// Admin API: /api/admin/...  Every route except sign-in needs an admin session. Every change writes an audit row.
import { json, fail, readJson, cleanEmail, cleanText, isLocal, now } from './http.js';
import { startLogin, verifyLogin, sessionUser, endSession, sessionCookie, clearCookie } from './auth.js';
import { sendCode } from './email.js';
import { rosterApi } from './roster-api.js';
import { replacementApi } from './replacements.js';
import { lineupApi } from './lineups.js';

const audit = (env, admin, action, target, detail) =>
  env.DB.prepare('INSERT INTO audit (at, actor_kind, actor_id, action, target, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(now(), 'admin', admin.id, action, target, detail ? JSON.stringify(detail) : null).run();

// The stats snapshot of the current season (built by build.mjs into the Worker assets: /data/season.json).
async function seasonData(env, url) {
  const r = await env.ASSETS.fetch(new Request(new URL('/data/season.json', url.origin)));
  return r.ok ? r.json() : null;
}

const seasonKey = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function adminApi(req, env, url) {
  const path = url.pathname.replace(/^\/api\/admin/, '') || '/';
  const m = req.method;

  // ---- sign-in (no session needed) ----
  if (m === 'POST' && path === '/login/start') {
    const body = await readJson(req), email = body && cleanEmail(body.email);
    if (!email) return fail(400, 'email');
    const r = await startLogin(env, 'admin', email, req.headers.get('CF-Connecting-IP'));
    if (r.code) await sendCode(env, url, email, r.code);
    // Same answer whether the email is an admin or not. On a local dev server only, the code comes back for testing.
    return json({ ok: true, ...(env.DEV === '1' && isLocal(url) && r.code ? { devCode: r.code } : {}) });
  }
  if (m === 'POST' && path === '/login/verify') {
    const body = await readJson(req), email = body && cleanEmail(body.email);
    const r = email && await verifyLogin(env, 'admin', email, String(body.code || '').trim());
    if (!r) return fail(401, 'code');
    await audit(env, r.user, 'admin.login', 'admin:' + r.user.id);
    return json({ ok: true, admin: { email: r.user.email, name: r.user.name } }, 200, { 'Set-Cookie': sessionCookie('admin', r.token) });
  }

  // ---- everything else: an admin session ----
  const admin = await sessionUser(env, req, 'admin');
  if (!admin) return fail(401, 'session');

  if (m === 'POST' && path === '/logout') {
    await endSession(env, req, 'admin');
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('admin') });
  }
  if (m === 'GET' && path === '/me') return json({ admin: { email: admin.email, name: admin.name } });

  // ---- seasons ----
  if (m === 'GET' && path === '/seasons') {
    const { results } = await env.DB.prepare('SELECT id, key, name, nbhpa_season_id, status, created_at FROM seasons ORDER BY created_at DESC, id DESC').all();
    return json({ seasons: results });
  }
  if (m === 'POST' && path === '/seasons') {
    const body = await readJson(req) || {};
    const name = cleanText(body.name, 60), nb = body.nbhpa_season_id === '' || body.nbhpa_season_id == null ? null : Number(body.nbhpa_season_id);
    const status = ['upcoming', 'active', 'archived'].includes(body.status) ? body.status : 'active';
    if (!name || !seasonKey(name) || (nb !== null && !(Number.isInteger(nb) && nb > 0))) return fail(400, 'season');
    if (await env.DB.prepare('SELECT 1 FROM seasons WHERE key = ?').bind(seasonKey(name)).first()) return fail(409, 'season_exists');
    const r = await env.DB.prepare('INSERT INTO seasons (key, name, nbhpa_season_id, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(seasonKey(name), name, nb, status, now(), admin.id).run();
    await audit(env, admin, 'season.create', 'season:' + r.meta.last_row_id, { name, nbhpa_season_id: nb, status });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }

  // ---- captains ----
  if (m === 'GET' && path === '/captains') {
    const { results: caps } = await env.DB.prepare('SELECT id, email, name, person_id, created_at, last_login_at, disabled_at FROM captains ORDER BY name COLLATE NOCASE').all();
    const { results: acc } = await env.DB.prepare(`SELECT a.id, a.captain_id, a.season_id, s.name AS season_name, a.league, a.team_id, a.team_abb, a.team_name, a.team_ref, a.created_at
      FROM captain_access a JOIN seasons s ON s.id = a.season_id WHERE a.revoked_at IS NULL ORDER BY s.created_at DESC, a.league, a.team_name`).all();
    return json({ captains: caps.map((c) => ({ ...c, access: acc.filter((a) => a.captain_id === c.id) })) });
  }
  if (m === 'POST' && path === '/captains') {
    const body = await readJson(req) || {};
    const email = cleanEmail(body.email), name = cleanText(body.name, 80);
    const person = body.person_id ? String(body.person_id) : null;
    if (!email || !name || (person && !/^L\d{4,}$/.test(person))) return fail(400, 'captain');
    if (await env.DB.prepare('SELECT 1 FROM captains WHERE email = ?').bind(email).first()) return fail(409, 'captain_exists');
    const r = await env.DB.prepare('INSERT INTO captains (email, name, person_id, created_at, created_by) VALUES (?, ?, ?, ?, ?)').bind(email, name, person, now(), admin.id).run();
    await audit(env, admin, 'captain.create', 'captain:' + r.meta.last_row_id, { name, person_id: person });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // Edit a captain (typo in the name or email, player link). A new email ends the captain's sessions and pending codes:
  // a code sent to the old address must not sign in.
  let x = path.match(/^\/captains\/(\d+)$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    const cur = await env.DB.prepare('SELECT id, email, name, person_id FROM captains WHERE id = ?').bind(id).first();
    if (!cur) return fail(404, 'captain');
    const body = await readJson(req) || {};
    const email = cleanEmail(body.email), name = cleanText(body.name, 80);
    const person = body.person_id ? String(body.person_id) : null;
    if (!email || !name || (person && !/^L\d{4,}$/.test(person))) return fail(400, 'captain');
    if (email !== cur.email && await env.DB.prepare('SELECT 1 FROM captains WHERE email = ? AND id <> ?').bind(email, id).first()) return fail(409, 'captain_exists');
    const changed = ['name', 'email', 'person_id'].filter((k) => ({ name, email, person_id: person })[k] !== cur[k]);
    if (!changed.length) return json({ ok: true, changed });
    const writes = [env.DB.prepare('UPDATE captains SET email = ?, name = ?, person_id = ? WHERE id = ?').bind(email, name, person, id)];
    if (changed.includes('email')) writes.push(
      env.DB.prepare("DELETE FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(id),
      env.DB.prepare("DELETE FROM login_codes WHERE kind = 'captain' AND user_id = ?").bind(id));
    await env.DB.batch(writes);
    await audit(env, admin, 'captain.update', 'captain:' + id, { changed, name, person_id: person });
    return json({ ok: true, changed });
  }
  x = path.match(/^\/captains\/(\d+)\/(disable|enable)$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    const r = await env.DB.prepare('UPDATE captains SET disabled_at = ? WHERE id = ?').bind(x[2] === 'disable' ? now() : null, id).run();
    if (!r.meta.changes) return fail(404, 'captain');
    if (x[2] === 'disable') await env.DB.prepare("DELETE FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(id).run();
    await audit(env, admin, 'captain.' + x[2], 'captain:' + id);
    return json({ ok: true });
  }

  // Full delete of a captain (test records, and the right to deletion under Quebec's Law 25): the account, all its access
  // (every season), its sessions and codes. Audit rows about it stay (who did what, when) but lose their details (names).
  x = path.match(/^\/captains\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    if (!await env.DB.prepare('SELECT 1 FROM captains WHERE id = ?').bind(id).first()) return fail(404, 'captain');
    const accessIds = (await env.DB.prepare('SELECT id FROM captain_access WHERE captain_id = ?').bind(id).all()).results.map((r) => 'access:' + r.id);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(id),
      env.DB.prepare("DELETE FROM login_codes WHERE kind = 'captain' AND user_id = ?").bind(id),
      env.DB.prepare('DELETE FROM captain_access WHERE captain_id = ?').bind(id),
      env.DB.prepare("UPDATE replacements SET created_by = NULL WHERE created_kind = 'captain' AND created_by = ?").bind(id),
      env.DB.prepare('UPDATE audit SET detail = NULL WHERE target = ?').bind('captain:' + id),
      ...accessIds.map((a) => env.DB.prepare('UPDATE audit SET detail = NULL WHERE target = ?').bind(a)),
      env.DB.prepare('DELETE FROM captains WHERE id = ?').bind(id)
    ]);
    await audit(env, admin, 'captain.delete', 'captain:' + id);
    return json({ ok: true });
  }

  // Delete a season: refused while a captain has active access or a team has players in it (a real season is not wiped
  // by mistake). Everything else of the season goes with it (teams, player lists, rules, revoked access, past roster rows).
  x = path.match(/^\/seasons\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    if (!await env.DB.prepare('SELECT 1 FROM seasons WHERE id = ?').bind(id).first()) return fail(404, 'season');
    if (await env.DB.prepare('SELECT 1 FROM captain_access WHERE season_id = ? AND revoked_at IS NULL').bind(id).first() ||
        await env.DB.prepare('SELECT 1 FROM rosters WHERE season_id = ? AND removed_at IS NULL').bind(id).first()) return fail(409, 'season_in_use');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM replacement_lines WHERE replacement_id IN (SELECT id FROM replacements WHERE season_id = ?)').bind(id),
      ...['replacements', 'captain_access', 'rosters', 'section_players', 'league_rules', 'teams', 'seasons'].map((tb) =>
        env.DB.prepare(`DELETE FROM ${tb} WHERE ${tb === 'seasons' ? 'id' : 'season_id'} = ?`).bind(id))]);
    await audit(env, admin, 'season.delete', 'season:' + id);
    return json({ ok: true });
  }

  // ---- access: a captain manages one team of one league, for one season ----
  // The team is one of OUR teams of that season (teams table). team_id keeps the NBHPA id ('' when the team has none);
  // names are copied so the history reads well.
  if (m === 'POST' && path === '/access') {
    const body = await readJson(req) || {};
    const cap = await env.DB.prepare('SELECT id FROM captains WHERE id = ?').bind(Number(body.captain_id)).first();
    const tm = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(Number(body.team_ref)).first();
    if (!cap || !tm) return fail(400, 'access');
    if (await env.DB.prepare('SELECT 1 FROM captain_access WHERE captain_id = ? AND team_ref = ? AND revoked_at IS NULL').bind(cap.id, tm.id).first()) return fail(409, 'access_exists');
    const r = await env.DB.prepare('INSERT INTO captain_access (captain_id, season_id, league, team_id, team_abb, team_name, team_ref, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(cap.id, tm.season_id, tm.league, tm.nbhpa_team_id || '', tm.abb, tm.name, tm.id, now(), admin.id).run();
    await audit(env, admin, 'access.grant', 'captain:' + cap.id, { access: r.meta.last_row_id, season: tm.season_id, league: tm.league, team: tm.id });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  x = path.match(/^\/access\/(\d+)\/revoke$/);
  if (m === 'POST' && x) {
    const r = await env.DB.prepare('UPDATE captain_access SET revoked_at = ?, revoked_by = ? WHERE id = ? AND revoked_at IS NULL').bind(now(), admin.id, Number(x[1])).run();
    if (!r.meta.changes) return fail(404, 'access');
    await audit(env, admin, 'access.revoke', 'access:' + x[1]);
    return json({ ok: true });
  }

  // ---- roster layer: people, player lists, teams, rosters, league rules (roster-api.js) ----
  const roster = await rosterApi({ req, env, url, path, m, admin, audit: (action, target, detail) => audit(env, admin, action, target, detail), seasonData: () => seasonData(env, url) });
  if (roster) return roster;

  // ---- replacement requests: the builder, the queue, decisions (replacements.js; the captain area uses the same code) ----
  const rep = await replacementApi({ req, env, url, path, m, actor: { kind: 'admin', id: admin.id }, teamIds: async () => null,
    audit: (action, target, detail) => audit(env, admin, action, target, detail), seasonData: () => seasonData(env, url) });
  if (rep) return rep;
  const lu = await lineupApi({ env, path, m, url, isAdmin: true, teamIds: async () => null, seasonData: () => seasonData(env, url) });
  if (lu) return lu;

  // ---- audit (read) ----
  if (m === 'GET' && path === '/audit') {
    const { results } = await env.DB.prepare(`SELECT a.id, a.at, a.actor_kind, a.actor_id, COALESCE(ad.name, c.name) AS actor_name, a.action, a.target, a.detail FROM audit a
      LEFT JOIN admins ad ON a.actor_kind = 'admin' AND ad.id = a.actor_id LEFT JOIN captains c ON a.actor_kind = 'captain' AND c.id = a.actor_id ORDER BY a.id DESC LIMIT 100`).all();
    return json({ audit: results });
  }
  return fail(404, 'not_found');
}
