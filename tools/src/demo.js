// Demo mode (DEMO=1): the tools online read only, to walk the admins through them before the domain (no email sign-in
// yet). Every write is refused (403 demo_readonly) except signing in and out, the replacement checks (they write
// nothing) and the stats site refresh (src/publish.js: it writes the GitHub repo, the demo is the only tool online). Sign-in: the DEMO_KEY secret opens a demo admin account, or a captain picked from a list.
// Run it on its own Worker and its own demo database only (wrangler.jsonc, env "demo"; docs/tools.md).
import { json, fail, readJson, now } from './http.js';
import { newSession, sameSecret } from './auth.js';
import { liveSeason } from './seasons.js';

export const isDemo = (env) => env.DEMO === '1';
export const DEMO_ADMIN = 'demo@demo.invalid';
const OPEN = new Set(['/api/admin/demo-login', '/api/captain/demo-login', '/api/captain/demo-accounts', '/api/admin/logout', '/api/captain/logout',
  '/api/admin/replacements/check', '/api/captain/replacements/check',
  '/api/admin/refresh/publish']);   // the stats site refresh writes GitHub, not the demo database (owner, 2026-10-30)
/** True when the demo must refuse this request (a write). */
export const demoRefuses = (env, req, url) => isDemo(env) && req.method !== 'GET' && !OPEN.has(url.pathname);

async function keyOk(env, key) {
  return !!env.DEMO_KEY && env.DEMO_KEY.length >= 8 && typeof key === 'string' && key.length <= 200 && await sameSecret(env, key, env.DEMO_KEY);
}

/** POST /api/admin/demo-login { key }: a session for the demo admin (created the first time). { user, token } or a Response. */
export async function demoAdminLogin(req, env) {
  const b = await readJson(req) || {};
  if (!await keyOk(env, b.key)) return fail(401, 'demo_key');
  let a = await env.DB.prepare('SELECT id, email, name FROM admins WHERE email = ?').bind(DEMO_ADMIN).first();
  if (!a) {
    await env.DB.prepare('INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)').bind(DEMO_ADMIN, 'Admin démo', now()).run();
    a = await env.DB.prepare('SELECT id, email, name FROM admins WHERE email = ?').bind(DEMO_ADMIN).first();
  }
  return { user: a, token: await newSession(env, 'admin', a.id) };
}

/** The captains with a team in the live season (the demo's choice of accounts). */
async function demoCaptains(env) {
  const s = await liveSeason(env.DB);
  if (!s) return [];
  const { results } = await env.DB.prepare(`SELECT c.id, c.name, a.league, a.team_abb, a.team_name FROM captains c JOIN captain_access a ON a.captain_id = c.id
    WHERE a.season_id = ? AND a.revoked_at IS NULL AND c.disabled_at IS NULL ORDER BY a.league, a.team_name, c.name COLLATE NOCASE`).bind(s.id).all();
  const out = new Map();
  for (const r of results) { if (!out.has(r.id)) out.set(r.id, { id: r.id, name: r.name, teams: [] }); out.get(r.id).teams.push({ league: r.league, abb: r.team_abb, name: r.team_name }); }
  return [...out.values()];
}

/** GET /api/captain/demo-accounts?key=  and  POST /api/captain/demo-login { key, captain_id }. Returns a Response, { user, token } or null. */
export async function demoCaptainApi(req, env, url, path) {
  if (req.method === 'GET' && path === '/demo-accounts') {
    if (!await keyOk(env, url.searchParams.get('key'))) return fail(401, 'demo_key');
    return json({ captains: await demoCaptains(env) });
  }
  if (req.method === 'POST' && path === '/demo-login') {
    const b = await readJson(req) || {};
    if (!await keyOk(env, b.key)) return fail(401, 'demo_key');
    const c = (await demoCaptains(env)).find((x) => x.id === Number(b.captain_id));
    if (!c) return fail(400, 'captain');
    const user = await env.DB.prepare('SELECT id, email, name FROM captains WHERE id = ?').bind(c.id).first();
    return { user, token: await newSession(env, 'captain', user.id) };
  }
  return null;
}
