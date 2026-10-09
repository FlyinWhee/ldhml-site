// Home page test: one card per league, links go to /<slug>/, language toggle, next game nights.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
const calls = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/',
  beforeParse(win) { win.LDHML_NOW = '2026-10-09T10:00:00'; win.fetch = async (u) => { calls.push(String(u)); return { ok: false, status: 403 }; }; }
});
const w = dom.window, d = w.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(300);

const hub = JSON.parse(d.getElementById('hub-data').textContent);
assert.equal(d.querySelectorAll('.lcard').length, hub.leagues.length, 'one card per league');
for (const l of hub.leagues) {
  assert.ok(d.querySelector(`.lcard a[href="${l.slug}/"]`), `card links to ${l.slug}/`);
  assert.ok(d.querySelector(`.lcard[data-t="${l.theme}"]`), `card has its theme ${l.theme}`);
}
assert.equal(d.documentElement.lang, 'fr', 'French by default');
assert.ok(/Ligues/.test(d.getElementById('main').textContent));
const night = d.querySelector('.night');
assert.ok(night && night.querySelectorAll('li').length >= 1, 'next game nights listed');
assert.equal(d.querySelectorAll('#lgsel option').length, hub.leagues.length + 1, 'picker lists every league');
d.querySelector('[data-lang]').click(); await wait(20);
assert.equal(d.documentElement.lang, 'en');
assert.ok(/Leagues/.test(d.getElementById('main').textContent), 'English toggle works');
assert.ok(calls.every((u) => u.startsWith('https://admin.nbhpa.com/table_data.php')), 'home page only reads standings');
assert.ok(calls.length <= 2, 'home page stops after failed requests (' + calls.length + ' made)');
assert.ok(cfg.leagues.every((l) => hub.leagues.some((x) => x.slug === l.slug)), 'every configured league has data');
assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));
console.log(`Home page test passed: ${hub.leagues.length} leagues.`);
w.close(); process.exit(0);
