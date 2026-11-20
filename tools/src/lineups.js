// The changes to a team's lineup for a game: its roster, minus the absent players, plus their replacements, from the
// open replacement requests (approved or pending; refused ones do not count). Shared by both areas:
//   /api/admin/lineups?season=&league=&date=   one game night of a league: every game, both teams (admin)
//   /api/captain/lineups?team=                 every game of one of the captain's teams, that team only
// The schedule is the tools' own (games table); the roster is the current one (rosters table).
import { json, fail } from './http.js';
import { leagueGames, teamGames } from './games.js';

/** Before a roster change touches a team (add, remove, number): copy its current roster to every game already played
 *  that has no copy yet (game_rosters), so the change never rewrites a past game. */
export async function freezePast(DB, teamId) {
  const { results: games } = await DB.prepare(`SELECT g.id FROM games g WHERE (g.away_team = ? OR g.home_team = ?) AND g.cancelled = 0 AND g.date < ?
    AND NOT EXISTS (SELECT 1 FROM game_rosters gr WHERE gr.game_ref = g.id AND gr.team_id = ?)`).bind(teamId, teamId, today(), teamId).all();
  if (!games.length) return;
  const { results: roster } = await DB.prepare('SELECT person_id, pos, jersey FROM rosters WHERE team_id = ? AND removed_at IS NULL').bind(teamId).all();
  if (!roster.length) return;
  await DB.batch(games.flatMap((g) => roster.map((r) => DB.prepare('INSERT OR IGNORE INTO game_rosters (game_ref, team_id, person_id, pos, jersey) VALUES (?, ?, ?, ?, ?)').bind(g.id, teamId, r.person_id, r.pos, r.jersey))));
}
/** The copies of past games: Map "game:team" -> roster rows (as rostersOf). */
async function frozenOf(DB, gameIds, section) {
  const out = new Map();
  if (!gameIds.length) return out;
  const { results } = await DB.prepare(`SELECT gr.game_ref, gr.team_id, gr.person_id, gr.pos, gr.jersey, p.name, p.site_id, p.nid, sp.salary_s, sp.salary_g FROM game_rosters gr
    JOIN people p ON p.id = gr.person_id JOIN games g ON g.id = gr.game_ref
    LEFT JOIN section_players sp ON sp.season_id = g.season_id AND sp.section = ? AND sp.person_id = gr.person_id
    WHERE gr.game_ref IN (${gameIds.map(() => '?').join(',')}) ORDER BY gr.pos DESC, p.name COLLATE NOCASE`).bind(section, ...gameIds).all();
  for (const r of results) {
    const k = r.game_ref + ':' + r.team_id;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push({ person_id: r.person_id, name: r.name, site_id: r.site_id, nid: r.nid, pos: r.pos, jersey: r.jersey, salary: (r.pos === 'g' ? r.salary_g : r.salary_s) ?? null });
  }
  return out;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const round = (v) => Math.round(v * 100) / 100;
const OPEN = "('pending', 'approved')";
const sectionOf = (data, league) => ((data && data.leagues.find((l) => l.slug === league)) || {}).section || '';

/** Rosters of some teams, with the salary of their section's list: Map team id -> [{ person_id, name, site_id, pos, salary }]. */
async function rostersOf(DB, teamIds, section) {
  const out = new Map(teamIds.map((id) => [id, []]));
  if (!teamIds.length) return out;
  const { results } = await DB.prepare(`SELECT r.team_id, r.person_id, r.pos, r.jersey, p.name, p.site_id, p.nid, sp.salary_s, sp.salary_g FROM rosters r JOIN people p ON p.id = r.person_id
    LEFT JOIN section_players sp ON sp.season_id = r.season_id AND sp.section = ? AND sp.person_id = r.person_id
    WHERE r.team_id IN (${teamIds.map(() => '?').join(',')}) AND r.removed_at IS NULL ORDER BY r.pos DESC, p.name COLLATE NOCASE`).bind(section, ...teamIds).all();
  for (const r of results) out.get(r.team_id).push({ person_id: r.person_id, name: r.name, site_id: r.site_id, nid: r.nid, pos: r.pos, jersey: r.jersey, salary: (r.pos === 'g' ? r.salary_g : r.salary_s) ?? null });
  return out;
}

/** Open requests of some teams (optionally one date), with their lines. */
async function openRequests(DB, teamIds, date) {
  if (!teamIds.length) return [];
  const where = `q.team_id IN (${teamIds.map(() => '?').join(',')}) AND q.status IN ${OPEN}` + (date ? ' AND q.game_date = ?' : '');
  const args = date ? [...teamIds, date] : teamIds;
  const { results: reqs } = await DB.prepare(`SELECT q.id, q.team_id, q.status, q.game_ref, q.game_date, q.game_time FROM replacements q WHERE ${where} ORDER BY q.id`).bind(...args).all();
  const { results: lines } = await DB.prepare(`SELECT l.replacement_id, l.absent_id, l.sub_id, l.sub_pos, l.sub_salary, l.sub_jersey, l.guest_name, l.guest_sex, l.guest_age, l.guest_nid,
      ps.name AS sub_name, ps.site_id AS sub_site, ps.nid AS sub_nid
    FROM replacement_lines l LEFT JOIN people ps ON ps.id = l.sub_id WHERE l.replacement_id IN (SELECT q.id FROM replacements q WHERE ${where})`).bind(...args).all();
  return reqs.map((q) => ({ ...q, lines: lines.filter((l) => l.replacement_id === q.id) }));
}

/** The lineup of one team for one of our games. A request for that game (game_ref), or for its date (and time) when typed
 *  by hand. An approved request wins over a pending one, then the newest. */
export function lineup(team, roster, reqs, game, cap) {
  const mine = reqs.filter((q) => q.team_id === team.id && (q.game_ref ? q.game_ref === game.id : q.game_date === game.date && (!q.game_time || !game.time || q.game_time === game.time)))
    .sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === 'approved' ? -1 : 1));
  const byAbsent = new Map();
  for (const q of mine) for (const l of q.lines) if (!byAbsent.has(l.absent_id)) byAbsent.set(l.absent_id, { q, l });
  const players = [], subs = [], absents = [];
  for (const r of roster) {
    const x = byAbsent.get(r.person_id);
    if (!x) { players.push(r); continue; }
    const l = x.l, replaced = !!(l.sub_id || l.guest_name);
    absents.push({ ...r, replaced, req: { id: x.q.id, status: x.q.status } });
    if (!replaced) continue;   // absent, not replaced: the team plays short
    subs.push({ name: l.sub_name || l.guest_name, person_id: l.sub_id || null, site_id: l.sub_site || null, nid: l.sub_nid || l.guest_nid || null, pos: l.sub_pos, jersey: l.sub_jersey ?? null,
      salary: l.sub_salary ?? null, for: r.name, guest: l.guest_name ? { name: l.guest_name, sex: l.guest_sex, age: l.guest_age, nid: l.guest_nid } : null, req: { id: x.q.id, status: x.q.status } });
  }
  const known = (v) => v || 0;
  const before = roster.reduce((t, r) => t + known(r.salary), 0);
  const after = before - absents.reduce((t, r) => t + known(r.salary), 0) + subs.reduce((t, s) => t + known(s.salary), 0);
  const all = players.concat(subs);
  return { team: { id: team.id, name: team.name, abb: team.abb, logo: team.logo || null, nbhpa_team_id: team.nbhpa_team_id, league: team.league },
    players, subs, absents, counts: { s: all.filter((p) => p.pos === 's').length, g: all.filter((p) => p.pos === 'g').length },
    payroll: { before: round(before), after: round(after), cap: cap ?? null } };
}

const gameOut = (g) => ({ id: g.id, date: g.date, time: g.time || null, venue: g.venue || '', court: g.court || '' });

/** Admin: one game night of a league (our schedule). */
export async function leagueNight(DB, data, season, league, date) {
  const games = (await leagueGames(DB, season.id, league)).filter((g) => !g.cancelled);
  const dates = [...new Set(games.map((g) => g.date))].sort();
  const t = today(), d = dates.includes(date) ? date : dates.find((x) => x >= t) || dates[dates.length - 1] || null;
  const night = games.filter((g) => g.date === d);
  const ids = [...new Set(night.flatMap((g) => [g.away.id, g.home.id]).filter(Boolean))];
  const rosters = await rostersOf(DB, ids, sectionOf(data, league)), reqs = await openRequests(DB, ids, d);
  const rules = await DB.prepare('SELECT salary_cap FROM season_leagues WHERE season_id = ? AND league = ?').bind(season.id, league).first();
  const frozen = await frozenOf(DB, night.map((g) => g.id), sectionOf(data, league));
  const side = (tm, g) => (tm && tm.id ? lineup({ ...tm, league }, frozen.get(g.id + ':' + tm.id) || rosters.get(tm.id) || [], reqs, g, rules && rules.salary_cap) : { team: { id: null, name: '?', abb: '?', league }, missing: true });
  return { dates, date: d, today: t, games: night.map((g) => ({ game: gameOut(g), teams: [side(g.away, g), side(g.home, g)] })) };
}

/** Captain (or admin): every game of one team, with that team's lineup. */
export async function teamSchedule(DB, data, team) {
  const games = await teamGames(DB, team);
  const roster = (await rostersOf(DB, [team.id], sectionOf(data, team.league))).get(team.id), reqs = await openRequests(DB, [team.id]);
  const frozen = await frozenOf(DB, games.map((g) => g.id), sectionOf(data, team.league));
  const rules = await DB.prepare('SELECT salary_cap FROM season_leagues WHERE season_id = ? AND league = ?').bind(team.season_id, team.league).first();
  return { today: today(), games: games.map((g) => ({ game: gameOut(g), home: g.home,
    opp: { id: g.opp.id, abb: g.opp.abb, name: g.opp.name, logo: g.opp.logo, nbhpa_team_id: g.opp.nbhpa_team_id },
    lineup: lineup(team, frozen.get(g.id + ':' + team.id) || roster, reqs, g, rules && rules.salary_cap) })) };
}

/** Routes: GET /lineups (admin: ?season&league&date; captain: ?team). Returns a Response or null. */
export async function lineupApi({ env, path, m, url, isAdmin, teamIds, seasonData }) {
  if (m !== 'GET' || path !== '/lineups') return null;
  const DB = env.DB, q = url.searchParams, data = await seasonData();
  if (q.get('team')) {
    const allowed = await teamIds();
    const team = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(Number(q.get('team')) || 0).first();
    if (!team || (allowed !== null && !allowed.includes(team.id))) return fail(404, 'team');
    return json(await teamSchedule(DB, data, team));
  }
  if (!isAdmin) return fail(400, 'team');
  const season = await DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(Number(q.get('season')) || 0).first();
  if (!season) return fail(400, 'season');
  return json(await leagueNight(DB, data, season, String(q.get('league') || ''), q.get('date')));
}
