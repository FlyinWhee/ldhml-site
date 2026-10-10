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
/* Value of each goal (goal[6]). The recap shows each scorer's running goal total, and a goal by a woman adds 2 to it
 * in the mixed leagues, so the value of a goal is the step from the scorer's previous total. Nothing is guessed from
 * the player's sex unless the step is not 1 or 2 (a missing earlier recap). A team goal (no scorer) has no value (null):
 * game.amb lists the teams whose known values do not add up to the final score, so the page can mark the score as approximate. */
export function weighGoals(box, games, teams, players) {
  const abbOf = Object.fromEntries(teams.map((t) => [t.id, t.abb]));
  const sexOf = Object.fromEntries(players.map((p) => [p.id, p.sex]));
  const gameOf = Object.fromEntries(games.map((g) => [g.id, g]));
  const ids = Object.keys(box.games).filter((id) => gameOf[id]).sort((a, b) => {
    const x = gameOf[a], y = gameOf[b];
    return (x.date + x.time + a).localeCompare(y.date + y.time + b);
  });
  const last = {};
  for (const id of ids) {
    const bg = box.games[id], g = gameOf[id];
    const mine = {};
    bg.goals.forEach((go) => { if (go[3] && go[5] > 0) (mine[go[3]] ??= []).push(go); });
    for (const [pid, list] of Object.entries(mine)) {
      list.sort((a, b) => a[5] - b[5]);
      let prev = last[pid] ?? 0;
      for (const go of list) {
        const step = go[5] - prev;
        go[6] = step === 1 || step === 2 ? step : (sexOf[pid] === 'f' ? 2 : 1);
        prev = go[5];
      }
      last[pid] = prev;
    }
    bg.goals.forEach((go) => { if (!go[3] || !(go[5] > 0)) go[6] = null; });
    delete bg.amb;
    const amb = [];
    if (bg.goals.every((go) => go.length > 5)) {
      for (const [side, tid] of [['as', g.away], ['hs', g.home]]) {
        if (g[side] == null) continue;
        const own = bg.goals.filter((go) => go[2] === abbOf[tid]);
        const known = own.reduce((n, go) => n + (go[6] ?? 0), 0), unk = own.filter((go) => go[6] == null).length;
        if (known + unk !== g[side]) amb.push(abbOf[tid]);
      }
    }
    if (amb.length) bg.amb = amb;
  }
}

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
  weighGoals(box, games, teams, players);
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
