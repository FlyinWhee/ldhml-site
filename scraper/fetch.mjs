// Refresh the league snapshots from the public NBHPA league pages.
//
//   node scraper/fetch.mjs                 -> every league in leagues.json, if its snapshot is older than MIN_AGE_MIN
//   node scraper/fetch.mjs retro 4v4-b     -> only these leagues
//   node scraper/fetch.mjs --force         -> refresh now
//
// About 4 requests per league, plus one per new box score, with a pause between requests.
// If anything looks wrong, the old snapshot of that league stays in place.
import path from 'node:path';
import { assemble, saveLeague, readJson, loadLeagues, DATA_DIR } from './lib.mjs';
import { syncFromData } from './registry.mjs';

const MIN_AGE_MIN = Number(process.env.MIN_AGE_MIN ?? 15);
const DELAY = Number(process.env.DELAY_MS ?? 1500);
const UA = 'ldhml-stats-poc/0.2 (community stats viewer; low-volume; contact: league player)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(url, init = {}, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      if (i === tries) throw e;
    }
    await sleep(DELAY * i * 2);
  }
  throw new Error(`Failed: ${url}`);
}

// The request steps are in shared/refresh.js (the tools run the same steps from an admin's browser).
const fetchLeague = (lg, cfg, oldBox) => globalThis.LDRefresh.fetchLeague(lg, cfg, oldBox, {
  get: async (url, init, kind) => { const r = await http(url, init); return kind === 'json' ? r.json() : r.text(); },
  sleep, delay: DELAY, warn: (m) => console.warn(m)
});

const cfg = await loadLeagues();
const force = process.argv.includes('--force');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let failed = 0;
for (const lg of cfg.leagues) {
  if (wanted.length && !wanted.includes(lg.slug)) continue;
  const old = await readJson(path.join(DATA_DIR, lg.slug, 'meta.json'));
  if (!force && old?.fetchedAt) {
    const age = (Date.now() - Date.parse(old.fetchedAt)) / 60000;
    if (age < MIN_AGE_MIN) { console.log(`${lg.slug}: snapshot is ${age.toFixed(1)} min old. Nothing to do.`); continue; }
  }
  try {
    const oldBox = await readJson(path.join(DATA_DIR, lg.slug, 'box.json'));
    const raw = await fetchLeague(lg, cfg, oldBox);
    const { problems, boxSaved, out } = assemble(raw, lg, cfg, oldBox);
    if (problems.length) throw new Error(`refusing to overwrite data: ${problems.join('; ')}`);
    await saveLeague(lg.slug, out);
    console.log(`${lg.slug}: ${out.teams.length} teams, ${out.games.length} games, ${out.players.length} players, ${out.goalies.length} goalies, ${boxSaved} box scores.`);
  } catch (e) {
    failed++;
    console.error(`${lg.slug}: ${e.message}`);
  }
  await sleep(DELAY);
}
// Our own person ids: add the new people of data/ to registry/people.json.
try { const r = await syncFromData(); console.log(`registry: ${r.reg.people.length} people, ${r.added} new.`); }
catch (e) { failed++; console.error(e.message); }
if (failed) process.exit(1);
