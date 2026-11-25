/* The data refresh: the steps of "npm run fetch:force", in one place for its two users, so they never drift apart:
 *   - Node: scraper/fetch.mjs (the owner's computer), scraper/lib.mjs, scraper/registry.mjs
 *   - the browser: the tools, Configuration > "Données du site public" (an admin's browser reads NBHPA; the Worker never
 *     does, rule 1; it only commits the checked files to GitHub)
 * It needs LDParsers (shared/parsers.js). It exposes window.LDRefresh (or globalThis.LDRefresh).
 * Requests: the public league pages only, one at a time, with a pause (rule 3). Same request shapes as site/js/3-live.js. */
(function (root) {
  'use strict';

  var BASE = 'https://admin.nbhpa.com';
  var FIELDS = ['team_id', 'team_name', 'team_abb', 'team_pic', 'position', 'gp', 'wins_tot', 'losses', 'ot', 'ot_loss', 'pts', 'gf', 'ga', 'diff', 'pts_gp'];
  var FILES = ['meta', 'teams', 'games', 'players', 'goalies', 'box'];
  var P = function () { return root.LDParsers; };

  /** The raw responses of one league. io = { get(url, init, kind 'json'|'text') -> Promise, sleep(ms) -> Promise, delay (ms),
   *  warn(msg), step(key, info) (optional: what is being read, for a log), oldAt (when the saved snapshot was taken) }.
   *  Box scores: new games, and games whose saved box was taken less than 6 h after the start (LDParsers.boxUnsettled; the
   *  league does not change a game after it is played). */
  async function fetchLeague(lg, cfg, oldBox, io) {
    var step = io.step || function () {};
    var raw = await readSeason(cfg.seasonId, lg, cfg, io, step, '');
    raw.recaps = {};
    var out = assemble(raw, lg, cfg, oldBox ? JSON.parse(JSON.stringify(oldBox)) : null, function () {}).out;
    var todo = out.games.filter(function (g) { return g.as != null && g.hs != null && !g.cancelled && (!(oldBox && oldBox.games && oldBox.games[g.id]) || P().boxUnsettled(g, io.oldAt)); });
    await readRecaps(todo, raw.recaps, cfg, io, step);
    /* The playoffs (cfg.playoffs.seasonId, set in the tools: Configuration, the season): their own NBHPA season, the
     * same categories and request shapes. A failure here never stops the regular season (the old playoff file stays). */
    var po = playoffsOf(cfg);
    if (po) {
      try {
        await io.sleep(io.delay);
        var pr = await readSeason(po.seasonId, lg, cfg, io, step, 'po_');
        pr.recaps = {};
        var oldPo = io.oldPo && io.oldPo.meta && io.oldPo.meta.seasonId === po.seasonId ? io.oldPo : null;
        var poGames = [];
        try { poGames = P().parseSchedule(pr.schedule, P().parseStandings(typeof pr.standings === 'string' ? JSON.parse(pr.standings) : pr.standings)); } catch (e) { poGames = []; }
        var poTodo = poGames.filter(function (g) { return g.id && g.as != null && g.hs != null && !g.cancelled && (!(oldPo && oldPo.box.games[g.id]) || P().boxUnsettled(g, oldPo.meta.fetchedAt)); });
        await readRecaps(poTodo, pr.recaps, cfg, io, step);
        raw.po = pr;
      } catch (e) { (io.warn || console.warn)('  playoffs skipped: ' + e.message); }
    }
    return raw;
  }

  /** The playoff season of cfg (leagues.json "playoffs": { seasonId, seasonName }), or null. */
  function playoffsOf(cfg) {
    var p = cfg && cfg.playoffs;
    return p && Number(p.seasonId) > 0 ? { seasonId: Number(p.seasonId), seasonName: String(p.seasonName || '') } : null;
  }

  /* The four lists of one NBHPA season of one league: standings, skaters, goalies, schedule. pre: '' or 'po_' (log keys). */
  async function readSeason(seasonId, lg, cfg, io, step, pre) {
    var form = function (extra) {
      var f = new URLSearchParams({ season_id: seasonId, category_id: lg.categoryId, league_id: cfg.leagueId });
      Object.keys(extra || {}).forEach(function (k) { f.set(k, extra[k]); });
      return f;
    };
    var post = function (body) { return { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }; };
    var q = new URLSearchParams();
    q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', cfg.leagueId);
    q.set('filters[][league_id]', cfg.leagueId); q.set('filters[][season_id]', seasonId);
    q.set('category_id', lg.categoryId); q.set('filters[][category_id]', lg.categoryId);
    q.set('public_site', '1'); q.set('class', 'Standings');
    FIELDS.forEach(function (f) { q.append('fields[]', f); });
    q.set('page', '1');

    var raw = {};
    step(pre + 'standings'); raw.standings = await io.get(BASE + '/table_data.php?' + q, {}, 'json'); await io.sleep(io.delay);
    step(pre + 'players'); raw.players = await io.get(BASE + '/sites/site_stats_players.php?lang=fr', post(form()), 'text'); await io.sleep(io.delay);
    step(pre + 'goalies'); raw.goalies = await io.get(BASE + '/sites/site_stats_goalies.php?lang=fr', post(form()), 'text'); await io.sleep(io.delay);
    step(pre + 'schedule'); raw.schedule = await io.get(BASE + '/sites/site_schedule_include.php?lang=fr', post(form({ view: 'list' })), 'text');
    return raw;
  }
  async function readRecaps(todo, into, cfg, io, step) {
    step('recaps', { n: todo.length });
    for (var i = 0; i < todo.length; i++) {
      var g = todo[i];
      await io.sleep(io.delay);
      step('recap', { id: g.id, date: g.date, i: i + 1, n: todo.length });
      try { into[g.id] = await io.get(BASE + '/sites/site_game_recap.php?game_id=' + g.id + '&league_id=' + cfg.leagueId + '&lang=fr', {}, 'text'); }
      catch (e) { (io.warn || console.warn)('  box score ' + g.id + ' skipped: ' + e.message); }
    }
  }

  /** Turn raw responses of one league into the snapshot files. Returns { problems, boxSaved, out }.
   *  raw = { standings: object, players: html, goalies: html, schedule: html, recaps: { gameId: html } } */
  function assemble(raw, lg, cfg, oldBox, warn, oldPo) {
    oldPo = oldPo && oldPo.meta && playoffsOf(cfg) && oldPo.meta.seasonId === playoffsOf(cfg).seasonId ? oldPo : null;
    warn = warn || function (m) { console.warn(m); };
    var teams = P().parseStandings(typeof raw.standings === 'string' ? JSON.parse(raw.standings) : raw.standings);
    var players = P().parsePlayers(raw.players);
    var goalies = P().parseGoalies(raw.goalies);
    var games = P().parseSchedule(raw.schedule, teams);

    var problems = [];
    if (teams.length < 2) problems.push('fewer than 2 teams');
    if (games.length < 1) problems.push('no games');
    if (games.some(function (g) { return !g.id || !g.away || !g.home || !g.date; })) problems.push('incomplete game rows');
    if (players.length < 1) problems.push('no players');

    var box = oldBox || { names: {}, games: {} };
    var boxSaved = 0;
    Object.keys(raw.recaps || {}).forEach(function (id) {
      try {
        var r = P().parseRecap(raw.recaps[id]);
        if (r.game.t.length !== 2) throw new Error('unexpected page layout');
        box.games[id] = r.game;
        Object.assign(box.names, r.names);
        boxSaved++;
      } catch (e) { warn('  box score ' + id + ' skipped: ' + e.message); }
    });
    P().weighGoals(box, games, teams, players);
    var meta = {
      league: 'LDHML', category: lg.short, slug: lg.slug, name: lg.name, season: cfg.seasonName,
      leagueId: cfg.leagueId, seasonId: cfg.seasonId, categoryId: lg.categoryId,
      fetchedAt: new Date().toISOString(), source: 'admin.nbhpa.com'
    };
    var out = { meta: meta, teams: teams, games: games, players: players, goalies: goalies, box: box };
    var poWarn = [];
    if (raw.po && !problems.length) {
      var pa = assemblePlayoffs(raw.po, lg, cfg, teams, players, oldPo, warn);
      poWarn = pa.problems;
      if (!pa.problems.length) { out.playoffs = pa.out; boxSaved += pa.boxSaved; }
      else warn('  playoffs not saved: ' + pa.problems.join('; '));
    }
    return { problems: problems, poProblems: poWarn, boxSaved: boxSaved, out: out };
  }

  /* ---- the playoffs ----
   * NBHPA keeps the playoffs in their own season, with NEW team records (new team ids). The playoff file holds the games,
   * the skater and goalie lists and the box scores of that season, with the team ids and codes of the REGULAR season
   * (teamMap: playoff team id -> our team id), so a team is the same team on every page. A team matches by name first
   * (case, accents and punctuation do not count), then by code. A team that does not match keeps its playoff id
   * (a warning, not a block). The skater and goalie pages have no stats block before the first game: that is [] (or the
   * old lists). data/<slug>/playoffs.json: { meta: { seasonId, season, fetchedAt, source }, teamMap, abbMap, teams, games,
   * players, goalies, box }. */
  var teamKey = function (s) { return String(P().niceName(s || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
  function mapTeams(poTeams, teams) {
    var byName = {}, byAbb = {}, map = {}, abbMap = {}, missing = [];
    teams.forEach(function (t) { byName[teamKey(t.name)] = t; byAbb[String(t.abb).toUpperCase()] = t; });
    poTeams.forEach(function (p) {
      var t = byName[teamKey(p.name)] || byAbb[String(p.abb).toUpperCase()];
      if (t) { map[p.id] = t.id; abbMap[p.abb] = t.abb; } else missing.push(p.name + ' (' + p.abb + ')');
    });
    return { map: map, abbMap: abbMap, missing: missing };
  }
  function assemblePlayoffs(raw, lg, cfg, teams, regPlayers, oldPo, warn) {
    var po = playoffsOf(cfg), problems = [];
    var poTeams = P().parseStandings(typeof raw.standings === 'string' ? JSON.parse(raw.standings) : raw.standings);
    if (poTeams.length < 2) problems.push('playoffs: fewer than 2 teams');
    var m = mapTeams(poTeams, teams);
    if (m.missing.length) warn('  playoffs: no regular team for ' + m.missing.join(', ') + ' (kept with its playoff id)');
    if (poTeams.length && m.missing.length * 2 > poTeams.length) problems.push('playoffs: most teams do not match the regular season');
    var tid = function (id) { return m.map[id] || id; }, tabb = function (a) { return m.abbMap[a] || a; };
    var games = P().parseSchedule(raw.schedule, poTeams).map(function (g) { g.away = tid(g.away); g.home = tid(g.home); return g; });
    if (games.some(function (g) { return !g.id || !g.away || !g.home || !g.date; })) problems.push('playoffs: incomplete game rows');
    // before the first playoff game, the stats pages have no stats block: keep the old lists (or none)
    var list = function (parse, html, key) {
      try { return parse(html); } catch (e) { return oldPo && Array.isArray(oldPo[key]) ? oldPo[key] : []; }
    };
    var mapRow = function (r) { r.teams = r.teams.map(tabb); return r; };
    var players = list(P().parsePlayers, raw.players, 'players').map(mapRow), goalies = list(P().parseGoalies, raw.goalies, 'goalies').map(mapRow);
    var box = oldPo ? JSON.parse(JSON.stringify(oldPo.box)) : { names: {}, games: {} }, boxSaved = 0;
    Object.keys(raw.recaps || {}).forEach(function (id) {
      try {
        var r = P().parseRecap(raw.recaps[id]);
        if (r.game.t.length !== 2) throw new Error('unexpected page layout');
        r.game.t.forEach(function (bt) { bt.id = tid(bt.id); });
        r.game.goals.forEach(function (go) { go[2] = tabb(go[2]); });
        r.game.pens.forEach(function (pe) { pe[2] = tabb(pe[2]); });
        box.games[id] = r.game;
        Object.assign(box.names, r.names);
        boxSaved++;
      } catch (e) { warn('  playoff box score ' + id + ' skipped: ' + e.message); }
    });
    // the running goal totals start again in the playoff season: weigh the playoff games on their own
    P().weighGoals(box, games, teams, players.concat(regPlayers));
    var meta = { seasonId: po.seasonId, season: po.seasonName, fetchedAt: new Date().toISOString(), source: 'admin.nbhpa.com' };
    var mapped = poTeams.map(function (p) { return Object.assign({}, p, { id: tid(p.id), abb: tabb(p.abb), nbhpaId: p.id }); });
    return { problems: problems, boxSaved: boxSaved, out: { meta: meta, teamMap: m.map, abbMap: m.abbMap, teams: mapped, games: games, players: players, goalies: goalies, box: box } };
  }

  /** The files of one league, as saveLeague writes them: { 'data/<slug>/<name>.json': text }. playoffs.json only when the
   *  league has a playoff season. */
  function leagueFiles(slug, out) {
    var f = {};
    FILES.forEach(function (k) { f['data/' + slug + '/' + k + '.json'] = JSON.stringify(out[k]); });
    if (out.playoffs) f['data/' + slug + '/playoffs.json'] = JSON.stringify(out.playoffs);
    return f;
  }

  // ---- our person ids (registry/people.json; read registry/CLAUDE.md) ----
  var idOf = function (n) { return 'L' + String(n).padStart(4, '0'); };
  var empty = function () { return { next: 1, people: [] }; };
  // Most frequent value of a list (first one wins a tie). Empty values do not count.
  var mostCommon = function (list) {
    var n = new Map(), best = null;
    list.forEach(function (v) { if (v != null && v !== '') n.set(v, (n.get(v) || 0) + 1); });
    n.forEach(function (c, v) { if (best === null || c > n.get(best)) best = v; });
    return best;
  };

  /** Add the people of `rows` to the registry. rows: [{ nid, pid, name, sex }] (one per stats row of any league).
   *  Returns { reg, added, changed, problems }. When problems is not empty, do not save. The input is not changed. */
  function syncRegistry(reg0, rows, opts) {
    var since = opts && opts.since;
    var reg = JSON.parse(JSON.stringify(reg0 || empty()));
    var problems = [];
    var byNid = new Map(reg.people.map(function (p) { return [p.nid, p]; }));
    var pidOwner = new Map();
    reg.people.forEach(function (p) { p.pids.forEach(function (pid) { pidOwner.set(pid, p.nid); }); });

    var seen = new Map(); // nid -> rows
    rows.forEach(function (r) {
      if (!r.nid) { problems.push('player_id ' + r.pid + ' (' + r.name + ') has no NBHPA id'); return; }
      var owner = pidOwner.get(r.pid);
      if (owner && owner !== r.nid) problems.push('player_id ' + r.pid + ' belongs to NBHPA id ' + owner + ' in the registry, but the data says ' + r.nid);
      if (!seen.has(r.nid)) seen.set(r.nid, []);
      seen.get(r.nid).push(r);
    });

    var changed = 0, fresh = [];
    seen.forEach(function (rs, nid) {
      var name = mostCommon(rs.map(function (r) { return r.name; })), sex = mostCommon(rs.map(function (r) { return r.sex; }));
      var pids = Array.from(new Set(rs.map(function (r) { return r.pid; }).filter(Boolean)));
      var p = byNid.get(nid);
      if (!p) { fresh.push({ nid: nid, name: name, sex: sex, pids: pids }); return; }
      var before = JSON.stringify(p);
      if (name) p.name = name;
      if (sex) p.sex = sex;
      p.pids = Array.from(new Set(p.pids.concat(pids))).sort();
      if (JSON.stringify(p) !== before) changed++;
    });
    // New people get the next ids, in name order, so a first batch reads well.
    fresh.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }) || a.nid.localeCompare(b.nid); });
    fresh.forEach(function (f) {
      var p = { id: idOf(reg.next++), nid: f.nid, name: f.name, sex: f.sex, pids: f.pids.sort() };
      if (since) p.since = since;
      reg.people.push(p);
    });
    return { reg: reg, added: fresh.length, changed: changed, problems: problems };
  }

  // One person per line: a refresh that adds one person changes one line.
  function serializeRegistry(reg) {
    var head = Object.keys(reg).filter(function (k) { return k !== 'next' && k !== 'people'; })
      .map(function (k) { return '  ' + JSON.stringify(k) + ': ' + JSON.stringify(reg[k]) + ',\n'; }).join('');
    return '{\n' + head + '  "next": ' + reg.next + ',\n  "people": [\n' + reg.people.map(function (p) { return '    ' + JSON.stringify(p); }).join(',\n') + '\n  ]\n}\n';
  }

  /** The registry rows of the players and goalies lists of every league: { slug: { players, goalies } }. */
  function registryRows(lists) {
    var rows = [];
    Object.keys(lists).forEach(function (slug) {
      ['players', 'goalies'].forEach(function (f) { (lists[slug][f] || []).forEach(function (p) { rows.push({ nid: p.nid, pid: p.id, name: p.name, sex: p.sex }); }); });
    });
    return rows;
  }

  root.LDRefresh = { BASE: BASE, FILES: FILES, fetchLeague: fetchLeague, assemble: assemble, leagueFiles: leagueFiles, playoffsOf: playoffsOf, mapTeams: mapTeams,
    idOf: idOf, syncRegistry: syncRegistry, serializeRegistry: serializeRegistry, registryRows: registryRows };
})(typeof window !== 'undefined' ? window : globalThis);
