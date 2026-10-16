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

// ---- access per season and team ----
const lg = season.leagues[0], team = lg.teams[0];
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, season_id: seasonId, league: lg.slug, team_id: team.id } });
assert.equal(r.status, 201); const accId = r.data.id;
assert.equal((await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, season_id: seasonId, league: lg.slug, team_id: team.id } })).status, 409, 'same access twice');
assert.equal((await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, season_id: seasonId, league: lg.slug, team_id: '999999999' } })).status, 400, 'unknown team');
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, season_id: futureId, league: lg.slug, team_id: team.id } });
assert.equal(r.data.error, 'no_season_data', 'a season without team data cannot get team access');
r = await call('/api/admin/captains', { cookie });
const cap = r.data.captains.find((c) => c.id === capId);
assert.equal(cap.email, 'marco@example.test'); assert.equal(cap.access.length, 1);
assert.deepEqual([cap.access[0].season_id, cap.access[0].league, cap.access[0].team_id, cap.access[0].team_abb], [seasonId, lg.slug, team.id, team.abb]);
assert.equal((await call('/api/admin/access/' + accId + '/revoke', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal((await call('/api/admin/access/' + accId + '/revoke', { method: 'POST', cookie, body: {} })).status, 404, 'revoked once');
r = await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: capId, season_id: seasonId, league: lg.slug, team_id: team.id } });
assert.equal(r.status, 201, 'access can be given again after a revoke (history stays)');
assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM captain_access WHERE captain_id = ?').bind(capId).first('n')), 2);

// disable a captain: their sessions end
await DB.prepare("INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES ('x', 'captain', ?, 0, 9999999999)").bind(capId).run();
assert.equal((await call('/api/admin/captains/' + capId + '/disable', { method: 'POST', cookie, body: {} })).status, 200);
assert.equal(await DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE kind = 'captain' AND user_id = ?").bind(capId).first('n'), 0);
assert.equal((await call('/api/admin/captains/' + capId + '/enable', { method: 'POST', cookie, body: {} })).status, 200);

// ---- full delete of a captain: account, access (every season), sessions; audit keeps the actions without personal details ----
r = await call('/api/admin/captains', { method: 'POST', cookie, body: { name: 'Test Record', email: 'test-record@example.test', person_id: 'L0001' } });
const delId = r.data.id;
await call('/api/admin/access', { method: 'POST', cookie, body: { captain_id: delId, season_id: seasonId, league: lg.slug, team_id: lg.teams[1].id } });
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
assert.ok(r.data.audit.every((a) => a.actor_name === 'Boss'), 'audit names the admin');

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
assert.ok(d.querySelector('#f-cap'), 'captains tab');
d.querySelector('#f-cap [name=name]').value = 'Nouvelle Capitaine';
d.querySelector('#f-cap [name=email]').value = 'cap2@example.test';
await submit('#f-cap');
const row = [...d.querySelectorAll('.ad-tbl tbody tr')].find((tr) => tr.textContent.includes('Nouvelle Capitaine'));
assert.ok(row, 'new captain is listed');
const grant = row.querySelector('[data-grant]');
grant.elements.league.value = lg.slug; grant.elements.league.dispatchEvent(new w.Event('change', { bubbles: true }));
assert.ok(!grant.elements.team.disabled && grant.elements.team.options.length === lg.teams.length + 1, 'team list follows the league');
grant.elements.team.value = team.id;
grant.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(80);
const row2 = [...d.querySelectorAll('.ad-tbl tbody tr')].find((tr) => tr.textContent.includes('Nouvelle Capitaine'));
assert.ok(row2.querySelector('.lgb .lgb-l') && row2.querySelector(`.lgb .abbs a[href$="#team-${team.id}"]`), 'access shown as a league badge with the team chip, linked to the stats site');
row2.querySelector('[data-delete-cap]').click(); await wait(80);
assert.ok(![...d.querySelectorAll('.ad-tbl tbody tr')].some((tr) => tr.textContent.includes('Nouvelle Capitaine')), 'Delete removes the captain from the list');
w.location.hash = '#audit'; await wait(80);
assert.ok(/access\.grant/.test(d.getElementById('main').textContent), 'log tab lists the grant');
d.querySelector('[data-act="logout"]').click(); await wait(80);
assert.ok(d.querySelector('#f-email'), 'signed out');
assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));

console.log = quiet;
console.log('Tools test passed: sign-in security, sessions, seasons, captains, access per season, audit, admin page.');
process.exit(0);
