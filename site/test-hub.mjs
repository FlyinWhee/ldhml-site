// Entry page (one card per section) and section pages (leagues, players, player profiles).
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(rel) {
  const html = await readFile(path.join(root, 'dist', rel, 'index.html'), 'utf8');
  const errors = [], calls = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' + (rel ? rel + '/' : ''),
    beforeParse(win) { win.LDHML_NOW = '2026-10-09T10:00:00'; win.scrollTo = () => {}; win.fetch = async (u) => { calls.push(String(u)); return { ok: false, status: 403 }; }; }
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
  const rk = H.people.find((p) => p.rank.s && played(p, 's')).rank.s;
  await pick('prank', rk);
  assert.equal(rows(), H.people.filter((p) => played(p, 's') && p.rank.s === rk).length, `${s.key}: skaters rated ${rk}`);
  await pick('prank', '-');
  assert.equal(rows(), H.people.filter((p) => played(p, 's') && !p.rank.s).length, `${s.key}: skaters without a rating`);
  await click('[data-fclear]');
  if (mine.length > 1) {
    await pick('plg', mine[0].slug);
    assert.equal(rows(), H.people.filter((p) => p.lg[mine[0].slug]).length, `${s.key}: league filter`);
    await click('[data-f="role=g"]');
    assert.equal(rows(), H.people.filter((p) => p.lg[mine[0].slug] && p.lg[mine[0].slug].g).length, `${s.key}: goalies of one league`);
  }
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
// a person who plays in both sections keeps one id of ours in both
const both = Object.entries(seenIn).filter(([, v]) => v.length > 1);
assert.ok(both.length > 0, 'some people play in both sections (same id in both)');
assert.ok(cfg.leagues.every((l) => cfg.sections.some((s) => s.key === l.section)), 'every league has a section');
console.log(`Entry and section pages passed: ${cfg.sections.length} sections, ${Object.keys(seenIn).length} people (${both.length} in both sections).`);
process.exit(0);
