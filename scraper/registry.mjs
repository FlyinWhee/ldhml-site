// Our own person registry: registry/people.json. It is a source of truth, NOT a cache.
//
//   node scraper/registry.mjs      -> add the people found in data/ to the registry (fetch.mjs runs this at the end)
//
// One person = one record = one id of ours ("L0001"). The NBHPA person id (nid, "nbhpa_player_id") is the foreign key.
// NBHPA can give one person several player_id values (registrations), so they are kept as aliases ("pids").
// Rules: an id is never changed, never reused, never deleted. "next" only goes up.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY_FILE = path.join(ROOT, 'registry/people.json');

export const idOf = (n) => 'L' + String(n).padStart(4, '0');
const empty = () => ({ next: 1, people: [] });

export async function loadRegistry(file = REGISTRY_FILE) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return empty(); throw e; }
}

// Most frequent value of a list (first one wins a tie). Empty values do not count.
const mostCommon = (list) => {
  const n = new Map();
  for (const v of list) if (v != null && v !== '') n.set(v, (n.get(v) || 0) + 1);
  let best = null;
  for (const [v, c] of n) if (best === null || c > n.get(best)) best = v;
  return best;
};

/** Add the people of `rows` to the registry. rows: [{ nid, pid, name, sex }] (one per stats row of any league).
 *  Returns { reg, added, changed, problems }. When problems is not empty, do not save. The input is not changed. */
export function syncRegistry(reg0, rows, { since } = {}) {
  const reg = structuredClone(reg0 ?? empty());
  const problems = [];
  const byNid = new Map(reg.people.map((p) => [p.nid, p]));
  const pidOwner = new Map();
  for (const p of reg.people) for (const pid of p.pids) pidOwner.set(pid, p.nid);

  const seen = new Map(); // nid -> rows
  for (const r of rows) {
    if (!r.nid) { problems.push(`player_id ${r.pid} (${r.name}) has no NBHPA id`); continue; }
    const owner = pidOwner.get(r.pid);
    if (owner && owner !== r.nid) problems.push(`player_id ${r.pid} belongs to NBHPA id ${owner} in the registry, but the data says ${r.nid}`);
    (seen.get(r.nid) ?? seen.set(r.nid, []).get(r.nid)).push(r);
  }

  let changed = 0;
  const fresh = [];
  for (const [nid, rs] of seen) {
    const name = mostCommon(rs.map((r) => r.name)), sex = mostCommon(rs.map((r) => r.sex));
    const pids = [...new Set(rs.map((r) => r.pid).filter(Boolean))];
    const p = byNid.get(nid);
    if (!p) { fresh.push({ nid, name, sex, pids }); continue; }
    const before = JSON.stringify(p);
    if (name) p.name = name;
    if (sex) p.sex = sex;
    p.pids = [...new Set([...p.pids, ...pids])].sort();
    if (JSON.stringify(p) !== before) changed++;
  }
  // New people get the next ids, in name order, so a first batch reads well.
  fresh.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }) || a.nid.localeCompare(b.nid));
  for (const f of fresh) reg.people.push({ id: idOf(reg.next++), nid: f.nid, name: f.name, sex: f.sex, pids: f.pids.sort(), ...(since ? { since } : {}) });
  return { reg, added: fresh.length, changed, problems };
}

// One person per line: a refresh that adds one person changes one line.
export function serializeRegistry(reg) {
  const { next, people, ...rest } = reg;
  const head = Object.entries(rest).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`).join('');
  return `{\n${head}  "next": ${next},\n  "people": [\n${people.map((p) => '    ' + JSON.stringify(p)).join(',\n')}\n  ]\n}\n`;
}

/** Read every league of data/ and add new people. Saves only when there is no problem. */
export async function syncFromData() {
  const cfg = JSON.parse(await readFile(path.join(ROOT, 'leagues.json'), 'utf8'));
  const rows = [];
  for (const lg of cfg.leagues) {
    for (const f of ['players', 'goalies']) {
      let list;
      try { list = JSON.parse(await readFile(path.join(ROOT, 'data', lg.slug, `${f}.json`), 'utf8')); } catch { continue; }
      for (const p of list) rows.push({ nid: p.nid, pid: p.id, name: p.name, sex: p.sex });
    }
  }
  const before = await loadRegistry();
  const res = syncRegistry(before, rows, { since: cfg.seasonName });
  if (res.problems.length) throw new Error('registry not saved:\n  ' + res.problems.join('\n  '));
  if (res.added || res.changed || !before.people.length) {
    await mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
    await writeFile(REGISTRY_FILE, serializeRegistry(res.reg));
  }
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await syncFromData();
    console.log(`registry: ${r.reg.people.length} people, ${r.added} new, ${r.changed} updated.`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
