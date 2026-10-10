  /* ================= live engine =================
   * Live data comes from the public NBHPA league pages. Rules this code follows:
   *   - It only reads pages that need no sign-in. It never uses the staff tools of the league.
   *   - One request at a time, with a pause between requests.
   *   - Nothing runs while the tab is hidden. Nothing runs for old data that is still fresh.
   *   - Game clocks (350 bytes) are read only for games that are on today, from 30 min before the start.
   *   - After an error the code waits longer. After HTTP 429 it stops for 5 minutes.
   */
  var API = (function () {
    var m = document.querySelector('meta[name="ldhml-api"]');
    return String(window.LDHML_API || (m && m.getAttribute('content')) || 'https://admin.nbhpa.com').replace(/\/+$/, '');
  })();
  var LEAGUE_ID = String(D.meta.leagueId || '10');
  var POLL = {
    tickMs: 5000, live: 30000, pre: 90000, none: 120000, recap: 120000, timeout: 12000, gap: 1200, gapSmall: 400,
    ttl: { standings: [600000, 300000], schedule: [900000, 300000], players: [900000, 600000], goalies: [900000, 600000] }
  };
  var NEED = {
    home: ['standings', 'schedule'], standings: ['standings', 'schedule'], schedule: ['schedule'], players: ['players'], goalies: ['goalies'],
    leaders: ['players', 'goalies'], team: ['standings', 'schedule', 'players', 'goalies'], player: ['players', 'goalies', 'schedule'], game: ['schedule'], live: ['schedule', 'standings']
  };
  var liveChain = Promise.resolve(), liveLastEnd = 0, liveBusy = false, liveTimer = 0, liveSig = '';

  function enqueue(fn, gap) {
    var p = liveChain.then(function () {
      return new Promise(function (ok) { setTimeout(ok, Math.max(0, liveLastEnd + gap - Date.now())); });
    }).then(fn).then(function (v) { liveLastEnd = Date.now(); return v; }, function (e) { liveLastEnd = Date.now(); throw e; });
    liveChain = p.catch(function () {});
    return p;
  }
  function http(path, init, gap, as) {
    return enqueue(function () {
      if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, POLL.timeout);
      init = init || {};
      if (ctl) init.signal = ctl.signal;
      return fetch(API + path, init).then(function (res) {
        clearTimeout(to);
        if (res.status === 429) LIVE.pauseUntil = Date.now() + 300000;
        if (!res.ok) { var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
        return as === 'json' ? res.json() : res.text();
      }, function (e) { clearTimeout(to); throw e; });
    }, gap);
  }
  var formInit = function (extra) {
    var p = { season_id: String(D.meta.seasonId), category_id: String(D.meta.categoryId), league_id: LEAGUE_ID };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString() };
  };
  function setData(key, val) {
    if (JSON.stringify(D[key]) === JSON.stringify(val)) return false;
    D[key] = val; LIVE.modelDirty = true; return true;
  }
  var FETCH = {
    standings: function () {
      var q = new URLSearchParams();
      q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', LEAGUE_ID);
      q.set('filters[][league_id]', LEAGUE_ID); q.set('filters[][season_id]', String(D.meta.seasonId));
      q.set('category_id', String(D.meta.categoryId)); q.set('filters[][category_id]', String(D.meta.categoryId));
      q.set('public_site', '1'); q.set('class', 'Standings');
      ['team_id', 'team_name', 'team_abb', 'team_pic', 'position', 'gp', 'wins_tot', 'losses', 'ot', 'ot_loss', 'pts', 'gf', 'ga', 'diff', 'pts_gp'].forEach(function (f) { q.append('fields[]', f); });
      q.set('page', '1');
      return http('/table_data.php?' + q, {}, POLL.gap, 'json').then(function (j) {
        var rows = LDParsers.parseStandings(j);
        if (rows.length < 2) throw new Error('standings');
        return setData('teams', rows);
      });
    },
    schedule: function () {
      return http('/sites/site_schedule_include.php?lang=fr', formInit({ view: 'list' }), POLL.gap, 'text').then(function (html) {
        var rows = LDParsers.parseSchedule(html, D.teams);
        if (!rows.length || rows.length < D.games.length * 0.8 || rows.some(function (g) { return !g.id || !g.away || !g.home || !g.date; })) throw new Error('schedule');
        return setData('games', rows);
      });
    },
    players: function () {
      return http('/sites/site_stats_players.php?lang=fr', formInit(), POLL.gap, 'text').then(function (html) {
        var rows = LDParsers.parsePlayers(html);
        if (!rows.length) throw new Error('players');
        return setData('players', rows);
      });
    },
    goalies: function () {
      return http('/sites/site_stats_goalies.php?lang=fr', formInit(), POLL.gap, 'text').then(function (html) {
        var rows = LDParsers.parseGoalies(html);
        if (!rows.length) throw new Error('goalies');
        return setData('goalies', rows);
      });
    }
  };
  function fetchRecap(g) {
    return http('/sites/site_game_recap.php?game_id=' + g.id + '&league_id=' + LEAGUE_ID + '&lang=fr', {}, POLL.gap, 'text').then(function (html) {
      var r = LDParsers.parseRecap(html);
      if (r.game.t.length !== 2) return false;
      Object.assign(D.box.names, r.names);
      /* Work out the value of each goal (a goal by a woman counts for 2) from the other games' running totals. */
      var wbox = { games: Object.assign({}, D.box.games) }; wbox.games[g.id] = r.game;
      LDParsers.weighGoals(wbox, D.games, D.teams, D.players);
      var final = played(gameById[g.id] || g);
      var before = JSON.stringify(final ? D.box.games[g.id] : (LIVE.recap[g.id] || {}).game);
      if (before === JSON.stringify(r.game)) return false;
      if (final) { D.box.games[g.id] = r.game; delete LIVE.recap[g.id]; LIVE.modelDirty = true; }
      else LIVE.recap[g.id] = { game: r.game, at: Date.now() };
      return true;
    });
  }

  var inWindow = function (g) {
    var s = startMs(g), n = nowMs(), x = LIVE.games[g.id];
    return n >= s - 30 * 60000 && (n <= s + 110 * 60000 || (x && x.state === 'live' && n <= s + 4 * 3600000));
  };
  var isPre = function (lv) { return /pre|not|sched|wait|upcom|ready/i.test(lv.status); };

  function pollLive(g, x) {
    return http('/livegame_json/' + g.id, {}, POLL.gapSmall, 'json').then(function (j) {
      LIVE.net = 'ok'; LIVE.lastOk = Date.now(); LIVE.fails = 0;
      var before = JSON.stringify(x.lv) + x.state, lv = LDParsers.parseLive(j), was = x.state;
      if (!lv) { x.lv = null; x.state = 'none'; x.next = Date.now() + POLL.none; }
      else {
        x.lv = lv; x.state = lv.over ? 'over' : (isPre(lv) ? 'pre' : 'live');
        x.next = Date.now() + (x.state === 'live' ? POLL.live : x.state === 'over' ? 600000 : POLL.pre);
        if (x.state === 'over' && was !== 'over') { LIVE.settleAt = Date.now() + 20000; LIVE.settleTries = 0; x.recapAt = 0; }
      }
      if (before !== JSON.stringify(x.lv) + x.state) LIVE.changed = true;
    }, function () {
      /* A game without a live record answers 404 without CORS headers, so the browser reports a network error. This is normal before a game. */
      x.fail = (x.fail || 0) + 1; x.state = x.state === 'live' ? 'live' : 'none';
      x.next = Date.now() + Math.min(180000, POLL.none * x.fail);
    });
  }

  function route() { return parseRoute(); }
  function staleKinds(onNight) {
    var r = route(), need = NEED[r.name] || [], now = Date.now();
    return need.filter(function (k) {
      if (LIVE.forced && LIVE.forced[k]) return true;
      return now - (LIVE.fetched[k] || 0) >= POLL.ttl[k][onNight ? 1 : 0];
    });
  }

  /* Which box scores does the current page need, and which of them are not in the cache (or must be read again)? */
  var BX = { fail: {}, fresh: {}, total: 0 };
  function boxMissing(g) {
    if (!played(g) || g.cancelled) return false;
    if (BX.fresh[g.id]) return false;
    var b = D.box.games[g.id];
    if (!b) return true;
    /* cached before the goal values were kept (older build) */
    if ((b.goals || []).some(function (go) { return go.length < 6; })) return true;
    /* scores can be corrected for a few days after the game, as in the scraper */
    var since = new Date((Date.parse(D.meta.fetchedAt) || 0) - 3 * 86400000).toISOString().slice(0, 10);
    return g.date >= since;
  }
  function boxNeeds(r) {
    var pl = games.filter(played), id = r.id, set;
    if (SCOPE === 'main' || r.name === 'standings') set = pl;
    else if (r.name === 'game') set = pl.filter(function (g) { return g.id === id; });
    else if (r.name === 'team') set = pl.filter(function (g) { return g.away === id || g.home === id; });
    else if (r.name === 'player') {
      var pp = people[id], abbs = pp ? pp.teams : [];
      set = pl.filter(function (g) { return abbs.indexOf(abbOfTeam(g.away)) >= 0 || abbs.indexOf(abbOfTeam(g.home)) >= 0; });
    } else if (r.name === 'home' || r.name === 'live') {
      var last = pl.length ? pl[pl.length - 1].date : '';
      set = pl.filter(function (g) { return g.date === last || g.date === todayStr(); });
    } else set = [];
    /* tonight's games always, so the stats stay right after a final */
    set = set.concat(pl.filter(function (g) { return g.date === todayStr(); }));
    return set.filter(function (g, i, l) { return l.indexOf(g) === i && boxMissing(g); });
  }
  function boxPill() {
    var el = document.getElementById('boxload'); if (!el) return;
    el.hidden = !BX.total || LIVE.net === 'offline';
    if (!el.hidden) el.textContent = t('boxLoading', { n: BX.total });
  }

  function run() {
    var steps = [], now = Date.now(), r = route();
    var tonight = games.filter(function (g) { return g.date === todayStr(); });
    var active = tonight.filter(inWindow);
    var onNight = active.length > 0;

    active.forEach(function (g) {
      var x = LIVE.games[g.id] || (LIVE.games[g.id] = { state: 'none', next: 0, fail: 0 });
      if (played(g) && x.state !== 'live') return;
      if (now >= x.next) steps.push(function () { return pollLive(g, x); });
    });
    /* Box score of a live game: only while somebody looks at it. */
    liveList().forEach(function (g) {
      var x = LIVE.games[g.id], watching = (r.name === 'live') || (r.name === 'game' && r.id === g.id) || r.name === 'home';
      if (watching && now - (x.recapAt || 0) >= POLL.recap) steps.push(function () { x.recapAt = Date.now(); return fetchRecap(g).then(function (c) { if (c) LIVE.changed = true; }); });
    });
    /* A game that just ended: once the league posts the final score, bring in the box score and the new stats. */
    if (LIVE.settleAt && now >= LIVE.settleAt) {
      LIVE.forced = { standings: 1, schedule: 1, players: 1, goalies: 1 };
      LIVE.settleAt = 0;
      LIVE.settleCheck = true;
    }
    staleKinds(onNight).forEach(function (k) {
      steps.push(function () {
        return FETCH[k]().then(function (c) {
          LIVE.fetched[k] = Date.now(); LIVE.net = 'ok'; LIVE.lastOk = Date.now(); LIVE.fails = 0;
          if (LIVE.forced) delete LIVE.forced[k];
          if (c) LIVE.changed = true;
        }, function () {
          LIVE.fails++; if (LIVE.fails >= 2 && !LIVE.lastOk) LIVE.net = 'offline';
          LIVE.fetched[k] = Date.now() - POLL.ttl[k][onNight ? 1 : 0] + Math.min(600000, 60000 * LIVE.fails);
          if (LIVE.forced) delete LIVE.forced[k];
        });
      });
    });
    /* Box scores. The build holds a cache of them. The page compares it with the played games of the live schedule and
     * fetches only the difference, for the games this page needs. A finished box score never changes, so a cached one is kept. */
    var todo = boxNeeds(r).filter(function (g) { var x = BX.fail[g.id]; return !x || Date.now() >= x; });
    BX.total = todo.length;
    if (LIVE.net !== 'offline') todo.slice(0, 3).forEach(function (g) {
      steps.push(function () {
        BX.fail[g.id] = Date.now() + 120000;
        return fetchRecap(g).then(function (c) {
          delete BX.fail[g.id]; BX.fresh[g.id] = 1;
          if (c) LIVE.changed = true;
        }, function () {});
      });
    });
    return steps.reduce(function (p, f) { return p.then(f).then(function () { flush(); updateFresh(); boxPill(); }); }, Promise.resolve()).then(function () {
      if (LIVE.settleCheck) {
        LIVE.settleCheck = false;
        var open = Object.keys(LIVE.games).some(function (id) { return LIVE.games[id].state === 'over' && gameById[id] && !played(gameById[id]); });
        if (open && ++LIVE.settleTries < 6) LIVE.settleAt = Date.now() + 120000;
      }
    });
  }

  function typing() {
    var a = document.activeElement;
    return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.id !== 'gs');
  }
  function flush() {
    if (!LIVE.changed && !LIVE.modelDirty) return;
    if (LIVE.modelDirty) { buildModel(); buildSearch(); LIVE.modelDirty = false; }
    LIVE.changed = false;
    var sig = liveList().map(function (g) { return g.id; }).join(',');
    if (sig !== liveSig) { liveSig = sig; if (!(document.activeElement && document.activeElement.id === 'gs')) renderChrome(); }
    if (!typing()) render(true);
  }

  var agoText = function (ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return t('justNow');
    return s < 90 ? t('ago', { n: s }) : t('agoMin', { n: Math.round(s / 60) });
  };
  /* The footer says something only when live data is not available. Otherwise visitors have nothing to read there. */
  function updateFresh() {
    var el = document.getElementById('fresh'); if (!el) return;
    var offline = LIVE.net === 'offline' || (typeof fetch !== 'function');
    el.hidden = !offline;
    el.className = 'fresh';
    el.textContent = offline ? t('liveOffline', { t: fmtStamp(D.meta.fetchedAt) }) : '';
  }

  function tick() {
    clearTimeout(liveTimer);
    if (window.LDHML_LIVE === false || liveBusy) return;
    var again = function () { liveTimer = setTimeout(tick, POLL.tickMs); };
    if (document.hidden || Date.now() < (LIVE.pauseUntil || 0)) { again(); return; }
    liveBusy = true;
    run().catch(function () {}).then(function () { liveBusy = false; flush(); updateFresh(); again(); });
  }

  /* Data from the build is the starting point. A page older than the refresh time limit is refreshed at once. */
  (function init() {
    var t0 = Date.parse(D.meta.fetchedAt) || 0;
    ['standings', 'schedule', 'players', 'goalies'].forEach(function (k) { LIVE.fetched[k] = t0; });
    if (window.LDHML_LIVE === false) return;
    liveTimer = setTimeout(tick, 600);
    setInterval(updateFresh, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    window.addEventListener('hashchange', function () { setTimeout(tick, 300); });
    window.LDHML_TEST = { tick: function () { return new Promise(function (ok) { clearTimeout(liveTimer); var go = function () { if (liveBusy) { setTimeout(go, 50); return; } liveBusy = true; run().catch(function () {}).then(function () { liveBusy = false; flush(); updateFresh(); ok(); }); }; go(); }); }, state: LIVE };
  })();
