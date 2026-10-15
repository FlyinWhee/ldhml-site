// People index for the build. Pure data in, pure data out (tested by scraper/test-registry.mjs).
//
//   person   (our id "L0001", NBHPA id nid)  name, sex, NBHPA rank per position
//    └─ in[section]                          one "instance" per section (draft, teams): our ranks, leagues
//        └─ leagues[slug]                    teams and season lines of this league (skater "s", goalie "g")
//
// A rank exists per position only: { s: skater rank, g: goalie rank }. NBHPA ranks come from the stats rows.
// Our own rank systems (cfg.rankSystems) apply to one section, or to some leagues of it; their values are in the registry.

const SK = ['gp', 'g', 'a', 'p', 'pim'];
const GK = ['gp', 'w', 'l', 't', 'sa', 'sv', 'ga', 'so'];
const add = (a, row, keys) => { const o = a || Object.fromEntries(keys.map((k) => [k, 0])); for (const k of keys) o[k] += Number(row[k]) || 0; return o; };
const mostCommon = (list) => {
  const n = new Map();
  for (const v of list) if (v != null && v !== '') n.set(v, (n.get(v) || 0) + 1);
  let best = null;
  for (const [v, c] of n) if (best === null || c > n.get(best)) best = v;
  return best;
};

/** cfg: leagues.json. leagues: [{ lg, data }]. reg: registry/people.json. nice: name cleaner.
 *  Returns { people: { uid: person }, missing: [nid] }. A person missing from the registry gets the temporary id "n<nid>". */
export function peopleIndex(cfg, leagues, reg, nice = (s) => s) {
  const byNid = new Map((reg?.people ?? []).map((p) => [p.nid, p]));
  const people = {}, missing = new Set(), ranks = {};
  for (const { lg, data } of leagues) {
    for (const [list, pos] of [[data.players, 's'], [data.goalies, 'g']]) {
      for (const row of list) {
        const r = byNid.get(row.nid);
        if (!r) missing.add(row.nid);
        const id = r ? r.id : 'n' + row.nid;
        const p = people[id] ?? (people[id] = { id, nid: row.nid, name: nice(r?.name || row.name), sex: r?.sex || row.sex, pids: [...(r?.pids ?? [])], rank: { s: null, g: null }, in: {} });
        if (row.id && !p.pids.includes(row.id)) p.pids.push(row.id);
        ((ranks[id] ??= { s: [], g: [] })[pos]).push(row.rank);
        const inst = p.in[lg.section] ?? (p.in[lg.section] = { ranks: {}, leagues: {} });
        const m = inst.leagues[lg.slug] ?? (inst.leagues[lg.slug] = { teams: [], s: null, g: null });
        for (const a of row.teams) if (!m.teams.includes(a)) m.teams.push(a);
        m[pos] = add(m[pos], row, pos === 's' ? SK : GK);
      }
    }
  }
  // Games per team, from the box scores. Same rule as the league page (mainTeam in site/js/1-core.js):
  // the main team is the team with the most games (skater + goalie); a tie goes to the team of the latest game.
  for (const { lg, data } of leagues) {
    const games = Object.fromEntries((data.games ?? []).map((g) => [g.id, g]));
    const abbOf = Object.fromEntries((data.teams ?? []).map((t) => [t.id, t.abb]));
    const byPid = {};
    for (const [gid, b] of Object.entries(data.box?.games ?? {})) {
      if (!games[gid] || !b.t || b.t.length !== 2) continue;
      for (const side of b.t) for (const r of [...side.sk, ...side.gk]) {
        if (!r[0]) continue;
        const z = ((byPid[r[0]] ??= {})[abbOf[side.id]] ??= { gp: 0, last: '' });
        z.gp++; if (games[gid].date > z.last) z.last = games[gid].date;
      }
    }
    for (const p of Object.values(people)) {
      const m = p.in[lg.section]?.leagues[lg.slug];
      if (!m) continue;
      const per = {};
      for (const pid of p.pids) for (const [abb, z] of Object.entries(byPid[pid] ?? {})) {
        const o = (per[abb] ??= { gp: 0, last: '' }); o.gp += z.gp; if (z.last > o.last) o.last = z.last;
      }
      const rank = (a) => [per[a]?.gp ?? 0, per[a]?.last ?? ''];
      m.teams.sort((a, b) => rank(b)[0] - rank(a)[0] || rank(b)[1].localeCompare(rank(a)[1]));
      m.main = m.teams.length > 1 && per[m.teams[0]] ? m.teams[0] : null;
      m.gpBy = Object.fromEntries(m.teams.filter((a) => per[a]).map((a) => [a, per[a].gp]));
    }
  }
  for (const id of Object.keys(people)) {
    const p = people[id];
    p.rank = { s: mostCommon(ranks[id].s), g: mostCommon(ranks[id].g) };
    p.pids.sort();
    // Our own ranks: a system belongs to one section (and optionally to some of its leagues).
    const own = byNid.get(p.nid)?.ranks ?? {};
    for (const sys of cfg.rankSystems ?? []) {
      const inst = p.in[sys.section];
      if (!inst || !own[sys.key]) continue;
      if (sys.leagues && !sys.leagues.some((s) => inst.leagues[s])) continue;
      inst.ranks[sys.key] = { s: own[sys.key].s ?? null, g: own[sys.key].g ?? null };
    }
  }
  return { people, missing: [...missing] };
}
