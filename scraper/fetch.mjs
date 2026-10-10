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

// LDHML_API: optional address of the Cloudflare Worker (worker/proxy.js). The league server refuses GitHub's servers but accepts the Worker.
const BASE = (process.env.LDHML_API || 'https://admin.nbhpa.com').trim().replace(/\/+$/, '');
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

const FIELDS = ['team_id', 'team_name', 'team_abb', 'team_pic', 'position', 'gp', 'wins_tot', 'losses', 'ot', 'ot_loss', 'pts', 'gf', 'ga', 'diff', 'pts_gp'];

async function fetchLeague(lg, cfg, oldBox) {
  const form = (extra = {}) => new URLSearchParams({ season_id: cfg.seasonId, category_id: lg.categoryId, league_id: cfg.leagueId, ...extra });
  const post = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
  const q = new URLSearchParams();
  q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', cfg.leagueId);
  q.set('filters[][league_id]', cfg.leagueId); q.set('filters[][season_id]', cfg.seasonId);
  q.set('category_id', lg.categoryId); q.set('filters[][category_id]', lg.categoryId);
  q.set('public_site', '1'); q.set('class', 'Standings');
  FIELDS.forEach((f) => q.append('fields[]', f));
  q.set('page', '1');

  const raw = { recaps: {} };
  raw.standings = await (await http(`${BASE}/table_data.php?${q}`)).json(); await sleep(DELAY);
  raw.players = await (await http(`${BASE}/sites/site_stats_players.php?lang=fr`, { ...post, body: form() })).text(); await sleep(DELAY);
  raw.goalies = await (await http(`${BASE}/sites/site_stats_goalies.php?lang=fr`, { ...post, body: form() })).text(); await sleep(DELAY);
  raw.schedule = await (await http(`${BASE}/sites/site_schedule_include.php?lang=fr`, { ...post, body: form({ view: 'list' }) })).text();

  // Box scores: only new games and games from the last 3 days (scores can be corrected).
  const { out } = assemble(raw, lg, cfg, structuredClone(oldBox));
  const recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const todo = out.games.filter((g) => g.as != null && g.hs != null && !g.cancelled && (!oldBox?.games?.[g.id] || g.date >= recent));
  for (const g of todo) {
    await sleep(DELAY);
    try { raw.recaps[g.id] = await (await http(`${BASE}/sites/site_game_recap.php?game_id=${g.id}&league_id=${cfg.leagueId}&lang=fr`)).text(); }
    catch (e) { console.warn(`  box score ${g.id} skipped: ${e.message}`); }
  }
  return raw;
}

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
if (failed) process.exit(1);
