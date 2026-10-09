/* LDHML home page: one card per league. The numbers come from the snapshot built into the page.
 * When the page opens, the standings of each league are read again from the public API (6 requests, one at a time). */
var H = JSON.parse(document.getElementById('hub-data').textContent);
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
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
    of: 'sur', gp: 'MJ', noGames: 'Pas de match joué', pointsShort: 'pts', fresh: 'Classements à jour', goTonight: 'Voir en direct'
  },
  en: {
    title: 'LDHML', lead: 'Standings, schedules, box scores and stats for the ball hockey leagues, {s} season.',
    leagues: 'Leagues', teams: 'teams', games: 'games', played: 'games played', pts: 'PTS', lang: 'FR',
    leader: 'Leading', scorer: 'Top scorer', open: 'Open the league', night: 'Next game night', nights: 'Next game nights', tonight: 'Tonight',
    noNight: 'No upcoming games for now.', gm: 'game', gms: 'games', all: 'All leagues', pickLabel: 'League', themeLabel: 'Theme', themeTipOff: 'Switch off the league themes (default look)', themeTipOn: 'Switch the league themes on',
    footUpdated: 'Data of {t}', footSource: 'Unofficial preview. All numbers come from the public NBHPA league data.',
    of: 'of', gp: 'GP', noGames: 'No game played yet', pointsShort: 'pts', fresh: 'Standings are up to date', goTonight: 'Watch live'
  }
};
var t = function (k, v) { var s = (STR[lang][k] != null ? STR[lang][k] : k); Object.keys(v || {}).forEach(function (n) { s = s.replace('{' + n + '}', v[n]); }); return s; };
var season = function () { var s = H.season; return lang === 'fr' ? s : s.replace('Automne', 'Fall').replace('Hiver', 'Winter').replace('Été', 'Summer').replace('Printemps', 'Spring'); };

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

var BALL = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" style="fill:var(--mark-a)"/><path d="M6 11a15 15 0 0 1 10-7" fill="none" style="stroke:var(--mark-b)" stroke-width="2" stroke-linecap="round" opacity=".7"/><g fill="#0A1218"><circle cx="18" cy="8" r="2.1"/><circle cx="18" cy="28" r="2.1"/><circle cx="8" cy="18" r="2.1"/><circle cx="28" cy="18" r="2.1"/><circle cx="11" cy="11" r="2.1"/><circle cx="25" cy="11" r="2.1"/><circle cx="11" cy="25" r="2.1"/><circle cx="25" cy="25" r="2.1"/><circle cx="18" cy="18" r="2.1"/></g></svg>';

var live = {}; // slug -> fresher standings, once read from the API

function standingsOf(l) { return live[l.slug] || l.top; }
function playedOf(l) { return live[l.slug] ? live[l.slug].played : l.played; }

/* Next game date of each league, soonest first. */
function nextNights() {
  var td = today(), rows = [];
  H.leagues.forEach(function (l) {
    var up = l.upcoming.filter(function (g) { return g.date >= td; });
    if (!up.length) return;
    var date = up.map(function (g) { return g.date; }).sort()[0];
    var gs = up.filter(function (g) { return g.date === date; });
    rows.push({ l: l, date: date, n: gs.length, first: gs.map(function (g) { return g.time; }).sort()[0], isToday: date === td });
  });
  rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.l.name < b.l.name ? -1 : 1; });
  return rows;
}
var fmtShort = function (d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

function nightHtml() {
  var rows = nextNights();
  if (!rows.length) return '<p class="lede">' + t('noNight') + '</p>';
  return '<section class="night" aria-labelledby="nt"><h2 id="nt" class="night-h">' + (rows[0].isToday ? t('tonight') : t('nights')) + '</h2><ul class="night-l">' +
    rows.map(function (r) {
      return '<li class="lcard-mini" data-t="' + esc(themeOf(r.l)) + '"><a href="' + esc(r.l.slug) + '/#' + (r.isToday ? 'live' : 'schedule') + '"><i aria-hidden="true"></i><b>' + esc(r.l.short) + '</b><span>' +
        esc(r.isToday ? t('tonight') : fmtShort(r.date)) + ' · ' + r.n + ' ' + (r.n === 1 ? t('gm') : t('gms')) + ' · ' + esc(r.first) + '</span></a></li>';
    }).join('') + '</ul></section>';
}

function cardHtml(l) {
  var top = standingsOf(l), pl = playedOf(l);
  var pct = l.total ? Math.min(100, Math.round(pl / l.total * 100)) : 0;
  var rows = top.slice(0, 3).map(function (r, i) {
    return '<li><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(window.LDParsers.niceName(r.name)) + '</span><span class="rec">' + r.w + '-' + r.l + '-' + r.t + '</span><b>' + r.pts + '</b></li>';
  }).join('');
  return '<article class="lcard" data-slug="' + esc(l.slug) + '" data-t="' + esc(themeOf(l)) + '"><div class="lcard-head">' + (l.logo && H.logos && H.logos[l.logo] ? '<img class="mk-logo" src="' + H.logos[l.logo] + '" alt="" width="60" height="52">' : BALL) +
    '<h2><a class="lcard-link" href="' + esc(l.slug) + '/"><span>LDHML</span> <i>' + esc(l.short) + '</i></a></h2></div>' +
    '<p class="lcard-meta">' + l.teams + ' ' + t('teams') + ' · ' + pl + ' ' + t('of') + ' ' + l.total + ' ' + t('games') + '</p>' +
    '<div class="bar" role="img" aria-label="' + pl + ' / ' + l.total + '"><i style="width:' + pct + '%"></i></div>' +
    (pl ? '<ol class="lcard-top" aria-label="' + t('leader') + '">' + rows + '</ol>' : '<p class="lcard-none">' + t('noGames') + '</p>') +
    (l.scorer && pl ? '<p class="lcard-sc"><small>' + t('scorer') + '</small><span>' + esc(l.scorer.name) + '</span><b>' + l.scorer.p + ' ' + t('pointsShort') + '</b></p>' : '') +
    '</article>';
}

function render() {
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-league', 'default');
  $('#top').innerHTML = '';
  var langBtn = '<button class="lang hub-lang" type="button" data-lang="' + (lang === 'fr' ? 'en' : 'fr') + '" aria-label="' + (lang === 'fr' ? 'Switch to English' : 'Passer au français') + '">' + t('lang') + '</button>';
  var totals = H.leagues.reduce(function (a, l) { a.teams += l.teams; a.played += playedOf(l); a.total += l.total; return a; }, { teams: 0, played: 0, total: 0 });
  $('#main').innerHTML = '<div class="arena hero">' + langBtn + '<div class="wrap hub-hero">' +
    (H.logos && H.logos.hero ? '<img class="hero-logo" src="' + H.logos.hero + '" alt="" width="693" height="747">' : '') +
    '<div><h1' + (H.logos && H.logos.hero ? ' class="sr"' : '') + '>LDHML</h1><p class="sub">' + t('lead', { s: esc(season()) }) + '</p>' +
    '<ul class="hub-stats"><li><b>' + H.leagues.length + '</b><span>' + t('leagues') + '</span></li><li><b>' + totals.teams + '</b><span>' + t('teams') + '</span></li><li><b>' + totals.played + '</b><span>' + t('played') + '</span></li></ul></div></div></div>' +
    '<div class="wrap hub-body">' + nightHtml() + '<h2 class="hub-h">' + t('leagues') + '</h2><div class="lcards">' + H.leagues.map(cardHtml).join('') + '</div></div>';
  var stamp = H.leagues.reduce(function (m, l) { return l.fetchedAt > m ? l.fetchedAt : m; }, '');
  $('#foot').innerHTML = '<p>' + t('footSource') + '</p>';
  document.title = 'LDHML | ' + season();
  renderPicker();
}

function renderPicker() {
  var el = $('#picker');
  el.innerHTML = '<button type="button" class="thm" data-theme-toggle aria-pressed="' + THEME_ON + '" title="' + esc(THEME_ON ? t('themeTipOff') : t('themeTipOn')) + '"><i aria-hidden="true"></i>' + t('themeLabel') + '</button>' +
    '<label><span class="sr">' + t('pickLabel') + '</span><select id="lgsel" aria-label="' + t('pickLabel') + '"><option value="" selected>' + t('all') + '</option>' +
    H.leagues.map(function (l) { return '<option value="' + esc(l.slug) + '">' + esc(l.name) + '</option>'; }).join('') + '</select></label>';
  $('#lgsel').addEventListener('change', function (e) { if (e.target.value) location.href = e.target.value + '/'; });
}

document.addEventListener('click', function (e) {
  var th = e.target.closest && e.target.closest('[data-theme-toggle]');
  if (th) {
    THEME_ON = !THEME_ON;
    try { localStorage.setItem('ldhml-theme', THEME_ON ? 'on' : 'off'); } catch (err) { /* ignore */ }
    render();
    return;
  }
  var b = e.target.closest && e.target.closest('[data-lang]');
  if (!b) return;
  lang = b.getAttribute('data-lang');
  try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ }
  render();
});

/* ---- fresher standings from the public API, one request at a time ---- */
function refreshStandings() {
  if (typeof fetch !== 'function' || !window.LDParsers) return;
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

render();
setTimeout(refreshStandings, 600);
