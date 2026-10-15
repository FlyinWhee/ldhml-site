// Smoke test: load the built page in jsdom, visit every route, follow every internal link.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] || 'retro';
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const lgc = cfg.leagues.find((l) => l.slug === slug);
const rel = cfg.sections.find((s) => s.key === lgc.section).path + '/' + (lgc.path || lgc.slug);
const html = await readFile(path.join(root, 'dist', rel, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
vc.on('error', (e) => errors.push(String(e)));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' + rel + '/' });
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
// 1b. schedule day headings: weekday and date in two parts (two lines on desktop)
await go('#schedule');
assert.ok([...w.document.querySelectorAll('.dgrp .day')].every((h) => h.querySelector('.wd') && h.querySelector('.dm')), 'schedule headings have a weekday and a date part');
// 2. every team and every person page renders
for (const t of data.teams) { await go('#team-' + t.id); assert.ok(main().toLowerCase().includes(t.name.toLowerCase()), `team page ${t.name}`); hrefs().forEach((x) => seen.add(x)); }
// People have our own ids (registry/people.json). One person can have several NBHPA player_id rows: they are one person.
const rowsAll = [...data.players, ...data.goalies];
const uidOf = (p) => data.ids.nids[p.nid];
assert.deepEqual(rowsAll.filter((p) => !uidOf(p)).map((p) => p.name), [], 'every person has an id of ours (run "npm run registry")');
const ids = new Set(rowsAll.map(uidOf));
for (const id of ids) {
  await go('#player-' + id);
  const name = rowsAll.find((p) => uidOf(p) === id).name;
  assert.ok(main().toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ' ')), `player page ${name}`);
  hrefs().forEach((x) => seen.add(x));
}
// an old link with an NBHPA player_id still opens the person
await go('#player-' + data.players[0].id);
assert.ok(main().toLowerCase().includes(data.players[0].name.toLowerCase().replace(/\s+/g, ' ')), 'old player_id link opens the person');
// skater lines per person (rows of one person added together)
const merged = {};
for (const p of data.players) {
  const m = merged[uidOf(p)] ??= { id: uidOf(p), name: p.name, teams: [], rows: 0, gp: 0, g: 0, a: 0 };
  p.teams.forEach((a) => { if (!m.teams.includes(a)) m.teams.push(a); });
  m.rows++; m.gp += p.gp; m.g += p.g; m.a += p.a;
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
assert.equal(picker.find((o) => o.selected).value, lgc.path || slug, 'picker shows the current league');
assert.ok(data.registry.every((l) => l.path && cfg.leagues.find((c) => c.slug === l.slug).section === lgc.section), 'picker lists only the leagues of this section');
assert.ok(w.document.querySelector('#foot a[href="../"]'), 'footer links to the section page');
assert.ok(w.document.querySelector('#foot a[href="../../"]'), 'footer links to the LDHML entry page');
// a person with several NBHPA player_id rows in this league is listed once
await go('#players');
w.document.querySelector('[data-scope="all"]') && w.document.querySelector('[data-scope="all"]').click(); await wait();
for (const m of Object.values(merged).filter((x) => x.rows > 1)) {
  const n = [...w.document.querySelectorAll('.tbl tbody tr')].filter((tr) => tr.querySelector(`a[href="#player-${m.id}"]`)).length;
  assert.equal(n, 1, m.name + ' is listed once');
}
w.document.querySelector('[data-scope="main"]') && w.document.querySelector('[data-scope="main"]').click(); await wait();
// main team: most games (skater + goalie), a tie goes to the team of the latest game. The section pages use the same rule (site/people.mjs).
{
  const dateOf = Object.fromEntries(data.games.map((g) => [g.id, g.date]));
  const per = {};
  for (const [gid, b] of Object.entries(data.box.games)) {
    if (!dateOf[gid] || b.t.length !== 2) continue;
    for (const side of b.t) for (const r of [...side.sk, ...side.gk]) {
      const u = data.ids.pids[r[0]]; if (!u) continue;
      const z = ((per[u] ??= {})[side.id] ??= { gp: 0, last: '' }); z.gp++; if (dateOf[gid] > z.last) z.last = dateOf[gid];
    }
  }
  for (const [u, byTeam] of Object.entries(per)) {
    const ids = Object.keys(byTeam).sort((a, b) => byTeam[b].gp - byTeam[a].gp || byTeam[b].last.localeCompare(byTeam[a].last));
    if (ids.length < 2 || (byTeam[ids[0]].gp === byTeam[ids[1]].gp && byTeam[ids[0]].last === byTeam[ids[1]].last)) continue;
    await go('#player-' + u);
    const main = w.document.querySelector('.pteams a.is-main');
    assert.equal(main && main.getAttribute('href'), '#team-' + ids[0], `main team of ${u} (most games, then latest game)`);
    assert.ok(w.document.querySelector('.pteams a') === main && main.nextElementSibling && main.nextElementSibling.classList.contains('also'), `main team of ${u} comes first, then "SUB:"`);
  }
}
// cross links: the section profile of the person
const cross = Object.keys(data.ids.who).find((k) => data.ids.who[k].lg.length) || Object.keys(data.ids.who)[0];
await go('#player-' + cross);
assert.ok(w.document.querySelector(`.pxl a[href="../#player-${cross}"]`), 'player page links to the section profile');
for (const x of data.ids.who[cross].lg) {
  const l = data.registry.find((r) => r.slug === x.slug);
  assert.ok(w.document.querySelector(`.pxl .lgb-l[href="../${l.path}/#player-${cross}"]`), 'league badge opens the person in the other league');
}
for (const k of data.ids.who[cross].xs) assert.ok(w.document.querySelector(`.pxl a[href="../../${data.sections[k].path}/#player-${cross}"]`), 'player page links to the other section');
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
const playedG = data.games.filter((g) => g.as != null && g.hs != null);
const lastDay = playedG.map((g) => g.date).sort().pop();
assert.equal(finals, data.games.filter((g) => g.date === lastDay).length, 'all games of the latest night are on the scoreboard');
await go('#standings');
const firstRow = w.document.querySelector('.tbl tbody tr').textContent;
assert.ok(/Ghostbusters/.test(firstRow), 'Ghostbusters lead the standings');
await go('#players');
const rows = w.document.querySelectorAll('.tbl tbody tr').length;
assert.equal(rows, Object.keys(merged).length, 'all skaters listed, once per person');

// 5. interactions: sort, filter, language, search
w.document.querySelector('[data-sort="players|g|desc"]').click(); await wait();
const maxG = Math.max(...data.players.map((p) => p.g));
const topNames = data.players.filter((p) => p.g === maxG).map((p) => p.name.toLowerCase());
const firstName = w.document.querySelector('.tbl tbody tr').textContent.toLowerCase();
assert.ok(topNames.some((n) => firstName.includes(n)), 'sort by goals works (first row should be one of: ' + topNames.join(', ') + ')');
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
assert.equal(w.document.querySelectorAll('.gm').length, data.games.filter((g) => g.as == null && !g.cancelled).length, 'every upcoming game is listed');
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
// a skater who played for several teams (the data decides who)
const multi = Object.values(merged).filter((x) => x.teams.length > 1).sort((x, y) => y.gp - x.gp)[0];
if (multi) {
  const mrow = rowOf(multi.name);
  assert.ok(mrow && /rempl|sub/i.test(cells(mrow)[2]), 'main team shown first, other teams tagged');
  assert.ok(Number(cells(mrow)[3]) <= multi.gp, 'main team games do not exceed league games');
  w.document.querySelector('[data-scope="all"]').click(); await wait();
  const mrow2 = rowOf(multi.name);
  assert.equal(cells(mrow2)[3], String(multi.gp), multi.name + ': games in the league');
  assert.equal(cells(mrow2)[4], String(multi.g), multi.name + ': goals in the league (matches the official site)');
}
// every team row of a person adds up to the league total
if (multi) {
await go('#player-' + multi.id);
const tfoot = [...w.document.querySelectorAll('.tbl tfoot td')].map((c) => c.textContent.trim());
assert.ok(w.document.querySelector('.scope'), 'scope switch on the player page');
}
for (const p of Object.values(merged).filter((x) => x.teams.length > 1)) {
  await go('#player-' + p.id);
  const f = [...w.document.querySelectorAll('.sec .tbl tfoot')][0];
  const t = f ? [...f.querySelectorAll('td')].map((c) => c.textContent.trim()) : [];
  assert.equal(t[1], String(p.gp), p.name + ': games add up');
  assert.equal(t[2], String(p.g), p.name + ': goals add up');
  assert.equal(t[3], String(p.a), p.name + ': assists add up');
}
// team page: substitutes appear in main-team scope only
w.document.querySelector('[data-scope="main"]').click(); await wait();
const mainOfRow = multi ? (((cells(rowOf(multi.name) || { children: [] })[2] || '').match(/^[A-Z0-9]+/) || [''])[0]) : '';
if (multi) {
  const subAbb = multi.teams.find((a) => a !== (mainOfRow));
  if (subAbb) {
    await go('#team-' + data.teams.find((x) => x.abb === subAbb).id);
    assert.ok(/Remplaçants|Substitutes/.test(w.document.getElementById('main').textContent), 'substitutes section');
  }
}
// goalie who played for several teams: all-scope games equal the league total
const gm = data.goalies.filter((x) => x.teams.length > 1)[0];
if (gm) {
  await go('#goalies');
  w.document.querySelector('[data-scope="all"]').click(); await wait();
  assert.equal(cells(rowOf(gm.name))[2], String(gm.gp), 'goalie: games in the league');
  w.document.querySelector('[data-scope="main"]').click(); await wait();
}
}

assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));
console.log(`UI smoke test passed (${slug}): ${data.teams.length} team pages, ${ids.size} player pages, ${seen.size} distinct internal links.`);
w.close(); process.exit(0);
