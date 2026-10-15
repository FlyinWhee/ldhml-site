// Our own person ids (scraper/registry.mjs) and the people index of the build (site/people.mjs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncRegistry, serializeRegistry, loadRegistry, idOf } from './registry.mjs';
import { peopleIndex } from '../site/people.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- registry: stable ids ----
assert.equal(idOf(7), 'L0007');
const rows = [
  { nid: '900', pid: '1', name: 'Zoé Roy', sex: 'f' },
  { nid: '800', pid: '2', name: 'Marco Normandin', sex: 'm' },
  { nid: '800', pid: '3', name: 'Marco Normandin', sex: 'm' } // same person, second NBHPA player_id
];
const empty = { next: 1, people: [] };
const a = syncRegistry(empty, rows, { since: 'Automne 2026' });
assert.deepEqual(a.problems, []);
assert.equal(a.added, 2, 'one record per person, not per player_id');
assert.deepEqual(a.reg.people.map((p) => [p.id, p.name, p.pids]), [['L0001', 'Marco Normandin', ['2', '3']], ['L0002', 'Zoé Roy', ['1']]], 'new ids in name order, aliases kept');
assert.equal(a.reg.next, 3);
assert.deepEqual(empty, { next: 1, people: [] }, 'the input registry is not changed');

const b = syncRegistry(a.reg, [...rows, { nid: '700', pid: '4', name: 'Ann Aubé', sex: 'f' }, { nid: '900', pid: '5', name: 'Zoé Roy', sex: 'f' }]);
assert.equal(b.added, 1);
assert.equal(b.reg.people.find((p) => p.nid === '700').id, 'L0003', 'a new person gets the next id, even if the name sorts first');
assert.equal(b.reg.people.find((p) => p.nid === '900').id, 'L0002', 'an id never changes');
assert.deepEqual(b.reg.people.find((p) => p.nid === '900').pids, ['1', '5'], 'a new player_id is added as an alias');
assert.equal(syncRegistry(b.reg, rows).changed + syncRegistry(b.reg, rows).added, 0, 'nothing changes on a second run');
// a person who is gone this season stays (ids are never deleted or reused)
const c = syncRegistry(b.reg, [{ nid: '600', pid: '9', name: 'New Person', sex: 'm' }]);
assert.equal(c.reg.people.length, 4); assert.equal(c.reg.people.find((p) => p.nid === '600').id, 'L0004');

// bad data never replaces good data
assert.ok(syncRegistry(b.reg, [{ nid: '999', pid: '2', name: 'X', sex: 'm' }]).problems.length, 'a player_id that moves to another person is a problem');
assert.ok(syncRegistry(b.reg, [{ nid: '', pid: '8', name: 'X', sex: 'm' }]).problems.length, 'a row without an NBHPA id is a problem');

// one person per line, and it reads back
const text = serializeRegistry(b.reg);
assert.deepEqual(JSON.parse(text), b.reg);
assert.equal(text.split('\n').filter((l) => l.includes('"nid"')).length, b.reg.people.length, 'one line per person');

// ---- people index: person > section instance > league ----
const cfg = {
  sections: [{ key: 'draft' }, { key: 'teams' }],
  rankSystems: [{ key: 'salary', section: 'draft', name: { fr: 'Salaire', en: 'Salary' } }]
};
const sk = (id, nid, rank, teams, gp, g) => ({ id, nid, name: 'MARCO NORMANDIN', sex: 'm', rank, teams, gp, g, a: 1, p: g + 1, pim: 0 });
const gk = (id, nid, rank, teams, gp) => ({ id, nid, name: 'MARCO NORMANDIN', sex: 'm', rank, teams, gp, w: 1, l: 0, t: 0, sa: 20, sv: 18, ga: 2, so: 0 });
// box scores: player_id 2 played 2 games for MAS, player_id 3 played 2 for TMN, TMN later: a tie goes to the latest game
const row = (pid) => [pid, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const game = (id, date, pid, team) => [{ id, date }, { t: [{ id: team, sk: [row(pid)], gk: [] }, { id: 'X', sk: [], gk: [] }] }];
const bx = [game('g1', '2026-09-01', '2', 'T1'), game('g2', '2026-09-08', '2', 'T1'), game('g3', '2026-09-15', '3', 'T2'), game('g4', '2026-09-22', '3', 'T2')];
const retroData = {
  players: [sk('2', '800', 'H10', ['MAS'], 5, 6), sk('3', '800', 'H10', ['TMN'], 1, 0)], goalies: [],
  teams: [{ id: 'T1', abb: 'MAS' }, { id: 'T2', abb: 'TMN' }, { id: 'X', abb: 'XXX' }],
  games: bx.map((x) => x[0]), box: { names: {}, games: Object.fromEntries(bx.map((x) => [x[0].id, x[1]])) }
};
const leagues = [
  { lg: { slug: 'retro', section: 'teams' }, data: retroData },
  { lg: { slug: 'draft', section: 'draft' }, data: { players: [], goalies: [gk('3', '800', 'H11', ['DDG'], 2), gk('50', '555', 'H9', ['DOL'], 1)] } }
];
const reg = { next: 2, people: [{ id: 'L0001', nid: '800', name: 'Marco Normandin', sex: 'm', pids: ['2', '3'], ranks: { salary: { s: 4, g: 6 } } }] };
const { people, missing } = peopleIndex(cfg, leagues, reg, (s) => s.toLowerCase());
const m = people.L0001;
assert.ok(m, 'the person has our id');
assert.equal(m.name, 'marco normandin', 'the name comes from the registry, cleaned');
assert.deepEqual(m.rank, { s: 'H10', g: 'H11' }, 'a rank per position');
assert.deepEqual(Object.keys(m.in).sort(), ['draft', 'teams'], 'one instance per section');
assert.deepEqual(m.in.teams.leagues.retro.teams, ['TMN', 'MAS'], 'main team first');
assert.equal(m.in.teams.leagues.retro.main, 'TMN', 'main team: most games, a tie goes to the latest game (same rule as the league page)');
assert.deepEqual(m.in.teams.leagues.retro.gpBy, { TMN: 2, MAS: 2 }, 'games per team from the box scores, both player_id together');
assert.equal(m.in.draft.leagues.draft.main, null, 'no main team with one team');
assert.equal(m.in.teams.leagues.retro.s.gp, 6, 'two player_id rows of one person add up');
assert.equal(m.in.teams.leagues.retro.g, null, 'no goalie line where the person did not play goal');
assert.equal(m.in.draft.leagues.draft.g.sv, 18);
assert.deepEqual(m.in.draft.ranks, { salary: { s: 4, g: 6 } }, 'our own rank applies to its section');
assert.deepEqual(m.in.teams.ranks, {}, '... and not to the other section');
assert.deepEqual(missing, ['555'], 'a person missing from the registry is reported');
assert.ok(people.n555 && people.n555.rank.s === null && people.n555.rank.g === 'H9', 'and gets a temporary id');

// ---- rank scales (shared/ranks.js): lower level = stronger, "+" half a level stronger, one scale per letter ----
await import('../shared/ranks.js');
const { nbhpa, scale } = globalThis.LDRanks;
assert.ok(nbhpa.key('H8').s < nbhpa.key('H12').s, 'H8 is stronger than H12');
assert.ok(nbhpa.key('W6').s < nbhpa.key('W7+').s && nbhpa.key('W7+').s < nbhpa.key('W7').s, 'W7+ is between W6 and W7');
assert.equal(nbhpa.key('N/C'), null); assert.equal(nbhpa.key(''), null); assert.equal(nbhpa.key(null), null);
assert.deepEqual(nbhpa.sort(['H12', 'W7', 'N/C', 'H8', 'W7+', 'J5', 'W6', 'H10']), ['H8', 'H10', 'H12', 'W6', 'W7+', 'W7', 'J5', 'N/C'], 'sorted by scale, strongest first, off-scale last');
assert.ok(nbhpa.inRange('H10', 'H9', 'H11') && nbhpa.inRange('H9', 'H9', 'H11') && nbhpa.inRange('H11', 'H9', 'H11'), 'range is inclusive');
assert.ok(!nbhpa.inRange('H12', 'H9', 'H11') && !nbhpa.inRange('H8', 'H9', 'H11'), 'outside the range');
assert.ok(nbhpa.inRange('H10', 'H11', 'H9'), 'bounds given in the wrong order still work');
assert.ok(!nbhpa.inRange('W7', 'H9', 'H11'), 'a range stays inside one scale');
assert.ok(nbhpa.inRange('H12', 'H10', '') && !nbhpa.inRange('H9', 'H10', ''), '"from" only: that rank or weaker');
assert.ok(nbhpa.inRange('H8', '', 'H10') && !nbhpa.inRange('H11', '', 'H10'), '"to" only: that rank or stronger');
assert.ok(!nbhpa.inRange('N/C', 'H8', 'H12') && !nbhpa.inRange(null, 'H8', ''), 'off-scale values are never in a range');
const own = scale(['A', 'B', 'C', 'D']); // our own rank system: a list, strongest first
assert.ok(own.inRange('B', 'A', 'C') && !own.inRange('D', 'A', 'C') && own.key('Z') === null, 'a homegrown scale works the same way');
assert.deepEqual(own.sort(['C', 'A', 'Z', 'B']), ['A', 'B', 'C', 'Z']);

// ---- the committed registry covers every person of data/ ----
const real = await loadRegistry();
const known = new Set(real.people.map((p) => p.nid));
const all = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const lost = [];
for (const lg of all.leagues) for (const f of ['players', 'goalies']) {
  let list = [];
  try { list = JSON.parse(await readFile(path.join(root, 'data', lg.slug, f + '.json'), 'utf8')); } catch { continue; }
  for (const p of list) if (!known.has(p.nid)) lost.push(`${lg.slug}: ${p.name}`);
}
assert.deepEqual(lost, [], 'people in data/ without an id of ours: run "npm run registry" and commit registry/');
assert.equal(new Set(real.people.map((p) => p.id)).size, real.people.length, 'ids are unique');
assert.ok(real.people.every((p) => Number(p.id.slice(1)) < real.next), '"next" is above every id');
console.log(`Registry test passed: ${real.people.length} people in registry/people.json.`);
