/* Parsers for the NBHPA pages.
 *
 * The same file runs in two places, so the saved snapshot and the live data are always read the same way:
 *   - in Node (scraper/fetch.mjs), with a DOMParser from jsdom
 *   - in the browser (inlined in the site by build.mjs), with the native DOMParser
 * It only needs a global DOMParser. It exposes window.LDParsers (or globalThis.LDParsers).
 */
(function (root) {
  'use strict';

  var num = function (v) { return (v === null || v === undefined || v === '' ? 0 : Number(v)); };
  var clean = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var parseHtml = function (html) { return new DOMParser().parseFromString(html, 'text/html'); };
  var all = function (el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); };

  /* ---------- standings: JSON from /table_data.php ---------- */
  function parseStandings(json) {
    var rows = Object.keys(json).map(function (k) { return json[k]; }).filter(function (v) { return v && Array.isArray(v.values); });
    return rows.map(function (r) {
      var o = {};
      r.values.forEach(function (v) { o[v.key] = v.val; });
      return {
        id: String(o.team_id), name: o.team_name, abb: o.team_abb, logo: o.team_pic,
        pos: num(o.position), gp: num(o.gp), w: num(o.wins_tot), l: num(o.losses), t: num(o.ot),
        otl: num(o.ot_loss), pts: num(o.pts), gf: num(o.gf), ga: num(o.ga), diff: num(o.diff), ppg: Number(o.pts_gp)
      };
    });
  }

  /* ---------- skater and goalie stats: JSON embedded in the page ---------- */
  function embeddedStats(html) {
    var m = html.match(/var stats_player = (\[[\s\S]*?\]);\s*\n/);
    if (!m) throw new Error('stats_player block not found');
    return JSON.parse(m[1]);
  }
  function person(p) {
    return {
      id: p.player_id, nid: p.nbhpa_player_id, name: String(p.full_name).replace(/\s+/g, ' ').trim(),
      sex: p.sex, rank: p.ranking, teams: String(p.teams == null ? '' : p.teams).split(',').filter(Boolean)
    };
  }
  function parsePlayers(html) {
    return embeddedStats(html).map(function (p) {
      var o = person(p);
      o.gp = num(p.mj); o.g = num(p.g); o.a = num(p.a); o.p = num(p.p); o.pim = num(p.pen);
      o.ppg = num(p.ban); o.ppp = num(p.pan); o.shg = num(p.bin); o.shp = num(p.pin); o.gwg = num(p.bg); o.otg = num(p.bp);
      return o;
    });
  }
  function parseGoalies(html) {
    return embeddedStats(html).map(function (p) {
      var o = person(p);
      o.gp = num(p.mj); o.w = num(p.w); o.l = num(p.l); o.t = num(p.t); o.sa = num(p.sa); o.sv = num(p.sv);
      o.ga = num(p.ga); o.pct = Number(p.pct); o.gaa = Number(p.gaa); o.gaat = Number(p.gaat); o.so = num(p.so);
      o.g = num(p.g); o.a = num(p.a); o.pts = num(p.pts); o.pim = num(p.pim); o.mp = num(p.mp);
      o.mpp = num(p.minutes_per_period); o.ppg_ = num(p.periods_per_game);
      return o;
    });
  }

  /* ---------- schedule: HTML rows from /sites/site_schedule_include.php ---------- */
  function parseSchedule(html, teams) {
    var doc = parseHtml(html);
    var abbToId = {};
    teams.forEach(function (t) { abbToId[t.abb] = t.id; });
    var games = [];
    all(doc, 'tr.schedule_container').forEach(function (tr) {
      var tds = Array.prototype.slice.call(tr.children).filter(function (c) { return c.tagName === 'TD'; });
      var ids = [];
      all(tds[0], 'a[href*="/equipes/"]').forEach(function (a) {
        var id = a.getAttribute('href').split('/').pop();
        if (ids.indexOf(id) < 0) ids.push(id);
      });
      var date = (clean(tds[1].textContent).match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
      var gd = tds[2].querySelector('.game_date'), gv = tds[2].querySelector('.game_venue');
      var time = gd ? clean(gd.textContent) : '';
      var venueRaw = gv ? clean(gv.textContent) : '';
      var court = (venueRaw.match(/\((\d)\)$/) || [])[1] || '';
      var link = tr.querySelector('a[href*="/sommaire/"]');
      var gid = link ? link.getAttribute('href').replace(/\/+$/, '').split('/').pop() : '';
      var as = null, hs = null;
      var scores = all(tds[2], '.score').map(function (s) { return clean(s.textContent.replace(/,/g, '')); });
      if (scores.length === 2) {
        scores.forEach(function (sc) {
          var m = sc.match(/^(\S+)\s+(\d+)$/);
          if (!m) return;
          var id = abbToId[m[1]];
          if (id === ids[0]) as = Number(m[2]);
          else if (id === ids[1]) hs = Number(m[2]);
        });
      }
      games.push({
        id: gid, date: date, time: time, venue: venueRaw.replace(/\(\d\)$/, '').trim(), court: court,
        away: ids[0], home: ids[1], as: as, hs: hs, cancelled: /cancelled/.test(tr.getAttribute('class') || '')
      });
    });
    return games;
  }

  /* ---------- game recap (box score): HTML from /sites/site_game_recap.php ----------
   * Compact output (data/box.json is inlined in the site):
   *   t[i].sk = [playerId, number, G, A, PIM(min), PPG, PPA, SHG, SHA, GWG, OTG]
   *   t[i].gk = [playerId, W, L, T, shotsAgainst, saves, goalsAgainst, SO, G, A, PIM(min)]
   *   sh = shots per team, pg = goals per period per team (same team order as t)
   *   goals = [period, "mm:ss", teamAbb, scorerId|null, [assistIds]]   (null scorer = team goal)
   *   pens  = [period, "mm:ss", teamAbb, playerId|null, kind]
   * A recap of a game that has not started has no team blocks: t is empty. */
  function parseRecap(html) {
    var doc = parseHtml(html);
    var names = {};
    var idOf = function (el, kind) {
      if (!el) return null;
      var m = (el.getAttribute('href') || '').match(new RegExp('/' + kind + '/(\\d+)'));
      return m && m[1] !== '0' ? m[1] : null;
    };
    var n = function (s) { var v = clean(s); if (v === '' || v === '-') return 0; var x = parseFloat(v); return isNaN(x) ? 0 : x; };
    var note = function (id, name) { if (id && name && !names[id]) names[id] = name; };
    var game = { t: [], sh: [], pg: [], goals: [], pens: [] };

    var heads = all(doc, 'h1.team_name');
    var tables = all(doc, 'table.stats_table');
    heads.forEach(function (hd, i) {
      var team = { id: idOf(hd.querySelector('a'), 'equipes'), sk: [], gk: [] };
      tables.slice(i * 2, i * 2 + 2).forEach(function (tb) {
        var hdr = all(tb, 'th').map(function (x) { return clean(x.textContent); });
        var isG = hdr[0] === 'Gardiens';
        all(tb, 'tbody.data_list tr').forEach(function (tr) {
          var tds = all(tr, 'td');
          if (!tds.length) return;
          var col = function (key) { var j = hdr.indexOf(key); return j < 0 || !tds[j] ? 0 : n(tds[j].textContent); };
          var id = idOf(tr.querySelector('a'), 'joueur');
          var noEl = tr.querySelector('.player_number'), nmEl = tr.querySelector('.player_name');
          note(id, clean(nmEl ? nmEl.textContent : ''));
          if (isG) team.gk.push([id, col('V'), col('D'), col('N/DP'), col('TC'), col('Arr'), col('BC'), col('BL'), col('B'), col('A'), col('PUN')]);
          else team.sk.push([id, clean(noEl ? noEl.textContent : ''), col('B'), col('A'), col('PUN'), col('BAN'), col('PAN'), col('BIN'), col('PIN'), col('BG'), col('BE')]);
        });
      });
      game.t.push(team);
    });

    var score = all(doc, 'table.toggle_score_table').map(function (t) {
      return all(t, 'tr').map(function (r) { return Array.prototype.slice.call(r.children).map(function (c) { return clean(c.textContent); }); });
    });
    if (score[0]) game.pg = score[0].slice(1).map(function (r) { return r.slice(1, -1).map(Number); });
    if (score[1]) game.sh = score[1].slice(1).map(function (r) { return Number(r[1]); });

    var period = 0;
    all(doc, '.goal_details, div.ultra_light_grey_background.text-muted').forEach(function (el) {
      if (el.closest('table')) return;
      if (!el.classList.contains('goal_details')) { period = parseInt(clean(el.textContent), 10) || period; return; }
      var tm = el.querySelector('.text-muted');
      var parts = clean(tm ? tm.textContent : '').split(' - ');
      var who = el.querySelector('h2.player_name a');
      var sid = idOf(who, 'joueur');
      note(sid, who ? clean(who.textContent) : '');
      var ast = all(el, '.assists a').map(function (a) { var id = idOf(a, 'joueur'); note(id, clean(a.textContent)); return id; }).filter(Boolean);
      game.goals.push([period, parts[0], parts[1], sid, ast]);
    });

    var pper = 0;
    all(doc, 'table.penalties_container tr').forEach(function (tr) {
      var tds = all(tr, 'td');
      if (tr.classList.contains('ultra_light_grey_background')) { pper = parseInt(clean(tds[0].textContent), 10) || pper; return; }
      var desc = tr.querySelector('.penalty_description');
      if (tds.length === 3 && desc) {
        var a = desc.querySelector('a');
        var id = idOf(a, 'joueur');
        var nm = a ? clean(a.textContent) : '';
        note(id, nm);
        game.pens.push([pper, clean(tds[0].textContent), clean(tds[1].textContent), id, clean(desc.textContent).replace(nm, '').trim()]);
      }
    });
    return { game: game, names: names };
  }

  /* ---------- live clock: JSON from /livegame_json/{gameId} ----------
   * status is "over" once the game is finished. Other values are treated as "in progress".
   * penalties_* list the players in the box with the time left. */
  function parseLive(json) {
    if (!json || typeof json !== 'object' || !('period_name' in json)) return null;
    var pen = function (list) { return (list || []).map(function (p) { return { no: String(p.player_number), left: String(p.penalty_time_remaining) }; }); };
    return {
      status: String(json.status || ''), over: String(json.status) === 'over',
      period: String(json.period_name || ''), clock: String(json.game_clock || ''),
      gv: num(json.goals_visitor), gh: num(json.goals_home), sv: num(json.shots_visitor), sh: num(json.shots_home),
      penV: pen(json.penalties_visitor), penH: pen(json.penalties_home),
      goalieV: String(json.goalie_name_visitor || '').replace(/^#\S*\s*-\s*/, ''), goalieH: String(json.goalie_name_home || '').replace(/^#\S*\s*-\s*/, '')
    };
  }

  root.LDParsers = { parseStandings: parseStandings, parsePlayers: parsePlayers, parseGoalies: parseGoalies, parseSchedule: parseSchedule, parseRecap: parseRecap, parseLive: parseLive };
})(typeof window !== 'undefined' ? window : globalThis);
