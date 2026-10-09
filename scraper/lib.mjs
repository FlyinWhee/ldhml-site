// Shared by scraper/fetch.mjs (network) and scraper/import-raw.mjs (a saved raw file).
import { JSDOM } from 'jsdom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

globalThis.DOMParser = new JSDOM('').window.DOMParser;
await import('../shared/parsers.js');

export const { parseStandings, parsePlayers, parseGoalies, parseSchedule, parseRecap } = globalThis.LDParsers;
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

export async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}
export const loadLeagues = async () => JSON.parse(await readFile(path.join(ROOT, 'leagues.json'), 'utf8'));

/** Turn raw responses of one league into the snapshot files. Returns { problems, out }.
 *  raw = { standings: object, players: html, goalies: html, schedule: html, recaps: { gameId: html } } */
export function assemble(raw, lg, cfg, oldBox) {
  const teams = parseStandings(typeof raw.standings === 'string' ? JSON.parse(raw.standings) : raw.standings);
  const players = parsePlayers(raw.players);
  const goalies = parseGoalies(raw.goalies);
  const games = parseSchedule(raw.schedule, teams);

  const problems = [];
  if (teams.length < 2) problems.push('fewer than 2 teams');
  if (games.length < 1) problems.push('no games');
  if (games.some((g) => !g.id || !g.away || !g.home || !g.date)) problems.push('incomplete game rows');
  if (players.length < 1) problems.push('no players');

  const box = oldBox ?? { names: {}, games: {} };
  let boxSaved = 0;
  for (const [id, html] of Object.entries(raw.recaps ?? {})) {
    try {
      const { game, names } = parseRecap(html);
      if (game.t.length !== 2) throw new Error('unexpected page layout');
      box.games[id] = game;
      Object.assign(box.names, names);
      boxSaved++;
    } catch (e) { console.warn(`  box score ${id} skipped: ${e.message}`); }
  }
  const meta = {
    league: 'LDHML', category: lg.short, slug: lg.slug, name: lg.name, season: cfg.seasonName,
    leagueId: cfg.leagueId, seasonId: cfg.seasonId, categoryId: lg.categoryId,
    fetchedAt: new Date().toISOString(), source: 'admin.nbhpa.com'
  };
  return { problems, boxSaved, out: { meta, teams, games, players, goalies, box } };
}

export async function saveLeague(slug, out) {
  const dir = path.join(DATA_DIR, slug);
  await mkdir(dir, { recursive: true });
  for (const [k, v] of Object.entries(out)) await writeFile(path.join(dir, `${k}.json`), JSON.stringify(v));
}
