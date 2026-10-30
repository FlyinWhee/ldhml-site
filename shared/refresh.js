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
   *  warn(msg), step(key, info) (optional: what is being read, for a log) }. Box scores: new games and the last 3 days. */
  async function fetchLeague(lg, cfg, oldBox, io) {
    var step = io.step || function () {};
    var form = function (extra) {
      var f = new URLSearchParams({ season_id: cfg.seasonId, category_id: lg.categoryId, league_id: cfg.leagueId });
      Object.keys(extra || {}).forEach(function (k) { f.set(k, extra[k]); });
      return f;
    };
    var post = function (body) { return { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }; };
    var q = new URLSearchParams();
    q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', cfg.leagueId);
    q.set('filters[][league_id]', cfg.leagueId); q.set('filters[][season_id]', cfg.seasonId);
    q.set('category_id', lg.categoryId); q.set('filters[][category_id]', lg.categoryId);
    q.set('public_site', '1'); q.set('class', 'Standings');
    FIELDS.forEach(function (f) { q.append('fields[]', f); });
    q.set('page', '1');

    var raw = { recaps: {} };
    step('standings'); raw.standings = await io.get(BASE + '/table_data.php?' + q, {}, 'json'); await io.sleep(io.delay);
    step('players'); raw.players = await io.get(BASE + '/sites/site_stats_players.php?lang=fr', post(form()), 'text'); await io.sleep(io.delay);
    step('goalies'); raw.goalies = await io.get(BASE + '/sites/site_stats_goalies.php?lang=fr', post(form()), 'text'); await io.sleep(io.delay);
    step('schedule'); raw.schedule = await io.get(BASE + '/sites/site_schedule_include.php?lang=fr', post(form({ view: 'list' })), 'text');

    var out = assemble(raw, lg, cfg, oldBox ? JSON.parse(JSON.stringify(oldBox)) : null, function () {}).out;
    var recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    var todo = out.games.filter(function (g) { return g.as != null && g.hs != null && !g.cancelled && (!(oldBox && oldBox.games && oldBox.games[g.id]) || g.date >= recent); });
    step('recaps', { n: todo.length });
    for (var i = 0; i < todo.length; i++) {
      var g = todo[i];
      await io.sleep(io.delay);
      step('recap', { id: g.id, date: g.date, i: i + 1, n: todo.length });
      try { raw.recaps[g.id] = await io.get(BASE + '/sites/site_game_recap.php?game_id=' + g.id + '&league_id=' + cfg.leagueId + '&lang=fr', {}, 'text'); }
      catch (e) { (io.warn || console.warn)('  box score ' + g.id + ' skipped: ' + e.message); }
    }
    return raw;
  }

  /** Turn raw responses of one league into the snapshot files. Returns { problems, boxSaved, out }.
   *  raw = { standings: object, players: html, goalies: html, schedule: html, recaps: { gameId: html } } */
  function assemble(raw, lg, cfg, oldBox, warn) {
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
    return { problems: problems, boxSaved: boxSaved, out: { meta: meta, teams: teams, games: games, players: players, goalies: goalies, box: box } };
  }

  /** The files of one league, as saveLeague writes them: { 'data/<slug>/<name>.json': text }. */
  function leagueFiles(slug, out) {
    var f = {};
    FILES.forEach(function (k) { f['data/' + slug + '/' + k + '.json'] = JSON.stringify(out[k]); });
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

  root.LDRefresh = { BASE: BASE, FILES: FILES, fetchLeague: fetchLeague, assemble: assemble, leagueFiles: leagueFiles,
    idOf: idOf, syncRegistry: syncRegistry, serializeRegistry: serializeRegistry, registryRows: registryRows };
})(typeof window !== 'undefined' ? window : globalThis);
