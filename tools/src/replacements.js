// Replacement requests, shared by both areas: /api/captain/replacements... (a captain, for their own teams) and
// /api/admin/replacements... (an admin, for any team: they build requests for captains who are less at ease with tech).
// Read tools/CLAUDE.md and docs/tools.md.
//
// One request = one game of one team, with one line per absent player (absent -> replacement, at a position).
// The checks run while the request is built, again when it is saved, and again when an admin decides.
// No rule engine: each check is coded here as a league confirms it, and reads its numbers from league_rules.
//   absent  the absent player is on the team's roster
//   listed  the replacement is on the section's player list for the season
//   own     the replacement is not already on this team
//   busy    the replacement does not play at the same time (their own team's game, or another request)
//   age     minimum age (men, women, goalies), from birth month and year; on the game date or in its year (age_on)
//   salary  the salaries the cap check needs are known
//   cap     team payroll - absent salaries + replacement salaries <= salary cap (salary of the position played)
//   dup     no other open request of this team for this game names the same players
// Each check: { k, s: 'ok' | 'warn' | 'fail', line?: index, d?: details }. Missing data gives 'warn' (to check), never a silent pass.
// Captains never get birth dates: the age check says only whether the minimum is met.
import { json, fail, readJson, cleanText, now } from './http.js';

const MAX_LINES = 8;
const OPEN = "('pending', 'approved')";
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const intId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** Possible age on a date, from birth year and month only: { lo, hi }. mode 'year': the age reached during that year. */
function ageRange(by, bm, date, mode) {
  const y = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7));
  if (mode === 'year') return { lo: y - by, hi: y - by };
  if (!bm || bm === mo) return { lo: y - by - 1, hi: y - by };   // unknown month, or the birthday is in the game's month
  return bm < mo ? { lo: y - by, hi: y - by } : { lo: y - by - 1, hi: y - by - 1 };
}
/** The minimum age that applies to a person at a position, or undefined when none applies. A goalie follows the goalie
 *  rule; without one, the rule of their sex. Unknown sex: the men/women rule when both are the same, otherwise null (to check). */
function minAge(rules, sex, pos) {
  if (!rules) return undefined;
  if (pos === 'g' && rules.min_age_g != null) return rules.min_age_g;
  if (rules.min_age_m == null && rules.min_age_f == null) return undefined;
  if (sex === 'm') return rules.min_age_m ?? undefined;
  if (sex === 'f') return rules.min_age_f ?? undefined;
  return rules.min_age_m === rules.min_age_f ? rules.min_age_m : null;
}
/** Age check of one person at one position: null (no rule) or { s, d }. */
export function ageCheck(rules, p, pos, date) {
  const min = minAge(rules, p.sex, pos);
  if (min === undefined) return null;
  if (min === null) return { s: 'warn', d: { why: 'no_sex' } };
  if (!p.birth_year) return { s: 'warn', d: { min, why: 'no_birth' } };
  const a = ageRange(p.birth_year, p.birth_month, date, rules.age_on);
  return a.lo >= min ? { s: 'ok', d: { min } } : a.hi < min ? { s: 'fail', d: { min } } : { s: 'warn', d: { min, why: 'birthday' } };
}

const leagueOf = (data, slug) => data && data.leagues.find((l) => l.slug === slug);
/** The stats data covers this team's season (its schedule can be used). */
const sameSeason = (data, season) => data && season && season.nbhpa_season_id === data.seasonId;
const label = (lg, g) => {
  const abb = (id) => ((lg.teams.find((t) => t.id === id) || {}).abb || '?');
  return abb(g.away) + ' @ ' + abb(g.home) + (g.venue ? ' · ' + g.venue + (g.court ? ' ' + g.court : '') : '');
};

/** The game of a request: an NBHPA game of this team, or a date (and time) typed by hand. null when not valid. */
function resolveGame(data, season, team, b) {
  const lg = leagueOf(data, team.league);
  if (b.game_id) {
    if (!sameSeason(data, season) || !lg || !team.nbhpa_team_id) return null;
    const g = (lg.games || []).find((x) => x.id === String(b.game_id) && (x.away === team.nbhpa_team_id || x.home === team.nbhpa_team_id));
    return g ? { id: g.id, date: g.date, time: g.time || null, label: label(lg, g) } : null;
  }
  const date = String(b.game_date || ''), time = b.game_time ? String(b.game_time) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^\d{2}:\d{2}$/.test(time))) return null;
  return { id: null, date, time, label: null };
}

/** Lines from a request body: [{ absent_id, sub_id, sub_pos }], each person once. null when not valid. */
function readLines(b) {
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > MAX_LINES) return null;
  const lines = b.lines.map((l) => ({ absent_id: intId(l && l.absent_id), sub_id: intId(l && l.sub_id), sub_pos: l && l.sub_pos }));
  if (lines.some((l) => !l.absent_id || !l.sub_id || !['s', 'g'].includes(l.sub_pos))) return null;
  const ids = lines.flatMap((l) => [l.absent_id, l.sub_id]);
  return new Set(ids).size === ids.length ? lines : null;
}

/** A team's active roster, with the salaries of its section's list (salary = at the roster position). */
async function teamRoster(DB, team, section) {
  const { results } = await DB.prepare(`SELECT r.person_id, r.pos, p.name, p.site_id, p.sex, p.birth_year, p.birth_month, sp.salary_s, sp.salary_g
    FROM rosters r JOIN people p ON p.id = r.person_id
    LEFT JOIN section_players sp ON sp.season_id = r.season_id AND sp.section = ? AND sp.person_id = r.person_id
    WHERE r.team_id = ? AND r.removed_at IS NULL ORDER BY r.pos DESC, p.name COLLATE NOCASE`).bind(section, team.id).all();
  return results.map((x) => ({ ...x, salary: x.pos === 'g' ? x.salary_g : x.salary_s }));
}

/** Who plays at that slot: person id -> { abb, league } (their own team's game) or { req } (another open request).
 *  Only when the time is known. exceptReq: the request being checked again. */
async function busyAt(DB, data, season, team, slot, exceptReq) {
  const out = new Map();
  if (!slot.time) return out;
  if (sameSeason(data, season)) {
    const playing = new Map();   // nbhpa team id + league -> playing at that slot
    for (const l of data.leagues) for (const g of l.games || []) if (!g.cancelled && g.date === slot.date && g.time === slot.time) {
      playing.set(l.slug + ':' + g.away, 1); playing.set(l.slug + ':' + g.home, 1);
    }
    if (playing.size) {
      const { results } = await DB.prepare(`SELECT r.person_id, r.league, t.abb, t.nbhpa_team_id FROM rosters r JOIN teams t ON t.id = r.team_id
        WHERE r.season_id = ? AND r.removed_at IS NULL AND t.nbhpa_team_id IS NOT NULL`).bind(season.id).all();
      for (const r of results) if (r.nbhpa_team_id !== team.nbhpa_team_id || r.league !== team.league) if (playing.has(r.league + ':' + r.nbhpa_team_id)) out.set(r.person_id, { abb: r.abb, league: r.league });
    }
  }
  const { results: subs } = await DB.prepare(`SELECT l.sub_id, q.id, t.abb, q.league FROM replacement_lines l JOIN replacements q ON q.id = l.replacement_id JOIN teams t ON t.id = q.team_id
    WHERE q.season_id = ? AND q.game_date = ? AND q.game_time = ? AND q.status IN ${OPEN} AND q.id <> ?`).bind(season.id, slot.date, slot.time, exceptReq || 0).all();
  for (const s of subs) if (!out.has(s.sub_id)) out.set(s.sub_id, { abb: s.abb, league: s.league, req: s.id });
  return out;
}

/** Run every check. Returns { result, checks, payroll, lines (with positions and salaries) }. */
export async function evaluate(DB, data, season, team, slot, lines, exceptReq) {
  const lg = leagueOf(data, team.league), section = lg ? lg.section : null;
  const rules = await DB.prepare('SELECT * FROM league_rules WHERE season_id = ? AND league = ?').bind(team.season_id, team.league).first();
  const roster = await teamRoster(DB, team, section);
  const onTeam = new Map(roster.map((r) => [r.person_id, r]));
  const listed = new Map((await DB.prepare(`SELECT p.id, p.name, p.sex, p.birth_year, p.birth_month, sp.salary_s, sp.salary_g, sp.id AS sp
    FROM people p LEFT JOIN section_players sp ON sp.person_id = p.id AND sp.season_id = ? AND sp.section = ?
    WHERE p.id IN (${lines.map(() => '?').join(',')})`).bind(team.season_id, section, ...lines.map((l) => l.sub_id)).all()).results.map((p) => [p.id, p]));
  const busy = await busyAt(DB, data, season, team, slot, exceptReq);
  const cap = rules && rules.salary_cap != null ? rules.salary_cap : null;
  const checks = [], out = [];
  lines.forEach((l, i) => {
    const a = onTeam.get(l.absent_id), p = listed.get(l.sub_id) || {};
    const absentPos = a ? a.pos : 's', subSalary = l.sub_pos === 'g' ? p.salary_g : p.salary_s;
    out.push({ ...l, absent_pos: absentPos, absent_salary: a ? a.salary ?? null : null, sub_salary: p.sp ? subSalary ?? null : null });
    checks.push({ k: 'absent', s: a ? 'ok' : 'fail', line: i });
    checks.push({ k: 'listed', s: p.sp ? 'ok' : 'fail', line: i });
    checks.push({ k: 'own', s: onTeam.has(l.sub_id) ? 'fail' : 'ok', line: i });
    if (slot.time) { const b = busy.get(l.sub_id); checks.push(b ? { k: 'busy', s: 'fail', line: i, d: b } : { k: 'busy', s: 'ok', line: i }); }
    const ag = ageCheck(rules, p, l.sub_pos, slot.date);
    if (ag) checks.push({ k: 'age', s: ag.s, line: i, d: { ...ag.d, pos: l.sub_pos } });
    if (cap != null) {
      const missing = [a && a.salary == null ? 'absent' : null, p.sp && subSalary == null ? 'sub' : null].filter(Boolean);
      checks.push(missing.length ? { k: 'salary', s: 'warn', line: i, d: { missing } } : { k: 'salary', s: 'ok', line: i });
    }
  });
  const known = (v) => (v == null ? 0 : v);
  const before = roster.reduce((t, r) => t + known(r.salary), 0);
  const after = before - out.reduce((t, l) => t + known(l.absent_salary), 0) + out.reduce((t, l) => t + known(l.sub_salary), 0);
  const missingRoster = roster.filter((r) => r.salary == null).length;
  const payroll = { before: round(before), after: round(after), cap, missing: missingRoster };
  if (cap != null) {
    const unknownLine = out.some((l) => (onTeam.has(l.absent_id) && l.absent_salary == null) || l.sub_salary == null);
    checks.push({ k: 'cap', s: unknownLine ? 'warn' : after > cap + 1e-9 ? 'fail' : missingRoster ? 'warn' : 'ok', d: payroll });
  }
  const others = (await DB.prepare(`SELECT q.id, l.absent_id, l.sub_id FROM replacements q JOIN replacement_lines l ON l.replacement_id = q.id
    WHERE q.team_id = ? AND q.game_date = ? AND (q.game_time IS ? OR q.game_time IS NULL OR ? IS NULL) AND q.status IN ${OPEN} AND q.id <> ?`)
    .bind(team.id, slot.date, slot.time, slot.time, exceptReq || 0).all()).results;
  const dupIds = [...new Set(others.filter((o) => lines.some((l) => l.absent_id === o.absent_id || l.sub_id === o.sub_id)).map((o) => o.id))];
  if (dupIds.length) checks.push({ k: 'dup', s: 'warn', d: { ids: dupIds } });
  const result = checks.some((c) => c.s === 'fail') ? 'fail' : checks.some((c) => c.s === 'warn') ? 'warn' : 'ok';
  return { result, checks, payroll, lines: out };
}
const round = (v) => Math.round(v * 100) / 100;

/**
 * Routes under /replacements (path is already without /api/admin or /api/captain).
 * actor = { kind: 'admin' | 'captain', id }. teamIds(): the team ids this actor may act for (null = every team: admin).
 * Returns a Response, or null when the route is not one of these.
 */
export async function replacementApi({ req, env, path, m, url, actor, teamIds, audit, seasonData }) {
  if (!path.startsWith('/replacements')) return null;
  const DB = env.DB, q = url.searchParams, isAdmin = actor.kind === 'admin';
  const data = await seasonData();
  const allowed = await teamIds();
  const teamRow = async (id) => {
    const t = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(intId(id) || 0).first();
    return t && (allowed === null || allowed.includes(t.id)) ? t : null;
  };
  const seasonOf = (id) => DB.prepare('SELECT * FROM seasons WHERE id = ?').bind(id).first();
  let x;

  // Everything the builder needs for one team: roster with salaries, rules, the team's games, and (once a game is
  // chosen) the candidates of the section's list with their status at that game. No birth dates leave the server.
  if (m === 'GET' && path === '/replacements/builder') {
    const team = await teamRow(q.get('team'));
    if (!team) return fail(404, 'team');
    const season = await seasonOf(team.season_id), lg = leagueOf(data, team.league);
    const rules = await DB.prepare('SELECT salary_cap, min_age_m, min_age_f, min_age_g, age_on, notes FROM league_rules WHERE season_id = ? AND league = ?').bind(team.season_id, team.league).first();
    const roster = (await teamRoster(DB, team, lg && lg.section)).map((r) => ({ person_id: r.person_id, name: r.name, site_id: r.site_id, pos: r.pos, salary: r.salary ?? null }));
    const games = sameSeason(data, season) && lg && team.nbhpa_team_id
      ? (lg.games || []).filter((g) => !g.cancelled && (g.away === team.nbhpa_team_id || g.home === team.nbhpa_team_id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) : [];
    const out = { team: { id: team.id, season_id: team.season_id, league: team.league, name: team.name, abb: team.abb, nbhpa_team_id: team.nbhpa_team_id }, season: season && { id: season.id, name: season.name }, rules, roster, games, today: today(), candidates: null };
    const slot = (q.get('game') || q.get('date')) ? resolveGame(data, season, team, { game_id: q.get('game'), game_date: q.get('date'), game_time: q.get('time') }) : null;
    if (slot) {
      const { results: list } = await DB.prepare(`SELECT p.id, p.name, p.site_id, p.sex, p.birth_year, p.birth_month, sp.salary_s, sp.salary_g
        FROM section_players sp JOIN people p ON p.id = sp.person_id WHERE sp.season_id = ? AND sp.section = ? ORDER BY p.name COLLATE NOCASE`).bind(team.season_id, lg ? lg.section : '').all();
      const { results: ros } = await DB.prepare(`SELECT r.person_id, t.id AS team_id, t.abb, t.name, t.nbhpa_team_id FROM rosters r JOIN teams t ON t.id = r.team_id
        WHERE r.season_id = ? AND r.league = ? AND r.removed_at IS NULL`).bind(team.season_id, team.league).all();
      const teamOf = new Map(ros.map((r) => [r.person_id, r]));
      const fullRules = await DB.prepare('SELECT * FROM league_rules WHERE season_id = ? AND league = ?').bind(team.season_id, team.league).first();
      const busy = await busyAt(DB, data, season, team, slot, 0);
      out.slot = slot;
      out.candidates = list.filter((p) => !(teamOf.get(p.id) && teamOf.get(p.id).team_id === team.id)).map((p) => {
        const age = (pos) => { const a = ageCheck(fullRules, p, pos, slot.date); return a ? a.s : null; };
        const tm = teamOf.get(p.id), b = busy.get(p.id);
        return { id: p.id, name: p.name, site_id: p.site_id, sex: p.sex, salary_s: p.salary_s, salary_g: p.salary_g,
          team: tm ? { abb: tm.abb, name: tm.name, nbhpa_team_id: tm.nbhpa_team_id } : null, age: { s: age('s'), g: age('g') }, busy: b ? { abb: b.abb, league: b.league } : null };
      });
    }
    return json(out);
  }

  // Check a request without saving it (the builder calls this after each change).
  if (m === 'POST' && (path === '/replacements/check' || path === '/replacements')) {
    const b = await readJson(req, 16384) || {};
    const team = await teamRow(b.team_id);
    if (!team) return fail(404, 'team');
    const season = await seasonOf(team.season_id), slot = resolveGame(data, season, team, b), lines = readLines(b);
    if (!slot) return fail(400, 'game');
    if (!lines) return fail(400, 'replacement');
    const ev = await evaluate(DB, data, season, team, slot, lines, 0);
    if (path === '/replacements/check') return json({ result: ev.result, checks: ev.checks, payroll: ev.payroll });
    const note = b.note ? cleanText(b.note, 1000) : null;
    if (b.note && !note) return fail(400, 'replacement');
    if (ev.result === 'fail' && !note) return fail(400, 'note_required', { checks: ev.checks });
    const approveNow = isAdmin && b.approve === true, t = now();
    const r = await DB.prepare(`INSERT INTO replacements (season_id, league, team_id, game_id, game_date, game_time, game_label, status, result, checks, note, created_at, created_kind, created_by, decided_at, decided_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(team.season_id, team.league, team.id, slot.id, slot.date, slot.time, slot.label,
      approveNow ? 'approved' : 'pending', ev.result, JSON.stringify({ checks: ev.checks, payroll: ev.payroll }), note, t, actor.kind, actor.id, approveNow ? t : null, approveNow ? actor.id : null).run();
    const id = r.meta.last_row_id;
    await DB.batch(ev.lines.map((l) => DB.prepare('INSERT INTO replacement_lines (replacement_id, absent_id, absent_pos, absent_salary, sub_id, sub_pos, sub_salary) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, l.absent_id, l.absent_pos, l.absent_salary, l.sub_id, l.sub_pos, l.sub_salary)));
    await audit('replacement.create', 'replacement:' + id, { team: team.id, game: slot.id || slot.date, lines: lines.length, result: ev.result, status: approveNow ? 'approved' : 'pending' });
    return json({ ok: true, id, status: approveNow ? 'approved' : 'pending', result: ev.result }, 201);
  }

  // Pending requests per league (admin: the count on the tab and the league buttons).
  if (m === 'GET' && path === '/replacements/pending' && isAdmin) {
    const { results } = await DB.prepare("SELECT league, COUNT(*) AS n FROM replacements WHERE season_id = ? AND status = 'pending' GROUP BY league").bind(intId(q.get('season')) || 0).all();
    return json({ counts: Object.fromEntries(results.map((r) => [r.league, r.n])) });
  }

  // The requests: admin, one season (every league); captain, their teams. Pending requests carry their checks run again now.
  if (m === 'GET' && path === '/replacements') {
    const where = isAdmin ? 'q.season_id = ?' : `q.team_id IN (${allowed.map(() => '?').join(',') || 'NULL'})`;
    const args = isAdmin ? [intId(q.get('season')) || 0] : allowed;
    const { results: reqs } = await DB.prepare(`SELECT q.*, t.name AS team_name, t.abb, t.nbhpa_team_id,
        CASE q.created_kind WHEN 'captain' THEN c.name ELSE a.name END AS created_name, d.name AS decided_name
      FROM replacements q JOIN teams t ON t.id = q.team_id
      LEFT JOIN captains c ON q.created_kind = 'captain' AND c.id = q.created_by
      LEFT JOIN admins a ON q.created_kind = 'admin' AND a.id = q.created_by
      LEFT JOIN admins d ON d.id = q.decided_by
      WHERE ${where} ORDER BY q.status = 'pending' DESC, q.game_date DESC, q.id DESC LIMIT 300`).bind(...args).all();
    const { results: lines } = await DB.prepare(`SELECT l.*, pa.name AS absent_name, pa.site_id AS absent_site, ps.name AS sub_name, ps.site_id AS sub_site
      FROM replacement_lines l JOIN people pa ON pa.id = l.absent_id JOIN people ps ON ps.id = l.sub_id
      WHERE l.replacement_id IN (SELECT q.id FROM replacements q WHERE ${where}) ORDER BY l.id`).bind(...args).all();
    const out = [];
    for (const r of reqs) {
      const ls = lines.filter((l) => l.replacement_id === r.id);
      let saved = {}; try { saved = JSON.parse(r.checks); } catch { /* old row */ }
      let live = null;
      if (r.status === 'pending' && ls.length) {
        const team = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(r.team_id).first();
        live = await evaluate(DB, data, await seasonOf(r.season_id), team, { id: r.game_id, date: r.game_date, time: r.game_time }, ls.map((l) => ({ absent_id: l.absent_id, sub_id: l.sub_id, sub_pos: l.sub_pos })), r.id);
      }
      out.push({ id: r.id, season_id: r.season_id, league: r.league, team: { id: r.team_id, name: r.team_name, abb: r.abb, nbhpa_team_id: r.nbhpa_team_id },
        game_id: r.game_id, game_date: r.game_date, game_time: r.game_time, game_label: r.game_label, status: r.status,
        result: live ? live.result : r.result, checks: live ? live.checks : saved.checks || [], payroll: live ? live.payroll : saved.payroll || null,
        note: r.note, created_at: r.created_at, created_kind: r.created_kind, created_name: r.created_name, decided_at: r.decided_at, decided_name: r.decided_name,
        decision_note: r.decision_note, cancelled_at: r.cancelled_at,
        lines: ls.map((l) => ({ absent_id: l.absent_id, absent_name: l.absent_name, absent_site: l.absent_site, absent_pos: l.absent_pos, absent_salary: l.absent_salary,
          sub_id: l.sub_id, sub_name: l.sub_name, sub_site: l.sub_site, sub_pos: l.sub_pos, sub_salary: l.sub_salary })) });
    }
    return json({ replacements: out, today: today() });
  }

  // Decide (admin): approve or refuse a pending request. The checks run again and are kept with the decision.
  x = path.match(/^\/replacements\/(\d+)\/decide$/);
  if (m === 'POST' && x && isAdmin) {
    const b = await readJson(req) || {}, r = await DB.prepare('SELECT * FROM replacements WHERE id = ?').bind(Number(x[1])).first();
    if (!r) return fail(404, 'replacement');
    if (r.status !== 'pending') return fail(409, 'not_pending');
    if (!['approve', 'refuse'].includes(b.decision)) return fail(400, 'decision');
    const note = b.note ? cleanText(b.note, 1000) : null;
    if (b.note && !note) return fail(400, 'decision');
    const ls = (await DB.prepare('SELECT absent_id, sub_id, sub_pos FROM replacement_lines WHERE replacement_id = ?').bind(r.id).all()).results;
    const team = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(r.team_id).first();
    const ev = await evaluate(DB, data, await seasonOf(r.season_id), team, { id: r.game_id, date: r.game_date, time: r.game_time }, ls, r.id);
    const status = b.decision === 'approve' ? 'approved' : 'refused';
    await DB.prepare('UPDATE replacements SET status = ?, result = ?, checks = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ? AND status = \'pending\'')
      .bind(status, ev.result, JSON.stringify({ checks: ev.checks, payroll: ev.payroll }), now(), actor.id, note, r.id).run();
    await audit('replacement.' + (status === 'approved' ? 'approve' : 'refuse'), 'replacement:' + r.id, { result: ev.result });
    return json({ ok: true, status, result: ev.result });
  }

  // Cancel: the team's captain or an admin, while the request is pending or approved.
  x = path.match(/^\/replacements\/(\d+)\/cancel$/);
  if (m === 'POST' && x) {
    const r = await DB.prepare('SELECT * FROM replacements WHERE id = ?').bind(Number(x[1])).first();
    if (!r || (allowed !== null && !allowed.includes(r.team_id))) return fail(404, 'replacement');
    if (!['pending', 'approved'].includes(r.status)) return fail(409, 'not_open');
    await DB.prepare("UPDATE replacements SET status = 'cancelled', cancelled_at = ? WHERE id = ?").bind(now(), r.id).run();
    await audit('replacement.cancel', 'replacement:' + r.id, { was: r.status });
    return json({ ok: true });
  }
  return fail(404, 'not_found');
}
