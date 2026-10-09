// Smoke test: load the built page in jsdom, visit every route, follow every internal link.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] || 'retro';
const html = await readFile(path.join(root, 'dist', slug, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
vc.on('error', (e) => errors.push(String(e)));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' + slug + '/' });
const w = dom.window;
w.scrollTo = () => {};
const wait = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const go = async (hash) => { w.location.hash = hash; await wait(); };
const main = () => w.document.getElementById('main').textContent;
const hrefs = () => [...w.document.querySelectorAll('#app a[href^="#"]')].map((a) => a.getAttribute('href'));

await wait(50);
const data = JSON.parse(w.document.getElementById('league-data').textContent);

// 1. every top-level route renders something
const seen = new Set();
for (const h of ['#home', '#standings', '#schedule', '#players', '#goalies', '#leaders', '#live', '#teams']) {
  await go(h);
  assert.ok(main().length > 200, `${h} rendered too little`);
  hrefs().forEach((x) => seen.add(x));
}
// 2. every team and every person page renders
for (const t of data.teams) { await go('#team-' + t.id); assert.ok(main().toLowerCase().includes(t.name.toLowerCase()), `team page ${t.name}`); hrefs().forEach((x) => seen.add(x)); }
const ids = new Set([...data.players, ...data.goalies].map((p) => p.id));
for (const id of ids) {
  await go('#player-' + id);
  const name = [...data.players, ...data.goalies].find((p) => p.id === id).name;
  assert.ok(main().toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ' ')), `player page ${name}`);
  hrefs().forEach((x) => seen.add(x));
}
// 2b. every game page renders (played games show a box score)
for (const g of data.games) {
  await go('#game-' + g.id);
  assert.ok(main().length > 100, `game page ${g.id}`);
  if (data.box.games[g.id]) {
    assert.ok(w.document.querySelector('.gboard .led'), `scoreboard digits on game ${g.id}`);
    assert.ok(w.document.querySelectorAll('.boxes .tbl').length >= 2, `box score tables on game ${g.id}`);
  }
  hrefs().forEach((x) => seen.add(x));
}
// 3. every internal link found on any page points to a page that exists
const known = new Set(data.teams.map((t) => 'team-' + t.id));
data.games.forEach((g) => known.add('game-' + g.id));
ids.forEach((i) => known.add('player-' + i));
['home', 'standings', 'schedule', 'players', 'goalies', 'leaders', 'live', 'teams'].forEach((r) => known.add(r));
const broken = [...seen].filter((h) => !known.has(h.slice(1)));
assert.deepEqual(broken, [], 'broken internal links: ' + broken.join(', '));

// 4. checks that hold for every league
assert.equal(w.document.documentElement.getAttribute('data-league'), data.league.theme, 'theme attribute follows the league');
await go('#home');
assert.ok(w.document.getElementById('top').textContent.includes(data.league.short), 'brand shows the league name');
assert.ok(w.document.querySelectorAll('.sbc').length >= 1, 'scoreboard shows games');
const picker = [...w.document.querySelectorAll('#lgsel option')];
assert.equal(picker.length, data.registry.length + 1, 'picker lists the home page and every league');
assert.equal(picker.find((o) => o.selected).value, slug, 'picker shows the current league');
assert.ok(w.document.querySelector('#foot a[href="../"]'), 'footer links to the LDHML home page');
await go('#standings');
const lead = [...data.teams].sort((x, y) => x.pos - y.pos)[0];
assert.ok(w.document.querySelector('.tbl tbody tr').textContent.toLowerCase().includes(lead.name.toLowerCase()), 'standings start with the leader');
await go('#teams');
assert.equal(w.document.querySelectorAll('.tcard').length, data.teams.length, 'one card per team');
assert.ok(w.document.querySelector('.lede').textContent.includes(String(data.teams.length)), 'teams page says how many teams');
assert.ok(![...w.document.querySelectorAll('a')].some((a) => /cphjoliette/.test(a.href)), 'no link to the old site');

// 4b. names: no all-capital team or player name is left (acronyms of 1 to 3 letters and words without vowels are allowed)
const shown = [...w.document.querySelectorAll('.tbl tbody tr td:nth-child(2)')].map((x) => x.textContent);
await go('#teams');
const teamNames = [...w.document.querySelectorAll('.tcard-link')].map((x) => x.textContent);
for (const n of teamNames) assert.ok(!/^[A-ZÀ-Ý][A-ZÀ-Ý ]{3,}$/.test(n) || !/[AEIOUY]/.test(n.replace(/ /g, '')), 'team name still in capitals: ' + n);
// 4c. theme switch
await go('#home');
assert.equal(w.document.documentElement.getAttribute('data-league'), data.league.theme);
w.document.querySelector('[data-theme-toggle]').click(); await wait();
assert.equal(w.document.documentElement.getAttribute('data-league'), 'default', 'theme can be switched off');
assert.equal(w.document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed'), 'false');
w.document.querySelector('[data-theme-toggle]').click(); await wait();
assert.equal(w.document.documentElement.getAttribute('data-league'), data.league.theme, 'theme can be switched on again');

// 4d. goal tooltip on the timeline of a played game with goals
const gp = data.games.find((g) => data.box.games[g.id] && data.box.games[g.id].goals.length);
await go('#game-' + gp.id);
const goal = w.document.querySelector('.timeline g.goal');
assert.ok(goal && goal.getAttribute('data-tip-who'), 'timeline goals carry tooltip data');
goal.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true })); await wait();
const tip = w.document.querySelector('.tip');
assert.ok(tip && !tip.hidden && /\d/.test(tip.textContent) && tip.textContent.includes(goal.getAttribute('data-tip-who')), 'tooltip shows scorer and time');
goal.dispatchEvent(new w.MouseEvent('mouseout', { bubbles: true })); await wait();
assert.ok(w.document.querySelector('.tip').hidden, 'tooltip hides');

// 5. Retro-only checks (numbers from the supplied data)
if (slug === 'retro') {
await go('#home');
assert.ok(w.document.getElementById('band').textContent.includes('TOP'), 'scoreboard shows teams');
const finals = w.document.querySelectorAll('.sbc').length;
assert.equal(finals, 5, 'five games on the latest night');
await go('#standings');
const firstRow = w.document.querySelector('.tbl tbody tr').textContent;
assert.ok(/Ghostbusters/.test(firstRow), 'Ghostbusters lead the standings');
await go('#players');
const rows = w.document.querySelectorAll('.tbl tbody tr').length;
assert.equal(rows, data.players.length, 'all skaters listed');

// 5. interactions: sort, filter, language, search
w.document.querySelector('[data-sort="players|g|desc"]').click(); await wait();
assert.ok(/Karine Begin|Jean-Pascal/.test(w.document.querySelector('.tbl tbody tr').textContent), 'sort by goals works');
const q = w.document.getElementById('pq'); q.value = 'lévesque'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait();
assert.equal(w.document.querySelectorAll('.tbl tbody tr').length, 2, 'accent-insensitive name filter finds both Lévesques');
w.document.querySelector('[data-set="players.sex=f"]').click(); await wait();
assert.equal(w.document.querySelectorAll('.tbl tbody tr').length, 2, 'women filter keeps both');
const gs = w.document.getElementById('gs'); gs.value = 'gagnon'; gs.dispatchEvent(new w.Event('input', { bubbles: true })); await wait();
assert.ok(w.document.querySelector('.gs-item') && /Martin Gagnon/.test(w.document.querySelector('.gs-item').textContent), 'global search finds a player');
assert.ok(/Classement/.test(w.document.getElementById('top').textContent), 'French is the default language');
assert.equal(w.document.documentElement.lang, 'fr');
w.document.querySelector('[data-lang]').click(); await wait();
assert.ok(/Standings/.test(w.document.getElementById('top').textContent), 'language toggle switches nav to English');
assert.equal(w.document.documentElement.lang, 'en');
await go('#schedule');
w.document.querySelector('[data-set="sched.mode=upcoming"]').click(); await wait();
assert.equal(w.document.querySelectorAll('.gm').length, 30, 'thirty upcoming games');
// player page shows the game log; totals match the season stats
const jobin = data.players.find((p) => p.name === 'Michael Jobin');
await go('#player-' + jobin.id);
assert.ok(w.document.querySelectorAll('.tbl tbody tr').length === 2 || w.document.querySelectorAll('.tbl tbody tr').length >= 2, 'game log rows');
const foot = [...w.document.querySelectorAll('.tbl tfoot td')].map((td) => td.textContent.trim());
assert.ok(foot.includes(String(jobin.g)) && foot.includes(String(jobin.p)), 'game log totals equal season goals and points: ' + foot.join('|'));
assert.ok(w.document.querySelector('.hero .jersey b').textContent.trim().length > 0, 'jersey number shown');
assert.ok(![...w.document.querySelectorAll('a')].some((a) => /cphjoliette/.test(a.href)), 'no link to the old site');
// game page content
await go('#game-2539180');
assert.ok(/BELLEROSE|Bellerose/.test(main()), 'scorers on the game page');
assert.ok(w.document.querySelector('.timeline svg circle'), 'goal timeline drawn');
await go('#nonsense'); assert.ok(main().length > 200, 'unknown hash falls back to home');
await go('#team-999'); assert.ok(/introuvable|not found/i.test(main()), 'unknown team shows not-found page');

// 6. main team / all teams scope
await go('#players');
w.document.querySelector('[data-set="players.sex="]').click(); await wait();
const pq2 = w.document.getElementById('pq'); pq2.value = ''; pq2.dispatchEvent(new w.Event('input', { bubbles: true })); await wait();
const gsx = w.document.getElementById('gs'); gsx.value = ''; gsx.dispatchEvent(new w.Event('input', { bubbles: true })); await wait();
const rowOf = (name) => [...w.document.querySelectorAll('.tbl tbody tr')].find((tr) => tr.textContent.includes(name));
const cells = (tr) => [...tr.children].map((c) => c.textContent.trim());
assert.ok(w.document.querySelector('.scope [data-scope="main"][aria-pressed="true"]'), 'main team is the default scope');
const pil = rowOf('Tommy Pilotte');
assert.ok(/TOP/.test(cells(pil)[2]) && /aussi|also/.test(cells(pil)[2]), 'main team shown first, other team tagged');
assert.equal(cells(pil)[3], '4', 'Pilotte: 4 games with his main team');
assert.equal(cells(pil)[4], '3', 'Pilotte: 3 goals with his main team');
w.document.querySelector('[data-scope="all"]').click(); await wait();
const pil2 = rowOf('Tommy Pilotte');
assert.equal(cells(pil2)[3], '5', 'Pilotte: 5 games in the league');
assert.equal(cells(pil2)[4], '4', 'Pilotte: 4 goals in the league (matches the official site)');
// every team row of a person adds up to the league total
await go('#player-' + data.players.find((p) => p.name.includes('Pilotte')).id);
const tfoot = [...w.document.querySelectorAll('.tbl tfoot td')].map((c) => c.textContent.trim());
assert.ok(w.document.querySelector('.scope'), 'scope switch on the player page');
assert.equal(tfoot[1], '5', 'by-team table adds up to 5 games');
for (const p of data.players.filter((x) => x.teams.length > 1)) {
  await go('#player-' + p.id);
  const f = [...w.document.querySelectorAll('.sec .tbl tfoot')][0];
  const t = f ? [...f.querySelectorAll('td')].map((c) => c.textContent.trim()) : [];
  assert.equal(t[1], String(p.gp), p.name + ': games add up');
  assert.equal(t[2], String(p.g), p.name + ': goals add up');
  assert.equal(t[3], String(p.a), p.name + ': assists add up');
}
// team page: substitutes appear in main-team scope only
w.document.querySelector('[data-scope="main"]').click(); await wait();
await go('#team-' + data.teams.find((x) => x.abb === 'GHO').id);
assert.ok(/Pilotte/.test(w.document.getElementById('main').textContent), 'Pilotte listed as a substitute for GHO');
assert.ok(/Remplaçants|Substitutes/.test(w.document.getElementById('main').textContent), 'substitutes section');
// goalie: Mailloux plays for TMN (3 games) and GHO (1 game)
await go('#goalies');
const mail = rowOf('Mailloux');
assert.ok(/TMN/.test(cells(mail)[1]), 'goalie main team is TMN');
assert.equal(cells(mail)[2], '3', 'goalie: 3 games for the main team');
w.document.querySelector('[data-scope="all"]').click(); await wait();
assert.equal(cells(rowOf('Mailloux'))[2], '4', 'goalie: 4 games in the league');
w.document.querySelector('[data-scope="main"]').click(); await wait();

}

assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));
console.log(`UI smoke test passed (${slug}): ${data.teams.length} team pages, ${ids.size} player pages, ${seen.size} distinct internal links.`);
w.close(); process.exit(0);
