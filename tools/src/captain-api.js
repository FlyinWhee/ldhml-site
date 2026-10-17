// Captain API: /api/captain/...  Every route except sign-in needs a captain session (cookie __Host-ldhml_captain).
// A captain sees and acts for their own teams only: open access rows (captain_access, team_ref) in seasons not archived.
// Every change writes an audit row (actor_kind 'captain').
import { json, fail, readJson, cleanEmail, isLocal, now } from './http.js';
import { startLogin, verifyLogin, sessionUser, endSession, sessionCookie, clearCookie } from './auth.js';
import { sendCode } from './email.js';
import { replacementApi } from './replacements.js';
import { lineupApi } from './lineups.js';

const audit = (env, cap, action, target, detail) =>
  env.DB.prepare('INSERT INTO audit (at, actor_kind, actor_id, action, target, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(now(), 'captain', cap.id, action, target, detail ? JSON.stringify(detail) : null).run();

async function seasonData(env, url) {
  const r = await env.ASSETS.fetch(new Request(new URL('/data/season.json', url.origin)));
  return r.ok ? r.json() : null;
}

/** The captain's teams: open access, seasons not archived, newest season first. */
const myTeams = (env, cap) => env.DB.prepare(`SELECT t.id, t.season_id, t.league, t.name, t.abb, t.nbhpa_team_id, s.name AS season_name, s.status AS season_status
  FROM captain_access a JOIN teams t ON t.id = a.team_ref JOIN seasons s ON s.id = t.season_id
  WHERE a.captain_id = ? AND a.revoked_at IS NULL AND s.status <> 'archived' ORDER BY s.created_at DESC, s.id DESC, t.league, t.name COLLATE NOCASE`).bind(cap.id).all().then((r) => r.results);

export async function captainApi(req, env, url) {
  const path = url.pathname.replace(/^\/api\/captain/, '') || '/';
  const m = req.method;

  // ---- sign-in (no session needed): same rules as the admin sign-in ----
  if (m === 'POST' && path === '/login/start') {
    const body = await readJson(req), email = body && cleanEmail(body.email);
    if (!email) return fail(400, 'email');
    const r = await startLogin(env, 'captain', email, req.headers.get('CF-Connecting-IP'));
    if (r.code) await sendCode(env, url, email, r.code);
    return json({ ok: true, ...(env.DEV === '1' && isLocal(url) && r.code ? { devCode: r.code } : {}) });
  }
  if (m === 'POST' && path === '/login/verify') {
    const body = await readJson(req), email = body && cleanEmail(body.email);
    const r = email && await verifyLogin(env, 'captain', email, String(body.code || '').trim());
    if (!r) return fail(401, 'code');
    await audit(env, r.user, 'captain.login', 'captain:' + r.user.id);
    return json({ ok: true, captain: { name: r.user.name } }, 200, { 'Set-Cookie': sessionCookie('captain', r.token) });
  }

  const cap = await sessionUser(env, req, 'captain');
  if (!cap) return fail(401, 'session');

  if (m === 'POST' && path === '/logout') {
    await endSession(env, req, 'captain');
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('captain') });
  }
  if (m === 'GET' && path === '/me') return json({ captain: { name: cap.name, email: cap.email } });

  // My teams, each with its roster (salaries of its section's list) and its league rules.
  if (m === 'GET' && path === '/teams') {
    const data = await seasonData(env, url), teams = await myTeams(env, cap);
    const out = [];
    for (const t of teams) {
      const lg = data && data.leagues.find((l) => l.slug === t.league);
      const { results: roster } = await env.DB.prepare(`SELECT r.person_id, r.pos, p.name, p.site_id, p.sex, sp.salary_s, sp.salary_g FROM rosters r JOIN people p ON p.id = r.person_id
        LEFT JOIN section_players sp ON sp.season_id = r.season_id AND sp.section = ? AND sp.person_id = r.person_id
        WHERE r.team_id = ? AND r.removed_at IS NULL ORDER BY r.pos DESC, p.name COLLATE NOCASE`).bind(lg ? lg.section : '', t.id).all();
      const rules = await env.DB.prepare('SELECT salary_cap, min_age_m, min_age_f, min_age_g, age_on, notes FROM league_rules WHERE season_id = ? AND league = ?').bind(t.season_id, t.league).first();
      out.push({ ...t, rules, roster: roster.map((r) => ({ person_id: r.person_id, name: r.name, site_id: r.site_id, sex: r.sex, pos: r.pos, salary: (r.pos === 'g' ? r.salary_g : r.salary_s) ?? null })) });
    }
    return json({ teams: out });
  }

  const lu = await lineupApi({ env, path, m, url, isAdmin: false, teamIds: async () => (await myTeams(env, cap)).map((t) => t.id), seasonData: () => seasonData(env, url) });
  if (lu) return lu;
  const rep = await replacementApi({ req, env, url, path, m, actor: { kind: 'captain', id: cap.id },
    teamIds: async () => (await myTeams(env, cap)).map((t) => t.id),
    audit: (action, target, detail) => audit(env, cap, action, target, detail), seasonData: () => seasonData(env, url) });
  if (rep) return rep;
  return fail(404, 'not_found');
}
