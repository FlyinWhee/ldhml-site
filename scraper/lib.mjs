// Shared by scraper/fetch.mjs (network) and scraper/import-raw.mjs (a saved raw file).
import { JSDOM } from 'jsdom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

globalThis.DOMParser = new JSDOM('').window.DOMParser;
await import('../shared/parsers.js');
await import('../shared/refresh.js');   // the refresh steps, shared with the tools (admin: Données du site public)

export const { parseStandings, parsePlayers, parseGoalies, parseSchedule, parseRecap, weighGoals } = globalThis.LDParsers;
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

export async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}
export const loadLeagues = async () => JSON.parse(await readFile(path.join(ROOT, 'leagues.json'), 'utf8'));

/** Turn raw responses of one league into the snapshot files. Returns { problems, boxSaved, out }. In shared/refresh.js. */
export const assemble = (raw, lg, cfg, oldBox) => globalThis.LDRefresh.assemble(raw, lg, cfg, oldBox);

export async function saveLeague(slug, out) {
  const dir = path.join(DATA_DIR, slug);
  await mkdir(dir, { recursive: true });
  for (const [k, v] of Object.entries(out)) await writeFile(path.join(dir, `${k}.json`), JSON.stringify(v));
}
