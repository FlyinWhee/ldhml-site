  var D = JSON.parse(document.getElementById('league-data').textContent);

  /* ================= helpers ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var LOGO_BASE = 'https://admin.nbhpa.com/';

  /* ================= language ================= */
  var STR = {
    en: {
      home: 'Home', standings: 'Standings', schedule: 'Schedule', players: 'Players', goalies: 'Goalies', leaders: 'Leaders',
      search: 'Search teams and players', noMatch: 'No team or player found', lang: 'FR',
      finals: '{n} final scores', progress: '{p} of {n} games played, {g} goals scored',
      nextNight: 'Next game night', fullStandings: 'Full standings', fullSchedule: 'Full schedule', allLeaders: 'All leaders',
      nextGames: 'Next games', game: 'game', games: 'games', rank: 'Rank', team: 'Team', player: 'Player', goalie: 'Goalie', teams: 'Teams',
      final: 'Final', cancelled: 'Cancelled', summary: 'Official summary',
      all: 'All', results: 'Results', upcoming: 'Upcoming', allTeams: 'All teams', women: 'Women', men: 'Men', allPlayers: 'All players',
      filterPlayers: 'Filter by name', nPlayers: '{n} players', nGoalies: '{n} goalies', nGames: '{n} games',
      standingsLede: 'Points are 2 for a win and 1 for a tie. Click a column to sort.',
      scheduleLede: 'Every game of the regular season, with scores as they come in.',
      playersLede: 'Skater stats combine all the teams a player has played for this season.',
      goaliesLede: 'Goalie stats for the season. Leaders need at least 2 games played.',
      leadersLede: 'Top 10 in each category. Per-game and goalie leaders need at least 2 games played.',
      skaters: 'Skaters', record: 'Record', pts: 'Points', gf: 'Goals for', ga: 'Goals against', diff: 'Goal difference', gfpg: 'Goals per game',
      leagueRank: 'League rank', last5: 'Last 5 games', scheduleResults: 'Schedule and results', officialTeam: 'Official team page',
      alsoPlayed: 'Also played for', rating: 'Rating', skaterStats: 'Skater stats', goalieStats: 'Goalie stats', combined: 'Stats combine every team this person played for this season.',
      notFound: 'Page not found', notFoundText: 'This page does not exist in the current snapshot.', backHome: 'Back to the home page',
      noGames: 'No games match these filters.', noPlayers: 'No players match these filters.', noData: 'No data yet.',
      footUpdated: 'Data updated: {t}', footSource: 'Unofficial preview. All numbers come from the public NBHPA league data.',
      chW: 'W', chL: 'L', chT: 'T', place: '{n}', wonOver: 'Won {a}-{b} against {o}', lostTo: 'Lost {a}-{b} to {o}', tiedWith: 'Tied {a}-{b} with {o}',
      streak: 'Streak', min2: 'min. 2 GP', ptsPerGame: 'Points per game', penMin: 'Penalty minutes', saves: 'Save %', gaaFull: 'Goals against average',
      wins: 'Wins', shutouts: 'Shutouts', points: 'Points', goals: 'Goals', assists: 'Assists',
      boxScore: 'Box score', total: 'Total', gameLog: 'Game log', date: 'Date', opp: 'Opponent', result: 'Result', scoring: 'Scoring',
      penalties: 'Penalties', noPens: 'No penalties', teamGoal: 'Team goal (scorer not recorded)', shots: 'Shots', noBox: 'The box score for this game is not available yet.',
      noGoalie: 'No goalie recorded', gameNight: 'Game night', seasonTotal: 'Season', timeline: 'Goal timeline',
      logGap: 'The game log lists {n} games. The league’s season totals count {gp}.', unscored: '{n} of {total} goals have no scorer in the league data.',
      officialPlayer: 'Official player page', minor: 'minor', court: 'Court', vs: 'vs', at: 'at', ot: 'OT', per: 'P{n}', saved: 'saves', noLog: 'No game log yet.',
      firstGame: 'Game', surface: 'Court {n}', fullBox: 'Full box score', away: 'Away', home: 'Home', hit: 'Hot streak', night: 'Night',
      live: 'Live', liveNow: 'LIVE', tonight: '{n} games tonight', liveLede: 'Scores, shots and penalties update by themselves while a game is on. You do not need to reload the page.',
      noGameToday: 'No game today. Next game night: {d}.', inBox: 'In the penalty box', goalieOn: 'Goalie', notStarted: 'Not started', pregame: 'Starts at {t}',
      recentGoals: 'Latest goals', detailsSoon: 'Goal and penalty details appear here when the league publishes them.', liveFinalWait: 'Final. The league is still updating the box score.',
      liveFresh: 'Live. Checked {a}.', liveChecking: 'Checking for live data…', liveOffline: 'Snapshot of {t}. Live data is not available here.', ago: '{n} s ago', agoMin: '{n} min ago', justNow: 'just now',
      scopeMain: 'Main team', scopeAll: 'All teams', scopeLabel: 'Stats shown',
      scopeNoteMain: 'Each player counts only what he did for his main team (the team he played most games for). Substitute games for other teams are left out.',
      scopeNoteAll: 'Each player counts every game he played in this league, for all teams, substitute games included. This matches the totals on the official site.',
      alsoShort: 'also', subs: 'Substitutes', subsNote: 'Players of other teams who filled in. Numbers are for games with this team only.', byTeam: 'By team', mainTag: 'Main team', teamCol: 'Team',
      teamsLede: 'All 10 teams in standings order. Open a team for its roster, substitutes and schedule.',
      shotsLive: 'Shots on goal', clockLabel: 'Clock', openGame: 'Open the game page'
    },
    fr: {
      home: 'Accueil', standings: 'Classement', schedule: 'Calendrier', players: 'Joueurs', goalies: 'Gardiens', leaders: 'Meneurs',
      search: 'Chercher une équipe ou un joueur', noMatch: 'Aucune équipe ni aucun joueur trouvé', lang: 'EN',
      finals: '{n} résultats finaux', progress: '{p} matchs joués sur {n}, {g} buts marqués',
      nextNight: 'Prochaine soirée', fullStandings: 'Classement complet', fullSchedule: 'Calendrier complet', allLeaders: 'Tous les meneurs',
      nextGames: 'Prochains matchs', game: 'match', games: 'matchs', rank: 'Rang', team: 'Équipe', player: 'Joueur', goalie: 'Gardien', teams: 'Équipes',
      final: 'Final', cancelled: 'Annulé', summary: 'Sommaire officiel',
      all: 'Tous', results: 'Résultats', upcoming: 'À venir', allTeams: 'Toutes les équipes', women: 'Femmes', men: 'Hommes', allPlayers: 'Tous les joueurs',
      filterPlayers: 'Filtrer par nom', nPlayers: '{n} joueurs', nGoalies: '{n} gardiens', nGames: '{n} matchs',
      standingsLede: 'Une victoire vaut 2 points et une nulle vaut 1 point. Cliquez sur une colonne pour trier.',
      scheduleLede: 'Tous les matchs de la saison régulière, avec les pointages au fur et à mesure.',
      playersLede: 'Les statistiques additionnent toutes les équipes pour lesquelles le joueur a joué cette saison.',
      goaliesLede: 'Statistiques des gardiens pour la saison. Les meneurs doivent avoir joué au moins 2 matchs.',
      leadersLede: 'Les 10 meilleurs de chaque catégorie. Les moyennes par match et les gardiens exigent au moins 2 matchs joués.',
      skaters: 'Joueurs', record: 'Fiche', pts: 'Points', gf: 'Buts pour', ga: 'Buts contre', diff: 'Différentiel', gfpg: 'Buts par match',
      leagueRank: 'Rang dans la ligue', last5: '5 derniers matchs', scheduleResults: 'Calendrier et résultats', officialTeam: 'Page officielle de l’équipe',
      alsoPlayed: 'A aussi joué pour', rating: 'Cote', skaterStats: 'Statistiques de joueur', goalieStats: 'Statistiques de gardien', combined: 'Les statistiques additionnent toutes les équipes pour lesquelles cette personne a joué cette saison.',
      notFound: 'Page introuvable', notFoundText: 'Cette page n’existe pas dans les données actuelles.', backHome: 'Retour à l’accueil',
      noGames: 'Aucun match ne correspond à ces filtres.', noPlayers: 'Aucun joueur ne correspond à ces filtres.', noData: 'Aucune donnée pour le moment.',
      footUpdated: 'Données mises à jour : {t}', footSource: 'Aperçu non officiel. Tous les chiffres viennent des données publiques de la ligue (NBHPA).',
      chW: 'V', chL: 'D', chT: 'N', place: '{n}', wonOver: 'Victoire {a}-{b} contre {o}', lostTo: 'Défaite {a}-{b} contre {o}', tiedWith: 'Nulle {a}-{b} avec {o}',
      streak: 'Séquence', min2: '2 MJ min.', ptsPerGame: 'Points par match', penMin: 'Minutes de pénalité', saves: '% d’arrêt', gaaFull: 'Moyenne de buts alloués',
      wins: 'Victoires', shutouts: 'Blanchissages', points: 'Points', goals: 'Buts', assists: 'Aides',
      boxScore: 'Feuille de match', total: 'Total', gameLog: 'Journal des matchs', date: 'Date', opp: 'Adversaire', result: 'Résultat', scoring: 'Pointage',
      penalties: 'Pénalités', noPens: 'Aucune pénalité', teamGoal: 'But d’équipe (marqueur non inscrit)', shots: 'Tirs', noBox: 'La feuille de match n’est pas encore disponible.',
      noGoalie: 'Aucun gardien inscrit', gameNight: 'Soirée de match', seasonTotal: 'Saison', timeline: 'Chronologie des buts',
      logGap: 'Le journal compte {n} matchs. Les totaux de saison de la ligue en comptent {gp}.', unscored: '{n} buts sur {total} n’ont pas de marqueur dans les données de la ligue.',
      officialPlayer: 'Page officielle du joueur', minor: 'mineure', court: 'Surface', vs: 'contre', at: 'à', ot: 'PROL', per: 'P{n}', saved: 'arrêts', noLog: 'Aucun match pour le moment.',
      firstGame: 'Match', surface: 'Surface {n}', fullBox: 'Feuille de match complète', away: 'Visiteur', home: 'Domicile', hit: 'En feu', night: 'Soirée',
      live: 'En direct', liveNow: 'EN DIRECT', tonight: '{n} matchs ce soir', liveLede: 'Les pointages, les tirs et les pénalités se mettent à jour tout seuls pendant un match. Pas besoin de recharger la page.',
      noGameToday: 'Aucun match aujourd’hui. Prochaine soirée : {d}.', inBox: 'Au banc des pénalités', goalieOn: 'Gardien', notStarted: 'Pas commencé', pregame: 'Début à {t}',
      recentGoals: 'Derniers buts', detailsSoon: 'Les détails des buts et des pénalités apparaissent ici dès que la ligue les publie.', liveFinalWait: 'Final. La ligue met encore la feuille de match à jour.',
      liveFresh: 'En direct. Vérifié {a}.', liveChecking: 'Recherche de données en direct…', liveOffline: 'Instantané du {t}. Les données en direct ne sont pas disponibles ici.', ago: 'il y a {n} s', agoMin: 'il y a {n} min', justNow: 'à l’instant',
      scopeMain: 'Équipe principale', scopeAll: 'Toutes les équipes', scopeLabel: 'Statistiques affichées',
      scopeNoteMain: 'Chaque joueur compte seulement ce qu’il a fait pour son équipe principale (celle pour qui il a joué le plus de matchs). Les matchs de remplacement pour d’autres équipes sont exclus.',
      scopeNoteAll: 'Chaque joueur compte tous ses matchs dans cette ligue, pour toutes les équipes, remplacements inclus. C’est ce que montre le site officiel.',
      alsoShort: 'aussi', subs: 'Remplaçants', subsNote: 'Joueurs d’autres équipes qui ont remplacé. Les chiffres comptent seulement les matchs avec cette équipe.', byTeam: 'Par équipe', mainTag: 'Équipe principale', teamCol: 'Équipe',
      teamsLede: 'Les 10 équipes selon le classement. Ouvrez une équipe pour voir sa formation, ses remplaçants et son calendrier.',
      shotsLive: 'Tirs au but', clockLabel: 'Horloge', openGame: 'Ouvrir la page du match'
    }
  };
  var COLS = {
    en: { gp: ['GP', 'Games played'], w: ['W', 'Wins'], l: ['L', 'Losses'], t: ['T', 'Ties'], otl: ['OTL', 'Overtime losses'], pts: ['PTS', 'Points'], gf: ['GF', 'Goals for'], ga: ['GA', 'Goals against'], diff: ['DIFF', 'Goal difference'], ppg: ['PTS/GP', 'Points per game'], l5: ['L5', 'Last 5 games'], strk: ['STRK', 'Current streak'], g: ['G', 'Goals'], a: ['A', 'Assists'], pim: ['PIM', 'Penalty minutes'], gwg: ['GWG', 'Game-winning goals'], ppgl: ['PPG', 'Power-play goals'], ppp: ['PPP', 'Power-play points'], shg: ['SHG', 'Short-handed goals'], shp: ['SHP', 'Short-handed points'], otg: ['OTG', 'Overtime goals'], sa: ['SA', 'Shots against'], sv: ['SV', 'Saves'], svp: ['SV%', 'Save percentage'], gaa: ['GAA', 'Goals against average'], so: ['SO', 'Shutouts'], min: ['MIN', 'Minutes played'], pgp: ['PTS/GP', 'Points per game'], rating: ['Rating', 'League rating code'] },
    fr: { gp: ['MJ', 'Matchs joués'], w: ['V', 'Victoires'], l: ['D', 'Défaites'], t: ['N', 'Nulles'], otl: ['DP', 'Défaites en prolongation'], pts: ['PTS', 'Points'], gf: ['BP', 'Buts pour'], ga: ['BC', 'Buts contre'], diff: ['DIFF', 'Différentiel de buts'], ppg: ['PTS/MJ', 'Points par match'], l5: ['5D', '5 derniers matchs'], strk: ['SÉQ', 'Séquence actuelle'], g: ['B', 'Buts'], a: ['A', 'Aides'], pim: ['PUN', 'Minutes de pénalité'], gwg: ['BG', 'Buts gagnants'], ppgl: ['BAN', 'Buts en avantage numérique'], ppp: ['PAN', 'Points en avantage numérique'], shg: ['BIN', 'Buts en infériorité numérique'], shp: ['PIN', 'Points en infériorité numérique'], otg: ['BP', 'Buts en prolongation'], sa: ['TC', 'Tirs contre'], sv: ['ARR', 'Arrêts'], svp: ['%ARR', 'Pourcentage d’arrêt'], gaa: ['MOY', 'Moyenne de buts alloués'], so: ['BL', 'Blanchissages'], min: ['MIN', 'Minutes jouées'], pgp: ['PTS/MJ', 'Points par match'], rating: ['Cote', 'Code de cote de la ligue'] }
  };
  var lang = 'fr';   // French is the default. The visitor's choice is saved in the browser.
  try { var saved = localStorage.getItem('ldhml-lang'); if (saved === 'fr' || saved === 'en') lang = saved; } catch (e) { /* storage can be blocked */ }
  var t = function (k, vars) {
    var s = (STR[lang][k] != null ? STR[lang][k] : (STR.en[k] != null ? STR.en[k] : k));
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  };
  var L = function (k) { return COLS[lang][k]; };
  var loc = function () { return lang === 'fr' ? 'fr-CA' : 'en-CA'; };
  var parseD = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var fmtDay = function (s) { return parseD(s).toLocaleDateString(loc(), { weekday: 'long', month: 'long', day: 'numeric' }); };
  var fmtShort = function (s) { return parseD(s).toLocaleDateString(loc(), { weekday: 'short', month: 'short', day: 'numeric' }); };
  var fmtStamp = function (iso) { try { return new Date(iso).toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }); } catch (e) { return iso; } };
  var f2 = function (n) { return Number(n).toFixed(2); };
  var pct = function (n) { return Number(n).toFixed(3).replace(/^0/, ''); };
  var mins = function (sec) { return Math.round(sec / 60); };
  var ord = function (n) {
    if (lang === 'fr') return n === 1 ? '1er' : n + 'e';
    var v = n % 100; return n + ((v > 10 && v < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  };
  var season = function () {
    var s = D.meta.season;
    return lang === 'fr' ? s : s.replace('Automne', 'Fall').replace('Hiver', 'Winter').replace('Été', 'Summer').replace('Printemps', 'Spring');
  };

  /* ================= data model ================= */
  /* Team colours, taken from the league's own team artwork (season 5, fall 2026).
   * [colour, ink]: the ink is the text colour used on top of the team colour. */
  var COLORS = {
    FLI: ['#F29B0F', '#1A1204'],  // Flintstones: amber
    CAL: ['#8E44C9', '#FFFFFF'],  // Câlinours: purple
    GIJ: ['#1D9A7C', '#FFFFFF'],  // GI Joe: teal green
    GOO: ['#D9B51E', '#1A1604'],  // Goonies: gold
    GHO: ['#C8202F', '#FFFFFF'],  // Ghostbusters: red
    JAW: ['#2A9FCF', '#FFFFFF'],  // Jaws: ocean blue
    MAS: ['#3162E0', '#FFFFFF'],  // Masters of the Universe: royal blue
    TMN: ['#2FA84F', '#FFFFFF'],  // TMNT: green
    TRA: ['#EA4A2B', '#FFFFFF'],  // Transformers: Autobot red-orange
    TOP: ['#66748A', '#FFFFFF']   // Top Gun: steel silver
  };
  /* Used inside style="--tc:" + colorOf(abb): it sets the team colour and the ink together. */
  var colorOf = function (abb) { var x = COLORS[abb] || ['#566471', '#FFFFFF']; return x[0] + ';--tx:' + x[1]; };
  /* Scope of the player numbers. "main": only what a player did for his main team in this league.
   * "all": everything he did in this league, for every team (substitutions included). */
  var SCOPE = 'main';
  try { var savedScope = localStorage.getItem('ldhml-scope'); if (savedScope === 'main' || savedScope === 'all') SCOPE = savedScope; } catch (e) { /* storage can be blocked */ }
  var splitS, splitG, hasMulti;
  var teams, T, TA, games, skaters, goalies, people, results, playedGames, upcomingGames, totalGoals, BOX, gameById, logS, logG, numOf;
  var played = function (g) { return g.as != null && g.hs != null; };
  var byDateDesc = function (a, b) { return (b.game.date + b.game.time).localeCompare(a.game.date + a.game.time); };
  var streakOf = function (id) {
    var r = results[id]; if (!r.length) return '';
    var last = r[r.length - 1].r, n = 0;
    for (var i = r.length - 1; i >= 0 && r[i].r === last; i--) n++;
    return (lang === 'fr' ? { W: 'V', L: 'D', T: 'N' } : { W: 'W', L: 'L', T: 'T' })[last] + n;
  };
  var rankMap = function (list, val, dir) {
    var m = {};
    list.forEach(function (p) {
      var v = val(p);
      m[p.id] = 1 + list.filter(function (q) { return dir === 'asc' ? val(q) < v : val(q) > v; }).length;
    });
    return m;
  };
  var jerseyOf = function (id) {
    var c = numOf[id]; if (!c) return '';
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
  };

  /* buildModel() derives every lookup table from D. The live module calls it again when fresh data arrives. */
  function buildModel() {
    teams = D.teams.slice().sort(function (a, b) { return a.pos - b.pos; });
    T = {}; TA = {};
    teams.forEach(function (x) { T[x.id] = x; TA[x.abb] = x; });
    games = D.games.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    results = {};
    teams.forEach(function (x) { results[x.id] = []; });
    games.forEach(function (g) {
      if (!played(g)) return;
      [[g.away, g.home, g.as, g.hs], [g.home, g.away, g.hs, g.as]].forEach(function (s) {
        if (!results[s[0]]) return;
        results[s[0]].push({ g: g, opp: s[1], gf: s[2], ga: s[3], r: s[2] > s[3] ? 'W' : s[2] < s[3] ? 'L' : 'T' });
      });
    });
    playedGames = games.filter(played);
    upcomingGames = games.filter(function (g) { return !played(g) && !g.cancelled; });
    totalGoals = playedGames.reduce(function (s, g) { return s + g.as + g.hs; }, 0);

    /* box scores: one entry per finished game, indexed by player */
    if (!D.box) D.box = { names: {}, games: {} };
    BOX = D.box;
    gameById = {};
    games.forEach(function (g) { gameById[g.id] = g; });
    logS = {}; logG = {}; numOf = {}; splitS = {}; splitG = {};
    Object.keys(BOX.games).forEach(function (gid) {
      var b = BOX.games[gid], g = gameById[gid];
      if (!g || b.t.length !== 2) return;
      b.t.forEach(function (bt, i) {
        var mine = bt.id === g.away ? g.as : g.hs, theirs = bt.id === g.away ? g.hs : g.as;
        var base = { game: g, team: bt.id, opp: b.t[1 - i].id, gf: mine, ga: theirs, r: mine > theirs ? 'W' : mine < theirs ? 'L' : 'T' };
        var abb = T[bt.id] ? T[bt.id].abb : '?';
        bt.sk.forEach(function (r) {
          if (!r[0]) return;
          var z = ((splitS[r[0]] = splitS[r[0]] || {})[abb] = splitS[r[0]][abb] || { gp: 0, g: 0, a: 0, pim: 0, ppg: 0, ppp: 0, shg: 0, shp: 0, gwg: 0, otg: 0, last: '' });
          z.gp++; z.g += r[2]; z.a += r[3]; z.pim += r[4] * 60; z.ppg += r[5]; z.ppp += r[6]; z.shg += r[7]; z.shp += r[8]; z.gwg += r[9]; z.otg += r[10];
          if (g.date > z.last) z.last = g.date;
          (logS[r[0]] = logS[r[0]] || []).push(Object.assign({ no: r[1], g: r[2], a: r[3], pim: r[4], gwg: r[9] }, base));
          if (r[1]) { var c = numOf[r[0]] = numOf[r[0]] || {}; c[r[1]] = (c[r[1]] || 0) + 1; }
        });
        bt.gk.forEach(function (r) {
          if (!r[0]) return;
          var y = ((splitG[r[0]] = splitG[r[0]] || {})[abb] = splitG[r[0]][abb] || { gp: 0, w: 0, l: 0, t: 0, sa: 0, sv: 0, ga: 0, so: 0, last: '' });
          y.gp++; y.w += r[1]; y.l += r[2]; y.t += r[3]; y.sa += r[4]; y.sv += r[5]; y.ga += r[6]; y.so += r[7];
          if (g.date > y.last) y.last = g.date;
          (logG[r[0]] = logG[r[0]] || []).push(Object.assign({ w: r[1], l: r[2], sa: r[4], sv: r[5], ga: r[6], so: r[7] }, base));
        });
      });
    });
    Object.keys(logS).forEach(function (k) { logS[k].sort(byDateDesc); });
    Object.keys(logG).forEach(function (k) { logG[k].sort(byDateDesc); });

    /* Main team = the team a person played most games for. A tie goes to the team of the latest game. */
    var gpOf = function (id, abb) { return ((splitS[id] || {})[abb] || { gp: 0 }).gp + ((splitG[id] || {})[abb] || { gp: 0 }).gp; };
    var lastOf = function (id, abb) { return Math.max(((splitS[id] || {})[abb] || { last: '' }).last, ((splitG[id] || {})[abb] || { last: '' }).last) || ''; };
    mainTeam = function (p) {
      var best = null;
      p.teams.forEach(function (a) {
        if (!best || gpOf(p.id, a) > gpOf(p.id, best) || (gpOf(p.id, a) === gpOf(p.id, best) && lastOf(p.id, a) > lastOf(p.id, best))) best = a;
      });
      return best;
    };
    var rawS = D.players, rawG = D.goalies;
    hasMulti = rawS.concat(rawG).some(function (p) { return p.teams.length > 1; });
    var zeroS = { gp: 0, g: 0, a: 0, pim: 0, ppg: 0, ppp: 0, shg: 0, shp: 0, gwg: 0, otg: 0 };
    skaterFor = function (p, abb, keep) {
      var s = (splitS[p.id] || {})[abb] || zeroS;
      return Object.assign({}, p, { teams: [abb].concat(p.teams.filter(function (a) { return a !== abb; })), also: p.teams.filter(function (a) { return a !== abb; }), all: p,
        gp: s.gp, g: s.g, a: s.a, p: s.g + s.a, pim: s.pim, ppg: s.ppg, ppp: s.ppp, shg: s.shg, shp: s.shp, gwg: s.gwg, otg: s.otg });
    };
    goalieFor = function (p, abb) {
      var s = (splitG[p.id] || {})[abb] || { gp: 0, w: 0, l: 0, t: 0, sa: 0, sv: 0, ga: 0, so: 0 };
      return Object.assign({}, p, { teams: [abb].concat(p.teams.filter(function (a) { return a !== abb; })), also: p.teams.filter(function (a) { return a !== abb; }), all: p,
        gp: s.gp, w: s.w, l: s.l, t: s.t, sa: s.sa, sv: s.sv, ga: s.ga, so: s.so, pct: s.sa ? s.sv / s.sa : 0, gaa: s.gp ? s.ga / s.gp : 0, mp: s.gp * (p.mpp || 12) * (p.ppg_ || 3) * 60 });
    };
    var scoped = function (p, make, splits) {
      var m = mainTeam(p);
      if (SCOPE !== 'main' || p.teams.length < 2 || !m || !splits[p.id]) return Object.assign({}, p, { also: [], all: p });
      var o = make(p, m);
      o.teams = [m];
      return o;
    };
    skaters = rawS.map(function (p) { return scoped(p, skaterFor, splitS); });
    goalies = rawG.map(function (p) { return scoped(p, goalieFor, splitG); });
    people = {};
    var ensure = function (p) {
      var all = p.all || p;
      var o = people[p.id] || (people[p.id] = { id: p.id, name: p.name, sex: p.sex, rank: p.rank, teams: [], main: mainTeam(all) });
      all.teams.forEach(function (a) { if (o.teams.indexOf(a) < 0) o.teams.push(a); });
      return o;
    };
    skaters.forEach(function (p) { ensure(p).skater = p; });
    goalies.forEach(function (p) { ensure(p).goalie = p; });
  }
  var mainTeam, skaterFor, goalieFor;
  buildModel();

  /* ================= live state (filled by 3-live.js) ================= */
  var LIVE = { net: 'idle', lastOk: 0, games: {}, recap: {}, fetched: {}, fails: 0 };
  var nowMs = function () { return typeof window.LDHML_NOW === 'function' ? window.LDHML_NOW() : Date.now(); };
  var todayStr = function () { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date(nowMs())); };
  /* Epoch milliseconds of a game start. The league times are Montreal time. */
  var startMs = function (g) {
    var guess = Date.parse(g.date + 'T' + (g.time || '00:00') + ':00Z');
    var parts = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).forEach(function (p) { parts[p.type] = p.value; });
    var local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return guess - (local - guess);
  };
  var liveRec = function (id) { var x = LIVE.games[id]; return x && x.lv && (x.state === 'live' || x.state === 'over') ? x : null; };
  var liveOf = function (id) { var x = LIVE.games[id]; return x && x.state === 'live' ? x.lv : null; };
  /* eff(g): the game with the live score, when the schedule has no final score yet. */
  var eff = function (g) {
    if (played(g)) return g;
    var x = liveRec(g.id);
    return x ? Object.assign({}, g, { as: x.lv.gv, hs: x.lv.gh, _live: x.state === 'live' }) : g;
  };
  var boxOf = function (id) {
    var b = BOX.games[id] || (LIVE.recap[id] && LIVE.recap[id].game) || null;
    return b && b.t && b.t.length === 2 ? b : null;
  };
  var liveList = function () { return games.filter(function (g) { return liveOf(g.id); }); };

  /* ================= small components ================= */
  var ICON_EXT = '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_SEARCH = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.6 10.6L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var BALL = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="#FF5B14"/><path d="M6 11a15 15 0 0 1 10-7" fill="none" stroke="#FFB48A" stroke-width="2" stroke-linecap="round" opacity=".7"/><g fill="#0A1218"><circle cx="18" cy="8" r="2.1"/><circle cx="18" cy="28" r="2.1"/><circle cx="8" cy="18" r="2.1"/><circle cx="28" cy="18" r="2.1"/><circle cx="11" cy="11" r="2.1"/><circle cx="25" cy="11" r="2.1"/><circle cx="11" cy="25" r="2.1"/><circle cx="25" cy="25" r="2.1"/><circle cx="18" cy="18" r="2.1"/></g></svg>';

  /* LED dot-matrix numerals, like the scoreboard on the wall of the arena. Each glyph is a grid of 7 rows. */
  var GLYPH = {
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    '-': ['...', '...', '...', '###', '...', '...', '...'],
    '+': ['...', '.#.', '.#.', '###', '.#.', '.#.', '...'],
    ':': ['.', '.', '#', '.', '#', '.', '.']
  };
  function led(value, cls, h) {
    var s = String(value), x0 = 0, on = '', off = '';
    for (var d = 0; d < s.length; d++) {
      var rows = GLYPH[s.charAt(d)]; if (!rows) continue;
      var w = rows[0].length;
      for (var y = 0; y < 7; y++) for (var x = 0; x < w; x++) {
        var seg = 'M' + (x0 + x + 0.5) + ' ' + (y + 0.5) + 'h0';
        if (rows[y].charAt(x) === '#') on += seg; else off += seg;
      }
      x0 += w + 1;
    }
    var cols = Math.max(1, x0 - 1);
    return '<svg class="led ' + (cls || '') + '" style="--cols:' + cols + (h ? ';--h:' + h + 'px' : '') + '" viewBox="0 0 ' + cols + ' 7" role="img" aria-label="' + esc(s) + '"><path class="off" d="' + off + '"/><path class="on" d="' + on + '"/></svg>';
  }
  function jersey(abb, no, cls) {
    return '<span class="jersey ' + (cls || '') + '" style="--tc:' + colorOf(abb) + '"><svg viewBox="0 0 100 96" aria-hidden="true"><path d="M31 6L8 18L1 44L19 51L23 42V92H77V42L81 51L99 44L92 18L69 6C65 15 58 19 50 19C42 19 35 15 31 6Z"/></svg><b>' + esc(no == null ? '' : no) + '</b></span>';
  }
  function pLink(id, fallback, cls) {
    var p = id && people[id];
    var name = p ? p.name : (BOX.names[id] || fallback || '');
    if (!p) return '<span class="' + (cls || '') + '">' + esc(name) + '</span>';
    return '<a class="tl ' + (cls == null ? 'strong' : cls) + '" href="#player-' + id + '">' + esc(name) + '</a>';
  }
  var abbOfTeam = function (id) { return T[id] ? T[id].abb : '?'; };

  function crest(abb, size) {
    var tm = TA[abb];
    var logo = tm && tm.logo ? '<img src="' + LOGO_BASE + esc(tm.logo) + '" alt="" loading="lazy" decoding="async">' : '';
    return '<span class="crest' + (size ? ' crest-' + size : '') + '" style="--tc:' + colorOf(abb) + '"><span aria-hidden="true">' + esc(abb) + '</span>' + logo + '</span>';
  }
  function teamCell(id) {
    var tm = T[id]; if (!tm) return '';
    return '<span class="tcell">' + crest(tm.abb, 'sm') + '<a class="tl strong" href="#team-' + tm.id + '">' + esc(tm.name) + '</a></span>';
  }
  function abbLinks(list) {
    return '<span class="abbs">' + list.map(function (a) {
      var tm = TA[a];
      return tm ? '<a href="#team-' + tm.id + '" style="--tc:' + colorOf(a) + '" title="' + esc(tm.name) + '">' + esc(a) + '</a>' : '<span>' + esc(a) + '</span>';
    }).join('') + '</span>';
  }
  function chip(r, title, href) {
    var letter = r === 'W' ? t('chW') : r === 'L' ? t('chL') : t('chT');
    return href ? '<a class="chip ' + r + '" href="' + href + '" title="' + esc(title) + '">' + letter + '</a>' : '<span class="chip ' + r + '" title="' + esc(title) + '">' + letter + '</span>';
  }
  function chipFor(x) {
    var o = T[x.opp] ? T[x.opp].name : '';
    var key = x.r === 'W' ? 'wonOver' : x.r === 'L' ? 'lostTo' : 'tiedWith';
    return chip(x.r, t(key, { a: x.gf, b: x.ga, o: o }) + ', ' + fmtShort(x.g.date), '#team-' + x.opp);
  }
  function formHtml(id) {
    var last = results[id].slice(-5);
    return '<span class="form">' + last.map(chipFor).join('') + '</span>';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? t(one) : t(many)); }

  /* ================= sortable tables ================= */
  var ui = { sort: {}, players: { q: '', team: '', sex: '' }, goalies: { team: '' }, sched: { mode: 'all', team: '' } };

  function dataTable(id, cols, rows, def, opts) {
    opts = opts || {};
    var st = ui.sort[id] || def;
    var col = cols.filter(function (c) { return c.k === st.k; })[0] || cols.filter(function (c) { return c.k === def.k; })[0];
    var val = function (r) { var v = col.sv ? col.sv(r) : col.get(r); return v == null ? -Infinity : v; };
    var sorted = opts.static ? rows : rows.map(function (r, i) { return [r, i]; }).sort(function (a, b) {
      var x = val(a[0]), y = val(b[0]);
      var c = (typeof x === 'string' || typeof y === 'string') ? String(x).localeCompare(String(y), loc(), { sensitivity: 'base' }) : (x === y ? 0 : x - y);
      if (!c) return a[1] - b[1];
      return st.dir === 'asc' ? c : -c;
    }).map(function (a) { return a[0]; });
    var head = cols.map(function (c) {
      var cls = (c.num ? 'num ' : '') + (c.stick ? 'stick' : '');
      if (opts.static || c.nosort) return '<th scope="col" class="' + cls + '" title="' + esc(c.title || '') + '">' + esc(c.label) + '</th>';
      var sorted = c.k === col.k;
      return '<th scope="col" class="' + cls + '"' + (sorted ? ' aria-sort="' + (st.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
        '<button type="button" data-sort="' + id + '|' + c.k + '|' + (c.dir || 'desc') + '" title="' + esc(c.title || '') + '">' + esc(c.label) + '</button></th>';
    }).join('');
    var body = sorted.map(function (r, i) {
      return '<tr>' + cols.map(function (c) {
        var cls = (c.num ? 'num ' : '') + (c.stick ? 'stick ' : '') + (c.key ? 'key' : '');
        var inner = c.html ? c.html(r, i) : esc(c.get(r));
        return '<td class="' + cls + '">' + inner + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  var numCol = function (k, label, get, extra) {
    var l = L(label);
    var c = { k: k, label: l[0], title: l[1], num: true, get: get, dir: 'desc' };
    if (extra) Object.keys(extra).forEach(function (x) { c[x] = extra[x]; });
    return c;
  };
  var idxCol = { k: 'idx', label: '#', num: true, nosort: true, get: function () { return ''; }, html: function (r, i) { return i + 1; } };

  /* ---- column sets ---- */
  function standingsCols(compact) {
    var hasOtl = teams.some(function (x) { return x.otl > 0; });
    var cols = [
      { k: 'pos', label: '#', num: true, get: function (x) { return x.pos; }, dir: 'asc', nosort: false, title: t('rank') },
      { k: 'name', label: t('team'), title: t('team'), get: function (x) { return x.name; }, html: function (x) { return teamCell(x.id); }, dir: 'asc', stick: true },
      numCol('gp', 'gp', function (x) { return x.gp; }),
      numCol('w', 'w', function (x) { return x.w; }),
      numCol('l', 'l', function (x) { return x.l; }),
      numCol('t', 't', function (x) { return x.t; })
    ];
    if (hasOtl) cols.push(numCol('otl', 'otl', function (x) { return x.otl; }));
    cols.push(numCol('pts', 'pts', function (x) { return x.pts; }, { key: true, sv: function (x) { return -x.pos; } }));
    if (!compact) {
      cols.push(numCol('gf', 'gf', function (x) { return x.gf; }));
      cols.push(numCol('ga', 'ga', function (x) { return x.ga; }, { dir: 'asc' }));
    }
    cols.push(numCol('diff', 'diff', function (x) { return x.diff; }, { html: function (x) { return (x.diff > 0 ? '+' : '') + x.diff; } }));
    if (!compact) {
      cols.push(numCol('ppg', 'ppg', function (x) { return x.ppg; }, { html: function (x) { return f2(x.ppg); } }));
      cols.push({ k: 'l5', label: L('l5')[0], title: L('l5')[1], nosort: true, get: function () { return ''; }, html: function (x) { return formHtml(x.id); } });
      cols.push({ k: 'strk', label: L('strk')[0], title: L('strk')[1], num: true, nosort: true, get: function () { return ''; }, html: function (x) { return esc(streakOf(x.id)); } });
    }
    return cols;
  }
  var teamsHtml = function (p) { return abbLinks(p.teams) + (p.also && p.also.length ? '<span class="also" title="' + esc(t('alsoPlayed')) + '">' + t('alsoShort') + ' ' + abbLinks(p.also) + '</span>' : ''); };
  function skaterCols(opts) {
    opts = opts || {};
    var has = function (k) { return skaters.some(function (p) { return p[k] > 0; }); };
    var cols = [idxCol, {
      k: 'name', label: t('player'), title: t('player'), get: function (p) { return p.name; }, dir: 'asc', stick: true,
      html: function (p) {
        var others = (opts.team ? p.teams.concat(p.also || []).filter(function (a, i, l) { return a !== opts.team && l.indexOf(a) === i; }) : []);
        return '<a class="tl strong" href="#player-' + p.id + '">' + esc(p.name) + '</a>' +
          (others.length ? '<span class="alsoplayed">' + t('alsoPlayed') + ' ' + others.map(function (a) { var tm = TA[a]; return tm ? '<a href="#team-' + tm.id + '">' + esc(tm.name) + '</a>' : esc(a); }).join(', ') + '</span>' : '');
      }
    }];
    if (!opts.team) cols.push({ k: 'team', label: t('team'), title: t('teams'), get: function (p) { return p.teams.join(','); }, dir: 'asc', html: teamsHtml });
    cols.push(numCol('gp', 'gp', function (p) { return p.gp; }));
    cols.push(numCol('g', 'g', function (p) { return p.g; }));
    cols.push(numCol('a', 'a', function (p) { return p.a; }));
    cols.push(numCol('p', 'pts', function (p) { return p.p; }, { key: true, sv: function (p) { return p.p * 1e6 + p.g * 1e3 + (999 - p.gp); } }));
    cols.push(numCol('pgp', 'pgp', function (p) { return p.gp ? p.p / p.gp : 0; }, { html: function (p) { return p.gp ? f2(p.p / p.gp) : '0.00'; } }));
    cols.push(numCol('pim', 'pim', function (p) { return p.pim; }, { html: function (p) { return mins(p.pim); } }));
    if (has('gwg')) cols.push(numCol('gwg', 'gwg', function (p) { return p.gwg; }));
    [['ppg', 'ppgl'], ['ppp', 'ppp'], ['shg', 'shg'], ['shp', 'shp'], ['otg', 'otg']].forEach(function (x) {
      if (has(x[0])) cols.push(numCol(x[0], x[1], function (p) { return p[x[0]]; }));
    });
    return cols;
  }
  function goalieCols(opts) {
    opts = opts || {};
    var cols = [{
      k: 'name', label: t('goalie'), title: t('goalie'), get: function (p) { return p.name; }, dir: 'asc', stick: true,
      html: function (p) { return '<a class="tl strong" href="#player-' + p.id + '">' + esc(p.name) + '</a>'; }
    }];
    if (!opts.team) cols.push({ k: 'team', label: t('team'), title: t('teams'), get: function (p) { return p.teams.join(','); }, dir: 'asc', html: teamsHtml });
    cols.push(numCol('gp', 'gp', function (p) { return p.gp; }));
    cols.push(numCol('w', 'w', function (p) { return p.w; }));
    cols.push(numCol('l', 'l', function (p) { return p.l; }));
    cols.push(numCol('t', 't', function (p) { return p.t; }));
    if (!opts.compact) {
      cols.push(numCol('sa', 'sa', function (p) { return p.sa; }));
      cols.push(numCol('sv', 'sv', function (p) { return p.sv; }));
      cols.push(numCol('ga', 'ga', function (p) { return p.ga; }, { dir: 'asc' }));
    }
    cols.push(numCol('svp', 'svp', function (p) { return p.pct; }, { key: true, html: function (p) { return pct(p.pct); } }));
    cols.push(numCol('gaa', 'gaa', function (p) { return p.gaa; }, { dir: 'asc', html: function (p) { return f2(p.gaa); } }));
    cols.push(numCol('so', 'so', function (p) { return p.so; }));
    if (!opts.compact) {
      cols.push(numCol('min', 'min', function (p) { return p.mp; }, { html: function (p) { return mins(p.mp); } }));
      if (goalies.some(function (p) { return p.pim > 0; })) cols.push(numCol('pim', 'pim', function (p) { return p.pim; }, { html: function (p) { return mins(p.pim); } }));
    }
    return cols;
  }

