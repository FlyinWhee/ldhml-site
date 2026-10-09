// Refresh the league data snapshot from the public NBHPA league pages.
//
//   node scraper/fetch.mjs            -> refresh if the snapshot is older than MIN_AGE_MIN
//   node scraper/fetch.mjs --force    -> refresh now
//
// The script makes about 5 requests per run, waits between them, and keeps the old
// snapshot if anything looks wrong. Run it from a scheduler (see .github/workflows).
import { JSDOM } from 'jsdom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

globalThis.DOMParser = new JSDOM('').window.DOMParser;
await import('../shared/parsers.js');

const BASE = 'https://admin.nbhpa.com';
const CFG = {
  leagueId: process.env.LEAGUE_ID ?? '10',
  seasonId: process.env.SEASON_ID ?? '4307', // LDHML AUTOMNE 2026
  categoryId: process.env.CATEGORY_ID ?? '6796', // LDHML RETRO
  seasonName: process.env.SEASON_NAME ?? 'Automne 2026',
  categoryName: process.env.CATEGORY_NAME ?? 'RETRO',
  minAgeMin: Number(process.env.MIN_AGE_MIN ?? 15),
  delayMs: Number(process.env.DELAY_MS ?? 1500),
};
const UA = 'ldhml-stats-poc/0.1 (community stats viewer; low-volume; contact: league player)';
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));

async function http(url, init = {}, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      if (i === tries) throw e;
    }
    await sleep(CFG.delayMs * i * 2);
  }
  throw new Error(`Failed: ${url}`);
}

const form = (extra = {}) => new URLSearchParams({
  season_id: CFG.seasonId, category_id: CFG.categoryId, league_id: CFG.leagueId, ...extra,
});

// ---------- parsers ----------
// The parsers live in shared/parsers.js. The browser runs the same file for live data.
export const { parseStandings, parsePlayers, parseGoalies, parseSchedule, parseRecap } = globalThis.LDParsers;

// ---------- main ----------

async function readJson(name) {
  try { return JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8')); } catch { return null; }
}

async function main() {
  const force = process.argv.includes('--force');
  const old = await readJson('meta.json');
  if (!force && old?.fetchedAt) {
    const ageMin = (Date.now() - Date.parse(old.fetchedAt)) / 60000;
    if (ageMin < CFG.minAgeMin) {
      console.log(`Snapshot is ${ageMin.toFixed(1)} min old (limit ${CFG.minAgeMin}). Nothing to do.`);
      return;
    }
  }

  const fields = ['team_id', 'team_name', 'team_abb', 'team_pic', 'position', 'gp', 'wins_tot', 'losses', 'ot',
    'ot_loss', 'pts', 'gf', 'ga', 'diff', 'pts_gp'];
  const q = new URLSearchParams();
  q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', CFG.leagueId);
  q.set('filters[][league_id]', CFG.leagueId); q.set('filters[][season_id]', CFG.seasonId);
  q.set('category_id', CFG.categoryId); q.set('filters[][category_id]', CFG.categoryId);
  q.set('public_site', '1'); q.set('class', 'Standings');
  fields.forEach((f) => q.append('fields[]', f));
  q.set('page', '1');

  const teams = parseStandings(await (await http(`${BASE}/table_data.php?${q}`)).json());
  await sleep(CFG.delayMs);

  const postForm = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
  const players = parsePlayers(await (await http(`${BASE}/sites/site_stats_players.php?lang=fr`, { ...postForm, body: form() })).text());
  await sleep(CFG.delayMs);
  const goalies = parseGoalies(await (await http(`${BASE}/sites/site_stats_goalies.php?lang=fr`, { ...postForm, body: form() })).text());
  await sleep(CFG.delayMs);
  const games = parseSchedule(await (await http(`${BASE}/sites/site_schedule_include.php?lang=fr`, { ...postForm, body: form({ view: 'list' }) })).text(), teams);

  // Safety checks: keep the old snapshot if the new one looks broken.
  const problems = [];
  if (teams.length < 2) problems.push('fewer than 2 teams');
  if (games.length < 1) problems.push('no games');
  if (games.some((g) => !g.id || !g.away || !g.home || !g.date)) problems.push('incomplete game rows');
  if (players.length < 1) problems.push('no players');
  if (problems.length) {
    console.error('Refusing to overwrite data:', problems.join('; '));
    process.exit(1);
  }

  // Box scores: one request per finished game. Only new games and games from the
  // last 3 days (scores can be corrected) are requested again.
  const box = (await readJson('box.json')) ?? { names: {}, games: {} };
  const recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const todo = games.filter((g) => g.as != null && g.hs != null && !g.cancelled && (!box.games[g.id] || g.date >= recent));
  let boxSaved = 0;
  for (const g of todo) {
    await sleep(CFG.delayMs);
    try {
      const html = await (await http(`${BASE}/sites/site_game_recap.php?game_id=${g.id}&league_id=${CFG.leagueId}&lang=fr`)).text();
      const { game, names } = parseRecap(html);
      if (game.t.length !== 2) throw new Error('unexpected page layout');
      box.games[g.id] = game;
      Object.assign(box.names, names);
      boxSaved++;
    } catch (e) {
      console.warn(`Box score for game ${g.id} skipped: ${e.message}`);
    }
  }

  const meta = {
    league: 'LDHML', category: CFG.categoryName, season: CFG.seasonName,
    seasonId: Number(CFG.seasonId), categoryId: Number(CFG.categoryId),
    fetchedAt: new Date().toISOString(), source: 'admin.nbhpa.com',
  };
  await mkdir(DATA_DIR, { recursive: true });
  const out = { meta, teams, games, players, goalies, box };
  for (const [k, v] of Object.entries(out)) await writeFile(path.join(DATA_DIR, `${k}.json`), JSON.stringify(v));
  console.log(`Saved: ${teams.length} teams, ${games.length} games, ${players.length} players, ${goalies.length} goalies, ${boxSaved} box scores.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
