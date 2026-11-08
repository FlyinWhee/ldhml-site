// The stats site data refresh, from the admin (owner, 2026-10-30: "refresh the live stats site without running a script
// on my computer"). An admin's BROWSER reads NBHPA (shared/refresh.js, the same steps as npm run fetch:force); this
// Worker never does (Cloudflare is blocked there, rule 1). It checks the files strictly and commits them to the repo
// (GitHub API, the GITHUB_TOKEN secret); the push to main rebuilds GitHub Pages. Super admins only. Works in the demo
// (it writes the repo, never the demo database except its audit row).
//   GET  /api/admin/refresh/base            { configured, repo, branch, sha, raw, last }   (the commit the browser starts from)
//   POST /api/admin/refresh/publish         { base, files: { path: text } }  ->  { commit, url }
//   GET  /api/admin/refresh/status?sha=     { status, conclusion, url }       (the Pages build of that commit)
import { json, fail, readJson, now } from './http.js';
import { isSuper } from './admins.js';

const FILE = /^data\/([a-z0-9-]{1,20})\/(meta|teams|games|players|goalies|box)\.json$/;
const REGISTRY = 'registry/people.json';
const MAX_FILE = 2 * 1024 * 1024, MAX_BODY = 12 * 1024 * 1024, GAP_S = 120;   // a publish at most every 2 minutes

const repoOf = (env) => env.GITHUB_REPO || 'FlyinWhee/ldhml-site';
const branchOf = (env) => env.GITHUB_BRANCH || 'main';
async function gh(env, method, p, body) {
  const r = await fetch('https://api.github.com/repos/' + repoOf(env) + p, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ldhml-tools', ...(body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}
const rawUrl = (env, sha) => 'https://raw.githubusercontent.com/' + repoOf(env) + '/' + sha + '/';
async function rawJson(env, sha, p) {
  const r = await fetch(rawUrl(env, sha) + p, { headers: { 'User-Agent': 'ldhml-tools' } });
  return r.ok ? r.json() : null;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
/** The checks of one league file (rule 4: a bad answer never replaces good data). Returns a problem or null. */
function checkLeagueFile(slug, name, v) {
  if (name === 'meta') {
    if (!isObj(v) || v.slug !== slug || v.source !== 'admin.nbhpa.com' || !ISO.test(String(v.fetchedAt))) return 'meta';
    if (Math.abs(Date.now() - Date.parse(v.fetchedAt)) > 3600 * 1000) return 'meta.fetchedAt';
    return null;
  }
  if (name === 'box') return isObj(v) && isObj(v.games) && isObj(v.names) ? null : 'box';
  if (!Array.isArray(v) || !v.every(isObj)) return name;
  if (name === 'teams' && (v.length < 2 || v.some((t) => !t.id))) return 'teams';
  if (name === 'games' && (!v.length || v.some((g) => !g.id || !g.away || !g.home || !g.date))) return 'games';
  if (name === 'players' && !v.length) return 'players';
  return null;
}
/** Our person ids (registry/CLAUDE.md): never changed, never reused, never deleted; "next" only goes up. */
function checkRegistry(old, reg) {
  if (!isObj(reg) || !Array.isArray(reg.people) || !Number.isInteger(reg.next)) return 'registry';
  if (!old) return null;
  if (reg.next < old.next || reg.people.length < old.people.length) return 'registry.removed';
  const byId = new Map(reg.people.map((p) => [p && p.id, p]));
  if (byId.size !== reg.people.length) return 'registry.duplicate';
  for (const p of old.people) { const q = byId.get(p.id); if (!q || q.nid !== p.nid) return 'registry.changed:' + p.id; }
  const oldIds = new Set(old.people.map((p) => p.id));
  for (const p of reg.people) {
    if (oldIds.has(p.id)) continue;
    const n = /^L(\d{4,})$/.exec(String(p.id));
    if (!n || Number(n[1]) < old.next || Number(n[1]) >= reg.next || !p.nid) return 'registry.new:' + p.id;
  }
  return null;
}

export async function publishApi({ req, env, url, path, m, admin, audit }) {
  if (!path.startsWith('/refresh/')) return null;
  if (!isSuper(env, admin)) return fail(403, 'super_only');
  const configured = !!env.GITHUB_TOKEN;

  if (m === 'GET' && path === '/refresh/base') {
    const last = await env.DB.prepare(`SELECT a.at, a.detail, d.name FROM audit a LEFT JOIN admins d ON d.id = a.actor_id
      WHERE a.action = 'data.publish' ORDER BY a.at DESC LIMIT 1`).first();
    const lastOut = last ? { at: last.at, by: last.name || null, ...(JSON.parse(last.detail || '{}')) } : null;
    if (!configured) return json({ configured: false, repo: repoOf(env), branch: branchOf(env), last: lastOut });
    const ref = await gh(env, 'GET', '/git/ref/heads/' + branchOf(env));
    if (!ref.ok || !ref.data || !ref.data.object) return fail(502, 'github', { status: ref.status });
    const sha = ref.data.object.sha;
    return json({ configured: true, repo: repoOf(env), branch: branchOf(env), sha, raw: rawUrl(env, sha), last: lastOut });
  }

  if (m === 'GET' && path === '/refresh/status') {
    const sha = String(url.searchParams.get('sha') || '');
    if (!configured || !/^[0-9a-f]{40}$/.test(sha)) return fail(400, 'sha');
    const r = await gh(env, 'GET', '/actions/runs?head_sha=' + sha + '&per_page=5');
    const run = r.ok && r.data && (r.data.workflow_runs || []).find((x) => x.event === 'push') || null;
    return json(run ? { status: run.status, conclusion: run.conclusion, url: run.html_url } : { status: r.ok ? 'waiting' : 'unknown' });
  }

  if (m === 'POST' && path === '/refresh/publish') {
    if (!configured) return fail(409, 'not_configured');
    const last = await env.DB.prepare(`SELECT MAX(at) AS at FROM audit WHERE action = 'data.publish'`).first('at');
    if (last && now() - last < GAP_S) return fail(429, 'too_soon', { wait: GAP_S - (now() - last) });
    const b = await readJson(req, MAX_BODY);
    if (!b || !/^[0-9a-f]{40}$/.test(String(b.base)) || !isObj(b.files)) return fail(400, 'body');
    const cfg = await rawJson(env, b.base, 'leagues.json');
    if (!cfg || !Array.isArray(cfg.leagues)) return fail(502, 'github_leagues');
    const slugs = new Set(cfg.leagues.map((l) => l.slug));

    // which leagues, each with all its files; the registry if it changed
    const byLeague = {}, tree = [];
    for (const [p, text] of Object.entries(b.files)) {
      const f = FILE.exec(p);
      if (p !== REGISTRY && (!f || !slugs.has(f[1]))) return fail(400, 'path', { path: p });
      if (typeof text !== 'string' || text.length > MAX_FILE) return fail(400, 'file', { path: p });
      let v; try { v = JSON.parse(text); } catch { return fail(400, 'json', { path: p }); }
      if (p === REGISTRY) {
        const problem = checkRegistry(await rawJson(env, b.base, REGISTRY), v);
        if (problem) return fail(400, 'check', { path: p, problem });
      } else {
        const problem = checkLeagueFile(f[1], f[2], v);
        if (problem) return fail(400, 'check', { path: p, problem });
        (byLeague[f[1]] = byLeague[f[1]] || new Set()).add(f[2]);
      }
      tree.push({ path: p, mode: '100644', type: 'blob', content: text });
    }
    const leagues = Object.keys(byLeague);
    if (!leagues.length) return fail(400, 'no_league');
    for (const s of leagues) if (byLeague[s].size !== 6) return fail(400, 'incomplete', { league: s });

    // one commit on top of the commit the browser started from; main moved meanwhile = refused (run again)
    const base = await gh(env, 'GET', '/git/commits/' + b.base);
    if (!base.ok) return fail(502, 'github', { step: 'base', status: base.status });
    const t = await gh(env, 'POST', '/git/trees', { base_tree: base.data.tree.sha, tree });
    if (!t.ok) return fail(502, 'github', { step: 'tree', status: t.status });
    const msg = 'Refresh data cache (' + leagues.join(', ') + ')\n\nFrom the LDHML tools (admin, Données du site public): the steps of npm run fetch:force, run in the browser.';
    const c = await gh(env, 'POST', '/git/commits', { message: msg, tree: t.data.sha, parents: [b.base] });
    if (!c.ok) return fail(502, 'github', { step: 'commit', status: c.status });
    const r = await gh(env, 'PATCH', '/git/refs/heads/' + branchOf(env), { sha: c.data.sha, force: false });
    if (!r.ok) return r.status === 422 ? fail(409, 'moved') : fail(502, 'github', { step: 'ref', status: r.status });
    const commitUrl = 'https://github.com/' + repoOf(env) + '/commit/' + c.data.sha;
    await audit('data.publish', 'github:' + c.data.sha.slice(0, 7), { commit: c.data.sha, url: commitUrl, leagues, registry: REGISTRY in b.files });
    return json({ ok: true, commit: c.data.sha, url: commitUrl, leagues });
  }
  return fail(404, 'not_found');
}
