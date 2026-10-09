  /* ================= helpers for games ================= */
  var venueName = function (g) { return g.venue.replace(/^Surface\s+/i, ''); };
  var venueLine = function (g) { return venueName(g) + (g.court ? ', ' + t('surface', { n: g.court }) : ''); };
  var perLabel = function (i) { return i < 3 ? t('per', { n: i + 1 }) : t('ot'); };
  var periodCount = function (b) { return Math.max(3, Math.max.apply(null, b.pg.map(function (r) { return r.length; }))); };
  var clockSec = function (s) { var p = String(s).split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); };
  var signed = function (n) { return (n > 0 ? '+' : '') + n; };
  var boxIndex = function (b, teamId) { for (var i = 0; i < b.t.length; i++) if (b.t[i].id === teamId) return i; return -1; };

  /* Static table without sorting. cols: { label, title, num, key, html(row), foot(rows) } */
  function simpleTable(cols, rows, footLabel) {
    var head = cols.map(function (c) { return '<th scope="col" class="' + (c.num ? 'num' : '') + '" title="' + esc(c.title || '') + '">' + esc(c.label) + '</th>'; }).join('');
    var body = rows.map(function (r) {
      return '<tr>' + cols.map(function (c) { return '<td class="' + (c.num ? 'num ' : '') + (c.key ? 'key' : '') + '">' + c.html(r) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var foot = footLabel ? '<tfoot><tr>' + cols.map(function (c) {
      return '<td class="' + (c.num ? 'num' : '') + '">' + (c.foot ? c.foot(rows) : '') + '</td>';
    }).join('') + '</tr></tfoot>' : '';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>';
  }
  var clockLabel = function (lv) {
    var n = parseInt(lv.period, 10);
    return (isNaN(n) ? lv.period : perLabel(n - 1)) + ' ' + lv.clock;
  };
  var liveBadge = function (lv) { return '<span class="livebadge"><i></i>' + t('liveNow') + (lv ? '<em>' + esc(clockLabel(lv)) + '</em>' : '') + '</span>'; };
  var sum = function (rows, f) { return rows.reduce(function (s, r) { return s + f(r); }, 0); };

  /* ================= game rows (schedule, team page) ================= */
  function gameBlock(g, o) {
    o = o || {};
    g = eff(g);
    var pl = played(g);
    var line = function (id, sc, other) {
      var tm = T[id] || { abb: '?', name: '?', id: '' };
      var cls = pl && !g._live ? (sc > other ? 'win' : sc < other ? 'lose' : '') : '';
      return '<div class="gm-line ' + cls + '">' + crest(tm.abb, 'sm') + '<a class="tl strong" href="#team-' + tm.id + '">' + esc(tm.name) + '</a><span class="sc">' + (pl ? sc : '') + '</span></div>';
    };
    var res = '';
    if (o.teamId && pl) {
      var mine = g.away === o.teamId ? [g.as, g.hs] : [g.hs, g.as];
      res = g._live ? '' : (mine[0] > mine[1] ? 'W' : mine[0] < mine[1] ? 'L' : 'T');
    }
    var when = (o.showDate ? '<b>' + esc(fmtShort(g.date)) + '</b>' + esc(g.time) + ' ' : '<b>' + esc(g.time) + '</b>') + esc(venueName(g));
    var end = (g.cancelled ? '<span class="cxl">' + t('cancelled') + '</span>' : (g._live ? liveBadge(liveOf(g.id)) : (pl ? '<span class="fin">' + t('final') + '</span>' : ''))) +
      '<a class="boxlink" href="#game-' + esc(g.id) + '">' + t('boxScore') + '</a>';
    return '<article class="gm ' + res + '"><div class="gm-when">' + when + '</div><div class="gm-teams">' + line(g.away, g.as, g.hs) + line(g.home, g.hs, g.as) + '</div><div class="gm-end">' + (res ? chip(res, '') : '') + end + '</div></article>';
  }
  function groupedGames(list) {
    if (!list.length) return '<p class="empty">' + t('noGames') + '</p>';
    var out = '', cur = null;
    list.forEach(function (g) {
      if (g.date !== cur) {
        if (cur !== null) out += '</div></section>';
        cur = g.date;
        var n = list.filter(function (x) { return x.date === cur; }).length;
        out += '<section class="dgrp"><h3 class="day">' + esc(fmtDay(cur)) + '<small>' + plural(n, 'game', 'games') + '</small></h3><div class="gms">';
      }
      out += gameBlock(g);
    });
    return out + '</div></section>';
  }

  /* ================= scoreboard card (home) ================= */
  function sbCard(g) {
    g = eff(g);
    var pl = played(g), b = boxOf(g.id), lv = g._live ? liveOf(g.id) : null;
    var np = (pl && b) ? periodCount(b) : 0;
    var cls = np ? '' : ' nop';
    var head = np ? '<div class="sbc-head' + cls + '" style="--np:' + np + '"><span></span><span></span>' +
      Array.apply(null, Array(np)).map(function (_, i) { return '<span>' + perLabel(i) + '</span>'; }).join('') + '<span></span></div>' : '';
    var row = function (id, sc, other) {
      var tm = T[id] || { abb: '?', name: '?', id: '' };
      var lose = pl && !lv && sc < other;
      var idx = b ? boxIndex(b, id) : -1;
      var pers = np ? Array.apply(null, Array(np)).map(function (_, i) { return '<span class="sbc-per">' + (idx >= 0 && b.pg[idx][i] != null ? b.pg[idx][i] : '') + '</span>'; }).join('') : '';
      return '<div class="sbc-row' + (lose ? ' lose' : '') + cls + '" style="--tc:' + colorOf(tm.abb) + ';--np:' + np + '"><span class="tab"></span>' +
        '<a class="sbc-team" href="#team-' + tm.id + '"><b>' + esc(tm.abb) + '</b><span>' + esc(tm.name) + '</span></a>' + pers +
        (pl ? led(sc, lose ? 'dim' : 'glow') : '<span></span>') + '</div>';
    };
    return '<article class="sbc' + (lv ? ' is-live' : '') + '"><div class="sbc-meta"><span>' + (lv ? liveBadge(lv) : pl ? t('final') : esc(g.time)) + '</span><span>' + (g.court ? esc(t('surface', { n: g.court })) : '') + '</span></div>' +
      head + row(g.away, g.as, g.hs) + row(g.home, g.hs, g.as) +
      '<div class="sbc-foot"><span>' + esc(g.time) + ' · ' + esc(venueName(g)) + '</span><a href="#game-' + esc(g.id) + '">' + t('boxScore') + '</a></div></article>';
  }

  /* ================= leaders ================= */
  var q2 = function (p) { return p.gp >= 2; };
  function leaderDefs() {
    return [
      { id: 'pts', title: t('points'), list: skaters, val: function (p) { return p.p; }, fmt: function (v) { return v; }, dir: 'desc', min0: true },
      { id: 'g', title: t('goals'), list: skaters, val: function (p) { return p.g; }, fmt: function (v) { return v; }, dir: 'desc', min0: true },
      { id: 'a', title: t('assists'), list: skaters, val: function (p) { return p.a; }, fmt: function (v) { return v; }, dir: 'desc', min0: true },
      { id: 'ppg', title: t('ptsPerGame'), note: t('min2'), list: skaters.filter(q2), val: function (p) { return p.p / p.gp; }, fmt: f2, dir: 'desc', min0: true },
      { id: 'pim', title: t('penMin'), list: skaters, val: function (p) { return mins(p.pim); }, fmt: function (v) { return v; }, dir: 'desc', min0: true },
      { id: 'svp', title: t('saves'), note: t('min2'), list: goalies.filter(q2), val: function (p) { return p.pct; }, fmt: pct, dir: 'desc', goalie: true },
      { id: 'gaa', title: t('gaaFull'), note: t('min2'), list: goalies.filter(q2), val: function (p) { return p.gaa; }, fmt: f2, dir: 'asc', goalie: true },
      { id: 'w', title: t('wins'), list: goalies, val: function (p) { return p.w; }, fmt: function (v) { return v; }, dir: 'desc', goalie: true, min0: true },
      { id: 'so', title: t('shutouts'), list: goalies, val: function (p) { return p.so; }, fmt: function (v) { return v; }, dir: 'desc', goalie: true, min0: true }
    ];
  }
  function leaderCard(def, n) {
    var list = def.list.filter(function (p) { return !def.min0 || def.val(p) > 0; });
    var ranks = rankMap(list, def.val, def.dir);
    var sorted = list.slice().sort(function (a, b) {
      var d = def.dir === 'asc' ? def.val(a) - def.val(b) : def.val(b) - def.val(a);
      return d || (b.gp - a.gp) || a.name.localeCompare(b.name);
    }).slice(0, n);
    var title = '<h3>' + esc(def.title) + (def.note ? '<small>' + esc(def.note) + '</small>' : '') + '</h3>';
    if (!sorted.length) return '<section class="lc"><div class="lc-top">' + title + '</div><p class="lc-empty">' + t('noData') + '</p></section>';
    var first = sorted[0];
    var top = '<div class="lc-top">' + title + '<div class="who1"><a href="#player-' + first.id + '">' + esc(first.name) + '</a>' + abbLinks(first.teams) + '</div>' + led(def.fmt(def.val(first)), 'glow') + '</div>';
    var items = sorted.slice(1).map(function (p) {
      return '<li><span class="rk">' + ranks[p.id] + '</span><span class="who"><a class="tl" href="#player-' + p.id + '">' + esc(p.name) + '</a>' + abbLinks(p.teams) + '</span><b class="val">' + def.fmt(def.val(p)) + '</b></li>';
    }).join('');
    return '<section class="lc">' + top + (items ? '<ol>' + items + '</ol>' : '') + '</section>';
  }

  /* ================= views ================= */
  function viewHome() {
    var lastDate = playedGames.length ? playedGames[playedGames.length - 1].date : null;
    var nextDate = upcomingGames.length ? upcomingGames[0].date : null;
    var today = todayStr(), hasToday = games.some(function (g) { return g.date === today; });
    var heroDate = hasToday ? today : (lastDate || nextDate);
    var heroGames = heroDate ? games.filter(function (g) { return g.date === heroDate; }) : [];
    var nextLine = (lastDate && nextDate && nextDate !== heroDate) ? '<p class="nextup">' + t('nextNight') + ': <a href="#schedule">' + esc(fmtDay(nextDate)) + '</a>, ' + plural(games.filter(function (g) { return g.date === nextDate; }).length, 'game', 'games') + '</p>' : '';
    var band = heroDate ? '<div class="arena"><div class="wrap"><div class="arena-head"><div><h1>' + esc(fmtDay(heroDate)) + '</h1><p class="sub">' +
      (hasToday ? t('tonight', { n: heroGames.length }) + '. ' : lastDate ? t('finals', { n: heroGames.length }) + '. ' : '') + t('progress', { p: playedGames.length, n: games.filter(function (g) { return !g.cancelled; }).length, g: totalGoals }) +
      '</p></div>' + nextLine + '</div><div class="sb-grid">' + heroGames.map(sbCard).join('') + '</div></div></div>' : '';

    var nextGames = nextDate && nextDate !== heroDate ? games.filter(function (g) { return g.date === nextDate && !played(g); }) : [];
    var nextHtml = nextGames.length ? '<section class="sec"><div class="sec-h"><h2>' + t('nextGames') + '</h2><a href="#schedule">' + t('fullSchedule') + '</a></div><h3 class="day">' + esc(fmtDay(nextDate)) + '</h3><div class="gms">' + nextGames.map(function (g) { return gameBlock(g); }).join('') + '</div></section>' : '';
    var defs = leaderDefs();
    var pick = function (id) { return defs.filter(function (d) { return d.id === id; })[0]; };
    var html = '<div class="home-grid"><div>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('standings') + '</h2><a href="#standings">' + t('fullStandings') + '</a></div>' +
      dataTable('home-standings', standingsCols(true), teams, { k: 'pos', dir: 'asc' }, { static: true }) + '</section>' + nextHtml +
      '</div><div><section class="sec"><div class="sec-h"><h2>' + t('leaders') + '</h2><a href="#leaders">' + t('allLeaders') + '</a></div><div class="lg mini">' +
      leaderCard(pick('pts'), 5) + leaderCard(pick('g'), 5) + leaderCard(pick('svp'), 5) + '</div></section></div></div>';
    return { band: band, html: html };
  }

  function viewStandings() {
    return '<h1 class="ph">' + t('standings') + '</h1><p class="lede">' + t('standingsLede') + '</p><div class="sec">' +
      dataTable('standings', standingsCols(false), teams, { k: 'pos', dir: 'asc' }) + '</div>';
  }

  function viewSchedule() {
    var f = ui.sched;
    if (!f.mode) f.mode = games.some(function (g) { return !played(g) && !g.cancelled; }) ? 'upcoming' : 'results';
    var list = games.filter(function (g) {
      if (f.team && g.away !== f.team && g.home !== f.team) return false;
      if (f.mode === 'results') return played(g);
      if (f.mode === 'upcoming') return !played(g);
      return true;
    });
    if (f.mode === 'results') {
      // Newest day first, but the games of one day stay in time order.
      var tkey = function (g) { var m = String(g.time || '').match(/(\d+):(\d+)/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '99:99'; };
      list = list.map(function (g, i) { return { g: g, i: i }; }).sort(function (a, b) {
        return a.g.date < b.g.date ? 1 : a.g.date > b.g.date ? -1 : (tkey(a.g) < tkey(b.g) ? -1 : tkey(a.g) > tkey(b.g) ? 1 : a.i - b.i);
      }).map(function (x) { return x.g; });
    }
    var modes = [['upcoming', t('upcoming')], ['results', t('results')], ['all', t('all')]];
    var seg = '<div class="seg" role="group">' + modes.map(function (m) { return '<button type="button" data-set="sched.mode=' + m[0] + '" aria-pressed="' + (f.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>';
    var sel = '<select id="sched-team" class="ctl" data-bind="sched.team" aria-label="' + t('team') + '"><option value="">' + t('allTeams') + '</option>' +
      teams.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) { return '<option value="' + x.id + '"' + (f.team === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>';
    return '<h1 class="ph">' + t('schedule') + '</h1><p class="lede">' + t('scheduleLede') + '</p><div class="controls">' + seg + sel + '<span class="count">' + t('nGames', { n: list.length }) + '</span></div>' + groupedGames(list);
  }

  function teamSelect(path, value, id) {
    return '<select id="' + id + '" class="ctl" data-bind="' + path + '" aria-label="' + t('team') + '"><option value="">' + t('allTeams') + '</option>' +
      teams.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) { return '<option value="' + x.abb + '"' + (value === x.abb ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>';
  }

  function viewPlayers() {
    var f = ui.players, q = norm(f.q.trim());
    var list = skaters.filter(function (p) {
      return (!f.team || p.teams.indexOf(f.team) >= 0) && (!f.sex || p.sex === f.sex) && (!q || norm(p.name).indexOf(q) >= 0);
    });
    var sx = [['', t('allPlayers')], ['f', t('women')], ['m', t('men')]];
    var seg = '<div class="seg" role="group">' + sx.map(function (m) { return '<button type="button" data-set="players.sex=' + m[0] + '" aria-pressed="' + (f.sex === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>';
    var input = '<input id="pq" class="ctl" type="search" data-bind="players.q" placeholder="' + t('filterPlayers') + '" value="' + esc(f.q) + '" aria-label="' + t('filterPlayers') + '" autocomplete="off">';
    return '<h1 class="ph">' + t('players') + '</h1><p class="lede">' + t('playersLede') + '</p>' + scopeBar() + '<div class="controls">' + input + teamSelect('players.team', f.team, 'pteam') + seg + '<span class="count">' + t('nPlayers', { n: list.length }) + '</span></div>' +
      (list.length ? dataTable('players', skaterCols(), list, { k: 'p', dir: 'desc' }) : '<p class="empty">' + t('noPlayers') + '</p>');
  }

  function viewGoalies() {
    var f = ui.goalies;
    var list = goalies.filter(function (p) { return !f.team || p.teams.indexOf(f.team) >= 0; });
    return '<h1 class="ph">' + t('goalies') + '</h1><p class="lede">' + t('goaliesLede') + '</p>' + scopeBar() + '<div class="controls">' + teamSelect('goalies.team', f.team, 'gteam') + '<span class="count">' + t('nGoalies', { n: list.length }) + '</span></div>' +
      (list.length ? dataTable('goalies', goalieCols(), list, { k: 'gaa', dir: 'asc' }) : '<p class="empty">' + t('noPlayers') + '</p>');
  }

  function viewLeaders() {
    var defs = leaderDefs();
    var cards = function (goalie) { return defs.filter(function (d) { return !!d.goalie === goalie; }).map(function (d) { return leaderCard(d, 10); }).join(''); };
    return '<h1 class="ph">' + t('leaders') + '</h1><p class="lede">' + t('leadersLede') + '</p>' + scopeBar() +
      '<section class="sec"><div class="sec-h"><h2>' + t('skaters') + '</h2></div><div class="lg">' + cards(false) + '</div></section>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('goalies') + '</h2></div><div class="lg">' + cards(true) + '</div></section>';
  }

  /* Scope switch: main team (default) or every team of this league. Shown only when somebody played for more than one team. */
  function scopeBar() {
    if (!hasMulti) return '';
    var o = [['main', t('scopeMain')], ['all', t('scopeAll')]];
    return '<div class="scope"><span class="scope-l">' + t('scopeLabel') + '</span><div class="seg" role="group" aria-label="' + esc(t('scopeLabel')) + '">' +
      o.map(function (m) { return '<button type="button" data-scope="' + m[0] + '" aria-pressed="' + (SCOPE === m[0]) + '">' + m[1] + '</button>'; }).join('') +
      '</div><p class="note scope-n">' + t(SCOPE === 'main' ? 'scopeNoteMain' : 'scopeNoteAll') + '</p></div>';
  }

  /* readout: a row of LED numbers inside a scoreboard panel */
  function readout(items) {
    return '<dl class="readout">' + items.map(function (x) {
      return '<div><dt title="' + esc(x[2] || x[0]) + '">' + esc(x[0]) + '</dt><dd>' + (x[3] ? '<span class="txt">' + esc(x[1]) + '</span>' : led(x[1], 'glow')) + '</dd></div>';
    }).join('') + '</dl>';
  }

  /* Teams: one card per team, in standings order. */
  function viewTeams() {
    var cards = teams.map(function (tm) {
      var top = skaters.filter(function (p) { return p.teams[0] === tm.abb && p.p > 0; }).sort(function (a, b) { return b.p - a.p || b.g - a.g; })[0];
      return '<div class="tcard" style="--tc:' + colorOf(tm.abb) + '"><span class="tab"></span>' +
        '<span class="tcard-top">' + crest(tm.abb, 'lg') + '<span class="tcard-name"><a class="tcard-link" href="#team-' + tm.id + '"><b>' + esc(tm.name) + '</b></a><small>' + ord(tm.pos) + ' · ' + tm.w + '-' + tm.l + '-' + tm.t + ' · ' + tm.pts + ' ' + L('pts')[0] + '</small></span></span>' +
        '<span class="tcard-stats"><span><small>' + L('gf')[0] + '</small><b>' + tm.gf + '</b></span><span><small>' + L('ga')[0] + '</small><b>' + tm.ga + '</b></span><span><small>' + L('diff')[0] + '</small><b>' + signed(tm.diff) + '</b></span><span class="tcard-form">' + formHtml(tm.id) + '</span></span>' +
        (top ? '<span class="tcard-top1"><small>' + t('points') + '</small>' + esc(top.name) + ' <b>' + top.p + '</b></span>' : '') + '</div>';
    }).join('');
    return '<h1 class="ph">' + t('teams') + '</h1><p class="lede">' + t('teamsLede', { n: teams.length }) + '</p><div class="tcards">' + cards + '</div>';
  }

  function viewTeam(r) {
    var tm = T[r.id]; if (!tm) return viewNotFound();
    var inTeam = function (p) { return SCOPE === 'main' ? p.teams[0] === tm.abb : p.teams.indexOf(tm.abb) >= 0; };
    var roster = skaters.filter(inTeam);
    var gk = goalies.filter(inTeam);
    /* Substitutes: in "main team" mode, people of other teams who played games for this team. */
    var subS = [], subG = [];
    if (SCOPE === 'main') {
      D.players.forEach(function (p) { if (p.teams.indexOf(tm.abb) >= 0 && mainTeam(p) !== tm.abb && (splitS[p.id] || {})[tm.abb]) subS.push(skaterFor(p, tm.abb)); });
      D.goalies.forEach(function (p) { if (p.teams.indexOf(tm.abb) >= 0 && mainTeam(p) !== tm.abb && (splitG[p.id] || {})[tm.abb]) subG.push(goalieFor(p, tm.abb)); });
    }
    var mine = games.filter(function (g) { return g.away === tm.id || g.home === tm.id; });
    var items = [
      [t('rank'), ord(tm.pos), t('rank'), true],
      [t('record'), tm.w + '-' + tm.l + '-' + tm.t, t('record'), true],
      [L('pts')[0], tm.pts, L('pts')[1]],
      [L('gf')[0], tm.gf, L('gf')[1]],
      [L('ga')[0], tm.ga, L('ga')[1]],
      [L('diff')[0], signed(tm.diff), L('diff')[1]],
      [t('gfpg'), tm.gp ? f2(tm.gf / tm.gp) : '0.00', t('gfpg')]
    ];
    var head = '<div class="hero" style="--tc:' + colorOf(tm.abb) + '">' + crest(tm.abb, 'lg') + '<div><h1>' + esc(tm.name) + '</h1>' +
      '<p class="meta"><span>' + t('last5') + ' ' + formHtml(tm.id) + '</span></p></div>' + readout(items) + '</div>';
    var rosterHtml = '<section class="sec"><div class="sec-h"><h2>' + t('skaters') + '</h2></div>' +
      (roster.length ? dataTable('team-skaters', skaterCols({ team: tm.abb }), roster, { k: 'p', dir: 'desc' }) : '<p class="empty">' + t('noData') + '</p>') + '</section>' +
      (gk.length ? '<section class="sec"><div class="sec-h"><h2>' + t('goalies') + '</h2></div>' + dataTable('team-goalies', goalieCols({ team: tm.abb, compact: true }), gk, { k: 'gaa', dir: 'asc' }) + '</section>' : '') +
      ((subS.length || subG.length) ? '<section class="sec"><div class="sec-h"><h2>' + t('subs') + '</h2></div><p class="note" style="margin:0 0 10px">' + t('subsNote') + '</p>' +
        (subS.length ? dataTable('team-subs', skaterCols({ team: tm.abb }), subS, { k: 'p', dir: 'desc' }) : '') +
        (subG.length ? '<div class="box-sub">' + dataTable('team-subs-g', goalieCols({ team: tm.abb, compact: true }), subG, { k: 'gaa', dir: 'asc' }) + '</div>' : '') + '</section>' : '');
    var sched = '<section class="sec"><div class="sec-h"><h2>' + t('scheduleResults') + '</h2></div><div class="gms">' +
      mine.map(function (g) { return gameBlock(g, { showDate: true, teamId: tm.id }); }).join('') + '</div></section>';
    return head + scopeBar() + '<div class="two"><div>' + rosterHtml + '</div><div>' + sched + '</div></div>';
  }

  /* ---- player page: hero, form strip and game log ---- */
  var teamLogCol = function () {
    return { label: t('teamCol'), title: t('teamCol'), html: function (x) { var tm = T[x.team]; return tm ? '<span class="tcell">' + crest(tm.abb, 'sm') + '<a class="tl" href="#team-' + tm.id + '">' + esc(tm.abb) + '</a></span>' : ''; } };
  };
  function skaterLogTable(log, showTeam) {
    var cols = [
      { label: t('date'), title: t('date'), html: function (x) { return '<a class="tl strong" href="#game-' + x.game.id + '">' + esc(fmtShort(x.game.date)) + '</a>'; }, foot: function () { return esc(t('seasonTotal')); } },
      { label: t('opp'), title: t('opp'), html: function (x) { var o = T[x.opp]; return o ? '<span class="tcell">' + crest(o.abb, 'sm') + '<a class="tl" href="#team-' + o.id + '">' + esc(o.name) + '</a></span>' : ''; } },
      { label: t('result'), title: t('result'), html: function (x) { return chip(x.r, '') + ' <a class="tl" href="#game-' + x.game.id + '">' + x.gf + '-' + x.ga + '</a>'; } },
      { label: '#', title: t('player'), num: true, html: function (x) { return esc(x.no); } },
      { label: L('g')[0], title: L('g')[1], num: true, key: true, html: function (x) { return x.g; }, foot: function (rows) { return sum(rows, function (x) { return x.g; }); } },
      { label: L('a')[0], title: L('a')[1], num: true, key: true, html: function (x) { return x.a; }, foot: function (rows) { return sum(rows, function (x) { return x.a; }); } },
      { label: L('pts')[0], title: L('pts')[1], num: true, key: true, html: function (x) { return x.g + x.a; }, foot: function (rows) { return sum(rows, function (x) { return x.g + x.a; }); } },
      { label: L('pim')[0], title: L('pim')[1], num: true, html: function (x) { return x.pim; }, foot: function (rows) { return sum(rows, function (x) { return x.pim; }); } }
    ];
    if (showTeam) cols.splice(1, 0, teamLogCol());
    return simpleTable(cols, log, t('seasonTotal'));
  }
  function goalieLogTable(log, showTeam) {
    var cols = [
      { label: t('date'), title: t('date'), html: function (x) { return '<a class="tl strong" href="#game-' + x.game.id + '">' + esc(fmtShort(x.game.date)) + '</a>'; }, foot: function () { return esc(t('seasonTotal')); } },
      { label: t('opp'), title: t('opp'), html: function (x) { var o = T[x.opp]; return o ? '<span class="tcell">' + crest(o.abb, 'sm') + '<a class="tl" href="#team-' + o.id + '">' + esc(o.name) + '</a></span>' : ''; } },
      { label: t('result'), title: t('result'), html: function (x) { return chip(x.r, '') + ' <a class="tl" href="#game-' + x.game.id + '">' + x.gf + '-' + x.ga + '</a>'; } },
      { label: L('sa')[0], title: L('sa')[1], num: true, html: function (x) { return x.sa; }, foot: function (rows) { return sum(rows, function (x) { return x.sa; }); } },
      { label: L('sv')[0], title: L('sv')[1], num: true, html: function (x) { return x.sv; }, foot: function (rows) { return sum(rows, function (x) { return x.sv; }); } },
      { label: L('ga')[0], title: L('ga')[1], num: true, html: function (x) { return x.ga; }, foot: function (rows) { return sum(rows, function (x) { return x.sa - x.sv; }); } },
      { label: L('svp')[0], title: L('svp')[1], num: true, key: true, html: function (x) { return x.sa ? pct(x.sv / x.sa) : '-'; }, foot: function (rows) { var s = sum(rows, function (x) { return x.sa; }); return s ? pct(sum(rows, function (x) { return x.sv; }) / s) : '-'; } }
    ];
    if (showTeam) cols.splice(1, 0, teamLogCol());
    return simpleTable(cols, log, t('seasonTotal'));
  }
  function sparkHtml(log) {
    var chrono = log.slice().reverse();
    return '<div class="spark-wrap"><small>' + t('ptsPerGame') + '</small><div class="spark">' + chrono.map(function (x) {
      var p = x.g + x.a;
      return '<a href="#game-' + x.game.id + '" style="--tc:' + colorOf(abbOfTeam(x.team)) + ';--p:' + p + '" title="' + esc(fmtShort(x.game.date) + ', ' + (T[x.opp] ? T[x.opp].name : '') + ': ' + x.g + ' ' + L('g')[0] + ', ' + x.a + ' ' + L('a')[0]) + '"><i></i>' + p + '</a>';
    }).join('') + '</div></div>';
  }

  /* Numbers of one person, team by team. The two rows always add up to the "all teams" totals. */
  function byTeamHtml(pp) {
    var teamCell2 = function (a) { var tm = TA[a]; return tm ? '<span class="tcell">' + crest(a, 'sm') + '<a class="tl strong" href="#team-' + tm.id + '">' + esc(tm.name) + '</a>' + (a === pp.main ? '<em class="maintag">' + t('mainTag') + '</em>' : '') + '</span>' : esc(a); };
    var teamsOf = function (map) { return pp.teams.filter(function (a) { return map && map[a]; }); };
    var out = '';
    var ss = teamsOf(splitS[pp.id]);
    if (pp.skater && ss.length) {
      var rows = ss.map(function (a) { return { a: a, s: splitS[pp.id][a] }; });
      var num = function (k, f, key) { return { label: L(k)[0], title: L(k)[1], num: true, key: key, html: function (r) { return f(r.s); }, foot: function (rs) { return sum(rs, function (r) { return f(r.s); }); } }; };
      out += simpleTable([
        { label: t('teamCol'), title: t('teamCol'), html: function (r) { return teamCell2(r.a); }, foot: function () { return esc(t('all')); } },
        num('gp', function (s) { return s.gp; }), num('g', function (s) { return s.g; }, true), num('a', function (s) { return s.a; }, true), num('pts', function (s) { return s.g + s.a; }, true),
        { label: L('pim')[0], title: L('pim')[1], num: true, html: function (r) { return mins(r.s.pim); }, foot: function (rs) { return mins(sum(rs, function (r) { return r.s.pim; })); } }
      ], rows, t('all'));
    }
    var gs = teamsOf(splitG[pp.id]);
    if (pp.goalie && gs.length) {
      var grows = gs.map(function (a) { return { a: a, s: splitG[pp.id][a] }; });
      var gn = function (k, f) { return { label: L(k)[0], title: L(k)[1], num: true, html: function (r) { return f(r.s); }, foot: function (rs) { return sum(rs, function (r) { return f(r.s); }); } }; };
      out += (out ? '<div class="box-sub"></div>' : '') + simpleTable([
        { label: t('teamCol'), title: t('teamCol'), html: function (r) { return teamCell2(r.a); }, foot: function () { return esc(t('all')); } },
        gn('gp', function (s) { return s.gp; }), gn('w', function (s) { return s.w; }), gn('l', function (s) { return s.l; }), gn('sa', function (s) { return s.sa; }), gn('sv', function (s) { return s.sv; }),
        { label: L('svp')[0], title: L('svp')[1], num: true, key: true, html: function (r) { return r.s.sa ? pct(r.s.sv / r.s.sa) : '-'; }, foot: function (rs) { var a = sum(rs, function (r) { return r.s.sa; }); return a ? pct(sum(rs, function (r) { return r.s.sv; }) / a) : '-'; } }
      ], grows, t('all'));
    }
    return out ? '<section class="sec"><div class="sec-h"><h2>' + t('byTeam') + '</h2></div>' + out + '</section>' : '';
  }

  function viewPlayer(r) {
    var pp = people[r.id]; if (!pp) return viewNotFound();
    var sk = pp.skater, gl = pp.goalie;
    var abb0 = pp.main || pp.teams[0];
    var no = jerseyOf(pp.id);
    var teamLinks = '<div class="pteams">' + pp.teams.map(function (a) {
      var tm = TA[a]; return tm ? '<a href="#team-' + tm.id + '"' + (a === pp.main && pp.teams.length > 1 ? ' class="is-main" title="' + esc(t('mainTag')) + '"' : '') + '>' + crest(a, 'sm') + esc(tm.name) + '</a>' : '';
    }).join('') + '</div>';
    var metaBits = [];
    if (pp.rank) metaBits.push('<span>' + t('rating') + ': ' + esc(pp.rank) + '</span>');
    if (sk) {
      var rp = rankMap(skaters, function (p) { return p.p; }, 'desc'), rg = rankMap(skaters, function (p) { return p.g; }, 'desc'), ra = rankMap(skaters, function (p) { return p.a; }, 'desc');
      metaBits.push('<span>' + L('pts')[1] + ': ' + ord(rp[sk.id]) + '</span>', '<span>' + L('g')[1] + ': ' + ord(rg[sk.id]) + '</span>', '<span>' + L('a')[1] + ': ' + ord(ra[sk.id]) + '</span>');
    }
    var ro = '';
    if (sk) {
      ro += (gl ? '<p class="ro-title">' + t('skaterStats') + '</p>' : '') + readout([
        [L('gp')[0], sk.gp, L('gp')[1]], [L('g')[0], sk.g, L('g')[1]], [L('a')[0], sk.a, L('a')[1]], [L('pts')[0], sk.p, L('pts')[1]],
        [L('pgp')[0], sk.gp ? f2(sk.p / sk.gp) : '0.00', L('pgp')[1]], [L('pim')[0], mins(sk.pim), L('pim')[1]]
      ]);
    }
    if (gl) {
      ro += (sk ? '<p class="ro-title">' + t('goalieStats') + '</p>' : '') + readout([
        [L('gp')[0], gl.gp, L('gp')[1]], [L('w')[0], gl.w, L('w')[1]], [L('l')[0], gl.l, L('l')[1]], [L('svp')[0], pct(gl.pct), L('svp')[1]], [L('gaa')[0], f2(gl.gaa), L('gaa')[1]], [L('so')[0], gl.so, L('so')[1]]
      ]);
    }
    var head = '<div class="hero" style="--tc:' + colorOf(abb0) + '">' + jersey(abb0, no, 'jersey-xl') + '<div><h1>' + esc(pp.name) + '</h1>' + teamLinks + '<p class="meta">' + metaBits.join('') + '</p></div>' + ro + '</div>';

    var body = '';
    var multi = pp.teams.length > 1;
    var inScope = function (x) { return !multi || SCOPE === 'all' || abbOfTeam(x.team) === pp.main; };
    var ls = (logS[pp.id] || []).filter(inScope), lg = (logG[pp.id] || []).filter(inScope);
    var showTeam = multi && SCOPE === 'all';
    if (multi) body += byTeamHtml(pp);
    if (ls.length) {
      body += '<section class="sec"><div class="sec-h"><h2>' + t('gameLog') + '</h2></div>' + skaterLogTable(ls, showTeam) + sparkHtml(ls) + '</section>';
      if (sk && ls.length !== sk.gp) body += '<p class="note">' + t('logGap', { n: ls.length, gp: sk.gp }) + '</p>';
    }
    if (lg.length) {
      body += '<section class="sec"><div class="sec-h"><h2>' + t('gameLog') + (ls.length ? ' · ' + t('goalie') : '') + '</h2></div>' + goalieLogTable(lg, showTeam) + '</section>';
    }
    if (!ls.length && !lg.length) body += '<section class="sec"><p class="empty">' + t('noLog') + '</p></section>';
    return head + (multi ? scopeBar() : '') + body;
  }

  /* ---- game page ---- */
  function timelineHtml(g, b) {
    var nP = periodCount(b), W = 720, pad = 18, per = 720;
    var scale = (W - 2 * pad) / (nP * per), axis = 74, H = 150;
    var X = function (s) { return pad + s * scale; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('timeline')) + '">';
    for (var k = 0; k <= nP; k++) svg += '<line class="pb" x1="' + X(k * per) + '" y1="22" x2="' + X(k * per) + '" y2="' + (H - 22) + '"/>';
    svg += '<line class="axis" x1="' + X(0) + '" y1="' + axis + '" x2="' + X(nP * per) + '" y2="' + axis + '"/>';
    for (var i = 0; i < nP; i++) svg += '<text x="' + X(i * per + per / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + perLabel(i) + '</text>';
    var awayAbb = abbOfTeam(g.away), homeAbb = abbOfTeam(g.home), last = [-99, -99], level = [0, 0], tally = [0, 0];
    var nameOf = function (id) { return (people[id] || {}).name || BOX.names[id] || ''; };
    b.goals.slice().sort(function (x, y) { return ((x[0] - 1) * per + per - clockSec(x[1])) - ((y[0] - 1) * per + per - clockSec(y[1])); }).forEach(function (go) {
      var side = go[2] === awayAbb ? 0 : 1;
      var x = X((go[0] - 1) * per + per - Math.min(per, clockSec(go[1])));
      level[side] = (x - last[side] < 17) ? Math.min(2, level[side] + 1) : 0;
      last[side] = x;
      tally[side]++;
      var y = side === 0 ? axis - 20 - level[side] * 17 : axis + 20 + level[side] * 17;
      var who = go[3] ? nameOf(go[3]) : t('teamGoal');
      var assists = (go[4] || []).map(nameOf).filter(Boolean).join(', ');
      /* The tooltip is built from these data attributes (see showTip). */
      var tipAttrs = ' data-tip-time="' + esc(go[1] + ' · ' + perLabel(go[0] - 1)) + '" data-tip-who="' + esc(who) + '" data-tip-ast="' + esc(assists) + '"' +
        ' data-tip-team="' + esc(go[2]) + '" data-tip-score="' + esc(awayAbb + ' ' + tally[0] + ' - ' + tally[1] + ' ' + homeAbb) + '"';
      var inner = '<line class="stem" x1="' + x + '" y1="' + axis + '" x2="' + x + '" y2="' + y + '"/><circle class="dot" cx="' + x + '" cy="' + y + '" r="7.5"/><circle class="hit" cx="' + x + '" cy="' + y + '" r="13"/>';
      var wrap = '<g class="goal" style="--tc:' + colorOf(go[2]) + '"' + tipAttrs + '>' + inner + '</g>';
      svg += (go[3] && people[go[3]]) ? '<a href="#player-' + go[3] + '" aria-label="' + esc(go[1] + ' ' + go[2] + ' ' + who) + '">' + wrap + '</a>' : wrap;
    });
    svg += '</svg>';
    var lg = function (id) { var tm = T[id]; return '<span class="tcell">' + crest(tm.abb, 'sm') + esc(tm.name) + '</span>'; };
    return '<div class="timeline">' + svg + '<div class="legend">' + lg(g.away) + lg(g.home) + '</div></div>';
  }
  function goalsHtml(g, b) {
    var out = '', cur = 0;
    b.goals.forEach(function (go) {
      if (go[0] !== cur) { cur = go[0]; out += '<h3>' + perLabel(cur - 1) + '</h3>'; }
      var ast = go[4].length ? '<span class="assist">' + t('assists') + ' : ' + go[4].map(function (id) { return pLink(id, '', ''); }).join(', ') + '</span>' : '';
      var scorer = go[3] ? pLink(go[3], '', 'scorer') : '<span class="scorer team-only">' + t('teamGoal') + '</span>';
      out += '<div class="gl" style="--tc:' + colorOf(go[2]) + '"><time>' + esc(go[1]) + '</time><span class="tab"></span><div>' + scorer + ' ' + abbLinks([go[2]]) + ast + '</div></div>';
    });
    return '<div class="goals">' + out + '</div>';
  }
  function pensHtml(b) {
    if (!b.pens.length) return '<p class="empty">' + t('noPens') + '</p>';
    var out = '', cur = 0;
    b.pens.forEach(function (p) {
      if (p[0] !== cur) { cur = p[0]; out += '<h3>' + perLabel(cur - 1) + '</h3>'; }
      var who = p[3] ? pLink(p[3], '', 'strong') : '<span class="team-only">' + t('teamGoal').replace(/ \(.*\)/, '') + '</span>';
      out += '<div class="pen"><time>' + esc(p[1]) + '</time><span>' + who + ' <span class="abbs" style="display:inline-flex">' + abbLinks([p[2]]) + '</span></span><span>' + esc(p[4] === 'mineure' ? t('minor') : p[4]) + '</span></div>';
    });
    return '<div class="goals">' + out + '</div>';
  }
  function boxTeamHtml(g, b, teamId) {
    var i = boxIndex(b, teamId), bt = b.t[i], tm = T[teamId];
    var sk = bt.sk.slice().sort(function (x, y) { return (y[2] + y[3]) - (x[2] + x[3]) || y[2] - x[2]; });
    var cols = [
      { label: '#', title: '#', html: function (r) { return '<span class="jn">' + esc(r[1]) + '</span>'; } },
      { label: t('player'), title: t('player'), html: function (r) { return pLink(r[0], BOX.names[r[0]]); }, foot: function () { return esc(t('total')); } },
      { label: L('g')[0], title: L('g')[1], num: true, key: true, html: function (r) { return r[2]; }, foot: function (rows) { return sum(rows, function (r) { return r[2]; }); } },
      { label: L('a')[0], title: L('a')[1], num: true, key: true, html: function (r) { return r[3]; }, foot: function (rows) { return sum(rows, function (r) { return r[3]; }); } },
      { label: L('pts')[0], title: L('pts')[1], num: true, key: true, html: function (r) { return r[2] + r[3]; }, foot: function (rows) { return sum(rows, function (r) { return r[2] + r[3]; }); } },
      { label: L('pim')[0], title: L('pim')[1], num: true, html: function (r) { return r[4]; }, foot: function (rows) { return sum(rows, function (r) { return r[4]; }); } }
    ];
    var gcols = [
      { label: t('goalie'), title: t('goalie'), html: function (r) { return pLink(r[0], BOX.names[r[0]]); } },
      { label: L('sa')[0], title: L('sa')[1], num: true, html: function (r) { return r[4]; } },
      { label: L('sv')[0], title: L('sv')[1], num: true, html: function (r) { return r[5]; } },
      { label: L('ga')[0], title: L('ga')[1], num: true, html: function (r) { return r[6]; } },
      { label: L('svp')[0], title: L('svp')[1], num: true, key: true, html: function (r) { return r[4] ? pct(r[5] / r[4]) : '-'; } }
    ];
    return '<section><div class="box-h" style="--tc:' + colorOf(tm.abb) + '">' + crest(tm.abb, 'sm') + '<a href="#team-' + tm.id + '">' + esc(tm.name) + '</a></div>' +
      simpleTable(cols, sk, t('total')) +
      (bt.gk.length ? '<div class="box-sub">' + simpleTable(gcols, bt.gk) + '</div>' : '<p class="note box-sub">' + t('noGoalie') + '</p>') + '</section>';
  }

  function viewGame(r) {
    var g = gameById[r.id]; if (!g) return viewNotFound();
    g = eff(g);
    var pl = played(g), b = boxOf(g.id), lv = g._live ? liveOf(g.id) : null;
    var hasBox = !!(pl && b);
    var np = hasBox ? periodCount(b) : 0, cls = np ? '' : ' nop';
    var head = np ? '<div class="gb-head' + cls + '" style="--np:' + np + '"><span></span><span></span>' +
      Array.apply(null, Array(np)).map(function (_, i) { return '<span>' + perLabel(i) + '</span>'; }).join('') + '<span></span></div>' : '';
    var row = function (id, sc, other, role) {
      var tm = T[id] || { abb: '?', name: '?', id: '' };
      var win = pl && !lv && sc > other, idx = hasBox ? boxIndex(b, id) : -1;
      var pers = np ? Array.apply(null, Array(np)).map(function (_, i) { return '<span class="gb-per">' + (idx >= 0 && b.pg[idx][i] != null ? b.pg[idx][i] : '') + '</span>'; }).join('') : '';
      return '<div class="gb-row' + (win ? ' win' : '') + cls + '" style="--tc:' + colorOf(tm.abb) + ';--np:' + np + '"><span class="tab"></span>' +
        '<div class="gb-team">' + crest(tm.abb, 'lg') + '<div class="nm"><a href="#team-' + tm.id + '">' + esc(tm.name) + '</a><span>' + role + '</span></div></div>' + pers +
        (pl ? led(sc, win ? 'glow' : 'dim') : '<span></span>') + '</div>';
    };
    var status = g.cancelled ? t('cancelled') : (lv ? liveBadge(lv) : pl ? t('final') : t('upcoming'));
    var shots = lv ? '<div class="gb-shots"><span>' + t('shotsLive') + '</span><span>' + esc(abbOfTeam(g.away)) + '<b>' + lv.sv + '</b></span><span>' + esc(abbOfTeam(g.home)) + '<b>' + lv.sh + '</b></span></div>' : hasBox && b.sh.length === 2 ? '<div class="gb-shots"><span>' + t('shots') + '</span>' +
      b.t.map(function (bt, i) { return '<span>' + esc(abbOfTeam(bt.id)) + '<b>' + b.sh[i] + '</b></span>'; }).join('') + '</div>' : '';
    var board = '<section class="gboard"><div class="gboard-meta"><span><b>' + esc(fmtDay(g.date)) + '</b> · ' + esc(g.time) + '</span><span>' + esc(venueLine(g)) + ' · ' + status + '</span></div>' +
      head + row(g.away, g.as, g.hs, t('away')) + row(g.home, g.hs, g.as, t('home')) + shots + '</section>';

    var out = '<p class="note" style="margin:0 0 14px"><a class="more" href="#schedule">' + t('schedule') + '</a></p>' + board + (lv ? liveOnIce(g, lv) : '');
    if (!hasBox) {
      out += '<p class="note">' + (lv ? t('detailsSoon') : pl ? t('noBox') : '') + '</p>';
      return out;
    }
    var unscored = b.goals.filter(function (x) { return !x[3]; }).length;
    out += '<section class="sec"><div class="sec-h"><h2>' + t('timeline') + '</h2></div>' + timelineHtml(g, b) + '</section>' +
      '<div class="two"><div><section class="sec" style="margin-top:0"><div class="sec-h"><h2>' + t('scoring') + '</h2></div>' + goalsHtml(g, b) +
      (unscored ? '<p class="note">' + t('unscored', { n: unscored, total: b.goals.length }) + '</p>' : '') + '</section></div>' +
      '<div><section class="sec" style="margin-top:0"><div class="sec-h"><h2>' + t('penalties') + '</h2></div>' + pensHtml(b) + '</section>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('boxScore') + '</h2></div>' +
      '<div class="boxes">' + boxTeamHtml(g, b, g.away) + boxTeamHtml(g, b, g.home) + '</div></section></div></div>';
    return out;
  }

  /* ---- live: penalty box and goalies for one game ---- */
  function liveOnIce(g, lv) {
    var side = function (id, pens, goalie) {
      var tm = T[id] || { abb: '?', name: '?' };
      var jerseys = pens.length ? pens.map(function (p) { return '<span class="pbx">' + jersey(tm.abb, p.no, 'sm') + '<b>' + esc(p.left) + '</b></span>'; }).join('') : '<span class="pbx-none">-</span>';
      return '<div class="oi" style="--tc:' + colorOf(tm.abb) + '"><div class="oi-h">' + crest(tm.abb, 'sm') + '<a href="#team-' + tm.id + '">' + esc(tm.name) + '</a></div>' +
        '<div class="oi-r"><span>' + t('goalieOn') + '</span><b>' + (goalie ? esc(goalie) : '-') + '</b></div>' +
        '<div class="oi-r"><span>' + t('inBox') + '</span><div class="pbxs">' + jerseys + '</div></div></div>';
    };
    return '<section class="onice">' + side(g.away, lv.penV, lv.goalieV) + side(g.home, lv.penH, lv.goalieH) + '</section>';
  }
  function recentGoalsHtml(g) {
    var b = boxOf(g.id); if (!b || !b.goals.length) return '';
    var items = b.goals.slice(-3).reverse().map(function (x) {
      var tm = TA[x[2]];
      return '<li style="--tc:' + colorOf(x[2]) + '"><span class="gt">' + esc(perLabel((x[0] || 1) - 1)) + ' ' + esc(x[1]) + '</span><b>' + (tm ? esc(tm.abb) : esc(x[2])) + '</b> ' +
        (x[3] ? pLink(x[3], '', 'strong') : '<span>' + t('teamGoal') + '</span>') +
        (x[4].length ? '<small>' + x[4].map(function (id) { return pLink(id, '', ''); }).join(', ') + '</small>' : '') + '</li>';
    }).join('');
    return '<div class="rg"><h4>' + t('recentGoals') + '</h4><ul>' + items + '</ul></div>';
  }
  function liveCard(g0) {
    var g = eff(g0), lv = g._live ? liveOf(g.id) : null, x = LIVE.games[g.id];
    var pl = played(g), over = pl && !lv;
    var state = lv ? liveBadge(lv) : over ? '<span class="fin">' + t('final') + '</span>' : g.cancelled ? '<span class="cxl">' + t('cancelled') + '</span>' : '<span class="pre">' + t('pregame', { t: esc(g.time) }) + '</span>';
    var row = function (id, sc, other, shots) {
      var tm = T[id] || { abb: '?', name: '?', id: '' };
      var lose = over && sc < other;
      return '<div class="lv-row' + (lose ? ' lose' : '') + '" style="--tc:' + colorOf(tm.abb) + '"><span class="tab"></span><a class="sbc-team" href="#team-' + tm.id + '"><b>' + esc(tm.abb) + '</b><span>' + esc(tm.name) + (shots != null ? ' · ' + shots + ' ' + t('shots').toLowerCase() : '') + '</span></a><span></span>' +
        (pl ? led(sc, lose ? 'dim' : 'glow') : '<span></span>') + '</div>';
    };
    var clock = lv ? '<div class="lv-clock"><small>' + t('clockLabel') + '</small>' + led(lv.clock, 'glow', 26) + '<span>' + esc(clockLabel(lv).split(' ')[0]) + '</span></div>' : '';
    return '<article class="lv' + (lv ? ' is-live' : '') + '"><div class="lv-top"><span>' + state + '</span><span class="lv-venue">' + esc(g.time) + ' · ' + esc(venueLine(g)) + '</span></div>' + clock +
      row(g.away, g.as, g.hs, lv ? lv.sv : null) + row(g.home, g.hs, g.as, lv ? lv.sh : null) +
      (lv ? liveOnIce(g, lv) : '') + recentGoalsHtml(g) +
      '<div class="lv-foot"><a class="more" href="#game-' + esc(g.id) + '">' + t('openGame') + '</a></div></article>';
  }
  function viewLive() {
    var today = todayStr();
    var list = games.filter(function (g) { return g.date === today; });
    var intro = '<h1 class="ph">' + t('live') + '</h1><p class="lede">' + t('liveLede') + '</p>';
    if (!list.length) {
      var nx = upcomingGames[0];
      return intro + '<p class="empty">' + t('noGameToday', { d: nx ? esc(fmtDay(nx.date)) : '-' }) + '</p>' +
        (nx ? '<div class="sec"><div class="gms">' + games.filter(function (g) { return g.date === nx.date; }).map(function (g) { return gameBlock(g); }).join('') + '</div></div>' : '');
    }
    return intro + '<h3 class="day">' + esc(fmtDay(today)) + '<small>' + plural(list.length, 'game', 'games') + '</small></h3><div class="lvs">' + list.map(liveCard).join('') + '</div>';
  }

  function viewNotFound() {
    return '<h1 class="ph">' + t('notFound') + '</h1><p class="lede">' + t('notFoundText') + '</p><p class="note"><a class="more" href="#home">' + t('backHome') + '</a></p>';
  }

  /* ================= chrome ================= */
  /* League picker: a native select fixed in the bottom right corner. The first option is the LDHML home page. */
  function renderPicker() {
    var el = $('#picker');
    if (!el) return;
    var reg = D.registry || [];
    el.innerHTML = '<button type="button" class="lgbtn" data-lang="' + (lang === 'fr' ? 'en' : 'fr') + '" aria-label="' + (lang === 'fr' ? 'Switch to English' : 'Passer au français') + '">' + (lang === 'fr' ? 'English' : 'Français') + '</button>' + '<button type="button" class="thm" data-theme-toggle aria-pressed="' + THEME_ON + '" title="' + esc(THEME_ON ? t('themeTipOff') : t('themeTipOn')) + '"><i aria-hidden="true"></i>' + t('themeLabel') + '</button>' +
      '<label><span class="sr">' + t('pickLabel') + '</span><select id="lgsel" aria-label="' + t('pickLabel') + '">' +
      '<option value="">' + t('allLeagues') + '</option>' +
      reg.map(function (l) { return '<option value="' + esc(l.slug) + '"' + (l.slug === LG.slug ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label>';
    $('#lgsel').addEventListener('change', function (e) { location.href = (D.base || './') + e.target.value + (e.target.value ? '/' : ''); });
  }
  var NAV = [['live', 'live'], ['standings', 'standings'], ['teams', 'teams'], ['schedule', 'schedule'], ['players', 'players'], ['goalies', 'goalies'], ['leaders', 'leaders']];
  var TAB_ICONS = {
    live: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M8.1 15.9a5.5 5.5 0 0 1 0-7.8M15.9 8.1a5.5 5.5 0 0 1 0 7.8"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
    standings: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    teams: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
    schedule: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    players: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>',
    goalies: '<path d="M5 20V8a7 7 0 0 1 14 0v12M5 13h14M9 8v5M15 8v5"/>',
    leaders: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/>',
    more: '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>'
  };
  var TAB_MAIN = ['live', 'standings', 'teams', 'schedule', 'leaders'], TAB_MORE = ['players', 'goalies'];
  function tabIcon(k) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_ICONS[k] + '</svg>'; }
  function renderTabbar() {
    var bar = $('#tabbar'), more = $('#more');
    if (!bar) return;
    bar.innerHTML = TAB_MAIN.map(function (k) {
      return '<a href="#' + k + '" data-nav="' + k + '">' + tabIcon(k) + '<span>' + t(k) + '</span>' + (k === 'live' && liveList().length ? '<i class="navdot" aria-hidden="true"></i>' : '') + '</a>';
    }).join('') + '<button type="button" data-more aria-expanded="false" aria-controls="more">' + tabIcon('more') + '<span>' + t('more') + '</span></button>';
    more.innerHTML = TAB_MORE.map(function (k) { return '<a href="#' + k + '" data-nav="' + k + '">' + tabIcon(k) + '<span>' + t(k) + '</span></a>'; }).join('');
    more.hidden = true;
  }
  function setMore(open) {
    var more = $('#more'), btn = document.querySelector('[data-more]');
    if (!more || !btn) return;
    more.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderChrome() {
    $('#top').innerHTML = '<div class="wrap top-in"><a class="brand" href="#home">' + (LG.logo ? '<img class="mk-logo" src="' + LG.logo + '" alt="" width="52" height="44">' : BALL) + '<span><b>LDHML <i>' + esc(LG.short) + '</i></b><small>' + esc(season()) + '</small></span></a>' +
      '<nav class="nav" aria-label="Main">' + NAV.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + t(n[1]) + (n[0] === 'live' && liveList().length ? '<i class="navdot" aria-hidden="true"></i>' : '') + '</a>'; }).join('') + '</nav>' +
      '<div class="tools"><div class="gs" role="search">' + ICON_SEARCH + '<input id="gs" type="search" placeholder="' + t('searchPh') + '" aria-label="' + t('search') + '" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gs-res"><div class="gs-res" id="gs-res" role="listbox" hidden></div></div>' +
      '</div></div>';
    renderTabbar();
    $('#foot').innerHTML = '<p id="fresh" class="fresh" hidden></p><p>' + t('footSource') + '</p><p><a href="' + (D.base || './') + '">' + t('footHub') + '</a></p>';
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-league', THEME_ON ? LG.theme : 'default');
    renderPicker();
    updateFresh();
  }

  var VIEWS = { home: viewHome, standings: viewStandings, schedule: viewSchedule, players: viewPlayers, goalies: viewGoalies, leaders: viewLeaders, live: viewLive, teams: viewTeams, team: viewTeam, player: viewPlayer, game: viewGame };
  function parseRoute() {
    var h = String(location.hash || '').replace(/^#/, '');
    var m = h.match(/^(team|player|game)-(\d+)$/);
    if (m) return { name: m[1], id: m[2] };
    if (['standings', 'schedule', 'players', 'goalies', 'leaders', 'live', 'teams'].indexOf(h) >= 0) return { name: h };
    return { name: 'home' };
  }
  function render(keepScroll) {
    var r = parseRoute();
    var out = VIEWS[r.name](r);
    var band = '';
    if (out && typeof out === 'object') { band = out.band; out = out.html; }
    $('#band').innerHTML = band;
    $('#main').innerHTML = out;
    var navKey = r.name === 'team' ? 'teams' : r.name === 'player' ? 'players' : r.name === 'game' ? 'schedule' : r.name;
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var mb = document.querySelector('[data-more]');
    if (mb) { if (TAB_MORE.indexOf(navKey) >= 0) mb.setAttribute('aria-current', 'page'); else mb.removeAttribute('aria-current'); }
    setMore(false);
    var title = LG.name;
    if (r.name === 'team' && T[r.id]) title = T[r.id].name + ' | ' + LG.name;
    if (r.name === 'player' && people[r.id]) title = people[r.id].name + ' | ' + LG.name;
    if (r.name === 'game' && gameById[r.id]) { var gg = gameById[r.id]; title = abbOfTeam(gg.away) + (played(gg) ? ' ' + gg.as + '-' + gg.hs + ' ' : ' @ ') + abbOfTeam(gg.home) + ' | ' + LG.name; }
    document.title = title;
    if (!keepScroll) window.scrollTo(0, 0);
  }

  /* ================= global search ================= */
  var searchIndex;
  function buildSearch() {
    searchIndex = teams.map(function (x) { return { type: 'team', id: x.id, label: x.name, sub: x.abb, abb: x.abb, n: norm(x.name + ' ' + x.abb) }; })
    .concat(Object.keys(people).map(function (k) { var p = people[k]; return { type: 'player', id: p.id, label: p.name, sub: p.teams.join(', '), abb: p.teams[0], n: norm(p.name) }; }));
  }
  buildSearch();
  var activeIdx = -1;
  function closeSearch() {
    var box = $('#gs-res'); if (box) { box.hidden = true; box.innerHTML = ''; }
    var inp = $('#gs'); if (inp) inp.setAttribute('aria-expanded', 'false');
    activeIdx = -1;
  }
  function runSearch(value) {
    var box = $('#gs-res'), inp = $('#gs');
    var words = norm(value).split(/\s+/).filter(Boolean);
    if (!words.length) { closeSearch(); return; }
    var hits = searchIndex.filter(function (x) { return words.every(function (w) { return x.n.indexOf(w) >= 0; }); });
    hits.sort(function (a, b) {
      var sa = a.n.indexOf(words[0]) === 0 ? 0 : 1, sb = b.n.indexOf(words[0]) === 0 ? 0 : 1;
      return (a.type === b.type ? 0 : a.type === 'team' ? -1 : 1) || (sa - sb) || a.label.localeCompare(b.label);
    });
    hits = hits.slice(0, 8);
    box.innerHTML = hits.length ? hits.map(function (x, i) {
      return '<a class="gs-item" role="option" id="gs-o' + i + '" aria-selected="false" href="#' + x.type + '-' + x.id + '">' + crest(x.abb, 'sm') + '<span>' + esc(x.label) + '</span><span class="sub">' + esc(x.sub) + '</span></a>';
    }).join('') : '<p class="gs-none">' + t('noMatch') + '</p>';
    box.hidden = false; inp.setAttribute('aria-expanded', 'true'); activeIdx = -1;
  }
  function moveActive(d) {
    var items = document.querySelectorAll('.gs-item'); if (!items.length) return;
    activeIdx = (activeIdx + d + items.length) % items.length;
    Array.prototype.forEach.call(items, function (el, i) { el.setAttribute('aria-selected', String(i === activeIdx)); });
    $('#gs').setAttribute('aria-activedescendant', items[activeIdx].id);
  }

  /* ================= goal tooltip (box score timeline) ================= */
  var tipEl = null;
  function showTip(g) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    var a = function (k) { return g.getAttribute('data-tip-' + k) || ''; };
    tipEl.style.setProperty('--tc', colorOf(a('team')).split(';')[0]);
    tipEl.innerHTML = '<span class="tip-time">' + esc(a('time')) + '</span><b>' + esc(a('who')) + '</b>' +
      '<span class="tip-team"><i></i>' + esc(a('team')) + '</span>' +
      (a('ast') ? '<span class="tip-ast">' + t('assistsLabel') + ' ' + esc(a('ast')) + '</span>' : '') +
      '<span class="tip-score">' + esc(a('score')) + '</span>';
    tipEl.hidden = false;
    var r = g.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var top = r.top - th - 10;
    if (top < 8) top = r.bottom + 10;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  var tipTarget = function (e) { return e.target && e.target.closest ? e.target.closest('.timeline g.goal') : null; };
  document.addEventListener('mouseover', function (e) { var g = tipTarget(e); if (g) showTip(g); });
  document.addEventListener('mouseout', function (e) { if (tipTarget(e)) hideTip(); });
  document.addEventListener('focusin', function (e) { var g = tipTarget(e) || (e.target.querySelector && e.target.querySelector('g.goal')); if (g) showTip(g); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('hashchange', hideTip);
  window.addEventListener('scroll', hideTip, true);

  /* ================= events ================= */
  function setPath(p, v) { var a = p.split('.'); ui[a[0]][a[1]] = v; }
  document.addEventListener('click', function (e) {
    var mt = e.target.closest ? e.target.closest('[data-more]') : null;
    if (mt) { setMore(mt.getAttribute('aria-expanded') !== 'true'); return; }
    if (!e.target.closest || !e.target.closest('#more')) setMore(false);
    var el = e.target.closest ? e.target.closest('[data-set],[data-sort],[data-lang],[data-scope],[data-theme-toggle]') : null;
    if (el) {
      if (el.hasAttribute('data-theme-toggle')) {
        THEME_ON = !THEME_ON;
        try { localStorage.setItem('ldhml-theme', THEME_ON ? 'on' : 'off'); } catch (err) { /* ignore */ }
        document.documentElement.setAttribute('data-league', THEME_ON ? LG.theme : 'default');
        renderPicker();
      } else if (el.hasAttribute('data-set')) { var kv = el.getAttribute('data-set').split('='); setPath(kv[0], kv[1]); render(true); }
      else if (el.hasAttribute('data-scope')) {
        SCOPE = el.getAttribute('data-scope');
        try { localStorage.setItem('ldhml-scope', SCOPE); } catch (err) { /* ignore */ }
        buildModel(); buildSearch(); render(true);
      } else if (el.hasAttribute('data-sort')) {
        var p = el.getAttribute('data-sort').split('|'), cur = ui.sort[p[0]];
        ui.sort[p[0]] = (cur && cur.k === p[1]) ? { k: p[1], dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { k: p[1], dir: p[2] };
        render(true);
      } else if (el.hasAttribute('data-lang')) {
        lang = el.getAttribute('data-lang');
        try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ }
        renderChrome(); render(true);
      }
      return;
    }
    if (!e.target.closest || !e.target.closest('.gs')) closeSearch();
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'gs') { runSearch(el.value); return; }
    if (el.getAttribute && el.getAttribute('data-bind')) {
      setPath(el.getAttribute('data-bind'), el.value);
      var id = el.id, pos = el.selectionStart;
      render(true);
      var n = document.getElementById(id);
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName === 'SELECT' && el.getAttribute('data-bind')) { setPath(el.getAttribute('data-bind'), el.value); render(true); var n = document.getElementById(el.id); if (n) n.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'gs') {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter') { var items = document.querySelectorAll('.gs-item'); var pick = items[activeIdx >= 0 ? activeIdx : 0]; if (pick) { e.preventDefault(); location.hash = pick.getAttribute('href'); } }
      else if (e.key === 'Escape') { e.target.value = ''; closeSearch(); }
    }
    if (e.key === 'Escape') setMore(false);
  });
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  window.addEventListener('hashchange', function () {
    var inp = $('#gs'); if (inp) inp.value = '';
    closeSearch(); render(false);
  });

  renderChrome();
  render(true);
