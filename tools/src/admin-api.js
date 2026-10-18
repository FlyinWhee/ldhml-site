// Admin API: /api/admin/...  Every route except sign-in needs an admin session. Every change writes an audit row.
import { json, fail, readJson, cleanEmail, cleanText, isLocal, now } from './http.js';
import { startLogin, verifyLogin, sessionUser, endSession, sessionCookie, clearCookie } from './auth.js';
import { sendCode } from './email.js';
import { rosterApi } from './roster-api.js';
import { replacementApi } from './replacements.js';
import { lineupApi } from './lineups.js';
import { isArchived, archiveOthers } from './seasons.js';
import { gamesApi, nbhpaPlan } from './games.js';

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
    // A new season is "upcoming" unless asked otherwise, or "active" when there is no active season yet (the first one).
    const hasLive = await env.DB.prepare("SELECT 1 FROM seasons WHERE status = 'active'").first();
    const status = ['upcoming', 'active', 'archived'].includes(body.status) ? body.status : hasLive ? 'upcoming' : 'active';
    if (!name || !seasonKey(name) || (nb !== null && !(Number.isInteger(nb) && nb > 0))) return fail(400, 'season');
    if (await env.DB.prepare('SELECT 1 FROM seasons WHERE key = ?').bind(seasonKey(name)).first()) return fail(409, 'season_exists');
    const r = await env.DB.prepare('INSERT INTO seasons (key, name, nbhpa_season_id, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(seasonKey(name), name, nb, status, now(), admin.id).run();
    if (status === 'active') await archiveOthers(env.DB, r.meta.last_row_id).run();   // one active season at a time
    await audit(env, admin, 'season.create', 'season:' + r.meta.last_row_id, { name, nbhpa_season_id: nb, status });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // Edit a season: name, NBHPA no., status. Making it active archives the active one (one active season at a time).
  let xs = path.match(/^\/seasons\/(\d+)$/);
  if (m === 'POST' && xs) {
    const id = Number(xs[1]), cur = await env.DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(id).first();
    if (!cur) return fail(404, 'season');
    const body = await readJson(req) || {};
    const name = cleanText(body.name, 60), nb = body.nbhpa_season_id === '' || body.nbhpa_season_id == null ? null : Number(body.nbhpa_season_id);
    const status = ['upcoming', 'active', 'archived'].includes(body.status) ? body.status : null;
    if (!name || !seasonKey(name) || !status || (nb !== null && !(Number.isInteger(nb) && nb > 0))) return fail(400, 'season');
    if (seasonKey(name) !== cur.key && await env.DB.prepare('SELECT 1 FROM seasons WHERE key = ? AND id <> ?').bind(seasonKey(name), id).first()) return fail(409, 'season_exists');
    const archived = status === 'active' && cur.status !== 'active'
      ? (await env.DB.prepare("SELECT id FROM seasons WHERE status = 'active' AND id <> ?").bind(id).all()).results.map((r) => r.id) : [];
    await env.DB.batch([
      ...(archived.length ? [archiveOthers(env.DB, id)] : []),
      env.DB.prepare('UPDATE seasons SET key = ?, name = ?, nbhpa_season_id = ?, status = ? WHERE id = ?').bind(seasonKey(name), name, nb, status, id)
    ]);
    await audit(env, admin, 'season.update', 'season:' + id, { name, nbhpa_season_id: nb, status, was: cur.status, archived });
    return json({ ok: true, archived });
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
  // One captain, everything the admins need (the captain page): the account, every access (all seasons, with the
  // history), their player profile in the tools (lists, salaries, teams), the replacements they declared, the log.
  if (m === 'GET' && x) {
    const id = Number(x[1]), DB = env.DB;
    const cap = await DB.prepare('SELECT id, email, name, person_id, created_at, last_login_at, disabled_at FROM captains WHERE id = ?').bind(id).first();
    if (!cap) return fail(404, 'captain');
    const { results: access } = await DB.prepare(`SELECT a.id, a.season_id, s.name AS season_name, s.status AS season_status, a.league, a.team_id, a.team_abb, a.team_name, a.team_ref,
        a.created_at, ga.name AS granted_by, a.revoked_at, ra.name AS revoked_by
      FROM captain_access a JOIN seasons s ON s.id = a.season_id LEFT JOIN admins ga ON ga.id = a.created_by LEFT JOIN admins ra ON ra.id = a.revoked_by
      WHERE a.captain_id = ? ORDER BY s.created_at DESC, (a.revoked_at IS NOT NULL), a.league, a.team_name`).bind(id).all();
    let person = null;
    if (cap.person_id) {
      const p = await DB.prepare('SELECT id, site_id, nid, name, sex, birth_year, birth_month FROM people WHERE site_id = ?').bind(cap.person_id).first();
      if (p) {
        const { results: lists } = await DB.prepare('SELECT sp.season_id, s.name AS season_name, sp.section, sp.salary_s, sp.salary_g FROM section_players sp JOIN seasons s ON s.id = sp.season_id WHERE sp.person_id = ? ORDER BY s.created_at DESC, sp.section').bind(p.id).all();
        const { results: rosters } = await DB.prepare(`SELECT r.season_id, r.league, r.pos, t.id AS team_id, t.abb, t.name AS team_name, t.nbhpa_team_id
          FROM rosters r JOIN teams t ON t.id = r.team_id WHERE r.person_id = ? AND r.removed_at IS NULL ORDER BY r.league`).bind(p.id).all();
        person = { ...p, lists, rosters };
      }
    }
    const { results: requests } = await DB.prepare(`SELECT q.id, q.season_id, q.league, q.status, q.game_date, q.game_time, q.created_at, t.abb, t.name AS team_name, t.nbhpa_team_id,
        (SELECT COUNT(*) FROM replacement_lines l WHERE l.replacement_id = q.id) AS lines
      FROM replacements q JOIN teams t ON t.id = q.team_id WHERE q.created_kind = 'captain' AND q.created_by = ? ORDER BY q.game_date DESC, q.id DESC LIMIT 30`).bind(id).all();
    const targets = ['captain:' + id, ...access.map((a) => 'access:' + a.id)];
    const { results: log } = await DB.prepare(`SELECT a.id, a.at, a.actor_kind, COALESCE(ad.name, c.name) AS actor_name, a.action, a.target FROM audit a
      LEFT JOIN admins ad ON a.actor_kind = 'admin' AND ad.id = a.actor_id LEFT JOIN captains c ON a.actor_kind = 'captain' AND c.id = a.actor_id
      WHERE a.target IN (${targets.map(() => '?').join(',')}) OR (a.actor_kind = 'captain' AND a.actor_id = ?) ORDER BY a.id DESC LIMIT 30`).bind(...targets, id).all();
    return json({ captain: cap, access, person, requests, log });
  }
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
      ...['replacements', 'games', 'captain_access', 'rosters', 'league_players', 'section_players', 'season_leagues', 'teams', 'seasons'].map((tb) =>
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
    if (await isArchived(env.DB, tm.season_id)) return fail(409, 'season_archived');
    if (await env.DB.prepare('SELECT 1 FROM captain_access WHERE captain_id = ? AND team_ref = ? AND revoked_at IS NULL').bind(cap.id, tm.id).first()) return fail(409, 'access_exists');
    const r = await env.DB.prepare('INSERT INTO captain_access (captain_id, season_id, league, team_id, team_abb, team_name, team_ref, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(cap.id, tm.season_id, tm.league, tm.nbhpa_team_id || '', tm.abb, tm.name, tm.id, now(), admin.id).run();
    await audit(env, admin, 'access.grant', 'captain:' + cap.id, { access: r.meta.last_row_id, season: tm.season_id, league: tm.league, team: tm.id });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  x = path.match(/^\/access\/(\d+)\/revoke$/);
  if (m === 'POST' && x) {
    const sa = await env.DB.prepare('SELECT season_id FROM captain_access WHERE id = ?').bind(Number(x[1])).first('season_id');
    if (sa && await isArchived(env.DB, sa)) return fail(409, 'season_archived');
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
  const gm = await gamesApi({ req, env, path, m, url, admin, audit: (action, target, detail) => audit(env, admin, action, target, detail), seasonData: () => seasonData(env, url) });
  if (gm) return gm;
  const lu = await lineupApi({ env, path, m, url, isAdmin: true, teamIds: async () => null, seasonData: () => seasonData(env, url) });
  if (lu) return lu;

  // ---- home dashboard: what needs the admins' attention this season (counts; the replacements come from /replacements) ----
  if (m === 'GET' && path === '/dashboard') {
    const sid = Number(url.searchParams.get('season')) || 0, DB = env.DB;
    const { results: missing } = await DB.prepare(`SELECT sp.section, COUNT(*) AS players, SUM(sp.salary_s IS NULL OR sp.salary_g IS NULL) AS no_salary,
        SUM(p.birth_year IS NULL) AS no_birth, SUM(p.nid IS NULL) AS no_nid
      FROM section_players sp JOIN people p ON p.id = sp.person_id WHERE sp.season_id = ? GROUP BY sp.section`).bind(sid).all();
    const { results: noCaptain } = await DB.prepare(`SELECT t.id, t.league, t.name, t.abb, t.nbhpa_team_id FROM teams t WHERE t.season_id = ?
      AND NOT EXISTS (SELECT 1 FROM captain_access a WHERE a.team_ref = t.id AND a.revoked_at IS NULL) ORDER BY t.league, t.name COLLATE NOCASE`).bind(sid).all();
    const teams = await DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE season_id = ?').bind(sid).first('n');
    // leagues with rules set (a row made only by the on/off switch does not count)
    const { results: rules } = await DB.prepare(`SELECT league FROM season_leagues WHERE season_id = ? AND (salary_cap IS NOT NULL OR min_age_m IS NOT NULL
      OR min_age_f IS NOT NULL OR min_age_g IS NOT NULL OR notes IS NOT NULL)`).bind(sid).all();
    const neverIn = await DB.prepare(`SELECT COUNT(*) AS n FROM captains c WHERE c.disabled_at IS NULL AND c.last_login_at IS NULL
      AND EXISTS (SELECT 1 FROM captain_access a WHERE a.captain_id = c.id AND a.season_id = ? AND a.revoked_at IS NULL)`).bind(sid).first('n');
    // the next game night of each league (our schedule), and what an NBHPA import would bring
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const { results: nights } = await DB.prepare(`SELECT g.league, g.date, COUNT(*) AS games FROM games g WHERE g.season_id = ? AND g.cancelled = 0
      AND g.date = (SELECT MIN(x.date) FROM games x WHERE x.season_id = g.season_id AND x.league = g.league AND x.cancelled = 0 AND x.date >= ?) GROUP BY g.league, g.date ORDER BY g.date`).bind(sid, today).all();
    const gamesN = await DB.prepare('SELECT COUNT(*) AS n FROM games WHERE season_id = ?').bind(sid).first('n');
    const season = await DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(sid).first();
    const plan = await nbhpaPlan(DB, await seasonData(env, url), season, null);
    return json({ missing, noCaptain, teams, rulesLeagues: rules.map((r) => r.league), captainsNeverIn: neverIn, nights, games: gamesN,
      nbhpa: plan ? { add: plan.add.length, update: plan.update.length } : null });
  }

  // ---- audit (read) ----
  if (m === 'GET' && path === '/audit') {
    const { results } = await env.DB.prepare(`SELECT a.id, a.at, a.actor_kind, a.actor_id, COALESCE(ad.name, c.name) AS actor_name, a.action, a.target, a.detail FROM audit a
      LEFT JOIN admins ad ON a.actor_kind = 'admin' AND ad.id = a.actor_id LEFT JOIN captains c ON a.actor_kind = 'captain' AND c.id = a.actor_id ORDER BY a.id DESC LIMIT 100`).all();
    return json({ audit: results });
  }
  return fail(404, 'not_found');
}
