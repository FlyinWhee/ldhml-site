// Entry page (one card per section) and section pages (leagues, players, player profiles).
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(rel, answer) {
  const html = await readFile(path.join(root, 'dist', rel, 'index.html'), 'utf8');
  const errors = [], calls = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' + (rel ? rel + '/' : ''),
    beforeParse(win) { win.LDHML_NOW = '2026-10-09T10:00:00'; win.scrollTo = () => {}; win.fetch = async (u) => { calls.push(String(u)); return answer ? answer(String(u)) : { ok: false, status: 403 }; }; }
  });
  await wait(300);
  const d = dom.window.document;
  return { w: dom.window, d, errors, calls, H: JSON.parse(d.getElementById('hub-data').textContent), main: () => d.getElementById('main').textContent };
}

// ---- entry page ----
{
  const { w, d, errors, calls, H } = await open('');
  assert.equal(H.kind, 'root');
  assert.equal(d.querySelectorAll('.scard').length, cfg.sections.length, 'one card per section');
  for (const s of cfg.sections) {
    assert.ok(d.querySelector(`.scard a[href="${s.path}/"]`), `card links to ${s.path}/`);
    for (const l of cfg.leagues.filter((x) => x.section === s.key)) assert.ok(d.querySelector(`.scard a[href="${s.path}/${l.path || l.slug}/"]`), `card links to league ${l.slug}`);
  }
  assert.equal(d.documentElement.lang, 'fr', 'French by default');
  assert.ok(/Ligues/.test(d.getElementById('main').textContent));
  assert.equal(d.querySelectorAll('#lgsel option').length, 1 + cfg.sections.length + cfg.leagues.length, 'picker lists the sections and every league');
  d.querySelector('[data-lang]').click(); await wait(20);
  assert.equal(d.documentElement.lang, 'en');
  assert.ok(/Leagues/.test(d.getElementById('main').textContent), 'English toggle works');
  assert.equal(calls.length, 0, 'the entry page makes no request to the league server');
  assert.deepEqual(errors, [], 'page errors:\n' + errors.join('\n'));
  w.close();
}

// ---- section pages ----
const seenIn = {};
let nights = 0;
for (const s of cfg.sections) {
  const { w, d, errors, calls, H, main } = await open(s.path);
  const mine = cfg.leagues.filter((l) => l.section === s.key);
  assert.equal(H.kind, 'section');
  assert.equal(d.querySelectorAll('.lcard').length, mine.length, `${s.key}: one card per league of the section`);
  for (const l of mine) assert.ok(d.querySelector(`.lcard a[href="${l.path || l.slug}/"]`), `${s.key}: card links to ${l.slug}`);
  assert.ok(H.leagues.every((l) => l.section === s.key), `${s.key}: no league of another section`);
  nights += d.querySelectorAll('.night li').length;
  // presentation (docs/presentation.md): teams have a badge and a link, people are links
  assert.ok(d.querySelectorAll('.lcard-top li').length > 0, `${s.key}: standings on the cards`);
  assert.ok([...d.querySelectorAll('.lcard-top li')].every((li) => li.querySelector('.crest') && li.querySelector('a[href*="/#team-"]')), `${s.key}: card standings rows have a team badge and a team link`);
  assert.ok([...d.querySelectorAll('.lcard-sc')].every((x) => x.querySelector('a[href*="/#player-"]') && x.querySelector('.abbs a[href*="/#team-"]')), `${s.key}: the top scorer and the team are links`);
  assert.equal(d.querySelectorAll('#lgsel option').length, mine.length + 2, `${s.key}: picker lists the section, its leagues and the entry page`);
  assert.ok(d.querySelector('#foot a[href="../"]'), `${s.key}: footer links to the entry page`);

  // people: only what this section knows; everybody has an id of ours
  assert.ok(H.people.length > 0, `${s.key}: people`);
  assert.deepEqual(H.people.filter((p) => !/^L\d+$/.test(p.id)).map((p) => p.name), [], `${s.key}: every person has an id of ours (run "npm run registry")`);
  for (const p of H.people) {
    assert.ok(Object.keys(p.lg).length && Object.keys(p.lg).every((slug) => mine.some((l) => l.slug === slug)), `${s.key}: ${p.name} has leagues of this section only`);
    assert.ok(Object.keys(p.rank).sort().join() === 'g,s', `${s.key}: ${p.name} has a rank per position`);
    seenIn[p.id] = (seenIn[p.id] || []).concat(s.key);
  }
  w.location.hash = '#players'; await wait(20);
  assert.equal(d.querySelectorAll('.tbl tbody tr').length, H.people.length, `${s.key}: player list has everybody`);
  assert.ok(d.getElementById('main').innerHTML.length < 500000, `${s.key}: player list HTML stays small (no inline logos in badges): ${d.getElementById('main').innerHTML.length} bytes`);
  assert.ok([...d.querySelectorAll('.tbl tbody tr')].every((tr) => tr.querySelector('a[href*="/#player-"]') && tr.querySelector('.abbs a[href*="/#team-"]')), `${s.key}: player list links each league page and each team`);
  const one = H.people[0], q = d.getElementById('pq');
  q.value = one.name; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(20);
  assert.ok([...d.querySelectorAll('.tbl tbody tr')].some((tr) => tr.textContent.includes(one.name)), `${s.key}: name filter`);
  // filters: sex, role, rank, league; each result equals a count made from the data
  const rows = () => d.querySelectorAll('.tbl tbody tr').length;
  const click = async (sel) => { d.querySelector(sel).click(); await wait(10); };
  const pick = async (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(10); };
  const played = (p, k) => Object.values(p.lg).some((m) => m[k]);
  await click('[data-fclear]');
  assert.equal(rows(), H.people.length, `${s.key}: clear filters`);
  await click('[data-f="sex=f"]');
  assert.equal(rows(), H.people.filter((p) => p.sex === 'f').length, `${s.key}: women filter`);
  await click('[data-f="role=g"]');
  assert.equal(rows(), H.people.filter((p) => p.sex === 'f' && played(p, 'g')).length, `${s.key}: women goalies`);
  await click('[data-fclear]'); await click('[data-f="role=s"]');
  // rating range: lower number = stronger; computed here without the page code
  const lv = (r) => { const m = /^H(\d+)$/.exec(r || ''); return m ? Number(m[1]) : null; };
  await pick('prfrom', 'H10'); await pick('prto', 'H11');
  assert.equal(rows(), H.people.filter((p) => played(p, 's') && lv(p.rank.s) != null && lv(p.rank.s) >= 10 && lv(p.rank.s) <= 11).length, `${s.key}: skaters rated H10 to H11`);
  await pick('prto', '');
  assert.equal(rows(), H.people.filter((p) => played(p, 's') && lv(p.rank.s) != null && lv(p.rank.s) >= 10).length, `${s.key}: skaters rated H10 or weaker`);
  await pick('prfrom', '-');
  assert.ok(d.getElementById('prto').disabled, `${s.key}: "to" is off for an exact value`);
  assert.equal(rows(), H.people.filter((p) => played(p, 's') && !p.rank.s).length, `${s.key}: skaters without a rating`);
  await click('[data-fclear]');
  if (mine.length > 1) {
    await pick('plg', mine[0].slug);
    assert.equal(rows(), H.people.filter((p) => p.lg[mine[0].slug]).length, `${s.key}: league filter`);
    await click('[data-f="role=g"]');
    assert.equal(rows(), H.people.filter((p) => p.lg[mine[0].slug] && p.lg[mine[0].slug].g).length, `${s.key}: goalies of one league`);
  }
  await click('[data-fclear]');
  // sorting: name (A-Z default), ratings (strongest first; N/C weakest; no rating always last), number of leagues
  const col = (i) => [...d.querySelectorAll('.tbl tbody tr')].map((tr) => tr.children[i].textContent.trim());
  const names = () => [...d.querySelectorAll('.tbl tbody tr td:first-child a')].map((a) => a.textContent);
  const az = H.people.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  assert.equal(names()[0], az[0], `${s.key}: A-Z by default`);
  await click('[data-psort="name"]');
  assert.equal(names()[0], az[az.length - 1], `${s.key}: Z-A on a second click`);
  const strength = (r) => { const m = /^([HWJ])(\d+)(\+?)$/.exec(r); return m ? 'HWJ'.indexOf(m[1]) * 1000 + Number(m[2]) * 2 - (m[3] ? 1 : 0) : 1e9; }; // off the scale = weakest
  const ordered = (vals, dir) => {
    const rated = vals.filter((v) => v !== '-'), firstDash = vals.indexOf('-');
    assert.ok(firstDash < 0 || vals.slice(firstDash).every((v) => v === '-'), `${s.key}: no rating stays last (${dir})`);
    for (let i = 1; i < rated.length; i++) assert.ok(dir === 'asc' ? strength(rated[i - 1]) <= strength(rated[i]) : strength(rated[i - 1]) >= strength(rated[i]), `${s.key}: rating order ${dir}: ${rated[i - 1]} then ${rated[i]}`);
  };
  await click('[data-psort="rs"]'); ordered(col(1), 'asc');
  await click('[data-psort="rs"]'); ordered(col(1), 'desc');
  await click('[data-psort="rg"]'); ordered(col(2), 'asc');
  assert.equal(d.querySelector('th[aria-sort]').querySelector('[data-psort]').getAttribute('data-psort'), 'rg', `${s.key}: the sorted column is marked`);
  await click('[data-psort="lg"]');
  const nl = [...d.querySelectorAll('.tbl tbody tr .pl-lgcol')].map((td) => td.querySelectorAll('.lgb').length);
  assert.ok(nl.every((v, i) => i === 0 || nl[i - 1] >= v), `${s.key}: most leagues first`);
  await click('[data-f="sex=f"]');
  assert.ok(d.querySelector('th[aria-sort] [data-psort="lg"]'), `${s.key}: sorting stays when filtering`);
  await click('[data-fclear]');
  assert.ok(d.querySelector('th[aria-sort] [data-psort="lg"]'), `${s.key}: "Clear filters" keeps the sort`);
  await click('[data-psort="name"]');
  // phones: the filters open in a side panel; the same controls, a count, Escape closes it
  await click('[data-fpanel]');
  assert.ok(d.querySelector('.fbar.fp-on') && d.documentElement.classList.contains('fp-open'), `${s.key}: filter panel opens`);
  assert.ok(d.activeElement && d.activeElement.closest('#fpanel'), `${s.key}: focus moves into the panel`);
  await click('#fpanel [data-f="sex=m"]');
  assert.ok(d.querySelector('.fbar.fp-on'), `${s.key}: panel stays open while filtering`);
  assert.ok(d.querySelector('.fp-go').textContent.includes(String(H.people.filter((p) => p.sex === 'm').length)), `${s.key}: panel button shows the result count`);
  assert.equal(d.querySelector('.fbtn b').textContent, '1', `${s.key}: the Filters button counts active filters`);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(10);
  assert.ok(!d.querySelector('.fbar.fp-on') && !d.documentElement.classList.contains('fp-open'), `${s.key}: Escape closes the panel`);
  await click('[data-fclear]');
  for (const p of H.people) {
    w.location.hash = '#player-' + p.id; await wait(5);
    assert.ok(main().includes(p.name), `${s.key}: profile of ${p.name}`);
    for (const slug of Object.keys(p.lg)) {
      const l = mine.find((x) => x.slug === slug);
      assert.ok(d.querySelector(`a[href="${l.path || l.slug}/#player-${p.id}"]`), `${s.key}: ${p.name} links to the league page`);
      const hl = H.leagues.find((x) => x.slug === slug);
      if (p.lg[slug].main) {
        const lis = [...d.querySelectorAll('.pl-lg')].find((sec) => sec.querySelector(`.lgb-l[href="${hl.path}/#player-${p.id}"]`)).querySelectorAll('.pl-teams li');
        assert.ok(lis[0].classList.contains('is-main') && lis[1].classList.contains('also'), `${s.key}: ${p.name}: main team first, then "SUB:"`);
      }
      assert.ok(d.querySelector(`.pl-lg-h .lgb-l[href="${hl.path}/#player-${p.id}"]`), `${s.key}: ${p.name}: the league badge opens the person's page in ${slug}`);
      for (const abb of p.lg[slug].teams) {
        const tm = hl.teamList.find((x) => x.abb === abb);
        if (tm) assert.ok(d.querySelector(`.pl-teams a[href="${hl.path}/#team-${tm.id}"]`) && d.querySelector(`.pl-teams .crest`), `${s.key}: ${p.name}: team ${abb} has a badge, its full name and a link`);
      }
    }
    for (const k of p.xs) assert.ok(d.querySelector(`.pxl a[href="../${cfg.sections.find((x) => x.key === k).path}/#player-${p.id}"]`), `${s.key}: ${p.name} links to the other section`);
  }
  w.location.hash = '#player-nobody'; await wait(5);
  assert.ok(/introuvable|not found/i.test(main()), `${s.key}: unknown person`);
  assert.ok(calls.every((u) => u.startsWith('https://admin.nbhpa.com/table_data.php')), `${s.key}: section page only reads standings`);
  assert.ok(calls.length <= 2, `${s.key}: stops after failed requests (${calls.length} made)`);
  assert.deepEqual(errors, [], `${s.key}: page errors:\n` + errors.join('\n'));
  w.close();
}
assert.ok(nights >= 1, 'next game nights listed');

// ---- live standings (what a real browser gets): the cards take the fresh numbers, and the page can leave home and come back ----
{
  const s = cfg.sections[0];
  const mine = cfg.leagues.filter((l) => l.section === s.key);
  const byCat = {};
  for (const l of mine) byCat[l.categoryId] = JSON.parse(await readFile(path.join(root, 'data', l.slug, 'teams.json'), 'utf8'));
  const standingsJson = (teams) => Object.fromEntries(teams.map((t, i) => [i, { values: Object.entries({ team_id: t.id, team_name: t.name, team_abb: t.abb, team_pic: t.logo, position: t.pos, gp: t.gp,
    wins_tot: t.w, losses: t.l, ot: t.t, ot_loss: t.otl, pts: t.pos === 1 ? 99 : t.pts, gf: t.gf, ga: t.ga, diff: t.diff, pts_gp: t.ppg }).map(([key, val]) => ({ key, val })) }]));
  const answer = (u) => { const cat = new URL(u).searchParams.get('category_id'); return { ok: true, status: 200, json: async () => standingsJson(byCat[cat]) }; };
  const { w, d, errors } = await open(s.path, answer);
  await wait(600 + 1300 * mine.length);
  const leaders = [...d.querySelectorAll('.lcard-top li:first-child b')].map((b) => b.textContent);
  assert.ok(leaders.length === mine.length && leaders.every((x) => x === '99'), `${s.key}: the cards show the live standings (${leaders.join(', ')})`);
  w.location.hash = '#players'; await wait(30);
  w.location.hash = '#home'; await wait(30);
  assert.ok(d.querySelector('.lcards') && d.querySelectorAll('.lcard').length === mine.length, `${s.key}: back to the leagues after live standings`);
  w.history.back(); await wait(60);
  assert.ok(d.querySelector('.tbl') || d.querySelector('.lcards'), `${s.key}: the back button works`);
  assert.deepEqual(errors, [], `${s.key}: page errors with live standings:\n` + errors.join('\n'));
  w.close();
}
// a person who plays in both sections keeps one id of ours in both
const both = Object.entries(seenIn).filter(([, v]) => v.length > 1);
assert.ok(both.length > 0, 'some people play in both sections (same id in both)');
assert.ok(cfg.leagues.every((l) => cfg.sections.some((s) => s.key === l.section)), 'every league has a section');
console.log(`Entry and section pages passed: ${cfg.sections.length} sections, ${Object.keys(seenIn).length} people (${both.length} in both sections).`);
process.exit(0);
