// Build league snapshots from a raw file saved from a browser session (see README, "Refresh from your own computer").
//   node scraper/import-raw.mjs raw/ldhml-raw.json
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assemble, saveLeague, readJson, loadLeagues, DATA_DIR } from './lib.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: node scraper/import-raw.mjs <raw.json>'); process.exit(1); }
const rawAll = JSON.parse(await readFile(file, 'utf8'));
const cfg = await loadLeagues();
for (const lg of cfg.leagues) {
  const raw = rawAll[lg.slug];
  if (!raw) continue;
  const old = await readJson(path.join(DATA_DIR, lg.slug, 'box.json'));
  const { problems, boxSaved, out } = assemble(raw, lg, cfg, old);
  if (problems.length) { console.error(`${lg.slug}: not saved (${problems.join('; ')})`); continue; }
  await saveLeague(lg.slug, out);
  console.log(`${lg.slug}: ${out.teams.length} teams, ${out.games.length} games, ${out.players.length} players, ${out.goalies.length} goalies, ${boxSaved} box scores.`);
}
