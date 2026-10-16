// Admin API: /api/admin/...  Every route except sign-in needs an admin session. Every change writes an audit row.
import { json, fail, readJson, cleanEmail, cleanText, isLocal, now } from './http.js';
import { startLogin, verifyLogin, sessionUser, endSession, sessionCookie, clearCookie } from './auth.js';
import { sendCode } from './email.js';

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
    const { results: acc } = await env.DB.prepare(`SELECT a.id, a.captain_id, a.season_id, s.name AS season_name, a.league, a.team_id, a.team_abb, a.team_name, a.created_at
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
  let x = path.match(/^\/captains\/(\d+)\/(disable|enable)$/);
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
      env.DB.prepare('UPDATE audit SET detail = NULL WHERE target = ?').bind('captain:' + id),
      ...accessIds.map((a) => env.DB.prepare('UPDATE audit SET detail = NULL WHERE target = ?').bind(a)),
      env.DB.prepare('DELETE FROM captains WHERE id = ?').bind(id)
    ]);
    await audit(env, admin, 'captain.delete', 'captain:' + id);
    return json({ ok: true });
  }

  // Delete a season: refused while a captain still has active access in it. Revoked access rows of the season go with it.
  x = path.match(/^\/seasons\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    if (!await env.DB.prepare('SELECT 1 FROM seasons WHERE id = ?').bind(id).first()) return fail(404, 'season');
    if (await env.DB.prepare('SELECT 1 FROM captain_access WHERE season_id = ? AND revoked_at IS NULL').bind(id).first()) return fail(409, 'season_in_use');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM captain_access WHERE season_id = ?').bind(id),
      env.DB.prepare('DELETE FROM seasons WHERE id = ?').bind(id)
    ]);
    await audit(env, admin, 'season.delete', 'season:' + id);
    return json({ ok: true });
  }

  // ---- access: a captain manages one team of one league, for one season ----
  if (m === 'POST' && path === '/access') {
    const body = await readJson(req) || {};
    const cap = await env.DB.prepare('SELECT id FROM captains WHERE id = ?').bind(Number(body.captain_id)).first();
    const season = await env.DB.prepare('SELECT id, nbhpa_season_id FROM seasons WHERE id = ?').bind(Number(body.season_id)).first();
    if (!cap || !season) return fail(400, 'access');
    // The team must exist in the stats data of THAT season.
    const data = await seasonData(env, url);
    if (!data || season.nbhpa_season_id !== data.seasonId) return fail(400, 'no_season_data');
    const lg = data.leagues.find((l) => l.slug === body.league), tm = lg && lg.teams.find((t) => t.id === String(body.team_id));
    if (!tm) return fail(400, 'team');
    if (await env.DB.prepare('SELECT 1 FROM captain_access WHERE captain_id = ? AND season_id = ? AND team_id = ? AND revoked_at IS NULL').bind(cap.id, season.id, tm.id).first()) return fail(409, 'access_exists');
    const r = await env.DB.prepare('INSERT INTO captain_access (captain_id, season_id, league, team_id, team_abb, team_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(cap.id, season.id, lg.slug, tm.id, tm.abb, tm.name, now(), admin.id).run();
    await audit(env, admin, 'access.grant', 'captain:' + cap.id, { access: r.meta.last_row_id, season: season.id, league: lg.slug, team: tm.id });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  x = path.match(/^\/access\/(\d+)\/revoke$/);
  if (m === 'POST' && x) {
    const r = await env.DB.prepare('UPDATE captain_access SET revoked_at = ?, revoked_by = ? WHERE id = ? AND revoked_at IS NULL').bind(now(), admin.id, Number(x[1])).run();
    if (!r.meta.changes) return fail(404, 'access');
    await audit(env, admin, 'access.revoke', 'access:' + x[1]);
    return json({ ok: true });
  }

  // ---- audit (read) ----
  if (m === 'GET' && path === '/audit') {
    const { results } = await env.DB.prepare('SELECT a.id, a.at, a.actor_kind, a.actor_id, ad.name AS actor_name, a.action, a.target, a.detail FROM audit a LEFT JOIN admins ad ON a.actor_kind = \'admin\' AND ad.id = a.actor_id ORDER BY a.id DESC LIMIT 100').all();
    return json({ audit: results });
  }
  return fail(404, 'not_found');
}
