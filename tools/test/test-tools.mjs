// Tools Worker tests: sign-in security, admin API, and the admin page in jsdom. No network, no Cloudflare account.
// Runs the real Worker (tools/src/worker.js) on an in-memory SQLite that behaves like D1 (test/d1-shim.mjs).
// Needs Node 22.5+ (node:sqlite) and a build (npm run build makes dist-tools/).
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import worker from '../src/worker.js';
import { makeD1, makeAssets } from './d1-shim.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGIN = 'http://localhost:8787';
const season = JSON.parse(await readFile(path.join(root, 'dist-tools/data/season.json'), 'utf8'));
const DB = await makeD1(path.join(root, 'tools/migrations'));
const env = { DB, ASSETS: makeAssets(path.join(root, 'dist-tools')), CODE_PEPPER: 'test-pepper-0123456789', DEV: '1', EMAIL_MODE: 'console' };
const quiet = console.log; console.log = () => {};   // the console email mode prints codes

const call = async (p, { method = 'GET', body, cookie, origin = ORIGIN, host = ORIGIN } = {}) => {
  const headers = { 'CF-Connecting-IP': '203.0.113.7' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (origin && method !== 'GET') headers.Origin = origin;
  const res = await worker.fetch(new Request(host + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }), env);
  let data = null; try { data = await res.clone().json(); } catch { /* not json */ }
  return { status: res.status, data, cookie: res.headers.get('Set-Cookie') };
};
const t0 = Math.floor(Date.now() / 1000);
await DB.prepare('INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)').bind('boss@example.test', 'Boss', t0).run();

// ---- sign-in ----
let r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'nobody@example.test' } });
assert.equal(r.status, 200); assert.equal(r.data.ok, true);
assert.equal(r.data.devCode, undefined, 'no code for an unknown email');
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'not-an-email' } });
assert.equal(r.status, 400);
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'BOSS@example.test ' } });
assert.equal(r.status, 200); assert.match(r.data.devCode, /^\d{6}$/, 'code for an admin (dev only), email is case-insensitive');
const code1 = r.data.devCode;
const wrong = code1 === '000000' ? '111111' : '000000';
for (let i = 0; i < 5; i++) assert.equal((await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: wrong } })).status, 401);
assert.equal((await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: code1 } })).status, 401, 'after 5 wrong tries the code is dead');
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'boss@example.test' } });
r = await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: r.data.devCode } });
assert.equal(r.status, 200);
assert.match(r.cookie, /^__Host-ldhml_admin=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+$/, 'safe session cookie');
const cookie = r.cookie.split(';')[0];
r = await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: r.data.devCode } });
assert.equal(r.status, 401, 'a code works once');

// stored data: no raw email, IP or code in login_codes; no raw token in sessions
const codesDump = JSON.stringify((await DB.prepare('SELECT * FROM login_codes').all()).results);
assert.ok(!/@|203\.0\.113/.test(codesDump), 'login_codes holds hashes only');
const token = cookie.split('=')[1];
assert.ok(!JSON.stringify((await DB.prepare('SELECT * FROM sessions').all()).results).includes(token), 'sessions hold a hash of the token, not the token');

// sessions
assert.equal((await call('/api/admin/me')).status, 401, 'no cookie: no session');
r = await call('/api/admin/me', { cookie });
assert.equal(r.status, 200); assert.equal(r.data.admin.email, 'boss@example.test');
assert.equal((await call('/api/admin/me', { cookie: '__Host-ldhml_captain=' + token })).status, 401, 'an admin token in the captain cookie does not open the admin area');

// writes from another site (CSRF) are refused
assert.equal((await call('/api/admin/seasons', { method: 'POST', body: { name: 'X' }, cookie, origin: 'https://evil.example' })).status, 403);
assert.equal((await call('/api/admin/seasons', { method: 'POST', body: { name: 'X' }, cookie, origin: null })).status, 403);

// rate limit: at most 5 codes per email per hour
for (let i = 0; i < 6; i++) r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'boss@example.test' } });
assert.equal(r.status, 200); assert.equal(r.data.devCode, undefined, 'too many codes: no new code, same answer');

// console email mode refuses to run on a real host (codes would go to logs)
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'other@example.test' }, host: 'https://tools.example.test', origin: 'https://tools.example.test' });
assert.equal(r.status, 200, 'unknown email: nothing is sent');
await DB.prepare('INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)').bind('ops@example.test', 'Ops', t0).run();
const logErr = console.error; console.error = () => {};   // the Worker logs this refusal; expected here
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'ops@example.test' }, host: 'https://tools.example.test', origin: 'https://tools.example.test' });
console.error = logErr;
assert.equal(r.status, 500, 'console mode is refused outside localhost');

// ---- seasons ----
r = await call('/api/admin/seasons', { method: 'POST', cookie, body: { name: season.seasonName, nbhpa_season_id: String(season.seasonId) } });
assert.equal(r.status, 201); const seasonId = r.data.id;
assert.equal((await call('/api/admin/seasons', { method: 'POST', cookie, body: { name: season.seasonName } })).status, 409, 'same season twice');
assert.equal((await call('/api/admin/seasons', { method: 'POST', cookie, body: { name: '', nbhpa_season_id: 'abc' } })).status, 400);
r = await call('/api/admin/seasons', { method: 'POST', cookie, body: { name: 'Hiver 2027', status: 'upcoming' } });
const futureId = r.data.id;
r = await call('/api/admin/seasons', { cookie });
assert.equal(r.data.seasons.length, 2); assert.equal(r.data.seasons.find((s) => s.id === seasonId).key, season.seasonName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));

// ---- captains ----
r = await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Marco Normandin', email: 'Marco@Example.test', person_id: 'L0137' } });
assert.equal(r.status, 201); const capId = r.data.id;
assert.equal((await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Twin', email: 'marco@example.test' } })).status, 409, 'one account per email');
assert.equal((await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'X', email: 'bad' } })).status, 400);
assert.equal((await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'X', email: 'x@example.test', person_id: 'DROP TABLE' } })).status, 400);

// ---- edit a captain (typo fix): a new email ends sessions and pending codes ----
r = await call('/api/admin/captains/' + capId, { method: 'POST', cookie, body: { name: 'Marco Normandin', email: 'marco@example.test', person_id: 'L0137' } });
assert.deepEqual(r.data.changed, [], 'no change: nothing written');
await DB.prepare("INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES ('edit', 'captain', ?, 0, 9999999999)").bind(capId).run();
await DB.prepare("INSERT INTO login_codes (kind, email_h, user_id, code_h, created_at, expires_at) VALUES ('captain', 'old', ?, 'x', 0, 9999999999)").bind(capId).run();
r = await call('/api/admin/captains/' + capId, { method: 'POST', cookie, body: { name: 'Marc Normandn', email: 'marc@example.test', person_id: 'L0137' } });
assert.equal(r.status, 200); assert.deepEqual(r.data.changed.sort(), ['email', 'name']);
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(capId).first('n'), 0, 'new email: sessions end');
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM login_codes WHERE kind = 'captain' AND user_id = ?").bind(capId).first('n'), 0, 'new email: a code sent to the old address is cancelled');
await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Other Captain', email: 'other-cap@example.test' } });
assert.equal((await call('/api/admin/captains/' + capId, { method: 'POST', cookie, body: { name: 'X', email: 'other-cap@example.test' } })).status, 409, 'cannot take the email of another captain');
assert.equal((await call('/api/admin/captains/' + capId, { method: 'POST', cookie, body: { name: '', email: 'bad' } })).status, 400);
assert.equal((await call('/api/admin/captains/99999', { method: 'POST', cookie, body: { name: 'X', email: 'x@example.test' } })).status, 404);
r = await call('/api/admin/captains/' + capId, { method: 'POST', cookie, body: { name: 'Marco Normandin', email: 'Marco@Example.test', person_id: 'L0137' } });
assert.deepEqual(r.data.changed.sort(), ['email', 'name'], 'fixed back');
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'captain.update'").first('n'), 2, 'edits are logged');

// ---- our teams: imported from the stats data for the current season; created by hand for any season ----
const lg = season.leagues[0], team = lg.teams[0];
r = await call('/api/admin/teams/import', { method: 'POST', cookie, body: { season_id: seasonId } });
assert.equal(r.data.added, season.leagues.reduce((a, l) => a + l.teams.length, 0), 'every team of the data is imported');
assert.equal((await call('/api/admin/teams/import', { method: 'POST', cookie, body: { season_id: seasonId } })).data.added, 0, 'import twice: nothing new');
assert.equal((await call('/api/admin/teams/import', { method: 'POST', cookie, body: { season_id: futureId } })).data.error, 'no_season_data', 'no stats data for a future season');
assert.equal((await call('/api/admin/teams/import', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro' } })).data.added, 0, 'import one league: nothing new');
assert.equal((await call('/api/admin/teams/import', { method: 'POST', cookie, body: { season_id: seasonId, league: 'nope' } })).status, 400, 'import: unknown league');
const teamsNow = (await call('/api/admin/teams?season=' + seasonId, { cookie })).data.teams;
const ref = (l, t) => teamsNow.find((x) => x.league === l.slug && x.nbhpa_team_id === t.id).id;
const teamRef = ref(lg, team);
r = await call('/api/admin/teams', { method: 'POST', cookie, body: { season_id: futureId, league: lg.slug, name: 'Équipe Future', abb: 'fut' } });
assert.equal(r.status, 201, 'a team can exist before NBHPA has it'); const futureTeam = r.data.id;

// ---- access per season and team (our team) ----
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, team_ref: teamRef } });
assert.equal(r.status, 201); const accId = r.data.id;
assert.equal((await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, team_ref: teamRef } })).status, 409, 'same access twice');
assert.equal((await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, team_ref: 999999 } })).status, 400, 'unknown team');
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, team_ref: futureTeam } });
assert.equal(r.status, 201, 'access to a team without NBHPA id (future season)');
await call('/api/admin/access/' + r.data.id + '/revoke', { method: 'POST', cookie, body: {} });
r = await call('/api/admin/captains', { cookie });
const cap = r.data.captains.find((c) => c.id === capId);
assert.equal(cap.email, 'marco@example.test'); assert.equal(cap.access.length, 1);
assert.equal(cap.access[0].team_ref, teamRef);
assert.deepEqual([cap.access[0].season_id, cap.access[0].league, cap.access[0].team_id, cap.access[0].team_abb], [seasonId, lg.slug, team.id, team.abb]);
assert.equal((await call('/api/admin/access/' + accId + '/revoke', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal((await call('/api/admin/access/' + accId + '/revoke', { method: 'POST', cookie, body: {} })).status, 404, 'revoked once');
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, team_ref: teamRef } });
assert.equal(r.status, 201, 'access can be given again after a revoke (history stays)');
assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM captain_access WHERE captain_id = ?').bind(capId).first('n')), 3);

// disable a captain: their sessions end
await DB.prepare("INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES ('x', 'captain', ?, 0, 9999999999)").bind(capId).run();
assert.equal((await call('/api/admin/captains/' + capId + '/disable', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(capId).first('n'), 0);
assert.equal((await call('/api/admin/captains/' + capId + '/enable', { method: 'POST', cookie, body: {} })).status, 200);

// ---- roster layer: the local seed from the stats data (safe to run twice) ----
const { seedSql } = await import('../scripts/seed-local.mjs');
const regJson = JSON.parse(await readFile(path.join(root, 'registry/people.json'), 'utf8'));
const count = async (tb) => DB.prepare(`SELECT COUNT(*) AS n FROM ${tb}`).first('n');
DB.raw.exec(seedSql(season, regJson));
const seeded = { people: await count('people'), lists: await count('section_players'), rosters: await count('rosters'), teams: await count('teams') };
assert.equal(seeded.people, season.people.length, 'one person per player of the data');
const secOf = Object.fromEntries(season.leagues.map((l) => [l.slug, l.section]));
assert.equal(seeded.lists, season.people.reduce((a, p) => a + new Set(Object.keys(p.lg).map((s) => secOf[s])).size, 0), 'each person on the list of each section they play in');
assert.equal(seeded.rosters, season.people.reduce((a, p) => a + Object.keys(p.lg).length, 0), 'each person on their main team, in each league');
DB.raw.exec(seedSql(season, regJson));
assert.deepEqual({ people: await count('people'), lists: await count('section_players'), rosters: await count('rosters'), teams: await count('teams') }, seeded, 'running the seed again changes nothing');
// demo salaries (local tests only): from the stats, 2 to 6 by 0.5, goalies 4, every Retro team under the 41 cap
{
  const { demoSalaries, demoSql } = await import('../scripts/seed-local.mjs');
  const stats = Object.fromEntries(await Promise.all(season.leagues.map(async (l) => [l.slug, { players: JSON.parse(await readFile(path.join(root, 'data', l.slug, 'players.json'), 'utf8')) }])));
  const sal = demoSalaries(season, regJson, stats), vals = [...sal.values()];
  assert.ok(vals.every((v) => v.s >= 2 && v.s <= 6 && v.s * 2 === Math.round(v.s * 2) && v.g === 4), 'demo salaries: 2 to 6 by 0.5, goalies 4');
  assert.ok(new Set(vals.map((v) => v.s)).size >= 5, 'demo salaries follow the stats (spread)');
  for (const t of season.leagues.find((l) => l.slug === 'retro').teams) {
    const pay = season.people.filter((p) => p.lg.retro && p.lg.retro[0] === t.abb).reduce((x, p) => x + sal.get('draft:' + p.id)[p.pos.retro === 'g' ? 'g' : 's'], 0);
    assert.ok(pay <= 41, 'demo: Retro team ' + t.abb + ' under the cap (' + pay + ')');
  }
  assert.ok(/UPDATE section_players SET salary_s = .* AND salary_s IS NULL AND salary_g IS NULL;/.test(demoSql(season, regJson, stats)), 'demo fills only empty salaries');
}
const marco = await DB.prepare("SELECT id FROM people WHERE site_id = 'L0137'").first('id');
const retro = season.leagues.find((l) => l.slug === 'retro');
const mainAbb = season.people.find((p) => p.id === 'L0137').lg.retro[0];

// people and the league player list
r = await call('/api/admin/people?season=' + seasonId + '&section=draft', { cookie });
assert.equal(r.data.players.length, await DB.prepare("SELECT COUNT(*) AS n FROM section_players WHERE section = 'draft'").first('n'));
const mp = r.data.players.find((p) => p.id === marco);
assert.ok(mp.rosters.some((x) => x.league === 'retro' && x.abb === mainAbb), 'Marco is on his main Retro team');
assert.ok(mp.rosters.every((x) => secOf[x.league] === 'draft'), 'the Draft list shows only rosters of Draft-section leagues');
const mpDraftPos = mp.rosters.find((x) => x.league === 'draft');
if (mpDraftPos) assert.equal(mpDraftPos.pos, season.people.find((p) => p.id === 'L0137').pos.draft === 'g' ? 'g' : 's', 'the seed keeps the position (a goalie stays a goalie)');
assert.equal((await call('/api/admin/people?season=' + seasonId + '&section=nope', { cookie })).status, 400);

// rosters: one team per league and season; removing keeps history
const tRef = (abb) => teamsNow.find((x) => x.league === 'retro' && x.abb === abb).id;
const otherAbb = retro.teams.find((x) => x.abb !== mainAbb).abb;
r = await call('/api/admin/rosters', { method: 'POST', cookie, body: { team_id: tRef(otherAbb), person_id: marco, pos: 's' } });
assert.equal(r.status, 409); assert.equal(r.data.error, 'already_on_roster'); assert.ok(r.data.team, 'says which team');
const marcoRow = await DB.prepare("SELECT id FROM rosters WHERE person_id = ? AND league = 'retro' AND removed_at IS NULL").bind(marco).first('id');
assert.equal((await call('/api/admin/rosters/' + marcoRow + '/remove', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal((await call('/api/admin/rosters', { method: 'POST', cookie, body: { team_id: tRef(otherAbb), person_id: marco, pos: 'g' } })).status, 201, 'moved to another team, as a goalie');
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM rosters WHERE person_id = ? AND league = 'retro'").bind(marco).first('n'), 2, 'the move keeps the history');
assert.equal((await call('/api/admin/rosters', { method: 'POST', cookie, body: { team_id: tRef(otherAbb), person_id: marco, pos: 'x' } })).status, 400);

// a new person (not in the NBHPA data yet), birth month and year, salaries per position
r = await call('/api/admin/people', { method: 'POST', cookie, body: { name: 'Nouvelle Joueuse', sex: 'f', birth_month: 3, birth_year: 1984 } });
assert.equal(r.status, 201); const nj = r.data.id;
assert.equal((await call('/api/admin/people', { method: 'POST', cookie, body: { name: 'X', birth_month: 3 } })).status, 400, 'a birth month needs a year');
assert.equal((await call('/api/admin/people', { method: 'POST', cookie, body: { name: 'X', site_id: 'L0137' } })).status, 409, 'site id taken');
assert.equal((await call('/api/admin/rosters', { method: 'POST', cookie, body: { team_id: tRef(mainAbb), person_id: nj, pos: 'g' } })).data.error, 'not_registered', 'must be on the section list first');
assert.equal((await call('/api/admin/section-players', { method: 'POST', cookie, body: { season_id: seasonId, section: 'draft', person_id: nj, salary_s: 4, salary_g: -1 } })).status, 400, 'salaries are positive');
assert.equal((await call('/api/admin/section-players', { method: 'POST', cookie, body: { season_id: seasonId, section: 'draft', person_id: nj, salary_s: 4, salary_g: 6.5 } })).status, 200);
assert.equal((await call('/api/admin/rosters', { method: 'POST', cookie, body: { team_id: tRef(mainAbb), person_id: nj, pos: 'g' } })).status, 201);
r = await call('/api/admin/teams?season=' + seasonId, { cookie });
const njRow = r.data.teams.find((x) => x.id === tRef(mainAbb)).roster.find((x) => x.person_id === nj);
assert.deepEqual([njRow.pos, njRow.salary_g, njRow.salary_s], ['g', 6.5, 4], 'the team view carries both salaries; the position decides which counts');
assert.equal((await call('/api/admin/section-players/' + (await DB.prepare("SELECT id FROM section_players WHERE person_id = ?").bind(nj).first('id')) + '/delete', { method: 'POST', cookie, body: {} })).data.error, 'on_roster');
assert.equal((await call('/api/admin/people/' + nj, { method: 'POST', cookie, body: { name: 'Nouvelle Joueuse', sex: 'f', birth_month: 4, birth_year: 1984 } })).status, 200, 'edit a person');

// league rules: one row per league and season (upsert)
assert.equal((await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: 25, min_age_m: 40, min_age_f: 35, min_age_g: 30, notes: 'Plafond et âge pour les remplaçants' } })).status, 200);
assert.equal((await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: 26, min_age_m: 40, min_age_f: 35, min_age_g: 30 } })).status, 200);
r = await call('/api/admin/rules?season=' + seasonId, { cookie });
assert.equal(r.data.rules.length, 1); assert.equal(r.data.rules[0].salary_cap, 26, 'the second save updates the same row');
assert.equal((await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: -5 } })).status, 400);
assert.equal((await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'nope', salary_cap: 5 } })).status, 400);

// ---- replacement requests: the builder data, each check, the captain flow and the admin flow ----
await DB.prepare("UPDATE section_players SET salary_s = 2, salary_g = 3 WHERE section = 'draft' AND season_id = ? AND salary_s IS NULL AND salary_g IS NULL").bind(seasonId).run();
const teamA = tRef(mainAbb), nbA = retro.teams.find((x) => x.abb === mainAbb).id;
const gamesA = retro.games.filter((g) => !g.cancelled && g.time && (g.away === nbA || g.home === nbA));
assert.ok(gamesA.length >= 2, 'the season export carries the schedule');
const gameA = gamesA[0], gameA2 = gamesA[1], oppNb = gameA.home === nbA ? gameA.away : gameA.home;
const oppTeam = teamsNow.find((x) => x.league === 'retro' && x.nbhpa_team_id === oppNb).id;
r = await call('/api/admin/replacements/builder?team=' + teamA, { cookie });
assert.equal(r.status, 200); assert.equal(r.data.games.length, retro.games.filter((g) => !g.cancelled && (g.away === nbA || g.home === nbA)).length, 'builder: the team’s games');
assert.equal(r.data.candidates, null, 'no candidates before a game is chosen');
const rosterA = r.data.roster, payrollA = rosterA.reduce((a, x) => a + x.salary, 0);
assert.ok(rosterA.every((x) => x.salary != null) && !('birth_year' in rosterA[0]), 'roster with salaries, no birth dates');
await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: payrollA, min_age_m: 40, min_age_f: 35, min_age_g: 30 } });
r = await call('/api/admin/replacements/builder?team=' + teamA + '&game=' + gameA.id, { cookie });
const cands = r.data.candidates, onA = new Set(rosterA.map((x) => x.person_id));
assert.ok(cands.length > 0 && cands.every((c) => !onA.has(c.id)), 'candidates: the section list without the team’s own players');
assert.ok(cands.every((c) => !('birth_year' in c)), 'candidates carry no birth dates (only the age result)');
const oppIds = new Set((await DB.prepare('SELECT person_id FROM rosters WHERE team_id = ? AND removed_at IS NULL').bind(oppTeam).all()).results.map((x) => x.person_id));
assert.ok(cands.filter((c) => oppIds.has(c.id)).every((c) => c.busy && c.busy.abb), 'the opponents are busy at that time');
const free = cands.filter((c) => !c.busy);
const absentA = rosterA.find((x) => x.pos === 's' && x.salary === 2).person_id;
await DB.prepare("UPDATE people SET sex = 'm' WHERE id = ?").bind(absentA).run();
const [sub1, sub2, sub3, sub4, sub5] = free.slice(0, 5).map((c) => c.id);
const setP = (id, sex, y, mo) => DB.prepare('UPDATE people SET sex = ?, birth_year = ?, birth_month = ? WHERE id = ?').bind(sex, y, mo, id).run();
const gy = Number(gameA.date.slice(0, 4)), gm = Number(gameA.date.slice(5, 7));
await setP(sub1, 'm', 1970, 1); await setP(sub2, 'm', 1970, 1); await setP(sub3, 'f', 2000, 1); await setP(sub4, 'm', gy - 40, gm); await setP(sub5, null, null, null);
await DB.prepare("UPDATE section_players SET salary_s = 5 WHERE person_id = ? AND section = 'draft'").bind(sub2).run();
const body = (sub, extra = {}) => ({ team_id: teamA, game_id: gameA.id, lines: [{ absent_id: absentA, sub_id: sub, sub_pos: 's' }], ...extra });
const chk = async (b, c = cookie, area = 'admin') => (await call('/api/' + area + '/replacements/check', { method: 'POST', cookie: c, body: b })).data;
const st = (res, k) => (res.checks.find((x) => x.k === k) || {}).s;
r = { data: await chk(body(sub1)) };
assert.equal(r.data.result, 'ok', 'a fitting replacement passes every check: ' + JSON.stringify(r.data.checks.filter((x) => x.s !== 'ok')));
assert.deepEqual(['absent', 'listed', 'sex', 'own', 'busy', 'age', 'salary', 'cap'].map((k) => st(r.data, k)), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], 'every check runs');
assert.equal(st(await chk(body(sub3)), 'sex'), 'fail', 'a replacement is always the same sex (every league)');
assert.equal(st(await chk(body(sub5)), 'sex'), 'warn', 'unknown sex: to check');
assert.deepEqual([r.data.payroll.before, r.data.payroll.after, r.data.payroll.cap], [payrollA, payrollA, payrollA], 'cap: payroll - absent + replacement');
let c2 = await chk(body(sub2));
assert.equal(st(c2, 'cap'), 'fail'); assert.equal(c2.payroll.after, payrollA + 3, 'over the cap by the salary difference');
assert.equal(st(await chk(body(sub3)), 'age'), 'fail', 'a woman under 35');
assert.equal(st(await chk(body(sub3, { lines: [{ absent_id: absentA, sub_id: sub3, sub_pos: 'g' }] })), 'age'), 'fail', 'under 30 as a goalie too');
assert.equal(st(await chk(body(sub4)), 'age'), 'warn', 'turns 40 in the month of the game: to check');
assert.equal(st(await chk(body(sub5)), 'age'), 'warn', 'no birth date: to check, never a silent pass');
assert.equal(st(await chk(body([...oppIds][0])), 'busy'), 'fail', 'an opponent plays at that time');
const outsider = (await call('/api/admin/people', { method: 'POST', cookie, body: { name: 'Pas Inscrit', sex: 'm', birth_year: 1960, birth_month: 1 } })).data.id;
assert.equal(st(await chk(body(outsider)), 'listed'), 'fail', 'not on the section list');
assert.equal(st(await chk(body(rosterA.find((x) => x.person_id !== absentA).person_id)), 'own'), 'fail', 'already on the team');
assert.equal(st(await chk({ ...body(sub2), lines: [{ absent_id: sub1, sub_id: sub2, sub_pos: 's' }] }), 'absent'), 'fail', 'the absent player must be on the roster');
assert.equal((await call('/api/admin/replacements/check', { method: 'POST', cookie, body: { ...body(sub1), lines: [] } })).status, 400, 'at least one line');
assert.equal((await call('/api/admin/replacements/check', { method: 'POST', cookie, body: { ...body(sub1), lines: [{ absent_id: absentA, sub_id: absentA, sub_pos: 's' }] } })).status, 400, 'each person once');
assert.equal((await call('/api/admin/replacements/check', { method: 'POST', cookie, body: body(sub1, { game_id: gamesA.length ? '999999999' : '' }) })).data.error, 'game', 'a game of this team only');
assert.equal(st(await chk(body(sub1, { game_id: undefined, game_date: '2026-12-01' })), 'busy'), undefined, 'a date without a time: no schedule check');
// a player who is not on the list ("joueur hors-ligue"): never passes, note required; sex required, age and NBHPA no. optional
const gb = (guest) => ({ team_id: teamA, game_id: gameA.id, lines: [{ absent_id: absentA, guest, sub_pos: 's' }] });
let gc = await chk(gb({ name: 'Invité Test', sex: 'm', age: 45, nid: '987654' }));
assert.deepEqual([gc.result, st(gc, 'guest'), st(gc, 'sex'), st(gc, 'age'), st(gc, 'salary'), st(gc, 'cap')], ['fail', 'fail', 'ok', 'ok', 'warn', 'warn'], 'a guest: not on the list (fails), sex and age from what was given, salary unknown');
assert.equal(st(gc, 'busy'), undefined, 'no schedule check for a guest (no team)');
assert.equal(st(await chk(gb({ name: 'Invité Test', sex: 'm' })), 'age'), 'warn', 'age not given: to check (only in a league with an age rule)');
assert.equal(st(await chk(gb({ name: 'Invitée', sex: 'f', age: 50 })), 'sex'), 'fail', 'a guest of the other sex fails');
assert.equal((await call('/api/admin/replacements/check', { method: 'POST', cookie, body: gb({ name: 'Sans Sexe', age: 45 }) })).status, 400, 'sex is required');
assert.equal((await call('/api/admin/replacements/check', { method: 'POST', cookie, body: gb({ name: 'X', sex: 'm', nid: 'abc' }) })).status, 400, 'NBHPA no.: digits');
assert.equal((await call('/api/admin/replacements', { method: 'POST', cookie, body: gb({ name: 'Invité Test', sex: 'm', age: 45 }) })).data.error, 'note_required');
r = await call('/api/admin/replacements', { method: 'POST', cookie, body: { ...gb({ name: 'Invité Test', sex: 'm', age: 45, nid: '987654' }), note: 'Personne d’autre de libre' } });
assert.equal(r.status, 201); const rqG = r.data.id;
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM people WHERE name = 'Invité Test'").first('n'), 0, 'a guest is never added to people');
const qG = (await call('/api/admin/replacements?season=' + seasonId, { cookie })).data.replacements.find((x) => x.id === rqG);
assert.deepEqual([qG.lines[0].sub_id, qG.lines[0].sub_name, qG.lines[0].guest], [null, 'Invité Test', { name: 'Invité Test', sex: 'm', age: 45, nid: '987654' }], 'the guest is on the line');
assert.equal((await call('/api/admin/replacements/' + rqG + '/decide', { method: 'POST', cookie, body: { decision: 'refuse', note: 'Test' } })).data.status, 'refused', 'decided like any request (checks run again)');
// admin: a failing request needs a note
assert.equal((await call('/api/admin/replacements', { method: 'POST', cookie, body: body(sub2) })).data.error, 'note_required', 'a failing request needs a note');
r = await call('/api/admin/replacements', { method: 'POST', cookie, body: body(sub2, { note: 'Le capitaine paie la différence' }) });
assert.equal(r.status, 201); assert.equal(r.data.status, 'pending'); const rqA = r.data.id;
// captain: own sign-in, own team only
r = await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Cap Retro', email: 'cap-retro@example.test' } });
const capRetro = r.data.id;
await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capRetro, team_ref: teamA } });
r = await call('/api/captain/login/start', { method: 'POST', body: { email: 'cap-retro@example.test' } });
assert.match(r.data.devCode, /^\d{6}$/);
assert.equal((await call('/api/captain/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: r.data.devCode } })).status, 401, 'an admin email is not a captain account');
r = await call('/api/captain/login/verify', { method: 'POST', body: { email: 'cap-retro@example.test', code: r.data.devCode } });
assert.match(r.cookie, /^__Host-ldhml_captain=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+$/, 'captain cookie');
const ccookie = r.cookie.split(';')[0], ctoken = ccookie.split('=')[1];
assert.equal((await call('/api/captain/me', { cookie: ccookie })).data.captain.name, 'Cap Retro');
assert.equal((await call('/api/admin/me', { cookie: '__Host-ldhml_admin=' + ctoken })).status, 401, 'a captain session never opens the admin area');
assert.equal((await call('/api/captain/me', { cookie: '__Host-ldhml_captain=' + token })).status, 401, 'an admin session never opens the captain area');
assert.equal((await call('/api/captain/replacements', { method: 'POST', cookie: ccookie, body: body(sub1), origin: 'https://evil.example' })).status, 403, 'captain writes: origin check');
r = await call('/api/captain/teams', { cookie: ccookie });
assert.equal(r.data.teams.length, 1); assert.equal(r.data.teams[0].id, teamA); assert.equal(r.data.teams[0].roster.length, rosterA.length); assert.equal(r.data.teams[0].rules.salary_cap, payrollA);
assert.equal((await call('/api/captain/replacements/builder?team=' + oppTeam, { cookie: ccookie })).status, 404, 'not their team');
assert.equal((await call('/api/captain/replacements', { method: 'POST', cookie: ccookie, body: { ...body(sub1), team_id: oppTeam } })).status, 404, 'cannot ask for another team');
assert.deepEqual(await chk(body(sub1), ccookie, 'captain'), await chk(body(sub1)), 'the captain gets the same checks as an admin');
r = await call('/api/captain/replacements', { method: 'POST', cookie: ccookie, body: body(sub1, { approve: true }) });
assert.equal(r.status, 201); assert.equal(r.data.status, 'pending', 'a captain cannot approve their own request'); const rqB = r.data.id;
assert.equal((await call('/api/captain/replacements/' + rqB + '/decide', { method: 'POST', cookie: ccookie, body: { decision: 'approve' } })).status, 404, 'captains do not decide');
assert.equal(st(await chk(body(sub3), ccookie, 'captain'), 'dup'), 'warn', 'another open request for this game names the same absent player');
r = await call('/api/captain/replacements', { cookie: ccookie });
assert.deepEqual(r.data.replacements.map((q) => q.id).sort(), [rqG, rqA, rqB].sort(), 'the captain sees every request of their team (also those made by the admins)');
assert.equal(r.data.replacements.find((q) => q.id === rqA).created_kind, 'admin');
// admin: the queue, decisions
assert.deepEqual((await call('/api/admin/replacements/pending?season=' + seasonId, { cookie })).data.counts, { retro: 2 });
r = await call('/api/admin/replacements?season=' + seasonId, { cookie });
const qB = r.data.replacements.find((q) => q.id === rqB);
assert.equal(qB.created_name, 'Cap Retro'); assert.equal(qB.lines[0].sub_id, sub1); assert.equal(qB.lines[0].sub_salary, 2); assert.equal(qB.result, 'warn', 'pending requests are checked again (now a duplicate of the other one)');
assert.equal((await call('/api/admin/replacements/' + rqB + '/decide', { method: 'POST', cookie, body: { decision: 'approve' } })).data.status, 'approved');
assert.equal((await call('/api/admin/replacements/' + rqB + '/decide', { method: 'POST', cookie, body: { decision: 'refuse' } })).data.error, 'not_pending', 'decided once');
assert.equal((await call('/api/admin/replacements/' + rqA + '/decide', { method: 'POST', cookie, body: { decision: 'maybe' } })).status, 400);
assert.equal((await call('/api/admin/replacements/' + rqA + '/decide', { method: 'POST', cookie, body: { decision: 'refuse', note: 'Plafond dépassé' } })).data.status, 'refused');
// the approved replacement is now busy at that time for the other team of the game
const oppAbsent = (await DB.prepare("SELECT person_id FROM rosters WHERE team_id = ? AND pos = 's' AND removed_at IS NULL").bind(oppTeam).first('person_id'));
c2 = await chk({ team_id: oppTeam, game_id: gameA.id, lines: [{ absent_id: oppAbsent, sub_id: sub1, sub_pos: 's' }] });
assert.deepEqual([st(c2, 'busy'), c2.checks.find((x) => x.k === 'busy').d.req], ['fail', rqB], 'already replacing at that time (another request)');
r = await call('/api/captain/replacements', { cookie: ccookie });
assert.equal(r.data.replacements.find((q) => q.id === rqA).decision_note, 'Plafond dépassé', 'the captain sees the decision and its note');
assert.equal((await call('/api/captain/replacements/' + rqB + '/cancel', { method: 'POST', cookie: ccookie, body: {} })).status, 200, 'the captain can cancel');
assert.equal(await DB.prepare('SELECT (SELECT COUNT(*) FROM replacements WHERE id = ?) + (SELECT COUNT(*) FROM replacement_lines WHERE replacement_id = ?) AS n').bind(rqB, rqB).first('n'), 0, 'a cancelled request is deleted, with its lines');
assert.equal((await call('/api/captain/replacements/' + rqB + '/cancel', { method: 'POST', cookie: ccookie, body: {} })).status, 404, 'gone');
assert.equal((await call('/api/admin/replacements/' + rqA + '/cancel', { method: 'POST', cookie, body: {} })).data.error, 'not_open', 'a refused request is not cancelled (it stays in the history)');
r = await call('/api/admin/replacements', { method: 'POST', cookie, body: { ...body(sub1), game_id: gameA2.id, approve: true, note: 'Fait pour le capitaine' } });
assert.equal(r.data.status, 'approved', 'an admin making the request for a captain can approve it at once');
assert.equal((await call('/api/admin/replacements?season=' + seasonId, { cookie })).data.replacements.find((q) => q.id === r.data.id).decided_name, 'Boss');
r = await call('/api/admin/audit', { cookie });
for (const a of ['replacement.create', 'replacement.approve', 'replacement.refuse', 'replacement.cancel']) assert.ok(r.data.audit.some((x) => x.action === a), 'audit has ' + a);
assert.ok(r.data.audit.some((x) => x.action === 'replacement.create' && x.actor_kind === 'captain' && x.actor_name === 'Cap Retro'), 'audit names the captain');
// the age rule can count in the game's year
await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: payrollA, min_age_m: 40, min_age_f: 35, min_age_g: 30, age_on: 'year' } });
assert.equal(st(await chk(body(sub4)), 'age'), 'ok', 'age_on year: turning 40 that year is enough');
assert.equal((await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', age_on: 'week' } })).status, 400);
await call('/api/admin/rules', { method: 'POST', cookie, body: { season_id: seasonId, league: 'retro', salary_cap: payrollA, min_age_m: 40, min_age_f: 35, min_age_g: 30 } });
// deleting a person takes their request lines (and a request left empty) with them
await call('/api/admin/section-players', { method: 'POST', cookie, body: { season_id: seasonId, section: 'draft', person_id: outsider, salary_s: 1 } });
r = await call('/api/admin/replacements', { method: 'POST', cookie, body: { ...body(outsider), game_id: gameA2.id, note: 'Test' } });
assert.equal(r.status, 201);
assert.equal((await call('/api/admin/people/' + outsider + '/delete', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal(await DB.prepare('SELECT COUNT(*) AS n FROM replacements WHERE id = ?').bind(r.data.id).first('n'), 0, 'person delete: their request goes');

// teams: a team with players cannot be deleted; a person delete takes their rows with them
assert.equal((await call('/api/admin/teams/' + tRef(mainAbb) + '/delete', { method: 'POST', cookie, body: {} })).data.error, 'team_in_use');
assert.equal((await call('/api/admin/people/' + nj + '/delete', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal(await DB.prepare('SELECT COUNT(*) AS n FROM rosters WHERE person_id = ?').bind(nj).first('n') + await DB.prepare('SELECT COUNT(*) AS n FROM section_players WHERE person_id = ?').bind(nj).first('n'), 0, 'person delete: lists and rosters gone');

// ---- full delete of a captain: account, access (every season), sessions; audit keeps the actions without personal details ----
r = await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Test Record', email: 'test-record@example.test', person_id: 'L0001' } });
const delId = r.data.id;
await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: delId, team_ref: ref(lg, lg.teams[1]) } });
await DB.prepare("INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES ('del', 'captain', ?, 0, 9999999999)").bind(delId).run();
assert.equal((await call('/api/admin/captains/' + delId + '/delete', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal(await DB.prepare('SELECT COUNT(*) AS n FROM captains WHERE id = ?').bind(delId).first('n'), 0, 'captain row gone');
assert.equal(await DB.prepare('SELECT COUNT(*) AS n FROM captain_access WHERE captain_id = ?').bind(delId).first('n'), 0, 'access rows gone');
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(delId).first('n'), 0, 'sessions gone');
const auditDump = JSON.stringify((await DB.prepare('SELECT * FROM audit').all()).results);
assert.ok(!auditDump.includes('Test Record') && !auditDump.includes('test-record@'), 'no personal data of a deleted captain left in the audit');
assert.ok((await DB.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'captain.delete' AND target = ?").bind('captain:' + delId).first('n')) === 1, 'the delete itself is logged');
assert.equal((await call('/api/admin/captains/' + delId + '/delete', { method: 'POST', cookie, body: {} })).status, 404, 'deleted once');
r = await call('/api/admin/captains', { cookie });
assert.ok(!r.data.captains.some((c) => c.id === delId), 'not listed any more');

// ---- delete a season: refused while active access exists, then allowed ----
assert.equal((await call('/api/admin/seasons/' + seasonId + '/delete', { method: 'POST', cookie, body: {} })).data.error, 'season_in_use');
assert.equal((await call('/api/admin/seasons/' + futureId + '/delete', { method: 'POST', cookie, body: {} })).status, 200, 'an unused season can be deleted');
assert.equal((await call('/api/admin/seasons', { cookie })).data.seasons.length, 1);

// ---- audit: every change is logged with its author ----
r = await call('/api/admin/audit', { cookie });
const actions = r.data.audit.map((a) => a.action);
for (const a of ['admin.login', 'season.create', 'captain.create', 'access.grant', 'access.revoke', 'captain.disable', 'captain.enable']) assert.ok(actions.includes(a), 'audit has ' + a);
assert.ok(r.data.audit.filter((a) => a.actor_kind === 'admin').every((a) => a.actor_name === 'Boss'), 'audit names the admin');
assert.ok(r.data.audit.some((a) => a.action === 'seed.local' && a.actor_kind === 'system'), 'the seed logs itself as the system');
for (const a of ['roster.add', 'roster.remove', 'person.create', 'person.update', 'person.delete', 'list.set', 'rules.set', 'team.import', 'team.create']) assert.ok(actions.includes(a), 'audit has ' + a);

// ---- sessions end: logout, expiry, disabled admin ----
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'ops@example.test' } });
const cookie2 = (await call('/api/admin/login/verify', { method: 'POST', body: { email: 'ops@example.test', code: r.data.devCode } })).cookie.split(';')[0];
assert.equal((await call('/api/admin/me', { cookie: cookie2 })).status, 200);
await DB.prepare("UPDATE admins SET disabled_at = 1 WHERE email = 'ops@example.test'").run();
assert.equal((await call('/api/admin/me', { cookie: cookie2 })).status, 401, 'a disabled admin is out at once');
r = await call('/api/admin/logout', { method: 'POST', cookie, body: {} });
assert.match(r.cookie, /Max-Age=0/);
assert.equal((await call('/api/admin/me', { cookie })).status, 401, 'logged out');
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'boss@example.test' } });
await DB.prepare('DELETE FROM login_codes').run();  // the rate limit above is still running; start again clean
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'boss@example.test' } });
const cookie3 = (await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: r.data.devCode } })).cookie.split(';')[0];
await DB.prepare('UPDATE sessions SET expires_at = 1').run();
assert.equal((await call('/api/admin/me', { cookie: cookie3 })).status, 401, 'an expired session is refused');

// ---- removing an admin (script): works with foreign keys on, even when the admin created seasons, captains and access ----
{
  const { removeAdminSql } = await import('../scripts/remove-admin.mjs');
  await DB.prepare("UPDATE admins SET disabled_at = NULL WHERE email = 'ops@example.test'").run();
  const opsId = await DB.prepare("SELECT id FROM admins WHERE email = 'ops@example.test'").first('id');
  await DB.prepare("INSERT INTO seasons (key, name, created_at, created_by) VALUES ('ops-season', 'Ops season', 0, ?)").bind(opsId).run();
  await DB.prepare("INSERT INTO captains (email, name, created_at, created_by) VALUES ('ops-cap@example.test', 'Ops cap', 0, ?)").bind(opsId).run();
  await DB.prepare("INSERT INTO people (name, created_at, created_by) VALUES ('Ops person', 0, ?)").bind(opsId).run();
  await DB.prepare('UPDATE replacements SET decided_by = ? WHERE id = (SELECT MIN(id) FROM replacements)').bind(opsId).run();
  DB.raw.exec(removeAdminSql('ops@example.test'));
  assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM admins WHERE email = 'ops@example.test'").first('n'), 0, 'admin removed');
  assert.equal(await DB.prepare("SELECT created_by FROM seasons WHERE key = 'ops-season'").first('created_by'), null, 'its rows keep existing, without the link');
  assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'admin.remove'").first('n'), 1, 'the removal is logged');
}

// ---- static pages and headers ----
r = await worker.fetch(new Request(ORIGIN + '/admin/'), env);
assert.equal(r.status, 200); assert.match(await r.text(), /admin\.js/);
assert.equal((await call('/api/nothing')).status, 404);

// ---- the admin page in a browser (jsdom), wired to the Worker ----
await DB.prepare('DELETE FROM login_codes').run();
const html = await readFile(path.join(root, 'dist-tools/admin/index.html'), 'utf8');
const scripts = { '/assets/look.js': await readFile(path.join(root, 'dist-tools/assets/look.js'), 'utf8'), '/admin/admin.js': await readFile(path.join(root, 'dist-tools/admin/admin.js'), 'utf8'),
  '/shared/builder.js': await readFile(path.join(root, 'dist-tools/shared/builder.js'), 'utf8') };
const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
const jar = {};
const dom = new JSDOM(html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>' + scripts[src] + '</script>'), {
  runScripts: 'dangerously', url: ORIGIN + '/admin/', virtualConsole: vc,
  beforeParse(w) {
    w.confirm = () => true;
    w.fetch = async (u, init = {}) => {
      const headers = { ...(init.headers || {}), Origin: ORIGIN, 'CF-Connecting-IP': '198.51.100.9' };
      if (jar.c) headers.Cookie = jar.c;
      const res = await worker.fetch(new Request(new URL(u, ORIGIN), { method: init.method || 'GET', headers, body: init.body }), env);
      const sc = res.headers.get('Set-Cookie'); if (sc) jar.c = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
      const text = await res.text();
      return { ok: res.ok, status: res.status, json: async () => JSON.parse(text) };
    };
  }
});
const w = dom.window, d = w.document;
const wait = (ms = 30) => new Promise((ok) => setTimeout(ok, ms));
const submit = async (sel) => { d.querySelector(sel).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80); };
await wait(100);
assert.ok(d.querySelector('#f-email'), 'page starts at the sign-in');
d.querySelector('#f-email [name=email]').value = 'boss@example.test'; await submit('#f-email');
const devHint = d.querySelector('.ad-dev').textContent.match(/\d{6}/)[0];
d.querySelector('#f-code [name=code]').value = devHint; await submit('#f-code');
assert.ok(/Boss|boss@example\.test/.test(d.getElementById('top').textContent), 'signed in');
// Teams tab (default): scoped to a league; each team card has its captains and roster; every add and edit in a modal
assert.ok(d.querySelector('.ad-scope [data-lg="' + lg.slug + '"][aria-pressed="true"]'), 'Teams tab first: scoped to the first league of the first section');
assert.ok(!d.querySelector('.nav a[href="#captains"]'), 'no separate Captains tab');
const ateams = await DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE season_id = ? AND league = ?').bind(seasonId, lg.slug).first('n');
assert.equal(d.querySelectorAll('.ad-team').length, ateams, 'one card per team of the league');
d.querySelector('[data-act="new-cap"]').click(); await wait(20);
assert.ok(d.querySelector('#modal .ad-modal #f-cap') && d.documentElement.classList.contains('ad-modal-open'), 'New captain opens a modal');
d.querySelector('#f-cap [name=name]').value = 'Nouvelle Capitaine'; d.querySelector('#f-cap [name=email]').value = 'cap2@example.test';
await submit('#f-cap');
assert.ok(!d.querySelector('#modal .ad-modal') && !d.documentElement.classList.contains('ad-modal-open'), 'the modal closes after saving');
const nocap = () => [...d.querySelectorAll('#ad-accounts .ad-cap')].find((li) => li.textContent.includes('Nouvelle Capitaine'));
assert.ok(nocap(), 'a new captain is in the captain accounts panel');
nocap().querySelector('[data-access-cap]').click(); await wait(20);
const af = d.querySelector('#f-access');
assert.ok(af && af.elements.team.options.length === ateams + 1, 'the access modal offers the teams of this league');
af.elements.team.value = String(teamRef);
await submit('#f-access');
const card = () => d.querySelector('.ad-team[data-team="' + teamRef + '"]');
assert.ok(card() && card().textContent.includes('Nouvelle Capitaine') && card().querySelector('a[href$="#team-' + team.id + '"]'), 'the captain is listed under the team (team linked to the stats site)');
card().querySelector('[data-access-team]').click(); await wait(20);
assert.ok(d.querySelector('#f-access select[name=captain]') && d.querySelector('#f-access input[name=team]').value === String(teamRef), 'team-side access modal: team fixed, captain to choose');
await submit('#f-access');
assert.ok(d.querySelector('#modal .ad-msg.ad-err'), 'no captain picked and no new one: an error in the modal');
d.querySelector('#f-access [name=name]').value = 'Capitaine Express'; d.querySelector('#f-access [name=email]').value = 'express@example.test';
await submit('#f-access');
assert.ok(card().textContent.includes('Capitaine Express') && !d.querySelector('#modal .ad-modal'), 'a new captain created from the team gets the access in the same step');
card().querySelector('[data-access-team]').click(); await wait(20);
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
assert.ok(!d.querySelector('#modal .ad-modal'), 'Escape closes the modal');
const line = () => [...d.querySelectorAll('#ad-accounts .ad-cap')].find((li) => li.textContent.includes('Nouvelle Capitaine'));
line().querySelector('[data-edit-cap]').click(); await wait(20);
const ef = d.querySelector('#modal [data-edit]');
assert.ok(ef && ef.elements.name.value === 'Nouvelle Capitaine', 'Edit opens a modal with the current values');
ef.elements.name.value = 'Nouvelle Capitaine Corrigée';
ef.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80);
assert.ok(line().textContent.includes('Corrigée') && !d.querySelector('#modal .ad-modal'), 'saved, modal closed');
line().querySelector('[data-edit-cap]').click(); await wait(20);
const ef2 = d.querySelector('#modal [data-edit]'); ef2.elements.email.value = 'other-cap@example.test';
ef2.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80);
assert.ok(d.querySelector('#modal .ad-msg.ad-err'), 'an error (email taken) shows in the modal, which stays open');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
const lg2 = season.leagues.filter((l) => l.section === lg.section)[1];
d.querySelector('[data-lg="' + lg2.slug + '"]').click(); await wait(20);
assert.equal(d.querySelectorAll('.ad-team').length, await DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE season_id = ? AND league = ?').bind(seasonId, lg2.slug).first('n'), 'another league: its own teams');
d.querySelector('[data-lg="' + lg.slug + '"]').click(); await wait(20);
line().querySelector('[data-delete-cap]').click(); await wait(80);
assert.ok(!line(), 'Delete removes the captain');
await DB.prepare('UPDATE people SET birth_year = 1970, birth_month = 1 WHERE birth_year IS NULL AND id <> ?').bind(sub5).run();   // eligible suggestions to pick from
// Replacements in the admin page: from a team card, the guided builder on its own page; then the queue and a decision
const cardA = () => d.querySelector('.ad-team[data-team="' + teamA + '"]');
const q = (sel) => d.querySelector('#ad-builder ' + sel);
const pickGame = async (doc, root, ev, id) => {
  const card = doc.querySelector(root + ' [data-b-game="' + id + '"]');
  if (card) card.click(); else { const sel = doc.querySelector(root + ' [data-b-slot]'); sel.value = id; sel.dispatchEvent(new ev('change', { bubbles: true })); }
  await wait(200);
};
cardA().querySelector('[data-sub-team]').click(); await wait(250);
assert.equal(w.location.hash, '#subs/new/' + teamA, 'the builder is a page of its own');
assert.ok(!d.querySelector('#modal .ad-modal') && q('.bd-steps') && q('.bd-sp.bd-now [data-b-step="1"]'), 'a guided page: four steps, the first one open');
assert.ok(q('.bd-gcard') || q('[data-b-slot]'), 'step 1: the next games as cards (others in a fold)');
assert.ok(!q('.bd-rlist') && q('[data-b-rules]'), 'the league rules: a link, not a block of text');
q('[data-b-rules]').click(); await wait(30);
assert.ok(q('.bd-rmodal .bd-rlist li') && /même sexe/.test(q('.bd-rlist').textContent), 'the rules in a small window (same sex, cap, ages)');
q('[data-b-rules-close]').click(); await wait(30);
assert.ok(!q('.bd-rmodal'), 'closed');
assert.ok(q('[data-b-step="3"]').disabled, 'later steps wait');
await pickGame(d, '#ad-builder', w.Event, gameA2.id);
assert.ok(q('.bd-sp.bd-now [data-b-step="2"]'), 'a game chosen: on to step 2');
q('[data-b-absent="' + absentA + '"]').click(); await wait(80);
assert.ok(q('[data-b-absent="' + absentA + '"]').classList.contains('bd-on'), 'tap a player: absent');
q('.bd-nav [data-b-step="3"]').click(); await wait(60);
assert.ok(q('[data-b-pick^="' + absentA + ':"]'), 'step 3: suggested replacements as cards');
assert.ok(q('.bd-cands').querySelectorAll('.bd-cand').length <= 6, 'a few suggestions, not the whole list');
assert.ok(!q('[data-b-pick="' + absentA + ':' + sub3 + '"]'), 'the other sex is never offered');
const sq3 = q('[data-b-q="' + absentA + '"]'); sq3.value = (await DB.prepare('SELECT name FROM people WHERE id = ?').bind(sub3).first('name')); sq3.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(40);
assert.ok(!q('[data-b-pick="' + absentA + ':' + sub3 + '"]'), 'not even in the search');
assert.ok(/hors-ligue/.test(q('.bd-line').textContent), 'no match: points to "Joueur hors-ligue"');
q('[data-b-guest-open="' + absentA + '"]').click(); await wait(30);
assert.ok(q('.bd-guest [data-b-gsex="' + absentA + ':m"][aria-pressed="true"]'), 'guest form: the sex of the absent player to start with');
q('[data-b-guest-save="' + absentA + '"]').click(); await wait(30);
assert.ok(q('.bd-guest .ad-msg.ad-err'), 'a name is required');
const gname = q('[data-b-gf="' + absentA + ':name"]'); gname.value = 'Invité Page'; gname.dispatchEvent(new w.Event('input', { bubbles: true }));
q('[data-b-guest-save="' + absentA + '"]').click(); await wait(150);
assert.ok(q('.bd-line.bd-gset') && /Invité Page/.test(q('.bd-gset').textContent) && q('.bd-gset .bd-gtag'), 'the guest is the replacement, marked off the list');
q('[data-b-unpick="' + absentA + '"]').click(); await wait(30);
const sq2 = q('[data-b-q="' + absentA + '"]'); sq2.value = ''; sq2.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(40);
q('.bd-cand.bd-ok').click(); await wait(200);
assert.ok(q('.bd-line.bd-set') && q('[data-b-unpick]'), 'chosen, can be changed');
q('.bd-nav [data-b-step="4"]').click(); await wait(150);
assert.ok(q('.bd-verdict .bd-res') && q('.bd-sum'), 'step 4: summary and the verdict');
assert.ok(q('[data-b-approve]').checked, 'admin builder: approve now, ticked by default');
const nb = q('[data-b-note]'); nb.value = 'Pour le capitaine'; nb.dispatchEvent(new w.Event('input', { bubbles: true }));
q('[data-b-approve]').checked = false; q('[data-b-approve]').dispatchEvent(new w.Event('change', { bubbles: true }));
q('[data-b-form]').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(300);
assert.equal(w.location.hash, '#teams', 'saved: back where the admin came from');
assert.ok(d.querySelector('#main .ad-msg.ad-ok'), 'with a message');
assert.ok(/\(1\)/.test(d.querySelector('.nav a[href="#subs"]').textContent), 'the Replacements tab counts the pending request');
assert.ok(d.querySelector('[data-lg="retro"] .ad-cnt'), 'the league button shows its pending count');
w.location.hash = '#subs'; await wait(200);
const pendingCards = d.querySelectorAll('.bd-req.bd-st-pending');
assert.equal(pendingCards.length, 1, 'Replacements tab: the pending queue of the league');
assert.ok(pendingCards[0].querySelector('.bd-lines li') && pendingCards[0].querySelector('details.bd-more'), 'a compact card: lines, the checks in a fold');
pendingCards[0].querySelector('[name=dnote]').value = 'OK pour ce match';
pendingCards[0].querySelector('[data-decide="approve"]').click(); await wait(200);
assert.equal(d.querySelectorAll('.bd-req.bd-st-pending').length, 0, 'approved: out of the pending queue');
d.querySelector('[data-sf="approved"]').click(); await wait(30);
assert.ok([...d.querySelectorAll('.bd-req.bd-st-approved')].some((c) => c.textContent.includes('OK pour ce match')), 'approved list, with the decision note');
d.querySelector('[data-act="sub-new"]').click(); await wait(200);
assert.ok(q('[data-b-team]'), 'from the tab: choose the team first');
w.location.hash = '#teams'; await wait(150);
// players: the section list, with a league filter
w.location.hash = '#players'; await wait(120);
const draftList = await DB.prepare("SELECT COUNT(*) AS n FROM section_players WHERE section = 'draft' AND season_id = ?").bind(seasonId).first('n');
const rowsN = () => d.querySelectorAll('.ad-tbl tbody tr').length;
assert.equal(rowsN(), draftList, 'Players tab lists the Draft section list');
const pq = d.getElementById('ad-pq'); pq.value = 'normandin'; pq.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(30);
assert.ok(rowsN() >= 1 && [...d.querySelectorAll('.ad-tbl tbody tr')].every((tr) => /normandin/i.test(tr.textContent)), 'name filter');
assert.ok(d.querySelector('.ad-tbl .lgb .abbs a'), 'rosters shown as league badges with team chips');
const pq2 = d.getElementById('ad-pq'); pq2.value = ''; pq2.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(30);
const inLg = await DB.prepare('SELECT COUNT(DISTINCT person_id) AS n FROM rosters WHERE season_id = ? AND league = ? AND removed_at IS NULL').bind(seasonId, lg.slug).first('n');
d.querySelector('[data-plf="in"]').click(); await wait(20);
assert.equal(rowsN(), inLg, 'filter: on a team in this league');
d.querySelector('[data-plf="free"]').click(); await wait(20);
assert.equal(rowsN(), draftList - inLg, 'filter: without a team in this league');
d.querySelector('[data-plf=""]').click(); await wait(20);
d.querySelector('[data-edit-person-btn]').click(); await wait(20);
assert.ok(d.querySelector('#modal [data-edit-person] [name=birth_year]'), 'person edit in a modal (birth month and year)');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
d.querySelector('[data-act="list-add"]').click(); await wait(20);
assert.ok(d.querySelector('#modal #f-addlist'), 'add an existing person: modal');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
d.querySelector('[data-sec="teams"]').click(); await wait(120);
assert.equal(rowsN(), await DB.prepare("SELECT COUNT(*) AS n FROM section_players WHERE section = 'teams' AND season_id = ?").bind(seasonId).first('n'), 'switch to the Équipes section list');
// teams: the chosen league only
w.location.hash = '#teams'; await wait(120);
const firstTeamsLg = season.leagues.filter((l) => l.section === 'teams')[0].slug;
assert.ok(d.querySelector('.ad-scope [data-lg="' + firstTeamsLg + '"][aria-pressed="true"]'), 'the section change carried over: first league of Équipes');
assert.equal(d.querySelectorAll('.ad-team').length, await DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE season_id = ? AND league = ?').bind(seasonId, firstTeamsLg).first('n'), 'one card per team of the league');
assert.ok([...d.querySelectorAll('.ad-payroll')].every((p) => /\d/.test(p.textContent)), 'each team shows its payroll');
assert.ok(!d.querySelector('#main [data-edit-team-btn], #main [data-del-team]'), 'team setup is not on the daily Teams tab');
// Configuration: seasons, then one card per league with its rules and team setup
w.location.hash = '#setup'; await wait(120);
assert.equal(d.querySelectorAll('[data-league-setup]').length, season.leagues.length, 'one setup card per league');
assert.equal(d.querySelectorAll('[data-rules]').length, season.leagues.length, 'each league card has its rules row');
const setupRetro = d.querySelector('[data-league-setup="retro"]');
assert.equal(setupRetro.querySelectorAll('[data-edit-team-btn]').length, retro.teams.length, 'the Retro card lists its teams (with edit)');
assert.ok(!setupRetro.querySelector('[data-import-league]'), 'no import button when every team is already there');
setupRetro.querySelector('[data-team-new]').click(); await wait(20);
assert.ok(d.querySelector('#modal [data-newteam="retro"]'), 'new team: modal for that league');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
d.querySelector('[data-act="season-new"]').click(); await wait(20);
assert.ok(d.querySelector('#modal #f-season'), 'new season: modal');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
w.location.hash = '#rules'; await wait(120);
assert.ok(d.querySelector('[data-league-setup]'), 'an old #rules link opens Configuration');
const rf = d.querySelector('[data-rules="retro"]');
assert.equal(rf.elements.salary_cap.value, String(payrollA), 'rules tab shows the saved row');
rf.elements.salary_cap.value = '30'; rf.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80);
assert.equal(await DB.prepare("SELECT salary_cap FROM league_rules WHERE league = 'retro' AND season_id = ?").bind(seasonId).first('salary_cap'), 30, 'rules saved from the page');
w.location.hash = '#audit'; await wait(80);
assert.ok(/access\.grant/.test(d.getElementById('main').textContent), 'log tab lists the grant');
d.querySelector('[data-act="logout"]').click(); await wait(80);
assert.ok(d.querySelector('#f-email'), 'signed out');
assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));

// ---- the captain page in a browser (jsdom): sign-in lands on the team; the switcher only with several teams ----
await DB.prepare('DELETE FROM login_codes').run();
r = await call('/api/admin/login/start', { method: 'POST', body: { email: 'boss@example.test' } });
const cookie3b = (await call('/api/admin/login/verify', { method: 'POST', body: { email: 'boss@example.test', code: r.data.devCode } })).cookie.split(';')[0];
const payNow = (await call('/api/admin/replacements/builder?team=' + teamA, { cookie: cookie3b })).data.roster.reduce((x, p) => x + (p.salary || 0), 0);
await call('/api/admin/rules', { method: 'POST', cookie: cookie3b, body: { season_id: seasonId, league: 'retro', salary_cap: payNow, min_age_m: 40, min_age_f: 35, min_age_g: 30 } });   // the team is at the cap
const cjar = {};   // one browser: the session cookie stays across page loads
const openCaptainPage = async () => {
  const chtml = await readFile(path.join(root, 'dist-tools/captain/index.html'), 'utf8');
  const cscripts = { '/assets/look.js': scripts['/assets/look.js'], '/shared/builder.js': await readFile(path.join(root, 'dist-tools/shared/builder.js'), 'utf8'), '/captain/captain.js': await readFile(path.join(root, 'dist-tools/captain/captain.js'), 'utf8') };
  const cdom = new JSDOM(chtml.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>' + cscripts[src] + '</script>'), {
    runScripts: 'dangerously', url: ORIGIN + '/captain/', virtualConsole: vc,
    beforeParse(cw) {
      cw.confirm = () => true;
      cw.fetch = async (u, init = {}) => {
        const headers = { ...(init.headers || {}), Origin: ORIGIN, 'CF-Connecting-IP': '198.51.100.10' };
        if (cjar.c) headers.Cookie = cjar.c;
        const res = await worker.fetch(new Request(new URL(u, ORIGIN), { method: init.method || 'GET', headers, body: init.body }), env);
        const sc = res.headers.get('Set-Cookie'); if (sc) cjar.c = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
        const text = await res.text();
        return { ok: res.ok, status: res.status, json: async () => JSON.parse(text) };
      };
    }
  });
  await wait(100);
  return cdom.window;
};
let cw = await openCaptainPage(), cd = cw.document;
const csubmit = async (sel) => { cd.querySelector(sel).dispatchEvent(new cw.Event('submit', { bubbles: true, cancelable: true })); await wait(100); };
assert.ok(cd.querySelector('#f-email'), 'captain page starts at the sign-in');
cd.querySelector('#f-email [name=email]').value = 'cap-retro@example.test'; await csubmit('#f-email');
cd.querySelector('#f-code [name=code]').value = cd.querySelector('.ad-dev').textContent.match(/\d{6}/)[0]; await csubmit('#f-code');
await wait(100);
assert.ok(cd.querySelector('.cp-team') && cd.querySelector('.cp-team').textContent.includes(retro.teams.find((x) => x.abb === mainAbb).name), 'signed in: straight on their team');
assert.ok(!cd.querySelector('.cp-switch'), 'one team: no team switcher, no sections, no setup');
assert.ok(cd.querySelector('[data-act="ask"]'), 'the main action is right there');
assert.equal(cd.querySelectorAll('.bd-req').length, (await DB.prepare('SELECT COUNT(*) AS n FROM replacements WHERE team_id = ?').bind(teamA).first('n')), 'their team’s requests (current and past)');
assert.ok(cd.querySelector('.cp-roster .ad-roster tr'), 'the roster with salaries');
cd.querySelector('[data-act="ask"]').click(); await wait(250);
const cq = (sel) => cd.querySelector('#cp-builder ' + sel);
assert.equal(cw.location.hash, '#demande', 'the request is a page of its own');
assert.ok(cq('.bd-steps') && !cq('[data-b-team]'), 'captain builder: their team, no team choice');
await pickGame(cd, '#cp-builder', cw.Event, gameA.id);
cq('[data-b-absent="' + absentA + '"]').click(); await wait(80);
cq('.bd-nav [data-b-step="3"]').click(); await wait(60);
const csq = cq('[data-b-q="' + absentA + '"]'); csq.value = (await DB.prepare('SELECT name FROM people WHERE id = ?').bind(sub2).first('name'));
csq.dispatchEvent(new cw.Event('input', { bubbles: true })); await wait(40);
const c2card = cq('[data-b-pick="' + absentA + ':' + sub2 + '"]');
assert.ok(c2card && c2card.classList.contains('bd-fail') && /plafond/.test(c2card.textContent), 'the search finds anyone of the same sex, with the reason they do not fit');
c2card.click(); await wait(200);
cq('.bd-nav [data-b-step="4"]').click(); await wait(150);
assert.ok(cq('.bd-verdict .bd-res.bd-fail') && cq('.bd-issues .bd-fail') && !cq('[data-b-approve]'), 'step 4: the failing check in words; no approve box for a captain');
cq('[data-b-form]').dispatchEvent(new cw.Event('submit', { bubbles: true, cancelable: true })); await wait(150);
assert.ok(cq('.ad-msg.ad-err'), 'failing without a note: refused, the builder stays');
const cnote = cq('[data-b-note]'); cnote.value = 'Seule disponible ce soir'; cnote.dispatchEvent(new cw.Event('input', { bubbles: true }));
cq('[data-b-form]').dispatchEvent(new cw.Event('submit', { bubbles: true, cancelable: true })); await wait(300);
assert.ok(cw.location.hash === '#equipe' && cd.querySelector('#main .ad-msg.ad-ok') && cd.querySelector('.cp-team'), 'sent: back on the team page, confirmation shown');
assert.ok(!cd.querySelector('.bd-req .bd-req-h .tcell'), 'compact cards on the team page (no team repeated)');
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM replacements WHERE created_kind = 'captain' AND status = 'pending' AND note = 'Seule disponible ce soir'").first('n'), 1, 'the request is in the queue');
// a second team: now the switcher shows
await call('/api/admin/access', { method: 'POST', cookie: cookie3b, body: { captain_id: capRetro, team_ref: oppTeam } });
cw.close();
cw = await openCaptainPage(); cd = cw.document; await wait(100);
assert.equal(cd.querySelectorAll('.cp-switch [data-team]').length, 2, 'two teams: a switcher');
cd.querySelector('.cp-switch [data-team="' + oppTeam + '"]').click(); await wait(30);
assert.ok(cd.querySelector('.cp-team').textContent.includes(retro.teams.find((x) => x.id === oppNb).name), 'switch to the other team');
cd.querySelector('[data-act="logout"]').click(); await wait(80);
assert.ok(cd.querySelector('#f-email'), 'captain signed out');
cw.close();
assert.deepEqual(errors, [], 'captain page errors:\n' + errors.join('\n'));

console.log = quiet;
console.log('Tools test passed: sign-in security, sessions, seasons, captains, access per season, replacements (checks, captain and admin), audit, admin and captain pages.');
process.exit(0);
