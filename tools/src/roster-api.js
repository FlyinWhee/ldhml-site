// Roster layer (admin only): people, league player lists (per section and season), sign-ups per league, our teams, rosters, league rules.
// Called by admin-api.js after the admin session check. Returns a Response, or null when the route is not one of these.
// Rules: every row is per season (people excepted: one person across seasons); every change writes an audit row.
import { json, fail, readJson, cleanText, now } from './http.js';
import { isArchived } from './seasons.js';

const num = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);
const int = (v, lo, hi) => (v === '' || v == null ? null : Number.isInteger(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : NaN);
const bad = (...vals) => vals.some((v) => Number.isNaN(v));

/** People fields from a request body. Returns null when something is not valid. */
function personFields(b) {
  const name = cleanText(b.name, 80);
  const sex = b.sex === 'm' || b.sex === 'f' ? b.sex : b.sex ? NaN : null;
  const year = int(b.birth_year, 1900, 2100), month = int(b.birth_month, 1, 12);
  const site = b.site_id ? String(b.site_id) : null, nid = b.nid ? String(b.nid) : null;
  if (!name || bad(sex, year, month) || (month !== null && year === null) || (site && !/^L\d{4,}$/.test(site)) || (nid && !/^\d{1,12}$/.test(nid))) return null;
  return { name, sex, birth_year: year, birth_month: month, site_id: site, nid };
}

export async function rosterApi({ req, env, url, path, m, admin, audit, seasonData }) {
  const DB = env.DB;
  const data = await seasonData();
  const leagueOf = (slug) => data && data.leagues.find((l) => l.slug === slug);
  const sectionKeys = data ? data.sections.map((s) => s.key) : [];
  const season = async (id) => DB.prepare('SELECT id, nbhpa_season_id FROM seasons WHERE id = ?').bind(Number(id)).first();
  const q = url.searchParams;
  let x;
  /** A league's sign-ups for a season (simple: signed up or not; no places, no waiting list):
   *  { signups (no team yet first), counts (men, women, goalies), pool (no team yet) }. */
  const signupsOf = async (seasonId, lg) => {
    const { results } = await DB.prepare(`SELECT u.id, u.person_id, u.pos, u.created_at, p.name, p.site_id, p.sex, sp.salary_s, sp.salary_g,
        t.id AS team_id, t.abb, t.name AS team_name, t.nbhpa_team_id, t.logo AS team_logo
      FROM league_players u JOIN people p ON p.id = u.person_id
      LEFT JOIN section_players sp ON sp.season_id = u.season_id AND sp.section = ? AND sp.person_id = u.person_id
      LEFT JOIN rosters r ON r.season_id = u.season_id AND r.league = u.league AND r.person_id = u.person_id AND r.removed_at IS NULL
      LEFT JOIN teams t ON t.id = r.team_id
      WHERE u.season_id = ? AND u.league = ? ORDER BY (t.id IS NOT NULL), p.name COLLATE NOCASE`).bind(lg.section, seasonId, lg.slug).all();
    const slot = (u) => (u.pos === 'g' ? 'g' : u.sex === 'f' ? 'f' : 'm'), count = (k) => results.filter((u) => slot(u) === k).length;
    return { signups: results.map((u) => ({ ...u, team: u.team_id ? { id: u.team_id, abb: u.abb, name: u.team_name, nbhpa_team_id: u.nbhpa_team_id, logo: u.team_logo } : null })),
      counts: { m: count('m'), f: count('f'), g: count('g') }, pool: results.filter((u) => !u.team_id).length };
  };

  // ---------- people and the league player list ----------
  if (m === 'GET' && path === '/people') {
    if (q.get('all')) {
      const { results } = await DB.prepare('SELECT id, name, site_id FROM people ORDER BY name COLLATE NOCASE').all();
      return json({ people: results });
    }
    const s = await season(q.get('season')), section = q.get('section');
    if (!s || !sectionKeys.includes(section)) return fail(400, 'season');
    const leagues = data.leagues.filter((l) => l.section === section).map((l) => l.slug);
    const { results: list } = await DB.prepare(`SELECT sp.id AS sp_id, sp.salary_s, sp.salary_g, p.id, p.site_id, p.nid, p.name, p.sex, p.birth_year, p.birth_month
      FROM section_players sp JOIN people p ON p.id = sp.person_id WHERE sp.season_id = ? AND sp.section = ? ORDER BY p.name COLLATE NOCASE`).bind(s.id, section).all();
    const { results: ros } = await DB.prepare(`SELECT r.id, r.person_id, r.league, r.pos, t.id AS team_id, t.name AS team_name, t.abb, t.nbhpa_team_id
      FROM rosters r JOIN teams t ON t.id = r.team_id WHERE r.season_id = ? AND r.removed_at IS NULL`).bind(s.id).all();
    const { results: ups } = await DB.prepare('SELECT person_id, league, pos FROM league_players WHERE season_id = ?').bind(s.id).all();
    return json({ players: list.map((p) => ({ ...p, rosters: ros.filter((r) => r.person_id === p.id && leagues.includes(r.league)),
      signups: ups.filter((u) => u.person_id === p.id && leagues.includes(u.league)).map((u) => ({ league: u.league, pos: u.pos })) })) });
  }
  if (m === 'POST' && path === '/people') {
    const b = await readJson(req) || {}, f = personFields(b);
    if (!f) return fail(400, 'person');
    if (f.site_id && await DB.prepare('SELECT 1 FROM people WHERE site_id = ?').bind(f.site_id).first()) return fail(409, 'person_exists');
    if (f.nid && await DB.prepare('SELECT 1 FROM people WHERE nid = ?').bind(f.nid).first()) return fail(409, 'person_exists');
    const r = await DB.prepare('INSERT INTO people (site_id, nid, name, sex, birth_year, birth_month, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(f.site_id, f.nid, f.name, f.sex, f.birth_year, f.birth_month, now(), admin.id).run();
    await audit('person.create', 'person:' + r.meta.last_row_id, { name: f.name });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  x = path.match(/^\/people\/(\d+)$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]), b = await readJson(req) || {}, f = personFields(b);
    if (!await DB.prepare('SELECT 1 FROM people WHERE id = ?').bind(id).first()) return fail(404, 'person');
    if (!f) return fail(400, 'person');
    if (f.site_id && await DB.prepare('SELECT 1 FROM people WHERE site_id = ? AND id <> ?').bind(f.site_id, id).first()) return fail(409, 'person_exists');
    if (f.nid && await DB.prepare('SELECT 1 FROM people WHERE nid = ? AND id <> ?').bind(f.nid, id).first()) return fail(409, 'person_exists');
    await DB.prepare('UPDATE people SET site_id = ?, nid = ?, name = ?, sex = ?, birth_year = ?, birth_month = ? WHERE id = ?')
      .bind(f.site_id, f.nid, f.name, f.sex, f.birth_year, f.birth_month, id).run();
    await audit('person.update', 'person:' + id, { name: f.name });
    return json({ ok: true });
  }
  // Full delete of a person: rosters (all seasons), league lists, replacement lines (a request left without lines goes too),
  // the person. Audit rows stay without details.
  x = path.match(/^\/people\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    if (!await DB.prepare('SELECT 1 FROM people WHERE id = ?').bind(id).first()) return fail(404, 'person');
    await DB.batch([
      DB.prepare('DELETE FROM replacement_lines WHERE absent_id = ? OR sub_id = ?').bind(id, id),
      DB.prepare('DELETE FROM replacements WHERE NOT EXISTS (SELECT 1 FROM replacement_lines l WHERE l.replacement_id = replacements.id)'),
      DB.prepare('DELETE FROM rosters WHERE person_id = ?').bind(id),
      DB.prepare('DELETE FROM league_players WHERE person_id = ?').bind(id),
      DB.prepare('DELETE FROM section_players WHERE person_id = ?').bind(id),
      DB.prepare('UPDATE audit SET detail = NULL WHERE target = ?').bind('person:' + id),
      DB.prepare('DELETE FROM people WHERE id = ?').bind(id)
    ]);
    await audit('person.delete', 'person:' + id);
    return json({ ok: true });
  }
  // Add a person to a section's player list for a season (or change their salaries).
  if (m === 'POST' && path === '/section-players') {
    const b = await readJson(req) || {}, s = await season(b.season_id), sal_s = num(b.salary_s), sal_g = num(b.salary_g);
    const person = await DB.prepare('SELECT id FROM people WHERE id = ?').bind(Number(b.person_id)).first();
    if (!s || !person || !sectionKeys.includes(b.section) || bad(sal_s, sal_g)) return fail(400, 'section_player');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    const r = await DB.prepare(`INSERT INTO section_players (season_id, section, person_id, salary_s, salary_g, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (season_id, section, person_id) DO UPDATE SET salary_s = excluded.salary_s, salary_g = excluded.salary_g`).bind(s.id, b.section, person.id, sal_s, sal_g, now(), admin.id).run();
    await audit('list.set', 'person:' + person.id, { season: s.id, section: b.section, salary_s: sal_s, salary_g: sal_g });
    return json({ ok: true, id: r.meta.last_row_id });
  }
  x = path.match(/^\/section-players\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const sp = await DB.prepare('SELECT * FROM section_players WHERE id = ?').bind(Number(x[1])).first();
    if (!sp) return fail(404, 'section_player');
    if (await isArchived(DB, sp.season_id)) return fail(409, 'season_archived');
    const leagues = data.leagues.filter((l) => l.section === sp.section).map((l) => l.slug);
    const on = (await DB.prepare('SELECT league FROM rosters WHERE season_id = ? AND person_id = ? AND removed_at IS NULL').bind(sp.season_id, sp.person_id).all()).results;
    if (on.some((r) => leagues.includes(r.league))) return fail(409, 'on_roster');
    await DB.prepare('DELETE FROM section_players WHERE id = ?').bind(sp.id).run();
    await audit('list.remove', 'person:' + sp.person_id, { season: sp.season_id, section: sp.section });
    return json({ ok: true });
  }

  // ---------- teams ----------
  if (m === 'GET' && path === '/teams') {
    const s = await season(q.get('season'));
    if (!s) return fail(400, 'season');
    const { results: teams } = await DB.prepare('SELECT id, league, name, abb, logo, nbhpa_team_id FROM teams WHERE season_id = ? ORDER BY league, name COLLATE NOCASE').bind(s.id).all();
    const { results: ros } = await DB.prepare(`SELECT r.id, r.team_id, r.league, r.pos, r.added_at, p.id AS person_id, p.name, p.site_id, p.sex
      FROM rosters r JOIN people p ON p.id = r.person_id
      WHERE r.season_id = ? AND r.removed_at IS NULL ORDER BY r.pos DESC, p.name COLLATE NOCASE`).bind(s.id).all();
    // The salary comes from the player list of the team's section (a person can be on the lists of two sections).
    const { results: sps } = await DB.prepare('SELECT person_id, section, salary_s, salary_g FROM section_players WHERE season_id = ?').bind(s.id).all();
    const sal = new Map(sps.map((x) => [x.section + ':' + x.person_id, x]));
    const withSalary = (r) => { const sp = sal.get(((leagueOf(r.league) || {}).section) + ':' + r.person_id) || {}; return { ...r, salary_s: sp.salary_s ?? null, salary_g: sp.salary_g ?? null }; };
    const { results: rules } = await DB.prepare('SELECT * FROM season_leagues WHERE season_id = ?').bind(s.id).all();
    return json({ teams: teams.map((t) => ({ ...t, roster: ros.filter((r) => r.team_id === t.id).map(withSalary) })), rules });
  }
  if (m === 'POST' && path === '/teams') {
    const b = await readJson(req) || {}, s = await season(b.season_id);
    const name = cleanText(b.name, 80), abb = cleanText(b.abb, 6), nb = b.nbhpa_team_id ? String(b.nbhpa_team_id) : null;
    if (!s || !leagueOf(b.league) || !name || !abb || (nb && !/^\d{1,12}$/.test(nb))) return fail(400, 'team');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    if (nb && await DB.prepare('SELECT 1 FROM teams WHERE season_id = ? AND league = ? AND nbhpa_team_id = ?').bind(s.id, b.league, nb).first()) return fail(409, 'team_exists');
    const r = await DB.prepare('INSERT INTO teams (season_id, league, name, abb, nbhpa_team_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, b.league, name, abb.toUpperCase(), nb, now(), admin.id).run();
    await audit('team.create', 'team:' + r.meta.last_row_id, { season: s.id, league: b.league, name, abb });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // Create the teams of a season from the stats data (when the season is the one in the data). Existing teams stay.
  // league (optional): only that league.
  if (m === 'POST' && path === '/teams/import') {
    const b = await readJson(req) || {}, s = await season(b.season_id);
    if (!s || (b.league && !leagueOf(b.league))) return fail(400, 'season');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    if (!data || s.nbhpa_season_id !== data.seasonId) return fail(400, 'no_season_data');
    let added = 0;
    for (const l of data.leagues.filter((x) => !b.league || x.slug === b.league)) for (const t of l.teams) {
      const r = await DB.prepare('INSERT OR IGNORE INTO teams (season_id, league, name, abb, nbhpa_team_id, logo, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s.id, l.slug, t.name, t.abb, t.id, t.logo || null, now(), admin.id).run();
      added += r.meta.changes;
    }
    await audit('team.import', 'season:' + s.id, { added, league: b.league || null });
    return json({ ok: true, added });
  }
  x = path.match(/^\/teams\/(\d+)$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]), t = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
    if (!t) return fail(404, 'team');
    if (await isArchived(DB, t.season_id)) return fail(409, 'season_archived');
    const b = await readJson(req) || {}, name = cleanText(b.name, 80), abb = cleanText(b.abb, 6), nb = b.nbhpa_team_id ? String(b.nbhpa_team_id) : null;
    if (!name || !abb || (nb && !/^\d{1,12}$/.test(nb))) return fail(400, 'team');
    if (nb && await DB.prepare('SELECT 1 FROM teams WHERE season_id = ? AND league = ? AND nbhpa_team_id = ? AND id <> ?').bind(t.season_id, t.league, nb, id).first()) return fail(409, 'team_exists');
    await DB.prepare('UPDATE teams SET name = ?, abb = ?, nbhpa_team_id = ? WHERE id = ?').bind(name, abb.toUpperCase(), nb, id).run();
    await audit('team.update', 'team:' + id, { name, abb });
    return json({ ok: true });
  }
  // Delete a team: refused while it has players or active captain access. Its past roster rows and requests go with it.
  x = path.match(/^\/teams\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const id = Number(x[1]);
    const tsid = await DB.prepare('SELECT season_id FROM teams WHERE id = ?').bind(id).first('season_id');
    if (!tsid) return fail(404, 'team');
    if (await isArchived(DB, tsid)) return fail(409, 'season_archived');
    if (await DB.prepare('SELECT 1 FROM rosters WHERE team_id = ? AND removed_at IS NULL').bind(id).first() ||
        await DB.prepare('SELECT 1 FROM games WHERE away_team = ? OR home_team = ?').bind(id, id).first() ||
        await DB.prepare('SELECT 1 FROM captain_access WHERE team_ref = ? AND revoked_at IS NULL').bind(id).first()) return fail(409, 'team_in_use');
    await DB.batch([
      DB.prepare('DELETE FROM replacement_lines WHERE replacement_id IN (SELECT id FROM replacements WHERE team_id = ?)').bind(id),
      DB.prepare('DELETE FROM replacements WHERE team_id = ?').bind(id),
      DB.prepare('DELETE FROM rosters WHERE team_id = ?').bind(id),
      DB.prepare('UPDATE captain_access SET team_ref = NULL WHERE team_ref = ?').bind(id),
      DB.prepare('DELETE FROM teams WHERE id = ?').bind(id)
    ]);
    await audit('team.delete', 'team:' + id);
    return json({ ok: true });
  }

  // ---------- rosters ----------
  // Put a person on a team (one active team per league and season). The person must be on the section's player list.
  if (m === 'POST' && path === '/rosters') {
    const b = await readJson(req) || {};
    const t = await DB.prepare('SELECT * FROM teams WHERE id = ?').bind(Number(b.team_id)).first();
    const p = await DB.prepare('SELECT id FROM people WHERE id = ?').bind(Number(b.person_id)).first();
    const lg = t && leagueOf(t.league);
    if (!t || !p || !lg || !['s', 'g'].includes(b.pos)) return fail(400, 'roster');
    if (await isArchived(DB, t.season_id)) return fail(409, 'season_archived');
    if (!await DB.prepare('SELECT 1 FROM section_players WHERE season_id = ? AND section = ? AND person_id = ?').bind(t.season_id, lg.section, p.id).first()) return fail(400, 'not_registered');
    const on = await DB.prepare(`SELECT tm.name FROM rosters r JOIN teams tm ON tm.id = r.team_id WHERE r.season_id = ? AND r.league = ? AND r.person_id = ? AND r.removed_at IS NULL`).bind(t.season_id, t.league, p.id).first();
    if (on) return fail(409, 'already_on_roster', { team: on.name });
    const r = await DB.prepare('INSERT INTO rosters (season_id, league, team_id, person_id, pos, added_at, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(t.season_id, t.league, t.id, p.id, b.pos, now(), admin.id).run();
    await DB.prepare(`INSERT INTO league_players (season_id, league, person_id, pos, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (season_id, league, person_id) DO UPDATE SET pos = excluded.pos, updated_at = excluded.created_at, updated_by = excluded.created_by`)
      .bind(t.season_id, t.league, p.id, b.pos, now(), admin.id).run();
    await audit('roster.add', 'team:' + t.id, { person: p.id, pos: b.pos });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // Take a person off a team: the row stays with removed_at (transaction history).
  x = path.match(/^\/rosters\/(\d+)\/remove$/);
  if (m === 'POST' && x) {
    const ro = await DB.prepare('SELECT season_id, league, person_id FROM rosters WHERE id = ?').bind(Number(x[1])).first();
    if (ro && await isArchived(DB, ro.season_id)) return fail(409, 'season_archived');
    const r = await DB.prepare('UPDATE rosters SET removed_at = ?, removed_by = ? WHERE id = ? AND removed_at IS NULL').bind(now(), admin.id, Number(x[1])).run();
    if (!r.meta.changes) return fail(404, 'roster');
    // a team league: off the team = out of the league; a draft league: back in the draft pool
    if ((leagueOf(ro.league) || {}).section !== 'draft') await DB.prepare('DELETE FROM league_players WHERE season_id = ? AND league = ? AND person_id = ?').bind(ro.season_id, ro.league, ro.person_id).run();
    await audit('roster.remove', 'roster:' + x[1]);
    return json({ ok: true });
  }

  // ---------- sign-ups: who plays in a league for a season (league_players) ----------
  // Kept simple on purpose (owner): no limits, no waiting list; admins manage. Team leagues get them with the roster.
  // GET: the league's sign-ups, with the team of each (none yet = the draft pool).
  if (m === 'GET' && path === '/league-players') {
    const s = await season(q.get('season')), lg = leagueOf(q.get('league'));
    if (!s || !lg) return fail(400, 'season');
    return json(await signupsOf(s.id, lg));
  }
  // POST: sign a person up (an admin does it; the tools are never public). Puts them on the section list too.
  if (m === 'POST' && path === '/league-players') {
    const b = await readJson(req) || {}, s = await season(b.season_id), lg = leagueOf(b.league);
    const p = await DB.prepare('SELECT id FROM people WHERE id = ?').bind(Number(b.person_id) || 0).first();
    if (!s || !lg || !p || !['s', 'g'].includes(b.pos)) return fail(400, 'signup');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    if (await DB.prepare('SELECT 1 FROM league_players WHERE season_id = ? AND league = ? AND person_id = ?').bind(s.id, lg.slug, p.id).first()) return fail(409, 'signup_exists');
    await DB.prepare('INSERT OR IGNORE INTO section_players (season_id, section, person_id, created_at, created_by) VALUES (?, ?, ?, ?, ?)').bind(s.id, lg.section, p.id, now(), admin.id).run();
    const r = await DB.prepare('INSERT INTO league_players (season_id, league, person_id, pos, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(s.id, lg.slug, p.id, b.pos, now(), admin.id).run();
    await audit('signup.add', 'person:' + p.id, { season: s.id, league: lg.slug, pos: b.pos });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // Remove a sign-up (left the league, or a mistake). A person on a team of the league is taken off the team first.
  x = path.match(/^\/league-players\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const u = await DB.prepare('SELECT * FROM league_players WHERE id = ?').bind(Number(x[1])).first();
    if (!u) return fail(404, 'signup');
    if (await isArchived(DB, u.season_id)) return fail(409, 'season_archived');
    if (await DB.prepare('SELECT 1 FROM rosters WHERE season_id = ? AND league = ? AND person_id = ? AND removed_at IS NULL').bind(u.season_id, u.league, u.person_id).first()) return fail(409, 'on_roster');
    await DB.prepare('DELETE FROM league_players WHERE id = ?').bind(u.id).run();
    await audit('signup.delete', 'person:' + u.person_id, { season: u.season_id, league: u.league });
    return json({ ok: true });
  }

  // ---------- a league in a season (season_leagues): active or not, and its rules. One row per league and season ----------
  // Switch a league on or off for a season (the rules stay).
  if (m === 'POST' && path === '/season-leagues') {
    const b = await readJson(req) || {}, s = await season(b.season_id);
    if (!s || !leagueOf(b.league) || typeof b.enabled !== 'boolean') return fail(400, 'season_league');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    await DB.prepare(`INSERT INTO season_leagues (season_id, league, enabled, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (season_id, league) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(s.id, b.league, b.enabled ? 1 : 0, now(), admin.id).run();
    await audit(b.enabled ? 'league.enable' : 'league.disable', 'season:' + s.id, { league: b.league });
    return json({ ok: true });
  }
  // ---------- league rules (in the season's league row) ----------
  if (m === 'GET' && path === '/rules') {
    const s = await season(q.get('season'));
    if (!s) return fail(400, 'season');
    const { results } = await DB.prepare('SELECT * FROM season_leagues WHERE season_id = ?').bind(s.id).all();
    return json({ rules: results });
  }
  if (m === 'POST' && path === '/rules') {
    const b = await readJson(req) || {}, s = await season(b.season_id);
    const cap = num(b.salary_cap), am = int(b.min_age_m, 0, 99), af = int(b.min_age_f, 0, 99), ag = int(b.min_age_g, 0, 99);
    const notes = b.notes ? cleanText(b.notes, 500) : null, ageOn = b.age_on === 'year' ? 'year' : b.age_on == null || b.age_on === '' || b.age_on === 'game' ? null : NaN;
    if (!s || !leagueOf(b.league) || bad(cap, am, af, ag, ageOn) || (b.notes && !notes)) return fail(400, 'rules');
    if (await isArchived(DB, s.id)) return fail(409, 'season_archived');
    await DB.prepare(`INSERT INTO season_leagues (season_id, league, salary_cap, min_age_m, min_age_f, min_age_g, age_on, notes, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (season_id, league) DO UPDATE SET salary_cap = excluded.salary_cap, min_age_m = excluded.min_age_m, min_age_f = excluded.min_age_f,
      min_age_g = excluded.min_age_g, age_on = excluded.age_on, notes = excluded.notes,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(s.id, b.league, cap, am, af, ag, ageOn, notes, now(), admin.id).run();
    await audit('rules.set', 'season:' + s.id, { league: b.league, salary_cap: cap, min_age_m: am, min_age_f: af, min_age_g: ag, age_on: ageOn });
    return json({ ok: true });
  }
  return null;
}
