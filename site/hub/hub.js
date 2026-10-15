/* LDHML entry page and section pages. One small app, two kinds of page (H.kind):
 *   root     /            one card per section (draft leagues, team leagues). No request to the league server.
 *   section  /<section>/  one card per league of the section, the people of the section, a player page per person.
 * The numbers come from the snapshot built into the page. On a section page, the standings of each league are read
 * again from the public API when the page opens (one request at a time, it stops after 2 failures). */
var H = JSON.parse(document.getElementById('hub-data').textContent);
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
var API = 'https://admin.nbhpa.com';
var THEME_ON = true;
try { THEME_ON = localStorage.getItem('ldhml-theme') !== 'off'; } catch (e) { /* storage can be blocked */ }
var themeOf = function (l) { return THEME_ON ? l.theme : 'default'; };
var lang = 'fr';
try { var sv = localStorage.getItem('ldhml-lang'); if (sv === 'fr' || sv === 'en') lang = sv; } catch (e) { /* storage can be blocked */ }

var STR = {
  fr: {
    title: 'LDHML', lead: 'Classements, calendriers, feuilles de match et statistiques des ligues de hockey balle, saison {s}.',
    leagues: 'Ligues', teams: 'équipes', games: 'matchs', played: 'matchs joués', pts: 'PTS', lang: 'EN',
    leader: 'En tête', scorer: 'Meilleur pointeur', open: 'Ouvrir la ligue', night: 'Prochaine soirée', nights: 'Prochaines soirées', tonight: 'Ce soir',
    noNight: 'Aucun match à venir pour le moment.', gm: 'match', gms: 'matchs', all: 'Toutes les ligues', pickLabel: 'Ligue', themeLabel: 'Thème', themeTipOff: 'Désactiver les thèmes des ligues (look par défaut)', themeTipOn: 'Activer les thèmes des ligues',
    footUpdated: 'Données du {t}', footSource: 'Aperçu non officiel. Tous les chiffres viennent des données publiques de la ligue NBHPA.',
    of: 'sur', gp: 'MJ', noGames: 'Pas de match joué', pointsShort: 'pts', fresh: 'Classements à jour', goTonight: 'Voir en direct',
    sections: 'Sections', nLeagues: '{n} ligues', nLeague: '{n} ligue', nTeams: '{n} équipes', nPeople: '{n} joueurs', openSection: 'Ouvrir la section {s}',
    allOf: 'Toutes les ligues {s}', hubName: 'Accueil LDHML', home: 'Ligues', players: 'Joueurs', people: 'joueurs',
    playersLede: 'Toutes les personnes qui jouent dans les ligues {s} cette saison. Ouvrez un nom pour son profil.',
    filter: 'Filtrer par nom', nShown: '{n} joueurs', noPlayers: 'Aucun joueur ne correspond.', player: 'Joueur',
    rating: 'Cote', ratingS: 'Cote de joueur', ratingG: 'Cote de gardien', ratingSShort: 'Cote J', ratingGShort: 'Cote G', ratingNote: 'La cote vient de la NBHPA. Elle existe séparément pour joueur et pour gardien.',
    skater: 'Joueur', goalie: 'Gardien', team: 'Équipe', season: 'Saison {s}', otherSection: 'Joue aussi dans la section {s} :',
    profile: 'Profil {s}', notFound: 'Joueur introuvable', notFoundText: 'Cette personne ne joue pas dans les ligues {s} cette saison.', back: 'Retour aux joueurs',
    snapNote: 'Chiffres du {t}. Les pages des ligues ont les chiffres en direct.', ownRanks: 'Cotes de la section',
    inLeague: '{p} : statistiques dans {l}', mainTag: 'Équipe principale', leaguesTeams: 'Ligues et équipes',
    cG: 'B', cA: 'A', cP: 'PTS', cPim: 'PUN', cW: 'V', cL: 'D', cT: 'N', cSv: '%ARR'
  },
  en: {
    title: 'LDHML', lead: 'Standings, schedules, box scores and stats for the ball hockey leagues, {s} season.',
    leagues: 'Leagues', teams: 'teams', games: 'games', played: 'games played', pts: 'PTS', lang: 'FR',
    leader: 'Leading', scorer: 'Top scorer', open: 'Open the league', night: 'Next game night', nights: 'Next game nights', tonight: 'Tonight',
    noNight: 'No upcoming games for now.', gm: 'game', gms: 'games', all: 'All leagues', pickLabel: 'League', themeLabel: 'Theme', themeTipOff: 'Switch off the league themes (default look)', themeTipOn: 'Switch the league themes on',
    footUpdated: 'Data of {t}', footSource: 'Unofficial preview. All numbers come from the public NBHPA league data.',
    of: 'of', gp: 'GP', noGames: 'No game played yet', pointsShort: 'pts', fresh: 'Standings are up to date', goTonight: 'Watch live',
    sections: 'Sections', nLeagues: '{n} leagues', nLeague: '{n} league', nTeams: '{n} teams', nPeople: '{n} players', openSection: 'Open the {s} section',
    allOf: 'All {s} leagues', hubName: 'LDHML home', home: 'Leagues', players: 'Players', people: 'players',
    playersLede: 'Everybody who plays in the {s} leagues this season. Open a name for the profile.',
    filter: 'Filter by name', nShown: '{n} players', noPlayers: 'No player matches.', player: 'Player',
    rating: 'Rating', ratingS: 'Skater rating', ratingG: 'Goalie rating', ratingSShort: 'Rtg S', ratingGShort: 'Rtg G', ratingNote: 'The rating comes from NBHPA. A skater rating and a goalie rating are separate.',
    skater: 'Skater', goalie: 'Goalie', team: 'Team', season: '{s} season', otherSection: 'Also plays in the {s} section:',
    profile: '{s} profile', notFound: 'Player not found', notFoundText: 'This person does not play in the {s} leagues this season.', back: 'Back to the players',
    snapNote: 'Numbers of {t}. The league pages have the live numbers.', ownRanks: 'Section ratings',
    inLeague: '{p}: stats in {l}', mainTag: 'Main team', leaguesTeams: 'Leagues and teams',
    cG: 'G', cA: 'A', cP: 'PTS', cPim: 'PIM', cW: 'W', cL: 'L', cT: 'T', cSv: 'SV%'
  }
};
var t = function (k, v) { var s = (STR[lang][k] != null ? STR[lang][k] : k); Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };
var season = function () { var s = H.season; return lang === 'fr' ? s : s.replace('Automne', 'Fall').replace('Hiver', 'Winter').replace('Été', 'Summer').replace('Printemps', 'Spring'); };
var nameOf = function (s) { return s && s.name ? (s.name[lang] || s.name.fr) : ''; };

var today = function () {
  if (window.LDHML_NOW) return window.LDHML_NOW.slice(0, 10);
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); } catch (e) { return new Date().toISOString().slice(0, 10); }
};
var fmtDay = function (d) {
  var x = new Date(d + 'T12:00:00Z');
  return x.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
};
var fmtStamp = function (iso) {
  var x = new Date(iso);
  if (isNaN(x)) return '';
  return x.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' });
};
var fmtShort = function (d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

var BALL = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" style="fill:var(--mark-a)"/><path d="M6 11a15 15 0 0 1 10-7" fill="none" style="stroke:var(--mark-b)" stroke-width="2" stroke-linecap="round" opacity=".7"/><g fill="#0A1218"><circle cx="18" cy="8" r="2.1"/><circle cx="18" cy="28" r="2.1"/><circle cx="8" cy="18" r="2.1"/><circle cx="28" cy="18" r="2.1"/><circle cx="11" cy="11" r="2.1"/><circle cx="25" cy="11" r="2.1"/><circle cx="11" cy="25" r="2.1"/><circle cx="25" cy="25" r="2.1"/><circle cx="18" cy="18" r="2.1"/></g></svg>';
var logoImg = function (key, w, h) { return key && H.logos && H.logos[key] ? '<img class="mk-logo" src="' + H.logos[key] + '" alt="" width="' + w + '" height="' + h + '">' : BALL; };

/* Teams look and link the same as on the league pages (shared/look.js, docs/presentation.md).
 * Links are relative to a section page: a league is at "<league path>/". */
var teamOf = function (l, abb) { return (l.teamList || []).filter(function (x) { return x.abb === abb; })[0] || { abb: abb }; };
var teamHref = function (l, tm) { return tm.id ? l.path + '/#team-' + tm.id : ''; };
var crestOf = function (l, abb) { return window.LDLook.crest(teamOf(l, abb), l.slug, 'sm'); };
var teamChips = function (l, abbs) { return '<span class="abbs">' + abbs.map(function (a) { var tm = teamOf(l, a); return window.LDLook.abbLink(tm, l.slug, teamHref(l, tm)); }).join('') + '</span>'; };
var badgeOf = function (l, o) { return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: H.logos && H.logos[l.logo] }, Object.assign({ theme: themeOf(l) }, o)); };
var teamName = function (l, tm) { var href = teamHref(l, tm); return href ? '<a class="tl strong" href="' + esc(href) + '">' + esc(tm.name || tm.abb) + '</a>' : esc(tm.name || tm.abb); };

var live = {}; // slug -> fresher standings, once read from the API

function standingsOf(l) { return live[l.slug] || l.top; }
function playedOf(l) { return live[l.slug] ? live[l.slug].played : l.played; }

/* Next game date of each league, soonest first. */
function nextNights(list) {
  var td = today(), rows = [];
  list.forEach(function (l) {
    var up = l.upcoming.filter(function (g) { return g.date >= td; });
    if (!up.length) return;
    var date = up.map(function (g) { return g.date; }).sort()[0];
    var gs = up.filter(function (g) { return g.date === date; });
    rows.push({ l: l, date: date, n: gs.length, first: gs.map(function (g) { return g.time; }).sort()[0], isToday: date === td });
  });
  rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.l.name < b.l.name ? -1 : 1; });
  return rows;
}

function nightHtml(list, prefix) {
  var rows = nextNights(list);
  if (!rows.length) return '<p class="lede">' + t('noNight') + '</p>';
  return '<section class="night" aria-labelledby="nt"><h2 id="nt" class="night-h">' + (rows[0].isToday ? t('tonight') : t('nights')) + '</h2><ul class="night-l">' +
    rows.map(function (r) {
      return '<li>' + badgeOf(r.l, { href: prefix + r.l.path + '/#' + (r.isToday ? 'live' : 'schedule'), title: r.l.name,
        extra: (r.isToday ? t('tonight') : fmtShort(r.date)) + ' · ' + r.n + ' ' + (r.n === 1 ? t('gm') : t('gms')) + ' · ' + r.first }) + '</li>';
    }).join('') + '</ul></section>';
}

function cardHtml(l) {
  var top = standingsOf(l), pl = playedOf(l);
  var pct = l.total ? Math.min(100, Math.round(pl / l.total * 100)) : 0;
  var rows = top.slice(0, 3).map(function (r, i) {
    var tm = Object.assign({}, teamOf(l, r.abb), { id: r.id || teamOf(l, r.abb).id, name: window.LDParsers.niceName(r.name) });
    return '<li><span class="rk">' + (i + 1) + '</span><span class="nm tcell">' + crestOf(l, r.abb) + teamName(l, tm) + '</span><span class="rec">' + r.w + '-' + r.l + '-' + r.t + '</span><b>' + r.pts + '</b></li>';
  }).join('');
  var sc = l.scorer;
  var scorer = sc && sc.id ? '<a class="tl strong" href="' + esc(l.path) + '/#player-' + esc(sc.id) + '">' + esc(sc.name) + '</a> ' + teamChips(l, [sc.abb]) : sc ? esc(sc.name) : '';
  return '<article class="lcard" data-slug="' + esc(l.slug) + '" data-t="' + esc(themeOf(l)) + '"><div class="lcard-head">' + logoImg(l.logo, 60, 52) +
    '<h2><a class="lcard-link" href="' + esc(l.path) + '/"><span>LDHML</span> <i>' + esc(l.short) + '</i></a></h2></div>' +
    '<p class="lcard-meta">' + l.teams + ' ' + t('teams') + ' · ' + pl + ' ' + t('of') + ' ' + l.total + ' ' + t('games') + '</p>' +
    '<div class="bar" role="img" aria-label="' + pl + ' / ' + l.total + '"><i style="width:' + pct + '%"></i></div>' +
    (pl ? '<ol class="lcard-top" aria-label="' + t('leader') + '">' + rows + '</ol>' : '<p class="lcard-none">' + t('noGames') + '</p>') +
    (l.scorer && pl ? '<p class="lcard-sc"><small>' + t('scorer') + '</small><span>' + scorer + '</span><b>' + l.scorer.p + ' ' + t('pointsShort') + '</b></p>' : '') +
    '</article>';
}

/* ================= entry page: one card per section ================= */
function sectionCard(s) {
  var nx = nextNights(s.leagues)[0];
  var teams = s.leagues.reduce(function (a, l) { return a + l.teams; }, 0);
  return '<article class="lcard scard" data-section="' + esc(s.key) + '" data-t="' + esc(THEME_ON ? s.theme || 'default' : 'default') + '"><div class="lcard-head">' + logoImg(s.logo, 60, 52) +
    '<h2><a class="lcard-link" href="' + esc(s.path) + '/" aria-label="' + esc(t('openSection', { s: nameOf(s) })) + '"><span>LDHML</span> <i>' + esc(nameOf(s)) + '</i></a></h2></div>' +
    '<p class="lcard-meta">' + t(s.leagues.length === 1 ? 'nLeague' : 'nLeagues', { n: s.leagues.length }) + ' · ' + t('nTeams', { n: teams }) + ' · ' + t('nPeople', { n: s.people }) + '</p>' +
    '<ul class="scard-l">' + s.leagues.map(function (l) {
      return '<li>' + badgeOf(l, { href: s.path + '/' + l.path + '/', title: l.name }) + '</li>';
    }).join('') + '</ul>' +
    (nx ? '<p class="lcard-sc"><small>' + t('night') + '</small><span>' + esc(nx.isToday ? t('tonight') : fmtDay(nx.date)) + '</span></p>' : '') + '</article>';
}
function renderRoot() {
  var all = [];
  H.sections.forEach(function (s) { all = all.concat(s.leagues); });
  var totals = all.reduce(function (a, l) { a.teams += l.teams; a.played += playedOf(l); return a; }, { teams: 0, played: 0 });
  $('#top').innerHTML = '';
  $('#main').innerHTML = '<div class="arena hero"><div class="wrap hub-hero">' +
    (H.logos && H.logos.hero ? '<img class="hero-logo" src="' + H.logos.hero + '" alt="" width="693" height="747">' : '') +
    '<div><h1' + (H.logos && H.logos.hero ? ' class="sr"' : '') + '>LDHML</h1><p class="hub-season">' + esc(season()) + '</p><ul class="hub-stats"><li><b>' + all.length + '</b><span>' + t('leagues') + '</span></li><li><b>' + totals.teams + '</b><span>' + t('teams') + '</span></li><li><b>' + totals.played + '</b><span>' + t('played') + '</span></li></ul></div></div></div>' +
    '<div class="wrap hub-body"><h2 class="hub-h">' + t('sections') + '</h2><div class="lcards scards">' + H.sections.map(sectionCard).join('') + '</div></div>';
  document.title = 'LDHML | ' + season();
}

/* ================= section page ================= */
var S = H.section;
var ui = { q: '' };
var PEOPLE = {};
(H.people || []).forEach(function (p) { PEOPLE[p.id] = p; });
var leagueBy = {};
(H.leagues || []).forEach(function (l) { leagueBy[l.slug] = l; });
var mins = function (sec) { return Math.round((sec || 0) / 60); };
var pct3 = function (n) { return Number(n).toFixed(3).replace(/^0/, ''); };
var playedIn = function (p) { return (H.leagues || []).filter(function (l) { return p.lg[l.slug]; }); };
var rankTxt = function (v) { return v ? esc(v) : '-'; };

function parseRoute() {
  var h = String(location.hash || '').replace(/^#/, '');
  var m = h.match(/^player-([A-Za-z0-9]+)$/);
  if (m) return { name: 'player', id: m[1] };
  if (h === 'players') return { name: 'players' };
  return { name: 'home' };
}
function sectionTop(route) {
  var nav = [['home', t('home')], ['players', t('players')]];
  return '<div class="wrap top-in sec-top"><a class="brand" href="#home">' + logoImg(S.logo, 52, 44) + '<span><b>LDHML <i>' + esc(nameOf(S)) + '</i></b><small>' + esc(season()) + '</small></span></a>' +
    '<nav class="nav" aria-label="Main">' + nav.map(function (n) { return '<a href="#' + n[0] + '"' + (route === n[0] || (route === 'player' && n[0] === 'players') ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('') +
    '<a href="' + esc(H.up || '../') + '">' + t('hubName') + '</a></nav></div>';
}
function viewSectionHome() {
  var list = H.leagues;
  var totals = list.reduce(function (a, l) { a.teams += l.teams; a.played += playedOf(l); return a; }, { teams: 0, played: 0 });
  return '<div class="arena sec-arena"><div class="wrap"><h1>LDHML ' + esc(nameOf(S)) + '</h1><ul class="hub-stats"><li><b>' + list.length + '</b><span>' + t('leagues') + '</span></li><li><b>' + totals.teams + '</b><span>' + t('teams') + '</span></li><li><b>' + H.people.length + '</b><span>' + t('people') + '</span></li><li><b>' + totals.played + '</b><span>' + t('played') + '</span></li></ul></div></div>' +
    '<div class="wrap hub-body">' + nightHtml(list, '') + '<h2 class="hub-h">' + t('leagues') + '</h2><div class="lcards">' + list.map(cardHtml).join('') + '</div></div>';
}
/* Each league of the person, as a league badge: the league part opens the person's page in that league,
 * the team chips inside open the team pages (docs/presentation.md). */
function personBadge(p, l, size) {
  return badgeOf(l, { href: l.path + '/#player-' + p.id, title: t('inLeague', { p: p.name, l: l.name }), size: size,
    teams: size ? [] : p.lg[l.slug].teams.map(function (a) { var tm = teamOf(l, a); return { abb: a, name: tm.name, href: teamHref(l, tm) }; }) });
}
function leagueChips(p) {
  return '<span class="lgbs">' + playedIn(p).map(function (l) { return personBadge(p, l); }).join('') + '</span>';
}
function viewPlayers() {
  var q = norm(ui.q.trim());
  var list = H.people.filter(function (p) { return !q || norm(p.name).indexOf(q) >= 0; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'fr', { sensitivity: 'base' }); });
  var rows = list.map(function (p) {
    /* The badges are in their own column; on phones they move under the name (CSS .pl-under / .pl-lgcol). */
    var chips = leagueChips(p);
    return '<tr><td class="stick"><a class="tl strong" href="#player-' + esc(p.id) + '">' + esc(p.name) + '</a><div class="pl-under">' + chips + '</div></td><td class="num">' + rankTxt(p.rank.s) + '</td><td class="num">' + rankTxt(p.rank.g) + '</td><td class="pl-lgcol">' + chips + '</td></tr>';
  }).join('');
  return '<div class="wrap sec-body"><h1 class="ph">' + t('players') + '</h1><p class="lede">' + esc(t('playersLede', { s: nameOf(S) })) + '</p>' +
    '<div class="controls"><input id="pq" class="ctl" type="search" data-q placeholder="' + esc(t('filter')) + '" value="' + esc(ui.q) + '" aria-label="' + esc(t('filter')) + '" autocomplete="off"><span class="count">' + t('nShown', { n: list.length }) + '</span></div>' +
    (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col" class="stick">' + t('player') + '</th><th scope="col" class="num" title="' + esc(t('ratingS')) + '">' + t('ratingSShort') + '</th><th scope="col" class="num" title="' + esc(t('ratingG')) + '">' + t('ratingGShort') + '</th><th scope="col" class="pl-lgcol">' + t('leaguesTeams') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">' + t('noPlayers') + '</p>') +
    '<p class="note">' + t('ratingNote') + '</p></div>';
}
function lineTable(head, cells) {
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + head.map(function (h, i) { return '<th scope="col"' + (i ? ' class="num"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody><tr>' +
    cells.map(function (c, i) { return '<td' + (i ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr></tbody></table></div>';
}
function viewPlayer(r) {
  var p = PEOPLE[r.id];
  if (!p) return '<div class="wrap sec-body"><h1 class="ph">' + t('notFound') + '</h1><p class="lede">' + esc(t('notFoundText', { s: nameOf(S) })) + '</p><p class="note"><a class="lnk" href="#players">' + t('back') + '</a></p></div>';
  var bits = [];
  if (p.rank.s) bits.push('<span>' + t('ratingS') + ': <b>' + esc(p.rank.s) + '</b></span>');
  if (p.rank.g) bits.push('<span>' + t('ratingG') + ': <b>' + esc(p.rank.g) + '</b></span>');
  /* Our own rank systems of this section (none yet): values per position. */
  var own = (H.rankSystems || []).filter(function (sys) { return p.ranks && p.ranks[sys.key]; }).map(function (sys) {
    var v = p.ranks[sys.key];
    return '<span>' + esc(nameOf(sys)) + ': <b>' + [v.s != null ? t('skater') + ' ' + esc(v.s) : '', v.g != null ? t('goalie') + ' ' + esc(v.g) : ''].filter(Boolean).join(' · ') + '</b></span>';
  });
  /* One block per league: the league (logo, name, link), the teams (badge, full name, link, games, main team), the season lines,
   * and a link to the person's page in the league, where the full stats are (game log, per-team splits). */
  var cards = playedIn(p).map(function (l) {
    var m = p.lg[l.slug], out = '', gpBy = m.gpBy || {};
    var teams = '<ul class="pl-teams">' + m.teams.map(function (a) {
      var tm = teamOf(l, a), href = teamHref(l, tm);
      return '<li style="--tc:' + window.LDLook.colorVar(l.slug, a) + '"><span class="tcell">' + crestOf(l, a) + teamName(l, tm) + '</span>' +
        (gpBy[a] != null ? '<small>' + gpBy[a] + ' ' + t('gp') + '</small>' : '') + (a === m.main ? '<em class="maintag">' + t('mainTag') + '</em>' : '') + '</li>';
    }).join('') + '</ul>';
    if (m.s) out += lineTable([t('skater'), t('gp'), t('cG'), t('cA'), t('cP'), t('cPim')], [teamChips(l, m.teams), m.s.gp, m.s.g, m.s.a, m.s.g + m.s.a, mins(m.s.pim)]);
    if (m.g) out += lineTable([t('goalie'), t('gp'), t('cW'), t('cL'), t('cT'), t('cSv')], [teamChips(l, m.teams), m.g.gp, m.g.w, m.g.l, m.g.t, m.g.sa ? pct3(m.g.sv / m.g.sa) : '-']);
    return '<section class="sec pl-lg" data-t="' + esc(themeOf(l)) + '"><h2 class="pl-lg-h">' + personBadge(p, l, 'lg') + '</h2>' + teams + out + '</section>';
  }).join('');
  var other = (p.xs || []).map(function (k) {
    var s = H.sections[k];
    return s ? '<p class="note pxl">' + esc(t('otherSection', { s: nameOf(s) })) + ' <a class="lnk" href="' + esc((H.up || '../') + s.path) + '/#player-' + esc(p.id) + '">' + esc(t('profile', { s: nameOf(s) })) + '</a></p>' : '';
  }).join('');
  var stamp = (H.leagues || []).reduce(function (m, l) { return l.fetchedAt > m ? l.fetchedAt : m; }, '');
  return '<div class="wrap sec-body"><p class="note"><a class="lnk" href="#players">' + t('players') + '</a></p><div class="hero pl-hero"><div><h1>' + esc(p.name) + '</h1><p class="meta">' + bits.join('') + '</p>' +
    (own.length ? '<p class="meta"><span>' + t('ownRanks') + '</span>' + own.join('') + '</p>' : '') + '</div></div>' + other + cards +
    '<p class="note">' + esc(t('snapNote', { t: fmtStamp(stamp) })) + '</p></div>';
}
function renderSection(keepScroll) {
  var r = parseRoute();
  $('#top').innerHTML = sectionTop(r.name);
  $('#main').innerHTML = r.name === 'player' ? viewPlayer(r) : r.name === 'players' ? viewPlayers() : viewSectionHome();
  var p = r.name === 'player' && PEOPLE[r.id];
  document.title = (p ? p.name + ' | ' : '') + 'LDHML ' + nameOf(S) + ' | ' + season();
  if (!keepScroll) window.scrollTo(0, 0);
}

/* ================= shared ================= */
function render(keepScroll) {
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-league', 'default');
  if (H.kind === 'section') renderSection(keepScroll); else renderRoot();
  $('#foot').innerHTML = '<p>' + t('footSource') + '</p>' + (H.kind === 'section' ? '<p><a href="' + esc(H.up || '../') + '">' + t('hubName') + '</a></p>' : '');
  renderPicker();
}

/* Picker. Entry page: each section and its leagues. Section page: this section's leagues and the entry page. */
function renderPicker() {
  var el = $('#picker'), opts;
  if (H.kind === 'section') {
    opts = '<option value="" selected>' + esc(t('allOf', { s: nameOf(S) })) + '</option>' + H.leagues.map(function (l) { return '<option value="' + esc(l.path) + '/">' + esc(l.name) + '</option>'; }).join('') +
      '<option value="' + esc(H.up || '../') + '">' + t('hubName') + '</option>';
  } else {
    opts = '<option value="" selected>' + t('hubName') + '</option>' + H.sections.map(function (s) {
      return '<optgroup label="' + esc(nameOf(s)) + '"><option value="' + esc(s.path) + '/">' + esc(t('allOf', { s: nameOf(s) })) + '</option>' +
        s.leagues.map(function (l) { return '<option value="' + esc(s.path + '/' + l.path) + '/">' + esc(l.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
  }
  el.innerHTML = '<button type="button" class="lgbtn" data-lang="' + (lang === 'fr' ? 'en' : 'fr') + '" aria-label="' + (lang === 'fr' ? 'Switch to English' : 'Passer au français') + '">' + (lang === 'fr' ? 'English' : 'Français') + '</button>' + '<button type="button" class="thm" data-theme-toggle aria-pressed="' + THEME_ON + '" title="' + esc(THEME_ON ? t('themeTipOff') : t('themeTipOn')) + '"><i aria-hidden="true"></i>' + t('themeLabel') + '</button>' +
    '<label><span class="sr">' + t('pickLabel') + '</span><select id="lgsel" aria-label="' + t('pickLabel') + '">' + opts + '</select></label>';
  $('#lgsel').addEventListener('change', function (e) { if (e.target.value) location.href = e.target.value; });
}

document.addEventListener('click', function (e) {
  var th = e.target.closest && e.target.closest('[data-theme-toggle]');
  if (th) {
    THEME_ON = !THEME_ON;
    try { localStorage.setItem('ldhml-theme', THEME_ON ? 'on' : 'off'); } catch (err) { /* ignore */ }
    render(true);
    return;
  }
  var b = e.target.closest && e.target.closest('[data-lang]');
  if (!b) return;
  lang = b.getAttribute('data-lang');
  try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ }
  render(true);
});
document.addEventListener('input', function (e) {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-q')) return;
  ui.q = e.target.value;
  var pos = e.target.selectionStart;
  render(true);
  var n = document.getElementById('pq');
  if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
});
window.addEventListener('hashchange', function () { render(false); });
/* Team logos (crests): show a logo once it has loaded; remove it if it fails, the team colour and code stay (same as the league pages). */
document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);

/* ---- fresher standings from the public API, one request at a time (section pages only) ---- */
function refreshStandings() {
  if (H.kind !== 'section' || typeof fetch !== 'function' || !window.LDParsers) return;
  var queue = H.leagues.slice(), failures = 0;
  function qs(l) {
    var q = new URLSearchParams();
    q.set('order', 'pts_tiebreak DESC'); q.set('group', 'team_id'); q.set('league_id', H.leagueId);
    q.set('filters[][league_id]', H.leagueId); q.set('filters[][season_id]', H.seasonId);
    q.set('category_id', l.categoryId); q.set('filters[][category_id]', l.categoryId);
    q.set('public_site', '1'); q.set('class', 'Standings');
    ['team_id', 'team_name', 'team_abb', 'team_pic', 'position', 'gp', 'wins_tot', 'losses', 'ot', 'ot_loss', 'pts', 'gf', 'ga', 'diff', 'pts_gp'].forEach(function (f) { q.append('fields[]', f); });
    q.set('page', '1');
    return q.toString();
  }
  function step() {
    if (document.hidden) { setTimeout(step, 4000); return; }
    var l = queue.shift();
    if (!l) return;
    fetch(API + '/table_data.php?' + qs(l)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      var rows = window.LDParsers.parseStandings(j);
      if (rows.length >= 2) {
        live[l.slug] = { played: Math.round(rows.reduce(function (a, r) { return a + r.gp; }, 0) / 2), top: rows.slice().sort(function (a, b) { return a.pos - b.pos; }).slice(0, 3) };
        var ex = $('.lcard[data-slug="' + l.slug + '"]');
        if (ex) ex.outerHTML = cardHtml(l);
      }
    }).catch(function () { failures++; }).then(function () { if (failures < 2) setTimeout(step, 1200); });
  }
  step();
}

render(true);
setTimeout(refreshStandings, 600);
