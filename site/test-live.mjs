// Live mode test: load the built page in jsdom with a fake clock and a fake league server.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'dist/retro/index.html'), 'utf8');
const data = JSON.parse(await readFile(path.join(root, 'data/retro/games.json'), 'utf8'));
const nextGame = data.find((g) => g.as == null && !g.cancelled);
const sameDay = data.filter((g) => g.date === nextGame.date);
const gid = nextGame.id;

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));

// Fake server. It records every request so the test can check how polite the page is.
const calls = [];
let phase = 'live';
const liveJson = (o) => JSON.stringify({ status: 'live', period_id: '1', period_name: '2', game_clock: '08:41', goals_visitor: '3', goals_home: '2',
  penalties_home: [{ player_number: '17', penalty_time_remaining: '01:12' }], penalties_visitor: [], shots_home: '11', shots_visitor: '14',
  goalie_home: '1', goalie_name_home: '#30 - Gab Home', goalie_visitor: '2', goalie_name_visitor: '# - Vic Away', game_id: gid, ...o });
const fakeFetch = async (url, init = {}) => {
  const u = String(url).replace('https://admin.nbhpa.com', '');
  calls.push({ u, method: init.method || 'GET', at: Date.now() });
  const ok = (body, type = 'text') => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body });
  if (u.startsWith('/livegame_json/' + gid)) return ok(phase === 'live' ? liveJson({}) : liveJson({ status: 'over', period_name: '3', game_clock: '00:00' }));
  if (u.startsWith('/livegame_json/')) throw new TypeError('Failed to fetch');
  if (u.startsWith('/table_data.php')) return ok('{}');       // too few teams: the page must keep its data
  if (u.startsWith('/sites/site_schedule_include')) return ok('<html></html>'); // no rows: the page must keep its data
  if (u.startsWith('/sites/')) return ok('<html></html>');
  return { ok: false, status: 404 };
};

// 20 minutes before the first game of that night, Toronto time (UTC-4 or -5: use the same helper as the page)
const first = sameDay.map((g) => g.time).sort()[0];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/#live',
  beforeParse(w) {
    w.fetch = fakeFetch;
    const [hh, mm] = first.split(':').map(Number);
    // Montreal in this season is UTC-4 (EDT) until early November, UTC-5 after.
    const off = nextGame.date >= '2026-11-01' ? 5 : 4;
    const start = Date.UTC(+nextGame.date.slice(0, 4), +nextGame.date.slice(5, 7) - 1, +nextGame.date.slice(8, 10), hh + off, mm);
    w.__start = start;
    w.__now = start + 20 * 60000; // 20 min after the first start: the game is on
    w.LDHML_NOW = () => w.__now;
    w.scrollTo = () => {};
  },
});
const w = dom.window;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(50);
const main = () => w.document.getElementById('main').textContent;

// 1. at first, before any poll, the page shows the snapshot and offers the live page
assert.ok(w.LDHML_TEST, 'live engine started');
await w.LDHML_TEST.tick();
assert.ok(calls.some((c) => c.u.startsWith('/livegame_json/' + gid)), 'the clock of the live game was read');
assert.ok(!calls.some((c) => c.u.startsWith('/livegame_json/') && !c.u.includes(gid) && sameDay.every((g) => !c.u.includes(g.id))), 'only games of today are read');
assert.ok(w.document.querySelector('.livebadge'), 'live badge shown');
assert.ok(w.document.querySelector('.navdot'), 'nav dot shown while a game is on');
assert.ok(w.document.querySelector('.lv.is-live .led'), 'live card has LED digits');
assert.match(main(), /08\.41|8.41/, 'period clock is shown');
assert.ok(w.document.querySelector('.pbx > b').textContent.includes('01:12'), 'penalty time left is shown');
assert.match(main(), /Gab Home/, 'goalie name cleaned from "#30 - " prefix');
assert.match(main(), /Vic Away/, 'goalie name cleaned from "# - " prefix');
assert.equal(w.LDHML_TEST.state.games[gid].lv.gv, 3);

// 2. the game page uses the live score
w.location.hash = '#game-' + gid; await wait(20);
assert.ok(w.document.querySelector('.gboard .led'), 'scoreboard on the game page');
assert.ok(w.document.querySelector('.gboard .livebadge'), 'badge on the game page');
assert.match(w.document.querySelector('.gb-shots').textContent, /14/, 'live shots shown');

// 3. bad answers from the server do not wipe the data
w.location.hash = '#standings'; await wait(20);
w.__now += 11 * 60000; await w.LDHML_TEST.tick();
assert.ok(w.document.querySelectorAll('.tbl tbody tr').length >= 2, 'standings kept after a bad answer');

// 4. politeness: no two requests closer than 300 ms, no request to staff endpoints
for (let i = 1; i < calls.length; i++) assert.ok(calls[i].at - calls[i - 1].at >= 300, `gap between requests ${i}: ${calls[i-1].u} -> ${calls[i].u} ${calls[i].at - calls[i - 1].at}`);
assert.ok(calls.every((c) => !/socket|admin\/|livegame\/|ajax/.test(c.u)), 'only public pages are requested');

// 5. the game ends: the clock says "over", the page shows the final score
phase = 'over';
w.LDHML_TEST.state.games[gid].next = 0;
await w.LDHML_TEST.tick();
assert.equal(w.LDHML_TEST.state.games[gid].state, 'over');
assert.ok(!w.document.querySelector('.livebadge'), 'badge gone when the game is over');
assert.ok(w.LDHML_TEST.state.settleAt > 0, 'a refresh of the stats is planned after the final');

// 6. no network: the status line says so
assert.equal(errors.length, 0, errors.join('\n'));
w.close();
console.log('Live mode test passed. Requests made: ' + calls.length);
process.exit(0);
