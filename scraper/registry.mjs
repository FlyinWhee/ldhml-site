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

await import('../shared/refresh.js');   // the id rules, shared with the tools (admin: Données du site public)
export const { idOf, syncRegistry, serializeRegistry } = globalThis.LDRefresh;
const empty = () => ({ next: 1, people: [] });

export async function loadRegistry(file = REGISTRY_FILE) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return empty(); throw e; }
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
