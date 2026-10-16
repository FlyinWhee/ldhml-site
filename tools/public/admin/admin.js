/* LDHML admin area. Talks to /api/admin/... (tools/src/admin-api.js). Plain JavaScript, no framework, fr/en.
 * Leagues and teams look and link like the stats site (shared/look.js: LDLook; docs/presentation.md).
 * Data of the current season: /data/season.json (built by build.mjs). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lang = 'fr';
  try { var sv = localStorage.getItem('ldhml-lang'); if (sv === 'fr' || sv === 'en') lang = sv; } catch (e) { /* storage can be blocked */ }

  var STR = {
    fr: {
      title: 'Administration', signIn: 'Connexion administrateur', emailLabel: 'Adresse courriel', sendCode: 'Recevoir un code',
      codeSent: 'Si cette adresse a un compte administrateur, un code vient d’être envoyé à {e}. Il expire dans 10 minutes.',
      codeLabel: 'Code à 6 chiffres', verify: 'Se connecter', otherEmail: 'Utiliser une autre adresse', devCode: 'Code (développement local) : {c}',
      signOut: 'Déconnexion', tabCaptains: 'Capitaines', tabSeasons: 'Saisons', tabAudit: 'Journal',
      season: 'Saison', noSeason: 'Créez d’abord une saison (onglet Saisons).',
      newCaptain: 'Nouveau capitaine', name: 'Nom', email: 'Courriel', player: 'Joueur (facultatif)',
      playerHint: 'Si le capitaine joue, choisissez son nom : son profil de joueur sera lié.', create: 'Créer',
      nCaptains: '{n} capitaines', nCaptain: '1 capitaine', noCaptains: 'Aucun capitaine pour le moment.', accessIn: 'Accès · {s}', noAccess: 'Aucun accès pour cette saison.',
      otherSeasons: '+{n} dans une autre saison', grant: 'Donner l’accès', league: 'Ligue', team: 'Équipe', chooseLeague: 'Ligue…', chooseTeam: 'Équipe…',
      revoke: 'Retirer l’accès', disable: 'Désactiver', enable: 'Réactiver', disabled: 'Désactivé', lastLogin: 'Dernière connexion : {d}', never: 'Jamais connecté',
      noData: 'Pas de données d’équipes pour cette saison. Les données des outils couvrent la saison {s}.', profile: 'Profil de joueur',
      seasons: 'Saisons', newSeason: 'Nouvelle saison', nbhpaId: 'No de saison NBHPA', status: 'Statut', st_upcoming: 'À venir', st_active: 'En cours', st_archived: 'Archivée',
      created: 'Créée', key: 'Clé', noSeasons: 'Aucune saison.', seasonHint: 'Chaque outil et chaque accès appartient à une saison. Le no NBHPA lie la saison aux statistiques.',
      audit: 'Journal des actions', when: 'Quand', who: 'Qui', what: 'Action', target: 'Cible', detail: 'Détail', auditNote: 'Les 100 dernières actions.', system: 'Système (script)',
      saved: 'Enregistré.', confirmRevoke: 'Retirer cet accès ?', confirmDisable: 'Désactiver ce capitaine ? Ses sessions seront fermées.', del: 'Supprimer', deleted: 'Supprimé.',
      confirmDeleteCap: 'Supprimer définitivement {n} ? Le compte, ses accès (toutes les saisons) et ses données personnelles dans le journal seront effacés. Impossible d’annuler.',
      confirmDeleteSeason: 'Supprimer la saison {n} ? Impossible d’annuler.', e_season_in_use: 'Des capitaines ont encore un accès actif dans cette saison. Retirez ces accès d’abord.',
      e_email: 'Adresse courriel invalide.', e_code: 'Code invalide ou expiré.', e_session: 'Votre session a expiré. Reconnectez-vous.',
      e_season: 'Saison invalide : un nom est requis, et le no NBHPA doit être un nombre.', e_season_exists: 'Cette saison existe déjà.',
      e_captain: 'Capitaine invalide : un nom et un courriel sont requis.', e_captain_exists: 'Un capitaine a déjà ce courriel.', e_access: 'Accès invalide.',
      e_no_season_data: 'Pas de données d’équipes pour cette saison.', e_team: 'Équipe introuvable.', e_access_exists: 'Ce capitaine a déjà cet accès.',
      e_server: 'Erreur du serveur. Réessayez.', e_origin: 'Requête refusée.', e_net: 'Le serveur ne répond pas.',
      lang: 'English', foot: 'Outils LDHML. Les courriels restent dans la base de données des outils, jamais sur le site public.'
    },
    en: {
      title: 'Administration', signIn: 'Admin sign-in', emailLabel: 'Email address', sendCode: 'Get a code',
      codeSent: 'If this address has an admin account, a code was just sent to {e}. It expires in 10 minutes.',
      codeLabel: '6-digit code', verify: 'Sign in', otherEmail: 'Use another address', devCode: 'Code (local development): {c}',
      signOut: 'Sign out', tabCaptains: 'Captains', tabSeasons: 'Seasons', tabAudit: 'Log',
      season: 'Season', noSeason: 'Create a season first (Seasons tab).',
      newCaptain: 'New captain', name: 'Name', email: 'Email', player: 'Player (optional)',
      playerHint: 'If the captain plays, pick their name: their player profile gets linked.', create: 'Create',
      nCaptains: '{n} captains', nCaptain: '1 captain', noCaptains: 'No captain yet.', accessIn: 'Access · {s}', noAccess: 'No access for this season.',
      otherSeasons: '+{n} in another season', grant: 'Give access', league: 'League', team: 'Team', chooseLeague: 'League…', chooseTeam: 'Team…',
      revoke: 'Remove access', disable: 'Disable', enable: 'Enable', disabled: 'Disabled', lastLogin: 'Last sign-in: {d}', never: 'Never signed in',
      noData: 'No team data for this season. The tools data covers the {s} season.', profile: 'Player profile',
      seasons: 'Seasons', newSeason: 'New season', nbhpaId: 'NBHPA season no.', status: 'Status', st_upcoming: 'Upcoming', st_active: 'Active', st_archived: 'Archived',
      created: 'Created', key: 'Key', noSeasons: 'No season.', seasonHint: 'Every tool and every access belongs to a season. The NBHPA no. links the season to the stats.',
      audit: 'Action log', when: 'When', who: 'Who', what: 'Action', target: 'Target', detail: 'Detail', auditNote: 'The last 100 actions.', system: 'System (script)',
      saved: 'Saved.', confirmRevoke: 'Remove this access?', confirmDisable: 'Disable this captain? Their sessions will be closed.', del: 'Delete', deleted: 'Deleted.',
      confirmDeleteCap: 'Delete {n} for good? The account, its access (every season) and its personal data in the log will be erased. This cannot be undone.',
      confirmDeleteSeason: 'Delete the {n} season? This cannot be undone.', e_season_in_use: 'Captains still have active access in this season. Remove that access first.',
      e_email: 'Invalid email address.', e_code: 'Invalid or expired code.', e_session: 'Your session expired. Sign in again.',
      e_season: 'Invalid season: a name is required, and the NBHPA no. must be a number.', e_season_exists: 'This season already exists.',
      e_captain: 'Invalid captain: a name and an email are required.', e_captain_exists: 'A captain already has this email.', e_access: 'Invalid access.',
      e_no_season_data: 'No team data for this season.', e_team: 'Team not found.', e_access_exists: 'This captain already has this access.',
      e_server: 'Server error. Try again.', e_origin: 'Request refused.', e_net: 'The server does not answer.',
      lang: 'Français', foot: 'LDHML tools. Emails stay in the tools database, never on the public site.'
    }
  };
  var t = function (k, v) { var s = STR[lang][k] != null ? STR[lang][k] : k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  /* state */
  var S = { me: null, step: 'email', email: '', devCode: '', msg: null, tab: 'captains', seasons: [], captains: [], audit: [], data: null, seasonId: null };

  function api(path, method, body) {
    return fetch('/api/admin' + path, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); },
        function () { return { ok: false, status: 0, data: { error: 'net' } }; });
  }
  var errMsg = function (r) { return t('e_' + ((r.data && r.data.error) || 'server')); };
  function say(kind, text) { S.msg = { kind: kind, text: text }; }

  /* stats data: leagues, teams, players (public) */
  var leagueOf = function (slug) { return S.data && S.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var site = function () { return (S.data && S.data.siteUrl) || '/'; };
  function accessBadge(a) {
    var l = leagueOf(a.league) || { slug: a.league, short: a.league, name: a.league, theme: 'default' };
    var home = site() + (l.sectionPath ? l.sectionPath + '/' + l.path + '/' : '');
    return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, {
      href: home, title: l.name, theme: l.theme, teams: [{ abb: a.team_abb, name: a.team_name, href: home + '#team-' + a.team_id }]
    });
  }
  var personName = function (id) { var p = S.data && S.data.people.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; };
  /* The player profile on the stats site (section of the first league the person plays in). */
  function personLink(id) {
    var p = S.data && S.data.people.filter(function (x) { return x.id === id; })[0];
    var l = p && leagueOf(Object.keys(p.lg)[0]);
    return l ? '<a class="lnk" href="' + esc(site() + l.sectionPath + '/#player-' + id) + '">' + esc(p.name) + '</a>' : esc(personName(id));
  }
  var fmt = function (sec) { return sec ? new Date(sec * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : ''; };

  /* ---------- views ---------- */
  function viewLogin() {
    var form = S.step === 'email'
      ? '<form id="f-email" class="ad-form ad-login"><label>' + t('emailLabel') + '<input class="ctl" type="email" name="email" autocomplete="email" required value="' + esc(S.email) + '"></label><button class="ad-btn" type="submit">' + t('sendCode') + '</button></form>'
      : '<p class="lede">' + esc(t('codeSent', { e: S.email })) + '</p>' + (S.devCode ? '<p class="note ad-dev">' + esc(t('devCode', { c: S.devCode })) + '</p>' : '') +
        '<form id="f-code" class="ad-form ad-login"><label>' + t('codeLabel') + '<input class="ctl" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="ad-btn" type="submit">' + t('verify') + '</button></form>' +
        '<p class="note"><button type="button" class="lnk ad-linkbtn" data-act="other-email">' + t('otherEmail') + '</button></p>';
    return '<h1 class="ph">' + t('signIn') + '</h1>' + form;
  }
  function seasonSelect() {
    if (!S.seasons.length) return '<p class="note">' + t('noSeason') + '</p>';
    return '<label class="ad-inline">' + t('season') + ' <select class="ctl" id="ad-season">' + S.seasons.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === S.seasonId ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(t('st_' + s.status)) + '</option>';
    }).join('') + '</select></label>';
  }
  function grantForm(c) {
    var s = S.seasons.filter(function (x) { return x.id === S.seasonId; })[0];
    if (!s) return '';
    if (!S.data || s.nbhpa_season_id !== S.data.seasonId) return '<p class="note">' + esc(t('noData', { s: S.data ? S.data.seasonName : '?' })) + '</p>';
    return '<form class="ad-grant" data-grant="' + c.id + '"><select class="ctl" name="league" aria-label="' + esc(t('league')) + '" required><option value="">' + t('chooseLeague') + '</option>' +
      S.data.leagues.map(function (l) { return '<option value="' + esc(l.slug) + '">' + esc(l.name) + '</option>'; }).join('') + '</select>' +
      '<select class="ctl" name="team" aria-label="' + esc(t('team')) + '" required disabled><option value="">' + t('chooseTeam') + '</option></select>' +
      '<button class="ad-btn ad-btn-sm" type="submit">' + t('grant') + '</button></form>';
  }
  function viewCaptains() {
    var seasonName = (S.seasons.filter(function (x) { return x.id === S.seasonId; })[0] || {}).name || '';
    var people = S.data ? S.data.people.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); }) : [];
    var rows = S.captains.map(function (c) {
      var mine = c.access.filter(function (a) { return a.season_id === S.seasonId; }), other = c.access.length - mine.length;
      var person = c.person_id ? '<div class="note">' + esc(t('profile')) + ' : ' + personLink(c.person_id) + ' (' + esc(c.person_id) + ')</div>' : '';
      return '<tr' + (c.disabled_at ? ' class="ad-off"' : '') + '><td><b>' + esc(c.name) + '</b>' + person + '<div class="note">' + esc(c.last_login_at ? t('lastLogin', { d: fmt(c.last_login_at) }) : t('never')) + '</div></td>' +
        '<td>' + esc(c.email) + (c.disabled_at ? ' <em class="subtag">' + t('disabled') + '</em>' : '') + '</td>' +
        '<td><div class="lgbs">' + (mine.length ? mine.map(function (a) { return '<span class="ad-acc">' + accessBadge(a) + '<button type="button" class="ad-x" data-revoke="' + a.id + '" title="' + esc(t('revoke')) + '" aria-label="' + esc(t('revoke')) + '">×</button></span>'; }).join('') : '<span class="note">' + t('noAccess') + '</span>') +
        (other ? ' <span class="note">' + esc(t('otherSeasons', { n: other })) + '</span>' : '') + '</div>' + (c.disabled_at ? '' : grantForm(c)) + '</td>' +
        '<td class="ad-acts"><button type="button" class="lnk ad-linkbtn" data-' + (c.disabled_at ? 'enable' : 'disable') + '="' + c.id + '">' + t(c.disabled_at ? 'enable' : 'disable') + '</button>' +
        '<button type="button" class="ad-del" data-delete-cap="' + c.id + '" data-name="' + esc(c.name) + '">' + t('del') + '</button></td></tr>';
    }).join('');
    return '<h1 class="ph">' + t('tabCaptains') + '</h1>' + seasonSelect() +
      '<section class="sec"><div class="sec-h"><h2>' + t('newCaptain') + '</h2></div><form id="f-cap" class="ad-form ad-row">' +
      '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80"></label>' +
      '<label>' + t('email') + '<input class="ctl" type="email" name="email" required></label>' +
      '<label>' + t('player') + '<input class="ctl" name="person" list="ad-people" autocomplete="off"></label>' +
      '<button class="ad-btn" type="submit">' + t('create') + '</button></form><p class="note">' + t('playerHint') + '</p>' +
      '<datalist id="ad-people">' + people.map(function (p) { return '<option value="' + esc(p.name + ' · ' + p.id) + '">'; }).join('') + '</datalist></section>' +
      '<section class="sec"><div class="sec-h"><h2>' + esc(S.captains.length === 1 ? t('nCaptain') : t('nCaptains', { n: S.captains.length })) + '</h2></div>' +
      (S.captains.length ? '<div class="tbl-wrap"><table class="tbl ad-tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('email') + '</th><th>' + esc(t('accessIn', { s: seasonName })) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">' + t('noCaptains') + '</p>') + '</section>';
  }
  function viewSeasons() {
    var d = S.data || {};
    var rows = S.seasons.map(function (s) { return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.key) + '</td><td class="num">' + esc(s.nbhpa_season_id || '') + '</td><td>' + esc(t('st_' + s.status)) + '</td><td>' + esc(fmt(s.created_at)) + '</td><td><button type="button" class="ad-del" data-delete-season="' + s.id + '" data-name="' + esc(s.name) + '">' + t('del') + '</button></td></tr>'; }).join('');
    return '<h1 class="ph">' + t('seasons') + '</h1><p class="lede">' + t('seasonHint') + '</p>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('newSeason') + '</h2></div><form id="f-season" class="ad-form ad-row">' +
      '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="60" value="' + esc(S.seasons.some(function (s) { return s.nbhpa_season_id === d.seasonId; }) ? '' : (d.seasonName || '')) + '"></label>' +
      '<label>' + t('nbhpaId') + '<input class="ctl" name="nbhpa" inputmode="numeric" value="' + esc(S.seasons.some(function (s) { return s.nbhpa_season_id === d.seasonId; }) ? '' : (d.seasonId || '')) + '"></label>' +
      '<label>' + t('status') + '<select class="ctl" name="status">' + ['active', 'upcoming', 'archived'].map(function (k) { return '<option value="' + k + '">' + t('st_' + k) + '</option>'; }).join('') + '</select></label>' +
      '<button class="ad-btn" type="submit">' + t('create') + '</button></form></section>' +
      '<section class="sec">' + (S.seasons.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('key') + '</th><th class="num">' + t('nbhpaId') + '</th><th>' + t('status') + '</th><th>' + t('created') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">' + t('noSeasons') + '</p>') + '</section>';
  }
  function viewAudit() {
    var rows = S.audit.map(function (a) { return '<tr><td>' + esc(fmt(a.at)) + '</td><td>' + esc(a.actor_name || (a.actor_kind === 'system' ? t('system') : a.actor_kind + ':' + a.actor_id)) + '</td><td><code>' + esc(a.action) + '</code></td><td>' + esc(a.target || '') + '</td><td class="ad-detail">' + esc(a.detail || '') + '</td></tr>'; }).join('');
    return '<h1 class="ph">' + t('audit') + '</h1><p class="lede">' + t('auditNote') + '</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('when') + '</th><th>' + t('who') + '</th><th>' + t('what') + '</th><th>' + t('target') + '</th><th>' + t('detail') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function render() {
    document.documentElement.lang = lang;
    var tabs = [['captains', t('tabCaptains')], ['seasons', t('tabSeasons')], ['audit', t('tabAudit')]];
    $('#top').innerHTML = '<div class="wrap top-in sec-top"><a class="brand" href="/admin/"><span><b>LDHML <i>Admin</i></b><small>' + esc(S.me ? S.me.email : t('title')) + '</small></span></a>' +
      (S.me ? '<nav class="nav" aria-label="Admin">' + tabs.map(function (x) { return '<a href="#' + x[0] + '"' + (S.tab === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>' : '') +
      '<div class="ad-tools"><button type="button" class="lgbtn" data-act="lang">' + t('lang') + '</button>' + (S.me ? '<button type="button" class="lgbtn" data-act="logout">' + t('signOut') + '</button>' : '') + '</div></div>';
    var msg = S.msg ? '<p class="ad-msg ad-' + S.msg.kind + '" role="' + (S.msg.kind === 'err' ? 'alert' : 'status') + '">' + esc(S.msg.text) + '</p>' : '';
    $('#main').innerHTML = msg + (!S.me ? viewLogin() : S.tab === 'seasons' ? viewSeasons() : S.tab === 'audit' ? viewAudit() : viewCaptains());
    $('#foot').innerHTML = '<p>' + t('foot') + '</p>';
    document.title = 'LDHML | ' + t('title');
  }

  /* ---------- data ---------- */
  function load() {
    return Promise.all([api('/seasons'), api('/captains'), S.tab === 'audit' ? api('/audit') : Promise.resolve(null)]).then(function (rs) {
      if (rs[0].status === 401) { S.me = null; S.step = 'email'; say('err', t('e_session')); return; }
      S.seasons = (rs[0].data.seasons || []);
      S.captains = (rs[1].data.captains || []);
      if (rs[2]) S.audit = rs[2].data.audit || [];
      if (!S.seasons.some(function (s) { return s.id === S.seasonId; })) {
        var cur = S.seasons.filter(function (s) { return S.data && s.nbhpa_season_id === S.data.seasonId; })[0] || S.seasons[0];
        S.seasonId = cur ? cur.id : null;
      }
    });
  }
  var refresh = function () { return load().then(render); };
  function done(r, okText) {
    if (r.ok) { say('ok', okText || t('saved')); return refresh(); }
    if (r.status === 401) { S.me = null; S.step = 'email'; }
    say('err', errMsg(r)); render();
  }

  /* ---------- events ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target; e.preventDefault();
    var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ''; };
    S.msg = null;
    if (f.id === 'f-email') {
      S.email = v('email');
      api('/login/start', 'POST', { email: S.email }).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.step = 'code'; S.devCode = r.data.devCode || ''; render();
        var c = $('#f-code input'); if (c) c.focus();
      });
    } else if (f.id === 'f-code') {
      api('/login/verify', 'POST', { email: S.email, code: v('code') }).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.me = r.data.admin; S.devCode = ''; S.msg = null; refresh();
      });
    } else if (f.id === 'f-cap') {
      var m = /L\d{4,}/.exec(v('person'));
      api('/captains', 'POST', { name: v('name'), email: v('email'), person_id: m ? m[0] : null }).then(function (r) { done(r); });
    } else if (f.id === 'f-season') {
      api('/seasons', 'POST', { name: v('name'), nbhpa_season_id: v('nbhpa'), status: v('status') }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-grant')) {
      api('/access', 'POST', { captain_id: Number(f.getAttribute('data-grant')), season_id: S.seasonId, league: v('league'), team_id: v('team') }).then(function (r) { done(r); });
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'ad-season') { S.seasonId = Number(el.value); S.msg = null; render(); return; }
    var f = el.closest && el.closest('[data-grant]');
    if (f && el.name === 'league') {
      var l = leagueOf(el.value), team = f.elements.team;
      team.innerHTML = '<option value="">' + t('chooseTeam') + '</option>' + (l ? l.teams.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); })
        .map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' (' + esc(x.abb) + ')</option>'; }).join('') : '');
      team.disabled = !l;
    }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act],[data-revoke],[data-disable],[data-enable],[data-delete-cap],[data-delete-season]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'lang') { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ } render(); return; }
    if (act === 'other-email') { S.step = 'email'; S.devCode = ''; S.msg = null; render(); return; }
    if (act === 'logout') { api('/logout', 'POST', {}).then(function () { S.me = null; S.step = 'email'; S.msg = null; render(); }); return; }
    if (b.hasAttribute('data-revoke')) { if (window.confirm(t('confirmRevoke'))) api('/access/' + b.getAttribute('data-revoke') + '/revoke', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-disable')) { if (window.confirm(t('confirmDisable'))) api('/captains/' + b.getAttribute('data-disable') + '/disable', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-delete-cap')) { if (window.confirm(t('confirmDeleteCap', { n: b.getAttribute('data-name') }))) api('/captains/' + b.getAttribute('data-delete-cap') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-delete-season')) { if (window.confirm(t('confirmDeleteSeason', { n: b.getAttribute('data-name') }))) api('/seasons/' + b.getAttribute('data-delete-season') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-enable')) api('/captains/' + b.getAttribute('data-enable') + '/enable', 'POST', {}).then(function (r) { done(r); });
  });
  window.addEventListener('hashchange', function () {
    var h = location.hash.replace('#', '');
    S.tab = ['captains', 'seasons', 'audit'].indexOf(h) >= 0 ? h : 'captains';
    S.msg = null;
    if (S.me) refresh(); else render();
  });

  /* ---------- start ---------- */
  var h0 = location.hash.replace('#', '');
  if (['captains', 'seasons', 'audit'].indexOf(h0) >= 0) S.tab = h0;
  Promise.all([fetch('/data/season.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), api('/me')]).then(function (rs) {
    S.data = rs[0];
    if (rs[1].ok) { S.me = rs[1].data.admin; return refresh(); }
    render();
  });
})();
