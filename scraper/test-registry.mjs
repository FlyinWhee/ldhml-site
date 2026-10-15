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
const leagues = [
  { lg: { slug: 'retro', section: 'teams' }, data: { players: [sk('2', '800', 'H10', ['MAS'], 5, 6), sk('3', '800', 'H10', ['TMN'], 1, 0)], goalies: [] } },
  { lg: { slug: 'draft', section: 'draft' }, data: { players: [], goalies: [gk('3', '800', 'H11', ['DDG'], 2), gk('50', '555', 'H9', ['DOL'], 1)] } }
];
const reg = { next: 2, people: [{ id: 'L0001', nid: '800', name: 'Marco Normandin', sex: 'm', pids: ['2', '3'], ranks: { salary: { s: 4, g: 6 } } }] };
const { people, missing } = peopleIndex(cfg, leagues, reg, (s) => s.toLowerCase());
const m = people.L0001;
assert.ok(m, 'the person has our id');
assert.equal(m.name, 'marco normandin', 'the name comes from the registry, cleaned');
assert.deepEqual(m.rank, { s: 'H10', g: 'H11' }, 'a rank per position');
assert.deepEqual(Object.keys(m.in).sort(), ['draft', 'teams'], 'one instance per section');
assert.deepEqual(m.in.teams.leagues.retro.teams, ['MAS', 'TMN']);
assert.equal(m.in.teams.leagues.retro.s.gp, 6, 'two player_id rows of one person add up');
assert.equal(m.in.teams.leagues.retro.g, null, 'no goalie line where the person did not play goal');
assert.equal(m.in.draft.leagues.draft.g.sv, 18);
assert.deepEqual(m.in.draft.ranks, { salary: { s: 4, g: 6 } }, 'our own rank applies to its section');
assert.deepEqual(m.in.teams.ranks, {}, '... and not to the other section');
assert.deepEqual(missing, ['555'], 'a person missing from the registry is reported');
assert.ok(people.n555 && people.n555.rank.s === null && people.n555.rank.g === 'H9', 'and gets a temporary id');

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
