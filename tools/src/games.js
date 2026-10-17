// The tools' own schedule (table games). Every feature reads it; nothing reads the NBHPA schedule directly.
// NBHPA is an optional source: importNbhpa() adds and updates games by their NBHPA no. from the build snapshot
// (/data/season.json) and never touches a game an admin changed by hand. Read docs/tools.md.
import { json, fail, readJson, cleanText, now } from './http.js';
import { isArchived } from './seasons.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/, HOUR = /^\d{2}:\d{2}$/;
const intId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** Games with both teams, as the pages need them: { id, date, time, venue, court, cancelled, nbhpa_game_id, away:{team}, home:{team} }. */
async function withTeams(DB, games) {
  const ids = [...new Set(games.flatMap((g) => [g.away_team, g.home_team]).filter(Boolean))];
  const teams = ids.length ? (await DB.prepare(`SELECT id, league, name, abb, logo, nbhpa_team_id FROM teams WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
  const byId = new Map(teams.map((t) => [t.id, t]));
  const side = (id) => byId.get(id) || { id: null, name: '?', abb: '?', logo: null, nbhpa_team_id: null };
  return games.map((g) => ({ id: g.id, league: g.league, date: g.date, time: g.time, venue: g.venue || '', court: g.court || '', cancelled: !!g.cancelled,
    nbhpa_game_id: g.nbhpa_game_id, edited: !!g.edited, away: side(g.away_team), home: side(g.home_team) }));
}
/** A short label for history: "FLI @ GHO · Venue 1". */
export const gameLabel = (g) => g.away.abb + ' @ ' + g.home.abb + (g.venue ? ' · ' + g.venue + (g.court ? ' ' + g.court : '') : '');

/** One game, with its teams. */
export async function gameById(DB, id) {
  const g = await DB.prepare('SELECT * FROM games WHERE id = ?').bind(intId(id) || 0).first();
  return g ? (await withTeams(DB, [g]))[0] : null;
}
/** A team's games (not cancelled), oldest first, each with home (true when the team plays at home) and opp (the other team). */
export async function teamGames(DB, team) {
  const { results } = await DB.prepare('SELECT * FROM games WHERE season_id = ? AND (away_team = ? OR home_team = ?) AND cancelled = 0 ORDER BY date, time')
    .bind(team.season_id, team.id, team.id).all();
  return (await withTeams(DB, results)).map((g) => ({ ...g, home: g.home.id === team.id, homeTeam: g.home, opp: g.home.id === team.id ? g.away : g.home }));
}
/** A league's games of a season (cancelled too), oldest first, with both teams. */
export async function leagueGames(DB, seasonId, league) {
  const { results } = await DB.prepare('SELECT * FROM games WHERE season_id = ? AND league = ? ORDER BY date, time, court').bind(seasonId, league).all();
  return withTeams(DB, results);
}
/** The team ids playing at a slot (date + time), in any league of the season. */
export async function teamsPlayingAt(DB, seasonId, date, time) {
  const { results } = await DB.prepare('SELECT away_team, home_team FROM games WHERE season_id = ? AND date = ? AND time = ? AND cancelled = 0').bind(seasonId, date, time).all();
  return new Set(results.flatMap((g) => [g.away_team, g.home_team]).filter(Boolean));
}

/** What the NBHPA snapshot would add or change for a season (and one league): { add, update, kept, unmatched, rows }. Writes nothing. */
export async function nbhpaPlan(DB, data, season, league) {
  const plan = { add: [], update: [], kept: 0, unmatched: 0 };
  if (!data || !season || season.nbhpa_season_id !== data.seasonId) return null;
  for (const l of data.leagues.filter((x) => !league || x.slug === league)) {
    const { results: teams } = await DB.prepare('SELECT id, nbhpa_team_id FROM teams WHERE season_id = ? AND league = ? AND nbhpa_team_id IS NOT NULL').bind(season.id, l.slug).all();
    const ours = new Map(teams.map((t) => [t.nbhpa_team_id, t.id]));
    const { results: have } = await DB.prepare('SELECT * FROM games WHERE season_id = ? AND league = ? AND nbhpa_game_id IS NOT NULL').bind(season.id, l.slug).all();
    const byNb = new Map(have.map((g) => [g.nbhpa_game_id, g]));
    for (const g of l.games || []) {
      const away = ours.get(g.away), home = ours.get(g.home);
      if (!away || !home) { plan.unmatched++; continue; }   // a team not in the tools yet: import the teams first
      const row = { league: l.slug, nb: g.id, date: g.date, time: g.time || null, venue: g.venue || null, court: g.court || null, away, home, cancelled: g.cancelled ? 1 : 0 };
      const cur = byNb.get(g.id);
      if (!cur) { plan.add.push(row); continue; }
      if (cur.edited) { plan.kept++; continue; }
      if (cur.date !== row.date || (cur.time || null) !== row.time || (cur.venue || null) !== row.venue || (cur.court || null) !== row.court ||
          cur.away_team !== away || cur.home_team !== home || cur.cancelled !== row.cancelled) plan.update.push({ ...row, id: cur.id });
    }
  }
  return plan;
}
/** Import the NBHPA schedule (and the team logos) for a season: adds and updates, never deletes, never touches edited games. */
export async function importNbhpa(DB, data, season, league, adminId) {
  const plan = await nbhpaPlan(DB, data, season, league);
  if (!plan) return null;
  const t = now(), writes = [];
  for (const r of plan.add) writes.push(DB.prepare(`INSERT INTO games (season_id, league, date, time, venue, court, away_team, home_team, cancelled, nbhpa_game_id, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(season.id, r.league, r.date, r.time, r.venue, r.court, r.away, r.home, r.cancelled, r.nb, t, adminId));
  for (const r of plan.update) writes.push(DB.prepare('UPDATE games SET date = ?, time = ?, venue = ?, court = ?, away_team = ?, home_team = ?, cancelled = ?, updated_at = ?, updated_by = ? WHERE id = ? AND edited = 0')
    .bind(r.date, r.time, r.venue, r.court, r.away, r.home, r.cancelled, t, adminId, r.id));
  // team logos: copied when our team has none
  for (const l of data.leagues.filter((x) => !league || x.slug === league)) for (const tm of l.teams) if (tm.logo)
    writes.push(DB.prepare('UPDATE teams SET logo = ? WHERE season_id = ? AND league = ? AND nbhpa_team_id = ? AND logo IS NULL').bind(tm.logo, season.id, l.slug, tm.id));
  // replacements made before the games were in the tools: point them to our game
  writes.push(DB.prepare(`UPDATE replacements SET game_ref = (SELECT g.id FROM games g WHERE g.season_id = replacements.season_id AND g.league = replacements.league AND g.nbhpa_game_id = replacements.game_id)
    WHERE season_id = ? AND game_ref IS NULL AND game_id IS NOT NULL`).bind(season.id));
  for (let i = 0; i < writes.length; i += 50) await DB.batch(writes.slice(i, i + 50));
  return { added: plan.add.length, updated: plan.update.length, kept: plan.kept, unmatched: plan.unmatched };
}

/** Game fields from a body (admin add or edit). null when not valid. */
async function gameFields(DB, season, league, b) {
  const date = String(b.date || ''), time = b.time ? String(b.time) : null;
  const away = intId(b.away_team), home = intId(b.home_team);
  if (!DAY.test(date) || (time && !HOUR.test(time)) || !away || !home || away === home) return null;
  const { results } = await DB.prepare(`SELECT id FROM teams WHERE season_id = ? AND league = ? AND id IN (?, ?)`).bind(season.id, league, away, home).all();
  if (results.length !== 2) return null;
  const venue = b.venue ? cleanText(b.venue, 80) : null, court = b.court ? cleanText(b.court, 10) : null;
  if ((b.venue && !venue) || (b.court && !court)) return null;
  return { date, time, venue, court, away, home, cancelled: b.cancelled ? 1 : 0 };
}

/** Admin routes: /games (list, add), /games/:id (edit), /games/:id/delete, /games/import (GET: what would change; POST: import). */
export async function gamesApi({ req, env, path, m, url, admin, audit, seasonData }) {
  if (!path.startsWith('/games')) return null;
  const DB = env.DB, q = url.searchParams;
  const seasonOf = (id) => DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(intId(id) || 0).first();
  let x;
  if (m === 'GET' && path === '/games') {
    const season = await seasonOf(q.get('season'));
    if (!season) return fail(400, 'season');
    return json({ games: await leagueGames(DB, season.id, String(q.get('league') || '')) });
  }
  if (path === '/games/import') {
    const b = m === 'POST' ? await readJson(req) || {} : {};
    const season = await seasonOf(m === 'POST' ? b.season_id : q.get('season')), league = (m === 'POST' ? b.league : q.get('league')) || null;
    if (!season) return fail(400, 'season');
    const data = await seasonData();
    if (m === 'GET') {
      const plan = await nbhpaPlan(DB, data, season, league);
      return json(plan ? { available: true, add: plan.add.length, update: plan.update.length, kept: plan.kept, unmatched: plan.unmatched } : { available: false });
    }
    if (m !== 'POST') return fail(404, 'not_found');
    if (await isArchived(DB, season.id)) return fail(409, 'season_archived');
    const r = await importNbhpa(DB, data, season, league, admin.id);
    if (!r) return fail(400, 'no_season_data');
    await audit('games.import', 'season:' + season.id, { league, ...r });
    return json({ ok: true, ...r });
  }
  if (m === 'POST' && path === '/games') {
    const b = await readJson(req) || {}, season = await seasonOf(b.season_id);
    const lg = (await seasonData() || { leagues: [] }).leagues.find((l) => l.slug === b.league);
    if (!season || !lg) return fail(400, 'game');
    if (await isArchived(DB, season.id)) return fail(409, 'season_archived');
    const f = await gameFields(DB, season, lg.slug, b);
    if (!f) return fail(400, 'game');
    const r = await DB.prepare(`INSERT INTO games (season_id, league, date, time, venue, court, away_team, home_team, cancelled, edited, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(season.id, lg.slug, f.date, f.time, f.venue, f.court, f.away, f.home, f.cancelled, now(), admin.id).run();
    await audit('game.create', 'game:' + r.meta.last_row_id, { league: lg.slug, date: f.date, time: f.time });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  x = path.match(/^\/games\/(\d+)$/);
  if (m === 'POST' && x) {
    const g = await DB.prepare('SELECT * FROM games WHERE id = ?').bind(Number(x[1])).first();
    if (!g) return fail(404, 'game');
    if (await isArchived(DB, g.season_id)) return fail(409, 'season_archived');
    const f = await gameFields(DB, await seasonOf(g.season_id), g.league, await readJson(req) || {});
    if (!f) return fail(400, 'game');
    // a change by hand: the NBHPA import leaves this game alone from now on
    await DB.prepare('UPDATE games SET date = ?, time = ?, venue = ?, court = ?, away_team = ?, home_team = ?, cancelled = ?, edited = 1, updated_at = ?, updated_by = ? WHERE id = ?')
      .bind(f.date, f.time, f.venue, f.court, f.away, f.home, f.cancelled, now(), admin.id, g.id).run();
    await DB.prepare('UPDATE replacements SET game_date = ?, game_time = ? WHERE game_ref = ?').bind(f.date, f.time, g.id).run();
    await audit('game.update', 'game:' + g.id, { date: f.date, time: f.time, cancelled: !!f.cancelled });
    return json({ ok: true });
  }
  x = path.match(/^\/games\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const g = await DB.prepare('SELECT * FROM games WHERE id = ?').bind(Number(x[1])).first();
    if (!g) return fail(404, 'game');
    if (await isArchived(DB, g.season_id)) return fail(409, 'season_archived');
    if (await DB.prepare('SELECT 1 FROM replacements WHERE game_ref = ?').bind(g.id).first()) return fail(409, 'game_in_use');
    await DB.prepare('DELETE FROM games WHERE id = ?').bind(g.id).run();
    await audit('game.delete', 'game:' + g.id, { league: g.league, date: g.date });
    return json({ ok: true });
  }
  return fail(404, 'not_found');
}
