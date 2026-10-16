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
const scripts = { '/assets/look.js': await readFile(path.join(root, 'dist-tools/assets/look.js'), 'utf8'), '/admin/admin.js': await readFile(path.join(root, 'dist-tools/admin/admin.js'), 'utf8') };
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
// captains: scoped to a league, team by team; every add and edit in a modal
assert.ok(d.querySelector('.ad-scope [data-lg="' + lg.slug + '"][aria-pressed="true"]'), 'captains tab: scoped to the first league of the first section');
const ateams = await DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE season_id = ? AND league = ?').bind(seasonId, lg.slug).first('n');
assert.equal(d.querySelectorAll('.ad-team').length, ateams, 'one card per team of the league');
d.querySelector('[data-act="new-cap"]').click(); await wait(20);
assert.ok(d.querySelector('#modal .ad-modal #f-cap') && d.documentElement.classList.contains('ad-modal-open'), 'New captain opens a modal');
d.querySelector('#f-cap [name=name]').value = 'Nouvelle Capitaine'; d.querySelector('#f-cap [name=email]').value = 'cap2@example.test';
await submit('#f-cap');
assert.ok(!d.querySelector('#modal .ad-modal') && !d.documentElement.classList.contains('ad-modal-open'), 'the modal closes after saving');
const nocap = () => [...d.querySelectorAll('#ad-nocap .ad-cap')].find((li) => li.textContent.includes('Nouvelle Capitaine'));
assert.ok(nocap(), 'a new captain without access is in the "without access" list');
nocap().querySelector('[data-access-cap]').click(); await wait(20);
const af = d.querySelector('#f-access');
assert.ok(af && af.elements.team.options.length === ateams + 1, 'the access modal offers the teams of this league');
af.elements.team.value = String(teamRef);
await submit('#f-access');
const card = () => d.querySelector('.ad-team[data-team="' + teamRef + '"]');
assert.ok(card() && card().textContent.includes('Nouvelle Capitaine') && card().querySelector('a[href$="#team-' + team.id + '"]'), 'the captain is listed under the team (team linked to the stats site)');
card().querySelector('[data-access-team]').click(); await wait(20);
assert.ok(d.querySelector('#f-access select[name=captain]') && d.querySelector('#f-access input[name=team]').value === String(teamRef), 'team-side access modal: team fixed, captain to choose');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
assert.ok(!d.querySelector('#modal .ad-modal'), 'Escape closes the modal');
const line = () => [...d.querySelectorAll('.ad-cap')].find((li) => li.textContent.includes('Nouvelle Capitaine'));
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
d.querySelector('[data-act="team-new"]').click(); await wait(20);
assert.ok(d.querySelector('#modal [data-newteam="' + firstTeamsLg + '"]'), 'new team: modal for this league');
d.querySelector('#modal [data-act="close-modal"]').click(); await wait(20);
// rules: the chosen league's row
d.querySelector('[data-sec="draft"]').click(); await wait(80);
w.location.hash = '#rules'; await wait(120);
assert.equal(d.querySelectorAll('[data-rules]').length, 1, 'rules: one row, the chosen league');
const rf = d.querySelector('[data-rules="retro"]');
assert.equal(rf.elements.salary_cap.value, '26', 'rules tab shows the saved row');
rf.elements.salary_cap.value = '30'; rf.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80);
assert.equal(await DB.prepare("SELECT salary_cap FROM league_rules WHERE league = 'retro' AND season_id = ?").bind(seasonId).first('salary_cap'), 30, 'rules saved from the page');
w.location.hash = '#audit'; await wait(80);
assert.ok(/access\.grant/.test(d.getElementById('main').textContent), 'log tab lists the grant');
d.querySelector('[data-act="logout"]').click(); await wait(80);
assert.ok(d.querySelector('#f-email'), 'signed out');
assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));

console.log = quiet;
console.log('Tools test passed: sign-in security, sessions, seasons, captains, access per season, audit, admin page.');
process.exit(0);
