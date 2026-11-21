// Payments (owner, 2026-11-21). An inscription = what a player owes in a league: from a first season, for N seasons, an amount.
// The tools make it when a player is added to a league (a roster, or a draft sign-up) and delete it when the player is removed,
// unless money was received. A multi-season plan (the league's plan, e.g. 3 seasons for $540) covers the next seasons: a new
// season makes no new inscription while a plan still covers it. Partial payments go against the one amount (never split per
// season). Money is in cents. The league price is not per season (league_prices): an inscription keeps its own amount and number
// of seasons, so a later price change never rewrites the past. Admins only write; captains read their team (captain-api.js).
import { json, fail, readJson, cleanText, now } from './http.js';

const cents = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100000 ? Math.round(Number(v) * 100) : NaN);

/** The seasons in order (oldest first), with the leagues switched off in each. */
async function seasonLine(DB) {
  const { results: seasons } = await DB.prepare('SELECT id, name, status FROM seasons ORDER BY id').all();
  const { results: off } = await DB.prepare('SELECT season_id, league FROM season_leagues WHERE enabled = 0').all();
  return { seasons, off: new Set(off.map((o) => o.season_id + ':' + o.league)) };
}
/** Which seasons an inscription covers: its first season, then the next ones where the league is on, N in all. */
function covered(line, ins) {
  const out = [];
  for (const s of line.seasons) {
    if (s.id < ins.season_id || out.length >= ins.seasons) continue;
    if (s.id !== ins.season_id && line.off.has(s.id + ':' + ins.league)) continue;
    out.push(s.id);
  }
  return out;
}
/** The inscription of a person in a league that covers a season (the newest first), with its place: { ins, k, n } or null. */
async function covering(DB, line, personId, league, seasonId) {
  const { results } = await DB.prepare('SELECT * FROM inscriptions WHERE person_id = ? AND league = ? AND season_id <= ? ORDER BY season_id DESC, id DESC')
    .bind(personId, league, seasonId).all();
  for (const ins of results) { const c = covered(line, ins), k = c.indexOf(seasonId); if (k >= 0) return { ins, k: k + 1, n: ins.seasons }; }
  return null;
}
const statusOf = (amount, paid) => (amount == null ? 'noprice' : paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'due');

/** A player was added to a league for a season: their inscription, unless one (a plan) already covers that season. */
export async function ensureInscription(DB, { season_id, league, person_id }, by) {
  const line = await seasonLine(DB);
  if (await covering(DB, line, person_id, league, season_id)) return;
  const price = await DB.prepare('SELECT season_price FROM league_prices WHERE league = ?').bind(league).first('season_price');
  await DB.prepare('INSERT INTO inscriptions (season_id, league, person_id, seasons, amount, created_at, created_by) VALUES (?, ?, ?, 1, ?, ?, ?)')
    .bind(season_id, league, person_id, price ?? null, now(), by || null).run();
}
/** A player was removed from a league for a season: the inscriptions starting that season go, unless money was received. */
export async function dropInscription(DB, { season_id, league, person_id }) {
  await DB.prepare(`DELETE FROM inscriptions WHERE season_id = ? AND league = ? AND person_id = ?
    AND NOT EXISTS (SELECT 1 FROM payments y WHERE y.inscription_id = inscriptions.id)`).bind(season_id, league, person_id).run();
}
/** Full deletes (a person, a season): payments first, then inscriptions (D1 enforces the foreign keys). */
export const deleteFor = (DB, where, ...binds) => [
  DB.prepare(`DELETE FROM payments WHERE inscription_id IN (SELECT id FROM inscriptions WHERE ${where})`).bind(...binds),
  DB.prepare(`DELETE FROM inscriptions WHERE ${where}`).bind(...binds)];

/** One inscription as shown: amounts in cents, paid, balance, status, its payments. */
async function shape(DB, line, ins, seasonId) {
  const { results: pays } = await DB.prepare(`SELECT y.id, y.amount, y.method, y.note, y.created_at, a.name AS by_name FROM payments y LEFT JOIN admins a ON a.id = y.created_by
    WHERE y.inscription_id = ? ORDER BY y.created_at, y.id`).bind(ins.id).all();
  const paid = pays.reduce((t, y) => t + y.amount, 0), c = covered(line, ins), first = line.seasons.find((s) => s.id === ins.season_id);
  return { id: ins.id, season_id: ins.season_id, first_season: first ? first.name : null, seasons: ins.seasons, k: seasonId ? c.indexOf(seasonId) + 1 : null,
    amount: ins.amount, paid, balance: ins.amount == null ? null : ins.amount - paid, status: statusOf(ins.amount, paid), note: ins.note, payments: pays };
}
/** A team's players this season and what each owes (the captain's team page: read only). person_id -> shape. */
export async function teamPayments(DB, team, personIds) {
  const line = await seasonLine(DB), out = {};
  for (const pid of personIds) { const c = await covering(DB, line, pid, team.league, team.season_id); if (c) out[pid] = await shape(DB, line, c.ins, team.season_id); }
  return out;
}
/** A person's inscriptions in every league and season (the admin's player page). */
export async function personPayments(DB, personId) {
  const line = await seasonLine(DB);
  const { results } = await DB.prepare('SELECT * FROM inscriptions WHERE person_id = ? ORDER BY season_id DESC, id DESC').bind(personId).all();
  const out = [];
  for (const ins of results) out.push({ league: ins.league, ...(await shape(DB, line, ins, null)) });
  return out;
}

export async function paymentApi({ req, env, url, path, m, admin, audit, seasonData }) {
  const DB = env.DB, q = url.searchParams;
  let x;
  const leagueOk = async (slug) => { const d = await seasonData(); return !!(d && d.leagues.some((l) => l.slug === slug)); };
  const priceOf = (league) => DB.prepare('SELECT * FROM league_prices WHERE league = ?').bind(league).first();
  /** True when every season an inscription covers is archived (then it is read only). */
  const frozen = async (line, ins) => covered(line, ins).every((id) => (line.seasons.find((s) => s.id === id) || {}).status === 'archived');

  // GET /payments?season&league: every player of the league this season (and anyone who left with money received), with what they owe.
  if (m === 'GET' && path === '/payments') {
    const sid = Number(q.get('season')), league = q.get('league');
    if (!sid || !await leagueOk(league)) return fail(400, 'season');
    const line = await seasonLine(DB);
    const { results: players } = await DB.prepare(`SELECT u.person_id, u.pos, p.name, p.sex, t.id AS team_id, t.abb, t.name AS team_name, t.logo AS team_logo, t.nbhpa_team_id
      FROM league_players u JOIN people p ON p.id = u.person_id
      LEFT JOIN rosters r ON r.season_id = u.season_id AND r.league = u.league AND r.person_id = u.person_id AND r.removed_at IS NULL
      LEFT JOIN teams t ON t.id = r.team_id WHERE u.season_id = ? AND u.league = ? ORDER BY p.name COLLATE NOCASE`).bind(sid, league).all();
    const rows = [], seen = new Set();
    for (const p of players) {
      seen.add(p.person_id);
      const c = await covering(DB, line, p.person_id, league, sid);
      rows.push({ person_id: p.person_id, name: p.name, sex: p.sex, pos: p.pos, team: p.team_id ? { id: p.team_id, abb: p.abb, name: p.team_name, logo: p.team_logo, nbhpa_team_id: p.nbhpa_team_id } : null,
        left: false, ins: c ? await shape(DB, line, c.ins, sid) : null });
    }
    // left the league with money received: the inscription stays (the record of what was paid)
    const { results: kept } = await DB.prepare(`SELECT DISTINCT i.person_id, p.name, p.sex FROM inscriptions i JOIN people p ON p.id = i.person_id
      WHERE i.league = ? AND i.season_id <= ? AND EXISTS (SELECT 1 FROM payments y WHERE y.inscription_id = i.id)`).bind(league, sid).all();
    for (const p of kept) {
      if (seen.has(p.person_id)) continue;
      const c = await covering(DB, line, p.person_id, league, sid);
      if (c) rows.push({ person_id: p.person_id, name: p.name, sex: p.sex, pos: null, team: null, left: true, ins: await shape(DB, line, c.ins, sid) });
    }
    return json({ rows, price: await priceOf(league) });
  }
  // POST /payments { inscription_id, amount (dollars), method?, note? }: money received (the date is now).
  if (m === 'POST' && path === '/payments') {
    const b = await readJson(req) || {}, amount = cents(b.amount), method = b.method ? cleanText(b.method, 40) : null, note = b.note ? cleanText(b.note, 300) : null;
    const ins = await DB.prepare('SELECT * FROM inscriptions WHERE id = ?').bind(Number(b.inscription_id) || 0).first();
    if (!ins) return fail(404, 'inscription');
    if (!amount || Number.isNaN(amount) || (b.method && !method) || (b.note && !note)) return fail(400, 'payment');
    if (await frozen(await seasonLine(DB), ins)) return fail(409, 'season_archived');
    const r = await DB.prepare('INSERT INTO payments (inscription_id, amount, method, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(ins.id, amount, method, note, now(), admin.id).run();
    await audit('payment.add', 'person:' + ins.person_id, { inscription: ins.id, league: ins.league, amount, method });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  // POST /payments/<id>/delete: a payment entered by mistake (full delete; the log keeps the trace).
  x = path.match(/^\/payments\/(\d+)\/delete$/);
  if (m === 'POST' && x) {
    const y = await DB.prepare('SELECT y.*, i.person_id, i.league, i.season_id, i.seasons FROM payments y JOIN inscriptions i ON i.id = y.inscription_id WHERE y.id = ?').bind(Number(x[1])).first();
    if (!y) return fail(404, 'payment');
    if (await frozen(await seasonLine(DB), y)) return fail(409, 'season_archived');
    await DB.prepare('DELETE FROM payments WHERE id = ?').bind(y.id).run();
    await audit('payment.delete', 'person:' + y.person_id, { inscription: y.inscription_id, league: y.league, amount: y.amount });
    return json({ ok: true });
  }
  // POST /inscriptions/<id> { amount (dollars, '' = none), seasons?, note? } or { plan: true } (the league's plan, its price and length).
  x = path.match(/^\/inscriptions\/(\d+)$/);
  if (m === 'POST' && x) {
    const ins = await DB.prepare('SELECT * FROM inscriptions WHERE id = ?').bind(Number(x[1])).first();
    if (!ins) return fail(404, 'inscription');
    const b = await readJson(req) || {}, line = await seasonLine(DB);
    if (await frozen(line, ins)) return fail(409, 'season_archived');
    let amount, seasons, note = ins.note;
    if (b.plan === true) {
      const pr = await priceOf(ins.league);
      if (!pr || !pr.plan_on || pr.plan_price == null) return fail(400, 'no_plan');
      amount = pr.plan_price; seasons = pr.plan_seasons;
    } else if (b.plan === false) {
      const pr = await priceOf(ins.league);
      amount = pr ? pr.season_price : null; seasons = 1;
    } else {
      amount = cents(b.amount); seasons = b.seasons == null ? ins.seasons : Number(b.seasons);
      note = b.note === undefined ? ins.note : b.note ? cleanText(b.note, 300) : null;
      if (Number.isNaN(amount) || !Number.isInteger(seasons) || seasons < 1 || seasons > 12 || (b.note && !note)) return fail(400, 'inscription');
    }
    await DB.prepare('UPDATE inscriptions SET amount = ?, seasons = ?, note = ?, updated_at = ?, updated_by = ? WHERE id = ?').bind(amount, seasons, note, now(), admin.id, ins.id).run();
    await audit('inscription.update', 'person:' + ins.person_id, { inscription: ins.id, league: ins.league, amount, seasons });
    return json({ ok: true });
  }
  // GET /league-prices: every league's price. POST /league-prices { league, season_price, plan_on, plan_price, plan_seasons } (dollars).
  if (m === 'GET' && path === '/league-prices') {
    const { results } = await DB.prepare('SELECT * FROM league_prices').all();
    return json({ prices: results });
  }
  if (m === 'POST' && path === '/league-prices') {
    const b = await readJson(req) || {}, sp = cents(b.season_price), pp = cents(b.plan_price), on = b.plan_on === true, n = b.plan_seasons == null || b.plan_seasons === '' ? 3 : Number(b.plan_seasons);
    if (!await leagueOk(b.league) || Number.isNaN(sp) || Number.isNaN(pp) || !Number.isInteger(n) || n < 2 || n > 12 || (on && pp == null)) return fail(400, 'price');
    await DB.prepare(`INSERT INTO league_prices (league, season_price, plan_on, plan_price, plan_seasons, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (league) DO UPDATE SET season_price = excluded.season_price, plan_on = excluded.plan_on, plan_price = excluded.plan_price,
      plan_seasons = excluded.plan_seasons, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(b.league, sp, on ? 1 : 0, pp, n, now(), admin.id).run();
    // the inscriptions with no amount yet (made before a price was set) take the season price now, except in archived seasons
    let filled = 0;
    if (sp != null) {
      const r = await DB.prepare(`UPDATE inscriptions SET amount = ?, updated_at = ?, updated_by = ? WHERE league = ? AND amount IS NULL AND seasons = 1
        AND season_id IN (SELECT id FROM seasons WHERE status <> 'archived')`).bind(sp, now(), admin.id, b.league).run();
      filled = r.meta.changes || 0;
    }
    await audit('price.set', 'league:' + b.league, { season_price: sp, plan_on: on, plan_price: pp, plan_seasons: n, filled });
    return json({ ok: true, filled });
  }
  return null;
}
