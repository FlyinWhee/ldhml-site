/* LDHML captain area. Talks to /api/captain/... (tools/src/captain-api.js). Plain JavaScript, no framework, fr/en.
 * Straight to the point: after sign-in the captain lands on their team (most captains have one). A team switcher shows
 * only for a captain with several teams (the last one chosen is remembered in this browser). No sections, no setup.
 * The replacement builder (its own page: #remplacement) and the request cards are shared with the admin area (shared/builder.js). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lang = 'fr';
  try { var sv = localStorage.getItem('ldhml-lang'); if (sv === 'fr' || sv === 'en') lang = sv; } catch (e) { /* storage can be blocked */ }

  var STR = {
    fr: {
      title: 'Capitaine', signIn: 'Connexion capitaine', emailLabel: 'Votre adresse courriel', sendCode: 'Recevoir un code',
      codeSent: 'Si cette adresse a un compte de capitaine, un code vient d’être envoyé à {e}. Il expire dans 10 minutes.',
      codeLabel: 'Code à 6 chiffres', verify: 'Se connecter', otherEmail: 'Utiliser une autre adresse', devCode: 'Code (développement local) : {c}',
      signOut: 'Déconnexion', lang: 'English', ask: 'Déclarer un remplacement', askTitle: 'Déclarer un remplacement', back: '← Mon équipe',
      kNext: 'Prochain match', kReqs: 'À valider', kPay: 'Masse salariale', kRoster: 'Alignement', kPending: '{n} à valider', kApprovedUp: '{n} validé(s) à venir',
      kNoReq: 'Aucun remplacement ouvert', kNoGame: 'Aucun match à venir', kRegular: 'alignement régulier', kCounts: '{s} joueurs · {g} gardien(s)', kCapLeft: 'reste {v} sous le plafond',
      kOver: 'au-dessus du plafond de {v}', vsT: 'vs',
      st_pending: 'À valider', st_approved: 'Validé', st_refused: 'Refusé', langShort: 'EN', askGame: 'Remplacement…', gPend: '{n} à valider', gSt_approved: '{n} validé(s)', gSt_pending: '{n} à valider', gSt_refused: '{n} refusé(s)',
      sxM: 'H', sxF: 'F', nextTag: 'Prochain', myGames: 'Mes matchs et mes remplacements', pastReqs: 'Matchs passés avec des remplacements ({n})', noGames: 'Aucun match à venir pour votre équipe.',
      offSchedule: 'hors calendrier', hideReq: 'Masquer', hidden: 'Remplacement masqué.', gPay: 'masse {a} / {c}', gPayNoCap: 'masse {a}',
      gSum: '{s} J · {g} G', gSubs: '{n} remplaçant(s)', gAbs: '{n} absent(s)',
      myReqs: 'Mes remplacements', noReqs: 'Aucun remplacement pour le moment.', roster: 'Alignement', emptyRoster: 'L’alignement n’est pas encore entré.',
      payroll: 'Masse salariale : {v}', payrollCap: 'Masse salariale : {v} / plafond {c}', posS: 'Joueur', posG: 'Gardien',
      noTeams: 'Aucune équipe pour le moment. Un administrateur de la ligue doit vous donner l’accès à votre équipe.',
      sent: 'Remplacement déclaré. Un administrateur va le valider.', cancelReq: 'Annuler le remplacement', confirmCancel: 'Annuler ce remplacement ? Il sera supprimé.', cancelled: 'Remplacement annulé et supprimé.',
      older: 'Remplacements passés ({n})', season: 'Saison {s}',
demoTitle: 'Démo', demoLede: 'Version de démonstration, en lecture seule : on peut tout voir, rien ne se modifie.', demoKey: 'Clé de démo', demoEnter: 'Entrer',
      demoBanner: 'Démo · lecture seule : les changements sont refusés', e_demo_readonly: 'Démo : les changements sont désactivés.', e_demo_key: 'Clé de démo invalide.', demoPick: 'Capitaine (démo)', loading: 'Chargement…', close: 'Fermer', account: 'Compte',
      playersTitle: 'Joueurs de la section', playersLede: 'Tous les joueurs de la liste cette saison, pour trouver un remplaçant : leur rang NBHPA, leur salaire, leurs équipes. Les noms ouvrent leurs statistiques.',
      backTeam: '← Mon équipe', findPlayer: 'Trouver un remplaçant : les joueurs de la section →', filterName: 'Filtrer par nom', fAll: 'Tous', fAllPos: 'Toutes positions',
      stAll: 'Tous', stFree: 'Sans équipe', stSub: 'Remplaçants', stTeam: 'Avec équipe', teamsCol: 'Équipes', stPoolChip: 'inscrit, sans équipe', stSubChip: 'Remplaçant',
      league: 'Ligue', allLeagues: 'Toutes les ligues', colS: 'J$', colG: 'G$', from: 'de', to: 'à', rankFrom: 'Rang de', rankTo: 'à', rankCol: 'Rang', sexShort: 'Sexe', name: 'Nom',
      nPlayers: '{n} joueurs', noPlayersMatch: 'Aucun joueur ne correspond.', filters: 'Filtres', sexLabel: 'Sexe', posLabel: 'Position', stLabel: 'Statut', salLabel: 'Salaire ({s})', clearFilters: 'Effacer les filtres', showN: 'Voir {n} joueurs',
      rankNote: 'Rang NBHPA à la position : un plus petit nombre est plus fort (H8 > H12).', navTeam: 'Mon équipe', navAsk: 'Déclarer', navPlayers: 'Joueurs',
      shareTitle: 'Lien pour l’administration', shareLede: 'Envoyez-le dans le groupe des capitaines : un admin l’ouvre et valide le remplacement en un clic.',
      shareGo: 'Partager', shareCopy: 'Copier', shareCopied: 'Lien copié.', shareShort: 'Partager le lien', shareText: 'Remplacement à valider · {t}',
      e_email: 'Adresse courriel invalide.', e_code: 'Code invalide ou expiré.', e_session: 'Votre session a expiré. Reconnectez-vous.',
      e_not_open: 'Ce remplacement n’est plus ouvert.', e_server: 'Erreur du serveur. Réessayez.', e_net: 'Le serveur ne répond pas.', e_origin: 'Requête refusée.',
      foot: 'Outils LDHML. Besoin d’aide ? Écrivez à l’administration de votre ligue : elle peut aussi déclarer le remplacement pour vous.'
    },
    en: {
      title: 'Captain', signIn: 'Captain sign-in', emailLabel: 'Your email address', sendCode: 'Get a code',
      codeSent: 'If this address has a captain account, a code was just sent to {e}. It expires in 10 minutes.',
      codeLabel: '6-digit code', verify: 'Sign in', otherEmail: 'Use another address', devCode: 'Code (local development): {c}',
      signOut: 'Sign out', lang: 'Français', ask: 'Declare a replacement', askTitle: 'Declare a replacement', back: '← My team',
      kNext: 'Next game', kReqs: 'To validate', kPay: 'Payroll', kRoster: 'Roster', kPending: '{n} to validate', kApprovedUp: '{n} validated, upcoming',
      kNoReq: 'No open replacement', kNoGame: 'No upcoming game', kRegular: 'regular roster', kCounts: '{s} skaters · {g} goalie(s)', kCapLeft: '{v} left under the cap',
      kOver: 'over the cap by {v}', vsT: 'vs',
      st_pending: 'To validate', st_approved: 'Validated', st_refused: 'Refused', langShort: 'FR', askGame: 'Replacement…', gPend: '{n} to validate', gSt_approved: '{n} validated', gSt_pending: '{n} to validate', gSt_refused: '{n} refused',
      sxM: 'M', sxF: 'W', nextTag: 'Next', myGames: 'My games and replacements', pastReqs: 'Past games with replacements ({n})', noGames: 'No upcoming game for your team.',
      offSchedule: 'not in the schedule', hideReq: 'Hide', hidden: 'Replacement hidden.', gPay: 'payroll {a} / {c}', gPayNoCap: 'payroll {a}',
      gSum: '{s} S · {g} G', gSubs: '{n} replacement(s)', gAbs: '{n} absent',
      myReqs: 'My replacements', noReqs: 'No replacement yet.', roster: 'Roster', emptyRoster: 'The roster is not entered yet.',
      payroll: 'Payroll: {v}', payrollCap: 'Payroll: {v} / cap {c}', posS: 'Skater', posG: 'Goalie',
      noTeams: 'No team yet. A league admin must give you access to your team.',
      sent: 'Replacement declared. An admin will validate it.', cancelReq: 'Cancel the replacement', confirmCancel: 'Cancel this replacement? It will be deleted.', cancelled: 'Replacement cancelled and deleted.',
      older: 'Past replacements ({n})', season: '{s} season',
demoTitle: 'Demo', demoLede: 'Demo version, read only: you can see everything, nothing can be changed.', demoKey: 'Demo key', demoEnter: 'Enter',
      demoBanner: 'Demo · read only: changes are refused', e_demo_readonly: 'Demo: changes are turned off.', e_demo_key: 'Invalid demo key.', demoPick: 'Captain (demo)', loading: 'Loading…', close: 'Close', account: 'Account',
      playersTitle: 'Section players', playersLede: 'Every player on the list this season, to find a replacement: their NBHPA rank, salary and teams. Names open their stats.',
      backTeam: '← My team', findPlayer: 'Find a replacement: the section players →', filterName: 'Filter by name', fAll: 'All', fAllPos: 'All positions',
      stAll: 'All', stFree: 'No team', stSub: 'Replacements', stTeam: 'With a team', teamsCol: 'Teams', stPoolChip: 'signed up, no team', stSubChip: 'Replacement',
      league: 'League', allLeagues: 'All leagues', colS: 'S$', colG: 'G$', from: 'from', to: 'to', rankFrom: 'Rank from', rankTo: 'to', rankCol: 'Rank', sexShort: 'Sex', name: 'Name',
      nPlayers: '{n} players', noPlayersMatch: 'No player matches.', filters: 'Filters', sexLabel: 'Sex', posLabel: 'Position', stLabel: 'Status', salLabel: 'Salary ({s})', clearFilters: 'Clear filters', showN: 'Show {n} players',
      rankNote: 'NBHPA rank at the position: a lower number is stronger (H8 > H12).', navTeam: 'My team', navAsk: 'Declare', navPlayers: 'Players',
      shareTitle: 'Link for the admins', shareLede: 'Send it to the captains’ group: an admin opens it and validates the replacement in one click.',
      shareGo: 'Share', shareCopy: 'Copy', shareCopied: 'Link copied.', shareShort: 'Share the link', shareText: 'Replacement to validate · {t}',
      e_email: 'Invalid email address.', e_code: 'Invalid or expired code.', e_session: 'Your session expired. Sign in again.',
      e_not_open: 'This replacement is no longer open.', e_server: 'Server error. Try again.', e_net: 'The server does not answer.', e_origin: 'Request refused.',
      foot: 'LDHML tools. Need help? Write to your league’s admins: they can also declare the replacement for you.'
    }
  };
  var t = function (k, v) { var s = STR[lang][k] != null ? STR[lang][k] : k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  var S = { me: null, step: 'email', email: '', devCode: '', msg: null, data: null, teams: [], teamId: null, reqs: [], games: [], today: '', sub: null, flash: null, openGames: {},
    view: 'team', players: null, pf: { q: '', sex: '', pos: '', st: '', lg: '', smin: '', smax: '', rfrom: '', rto: '' }, ps: { k: 'name', d: 1 } };
  try { S.teamId = Number(localStorage.getItem('ldhml-captain-team')) || null; } catch (e) { /* ignore */ }

  function api(path, method, body) {
    return fetch('/api/captain' + path, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); },
        function () { return { ok: false, status: 0, data: { error: 'net' } }; });
  }
  var errMsg = function (r) { return t('e_' + ((r.data && r.data.error) || 'server')); };
  var say = function (kind, text) { S.msg = { kind: kind, text: text }; };
  var money = function (v) { return v == null ? '—' : (Math.round(v * 100) / 100) + 'M'; };   // salaries are in millions
  var team = function () { return S.teams.filter(function (x) { return x.id === S.teamId; })[0]; };
  var leagueOf = function (slug) { return S.data && S.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var home = function (l) { return ((S.data && S.data.siteUrl) || '/') + l.sectionPath + '/' + l.path + '/'; };
  var ctx = function () {
    return { lang: lang, data: S.data, api: api,
      onSaved: function (res) { S.flash = { kind: 'ok', text: t('sent') }; S.shared = res && res.status === 'pending' ? res.id : null; S.sub = null; location.hash = '#equipe'; },
      onCancel: function () { S.sub = null; location.hash = '#equipe'; } };
  };

  /* Team identity like the stats site: crest, full name (link to the team page), league badge. */
  function teamHead(tm) {
    var l = leagueOf(tm.league) || { slug: tm.league, teams: [] };
    var dt = (l.teams || []).filter(function (x) { return x.id === tm.nbhpa_team_id; })[0] || {};
    var name = tm.nbhpa_team_id && l.path ? '<a class="tl strong" href="' + esc(home(l) + '#team-' + tm.nbhpa_team_id) + '">' + esc(tm.name) + '</a>' : '<b>' + esc(tm.name) + '</b>';
    var badge = l.path ? window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { href: home(l), title: l.name, theme: l.theme }) : '';
    return '<span class="tcell">' + window.LDLook.crest({ abb: tm.abb, logo: tm.logo || dt.logo }, tm.league, '') + name + '</span>' + badge;
  }
  /* A player of the team: their page in THIS league (most detail); the section page when they have not played in it yet. */
  function person(tm, p) {
    var l = leagueOf(tm.league), dp = p.site_id && S.data && S.data.people.filter(function (x) { return x.id === p.site_id; })[0];
    if (!p.site_id || !l) return esc(p.name);
    var href = dp && dp.lg && dp.lg[l.slug] ? home(l) + '#player-' + p.site_id : ((S.data && S.data.siteUrl) || '/') + l.sectionPath + '/#player-' + p.site_id;
    return '<a class="lnk" href="' + esc(href) + '">' + esc(p.name) + '</a>';
  }

  /* ---------- views ---------- */
  function viewLogin() {
    if (S.booting) return '<p class="note">' + t('loading') + '</p>';   // the first answers are on their way
    // the online demo (no email yet): the demo key, then a captain picked from the list
    if (S.demoMode) return '<h1 class="ph">' + t('demoTitle') + '</h1><p class="lede">' + t('demoLede') + '</p>' + (!S.demoCaps
      ? '<form id="f-demo" class="ta-form ta-login"><label>' + t('demoKey') + '<input class="ctl" type="password" name="key" autocomplete="off" required></label><button class="ta-btn" type="submit">' + t('demoEnter') + '</button></form>'
      : '<form id="f-demo-pick" class="ta-form ta-login"><label>' + t('demoPick') + '<select class="ctl" name="captain" required>' + S.demoCaps.map(function (c) {
          return '<option value="' + c.id + '">' + esc(c.name + ' · ' + c.teams.map(function (x) { var l = S.data && S.data.leagues.filter(function (y) { return y.slug === x.league; })[0]; return (l ? l.short : x.league) + ' ' + x.abb; }).join(', ')) + '</option>';
        }).join('') + '</select></label><button class="ta-btn" type="submit">' + t('demoEnter') + '</button></form>');
    var form = S.step === 'email'
      ? '<form id="f-email" class="ta-form ta-login"><label>' + t('emailLabel') + '<input class="ctl" type="email" name="email" autocomplete="email" required value="' + esc(S.email) + '"></label><button class="ta-btn" type="submit">' + t('sendCode') + '</button></form>'
      : '<p class="lede">' + esc(t('codeSent', { e: S.email })) + '</p>' + (S.devCode ? '<p class="note ta-dev">' + esc(t('devCode', { c: S.devCode })) + '</p>' : '') +
        '<form id="f-code" class="ta-form ta-login"><label>' + t('codeLabel') + '<input class="ctl" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="ta-btn" type="submit">' + t('verify') + '</button></form>' +
        '<p class="note"><button type="button" class="lnk ta-linkbtn" data-act="other-email">' + t('otherEmail') + '</button></p>';
    return '<h1 class="ph">' + t('signIn') + '</h1>' + form;
  }
  function switcher() {
    if (S.teams.length < 2) return '';
    return '<div class="cp-switch" role="group">' + S.teams.map(function (x) {
      var l = leagueOf(x.league) || {};
      return '<button type="button" data-team="' + x.id + '" aria-pressed="' + (x.id === S.teamId) + '" title="' + esc(x.name + (l.name ? ' · ' + l.name : '')) + '">' +
        window.LDLook.crest({ abb: x.abb }, x.league, 'sm') + esc(x.name) + (l.short ? ' <span class="note">' + esc(l.short) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  /* ---------- the captain dashboard ----------
   * Top: the team and the main action. Then four key numbers (next game, requests, payroll, roster). Then two columns:
   * the timeline (the team's games, each with its requests: the work in its context) and the roster. One column on a phone. */
  /* After a request: the link the admins open to validate it, to share in the captains' group (or copy). */
  var shareUrl = function (id) { return location.origin + '/admin/#/r/' + id; };
  function sharePanel() {
    if (!S.shared) return '';
    return '<section class="ta-panel cp-share"><h2 class="ta-ph">' + t('shareTitle') + '</h2><p class="note">' + t('shareLede') + '</p>' +
      '<p class="cp-share-row"><input class="ctl" readonly value="' + esc(shareUrl(S.shared)) + '" aria-label="' + esc(t('shareTitle')) + '" id="cp-share-url">' +
      (navigator.share ? '<button type="button" class="ta-btn ta-btn-sm" data-share-go="' + S.shared + '">' + t('shareGo') + '</button>' : '') +
      '<button type="button" class="ta-btn ta-btn-sm ta-ghost" data-share-copy="' + S.shared + '">' + t('shareCopy') + '</button>' +
      '<button type="button" class="ta-x" data-share-close aria-label="' + esc(t('close')) + '">×</button></p></section>';
  }
  /* The link of a request in a small box: a link icon, the address (a tap selects it), copy, and share on a phone. */
  var LINK_I = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  var COPY_I = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
  var SHARE_I = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
  function linkBox(id) {
    return '<span class="cp-link" title="' + esc(t('shareTitle')) + '">' + LINK_I + '<input class="cp-link-url" readonly data-select value="' + esc(shareUrl(id)) + '" aria-label="' + esc(t('shareTitle')) + '">' +
      '<button type="button" class="cp-link-b" data-share-copy="' + id + '" title="' + esc(t('shareCopy')) + '" aria-label="' + esc(t('shareCopy')) + '">' + COPY_I + '</button>' +
      (navigator.share ? '<button type="button" class="cp-link-b" data-share-go="' + id + '" title="' + esc(t('shareGo')) + '" aria-label="' + esc(t('shareGo')) + '">' + SHARE_I + '</button>' : '') + '</span>';
  }
  /* Share (the phone's share sheet: Messenger, SMS…) or copy the link of a request. */
  function shareReq(id, copyOnly) {
    var url = shareUrl(id), tm = team(), text = t('shareText', { t: tm ? tm.name : '' });
    if (!copyOnly && navigator.share) { navigator.share({ title: text, text: text, url: url }).catch(function () { /* closed by the user */ }); return; }
    var done = function () { say('ok', t('shareCopied')); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { S.shared = id; render(); });
    else { S.shared = id; render(); }
  }
  function viewTeam() {
    var tm = team();
    if (!tm) return '<h1 class="ph">' + t('title') + '</h1><p class="lede">' + t('noTeams') + '</p>';
    var reqs = S.reqs.filter(function (q) { return q.team.id === tm.id; });
    var hero = '<div class="cp-hero"><div class="cp-team">' + teamHead(tm) + '<span class="note">' + esc(t('season', { s: tm.season_name })) + '</span></div>' +
      '<p class="cp-ask"><button type="button" class="ta-btn" data-act="ask">' + t('ask') + '</button></p></div>';
    return switcher() + sharePanel() + hero + kpis(tm, reqs) + '<div class="cp-grid"><div class="cp-col">' + timeline(tm, reqs) + '</div><div class="cp-col">' + rosterPanel(tm) + '</div></div>';
  }
  /* The two key numbers (owner: the others were noise): the next game, with what is declared for it, and the payroll. */
  function kpis(tm, reqs) {
    var tile = function (cls, label, value, sub) { return '<div class="cp-kpi ' + cls + '"><span class="cp-kl">' + esc(label) + '</span><span class="cp-kv">' + value + '</span>' + (sub ? '<span class="cp-ks">' + sub + '</span>' : '') + '</div>'; };
    var next = S.games.filter(function (g) { return g.game.date >= S.today; })[0], nextV, nextS;
    if (next) {
      var l = leagueOf(tm.league) || { teams: [] }, dOpp = (l.teams || []).filter(function (x) { return next.opp.nbhpa_team_id && x.id === next.opp.nbhpa_team_id; })[0] || {};
      var opp = { abb: next.opp.abb, logo: next.opp.logo || dOpp.logo };   // the opponent: our team (its logo, else the stats data's)
      nextV = esc(window.LDBuilder.day(ctx(), next.game.date)) + (next.game.time ? ' <small>' + esc(next.game.time) + '</small>' : '');
      var lu = next.lineup;
      nextS = esc(t('vsT')) + ' ' + window.LDLook.crest({ abb: opp.abb, logo: opp.logo }, tm.league, 'sm') + '<b title="' + esc(next.opp.name) + '">' + esc(next.opp.abb) + '</b> · ' +
        esc(lu.subs.length ? t('gSubs', { n: lu.subs.length }) : t('kRegular'));
      var nextPend = reqs.filter(function (q) { return q.status === 'pending' && (q.game_ref ? q.game_ref === next.game.id : q.game_date === next.game.date); }).length;
      if (nextPend) nextS += ' · ' + esc(t('gPend', { n: nextPend }));
    } else { nextV = '—'; nextS = esc(t('kNoGame')); }
    var pending = reqs.filter(function (q) { return q.status === 'pending'; }).length, approvedUp = reqs.filter(function (q) { return q.status === 'approved' && q.game_date >= S.today; }).length;
    var total = 0, cap = tm.rules && tm.rules.salary_cap != null ? tm.rules.salary_cap : null;
    tm.roster.forEach(function (r) { total += r.salary || 0; });
    var payS = '';
    if (cap != null) {
      var pct = Math.max(0, Math.min(100, Math.round(total / cap * 100)));
      payS = '<span class="cp-bar' + (total > cap ? ' cp-over' : '') + '" role="img" aria-label="' + pct + ' %"><i style="width:' + pct + '%"></i></span>' +
        esc(total > cap ? t('kOver', { v: money(total - cap) }) : t('kCapLeft', { v: money(cap - total) }));
    }
    var nS = tm.roster.filter(function (r) { return r.pos === 's'; }).length, nG = tm.roster.length - nS;
    return '<div class="cp-kpis">' +
      tile('cp-k-next', t('kNext'), nextV, nextS) +
      tile('cp-k-pay', t('kPay'), esc(money(total)) + (cap != null ? ' <small>/ ' + esc(money(cap)) + '</small>' : ''), payS) + '</div>';
  }
  /* The timeline: one line per game of the team (the next one marked), its requests under it (compact, without the game
   * again), and the night's counts and payroll when something changes. A request for a date typed by hand gets its own line.
   * Past games show only when they had requests, in a fold. Refused requests can be hidden; open ones cancelled. */
  var gameLine = function (tm, x) { return window.LDBuilder.gameText(ctx(), { date: x.game.date, time: x.game.time, venue: x.game.venue, court: x.game.court, home: x.home, opp: x.opp }); };
  function timeline(tm, reqs) {
    var byGame = {}, ids = {}, rows = [];
    S.games.forEach(function (x) { ids[x.game.id] = 1; });
    reqs.forEach(function (q) { var k = q.game_ref && ids[q.game_ref] ? q.game_ref : 'd:' + q.game_date + ':' + (q.game_time || ''); (byGame[k] = byGame[k] || []).push(q); });
    S.games.forEach(function (x) { rows.push({ date: x.game.date, time: x.game.time || '', x: x, reqs: byGame[x.game.id] || [] }); });
    Object.keys(byGame).filter(function (k) { return k.indexOf('d:') === 0; }).forEach(function (k) {
      var q = byGame[k][0]; rows.push({ date: q.game_date, time: q.game_time || '', x: null, reqs: byGame[k], label: window.LDBuilder.day(ctx(), q.game_date) + (q.game_time ? ' · ' + q.game_time : '') + ' · ' + t('offSchedule') });
    });
    rows.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    var up = rows.filter(function (r) { return r.date >= S.today; }), past = rows.filter(function (r) { return r.date < S.today && r.reqs.length; }).reverse();
    var actions = function (q) {
      var a = [];
      if (q.status === 'pending') a.push(linkBox(q.id));   // still to validate: its link for the admins, shown, to copy or share
      if ((q.status === 'pending' || q.status === 'approved') && q.game_date >= S.today) a.push('<button type="button" class="lnk ta-linkbtn" data-cancel="' + q.id + '">' + t('cancelReq') + '</button>');
      if (q.status === 'refused') a.push('<button type="button" class="lnk ta-linkbtn" data-hide="' + q.id + '">' + t('hideReq') + '</button>');
      return a.length ? '<div class="bd-acts">' + a.join('') + '</div>' : '';
    };
    var row = function (r, i) {
      var lu = r.x && r.x.lineup, changed = lu && (lu.subs.length || lu.absents.length), next = i === 0 && r.date >= S.today, upcoming = r.date >= S.today;
      var n = { approved: 0, pending: 0, refused: 0 }; r.reqs.forEach(function (q) { n[q.status] = (n[q.status] || 0) + 1; });
      var chips = ['approved', 'pending', 'refused'].filter(function (k) { return n[k]; }).map(function (k) { return '<span class="cp-st cp-st-' + k + '">' + esc(t('gSt_' + k, { n: n[k] })) + '</span>'; }).join('');
      var sum = changed ? '<p class="note cp-gsum">' + esc(t('gSum', lu.counts) + ' · ' + (lu.payroll.cap != null ? t('gPay', { a: money(lu.payroll.after), c: money(lu.payroll.cap) }) : t('gPayNoCap', { a: money(lu.payroll.after) }))) + '</p>' : '';
      var ask = upcoming && r.x ? '<button type="button" class="ta-btn ta-btn-sm cp-ask-g" data-ask-game="' + esc(r.x.game.id) + '">' + t('askGame') + '</button>' : '';
      var line = '<span class="cp-gt"><b>' + esc(r.x ? gameLine(tm, r.x) : r.label) + '</b>' + (next ? ' <span class="cp-tag">' + t('nextTag') + '</span>' : '') + '</span><span class="cp-gchips">' + chips + '</span>' + ask;
      if (!r.reqs.length) return '<li class="cp-game' + (next ? ' cp-nextg' : '') + '"><div class="cp-gl">' + line + '</div></li>';
      /* folded, the game still shows each replacement on one line: absent → replacement, with a status dot */
      var slim = '<ul class="cp-slim">' + r.reqs.map(function (q) { return q.lines.map(function (l) {
        return '<li class="cp-st-' + q.status + '"><i aria-hidden="true"></i>' + esc(l.absent_name) + ' <span aria-hidden="true">→</span> <b>' + esc(l.sub_name) + '</b><span class="cp-sr"> · ' + esc(t('st_' + q.status)) + '</span></li>'; }).join(''); }).join('') + '</ul>';
      return '<li class="cp-game cp-has-subs' + (next ? ' cp-nextg' : '') + '"><details' + (S.openGames[r.x ? r.x.game.id : r.date] ? ' open' : '') + ' data-game-key="' + esc(r.x ? r.x.game.id : r.date) + '"><summary><span class="cp-gl">' + line + '</span>' + slim + '</summary>' + sum +
        '<div class="bd-reqs">' + r.reqs.map(function (q) { return window.LDBuilder.requestCard(q, ctx(), actions(q), { team: false, game: false, result: q.status === 'pending' }); }).join('') + '</div></details></li>';
    };
    return '<section class="cp-panel cp-tl"><h2 class="cp-ph">' + t('myGames') + '</h2>' +
      (up.length ? '<ul class="cp-games">' + up.map(row).join('') + '</ul>' : '<p class="note">' + t('noGames') + '</p>') +
      (past.length ? '<details class="ta-add"><summary>' + esc(t('pastReqs', { n: past.length })) + '</summary><ul class="cp-games">' + past.map(function (r) { return row(r, -1); }).join('') + '</ul></details>' : '') + '</section>';
  }
  /* ---------- #joueurs: the section's players, to find a replacement ----------
   * Everyone on the section list this season: sex, NBHPA rank (at the position), salaries, teams in the section's
   * leagues, and their status (on a team, signed up with no team, or a replacement player). Filters and sorting. */
  var rankOf = function (p) { var dp = p.site_id && S.data && S.data.people.filter(function (x) { return x.id === p.site_id; })[0]; return (dp && dp.rank) || {}; };
  var numOf = function (v) { return v === '' || v == null || isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')); };
  function viewPlayers() {
    var tm = team(), f = S.pf, R = window.LDRanks && window.LDRanks.nbhpa;
    var lgs = S.data ? S.data.leagues.filter(function (l) { return tm && l.section === (S.data.leagues.filter(function (x) { return x.slug === tm.league; })[0] || {}).section; }) : [];
    var head = '<p class="ta-back"><a class="lnk" href="#equipe">' + t('backTeam') + '</a></p><h1 class="ph">' + t('playersTitle') + '</h1><p class="lede">' + t('playersLede') + '</p>';
    if (!S.players) return head + '<p class="note">' + t('loading') + '</p>';
    var pos = f.pos === 'g' ? 'g' : 's';   // the position the rank and the salary are read at
    var mineR = function (p) { return p.rosters; };   // the teams in this section (the server sends no other)
    var isG = function (p) { var rs = mineR(p); return rs.some(function (r) { return r.pos === 'g'; }) || (!rs.length && rankOf(p).g && !rankOf(p).s); };
    var stOf = function (p) { return mineR(p).length ? 'team' : 'free'; };
    var smin = numOf(f.smin), smax = numOf(f.smax);
    var list = S.players.filter(function (p) {
      var sal = pos === 'g' ? p.salary_g : p.salary_s, rk = rankOf(p)[pos];
      return (!f.q || p.name.toLowerCase().indexOf(f.q.trim().toLowerCase()) >= 0) && (!f.sex || p.sex === f.sex) &&
        (!f.pos || (f.pos === 'g' ? isG(p) : !isG(p) || mineR(p).some(function (r) { return r.pos === 's'; }))) &&
        (!f.st || stOf(p) === f.st) && (!f.lg || mineR(p).some(function (r) { return r.league === f.lg; })) &&
        (smin == null || (sal != null && sal >= smin)) && (smax == null || (sal != null && sal <= smax)) &&
        (!(f.rfrom || f.rto) || (R && R.inRange(rk, f.rfrom, f.rto)));
    });
    var key = { name: function (p) { return p.name.toLowerCase(); }, sal: function (p) { return pos === 'g' ? p.salary_g : p.salary_s; },
      rank: function (p) { var k = R && R.key(rankOf(p)[pos]); return k ? k.g * 1000 + k.s : null; } }[S.ps.k] || function (p) { return p.name; };
    list.sort(function (a, b) { var x = key(a), y = key(b); if (x == null && y == null) return a.name.localeCompare(b.name, 'fr'); if (x == null) return 1; if (y == null) return -1; return (x < y ? -S.ps.d : x > y ? S.ps.d : 0) || a.name.localeCompare(b.name, 'fr'); });
    var seg = function (attr, cur, opts) { return '<div class="seg" role="group">' + opts.map(function (o) { return '<button type="button" ' + attr + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; };
    var ranks = R ? R.sort(Object.keys(S.players.reduce(function (a, p) { var r = rankOf(p)[pos]; if (r && R.key(r)) a[r] = 1; return a; }, {}))) : [];
    /* The same filter component as the stats site's player list (site/hub: .fbar, .fpanel): inline on a computer (the
     * salary and the rank on a second line), a side panel on a phone ("Filtres" button, labelled groups, "Voir N joueurs"). */
    var grp = function (label, html) { return '<div class="fp-grp"><span class="fp-lbl">' + esc(label) + '</span>' + html + '</div>'; };
    var active = [f.sex, f.pos, f.st, f.lg, f.smin || f.smax, f.rfrom || f.rto].filter(Boolean).length, any = active || f.q;
    var salTag = pos === 'g' ? t('colG') : t('colS');
    var rsel = function (k, label) { return '<select class="ctl" data-cpf="' + k + '" aria-label="' + esc(label) + '"><option value="">' + esc(label) + '</option>' + ranks.map(function (r) { return '<option' + (f[k] === r ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>'; };
    var filters = '<div class="controls fbar cp-fbar' + (S.fpanel ? ' fp-on' : '') + '"><input id="cp-pq" class="ctl" type="search" data-cpf="q" placeholder="' + esc(t('filterName')) + '" value="' + esc(f.q) + '" aria-label="' + esc(t('filterName')) + '" autocomplete="off">' +
      '<button type="button" class="fbtn" data-fpanel aria-expanded="' + !!S.fpanel + '" aria-controls="fpanel">' + t('filters') + (active ? ' <b>' + active + '</b>' : '') + '</button>' +
      '<div class="fp-back" data-fpanel-close></div><div class="fpanel" id="fpanel" role="dialog" aria-label="' + esc(t('filters')) + '"><div class="fp-head"><b>' + t('filters') + '</b><button type="button" class="fp-x" data-fpanel-close aria-label="' + esc(t('close')) + '">×</button></div>' +
      grp(t('sexLabel'), seg('data-cpsex', f.sex, [['', t('fAll')], ['m', t('sxM')], ['f', t('sxF')]])) +
      grp(t('posLabel'), seg('data-cppos', f.pos, [['', t('fAllPos')], ['s', t('posS')], ['g', t('posG')]])) +
      grp(t('stLabel'), seg('data-cpst', f.st, [['', t('stAll')], ['free', t('stFree')], ['team', t('stTeam')]])) +
      '<span class="cp-break" aria-hidden="true"></span>' +
      (lgs.length > 1 ? grp(t('league'), '<select class="ctl" data-cplg aria-label="' + esc(t('league')) + '"><option value="">' + esc(t('allLeagues')) + '</option>' + lgs.map(function (l) { return '<option value="' + esc(l.slug) + '"' + (f.lg === l.slug ? ' selected' : '') + '>' + esc(l.short) + '</option>'; }).join('') + '</select>') : '') +
      grp(t('salLabel', { s: salTag }), '<span class="rk-range"><span class="rk-l">' + esc(salTag) + '</span><input id="cp-smin" class="ctl ta-xs" data-cpf="smin" inputmode="decimal" placeholder="' + esc(t('from')) + '" value="' + esc(f.smin) + '" aria-label="' + esc(salTag + ' ' + t('from')) + '">' +
        '<input id="cp-smax" class="ctl ta-xs" data-cpf="smax" inputmode="decimal" placeholder="' + esc(t('to')) + '" value="' + esc(f.smax) + '" aria-label="' + esc(salTag + ' ' + t('to')) + '"></span>') +
      (ranks.length ? grp(t('rankCol'), '<span class="rk-range"><span class="rk-l">' + t('rankCol') + '</span>' + rsel('rfrom', t('rankFrom')) + rsel('rto', t('rankTo')) + '</span><p class="fp-note">' + esc(t('rankNote')) + '</p>') : '') +
      (any ? '<button type="button" class="lnk clearf clearf-d" data-fclear>' + t('clearFilters') + '</button>' : '') +
      '<div class="fp-foot"><button type="button" class="lnk clearf" data-fclear' + (any ? '' : ' disabled') + '>' + t('clearFilters') + '</button><button type="button" class="fp-go" data-fpanel-close>' + esc(t('showN', { n: list.length })) + '</button></div>' +
      '</div></div>';
    var site = (S.data && S.data.siteUrl) || '/', secPath = (S.data && S.data.sections || []).filter(function (s) { return lgs[0] && s.key === lgs[0].section; }).map(function (s) { return s.path; })[0] || '';
    var rows = list.map(function (p) {
      var rk = rankOf(p)[pos], sal = pos === 'g' ? p.salary_g : p.salary_s, st = stOf(p);
      var name = p.site_id ? '<a class="lnk" href="' + esc(site + secPath + '/#player-' + p.site_id) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' : esc(p.name);
      var teams = p.rosters.map(function (r) { var l = lgs.filter(function (x) { return x.slug === r.league; })[0] || { slug: r.league, short: r.league, name: r.league, theme: 'default' };
        return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { theme: l.theme, teams: [{ abb: r.abb, name: r.name }] }); }).join('');
      return '<tr><td><b>' + name + '</b><div class="cp-pl-sub lgbs cp-m-only">' + teams + '</div></td><td class="cp-pl-teams"><div class="lgbs">' + teams + '</div></td>' +
        '<td class="cp-sx">' + esc(p.sex === 'f' ? t('sxF') : p.sex === 'm' ? t('sxM') : '—') + '</td><td class="num">' + esc(rk || '—') + '</td><td class="num">' + esc(money(sal)) + '</td></tr>';
    }).join('');
    var sh = function (k, label, cls) { var on = S.ps.k === k; return '<th' + (cls ? ' class="' + cls + '"' : '') + '><button type="button" class="cp-sort" data-cpsort="' + k + '">' + esc(label) + (on ? (S.ps.d > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; };
    return head + filters + '<p class="note">' + esc(t('nPlayers', { n: list.length })) + '</p>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl cp-players"><thead><tr>' + sh('name', t('name')) + '<th class="cp-pl-teams">' + t('teamsCol') + '</th><th>' + t('sexShort') + '</th>' + sh('rank', t('rankCol'), 'num') + sh('sal', pos === 'g' ? t('colG') : t('colS'), 'num') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty">' + t('noPlayersMatch') + '</p>');
  }
  function rosterPanel(tm) {
    var rows = window.LDBuilder.rosterOrder(tm.roster, function (r) { return r.salary; }).map(function (r) {
      return '<tr><td>' + person(tm, r) + '</td><td class="cp-sx">' + esc(r.sex === 'f' ? t('sxF') : r.sex === 'm' ? t('sxM') : '—') + '</td><td>' + esc(r.pos === 'g' ? t('posG') : t('posS')) + '</td><td class="num">' + esc(money(r.salary)) + '</td></tr>'; }).join('');
    return '<section class="cp-panel cp-roster"><h2 class="cp-ph">' + t('roster') + '</h2>' +
      (rows ? '<table class="tbl ta-roster"><tbody>' + rows + '</tbody></table>' : '<p class="note">' + t('emptyRoster') + '</p>') +
      (tm.rules && tm.rules.notes ? '<p class="note">' + esc(tm.rules.notes) + '</p>' : '') + '</section>';
  }
  /* The builder page (#remplacement[/<game id>]): the team, then the guided steps (a game chosen beforehand starts at step 2). */
  function viewAsk() {
    return '<p class="ta-back"><a class="lnk" href="#equipe">' + t('back') + '</a></p><h1 class="ph">' + t('askTitle') + '</h1><div class="bd-page" id="cp-builder"></div>';
  }
  /* The online demo: a slim bar fixed at the bottom, always visible (before and after sign-in). */
  function demoBar(on) {
    var bar = document.getElementById('ta-demobar');
    document.documentElement.classList.toggle('ta-demo', !!on);
    if (!on) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'ta-demobar'; bar.className = 'ta-demobar'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
    bar.textContent = t('demoBanner');
  }
  /* The account menu (top bar): who is signed in, the language, sign out. Rarely used: one small button, not three. */
  var ACCT_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.8-3.8 3.6-5.8 7.2-5.8s6.4 2 7.2 5.8"/></svg>';
  function acctMenu(who) {
    return '<details class="ta-acct" id="ta-acct"><summary class="ta-acct-btn" aria-label="' + esc(t('account')) + '" title="' + esc(t('account')) + '">' + ACCT_ICON + '</summary><div class="ta-acct-pop">' +
      (who ? '<p class="ta-acct-who">' + esc(who) + '</p>' : '') +
      '<button type="button" class="ta-acct-i" data-act="lang">' + esc(t('lang')) + '</button>' +
      (S.me ? '<button type="button" class="ta-acct-i" data-act="logout">' + esc(t('signOut')) + '</button>' : '') + '</div></details>';
  }
  document.addEventListener('click', function (e) { var m = document.getElementById('ta-acct'); if (m && m.open && !(e.target.closest && e.target.closest('#ta-acct'))) m.open = false; }, true);
  document.addEventListener('keydown', function (e) { var m = document.getElementById('ta-acct'); if (e.key === 'Escape' && m) m.open = false; });
  /* The captain's pages: Mon équipe, Joueurs (the section players). Declaring has its big button on the team page (owner). */
  var NAV_ICON = { team: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>', ask: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', players: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>' };
  var navIcon = function (k) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + NAV_ICON[k] + '</svg>'; };
  function navItems() {
    var cur = S.view === 'players' && !S.sub ? 'players' : 'team';
    return [['team', '#equipe', t('navTeam')], ['players', '#joueurs', t('navPlayers')]].map(function (x) { return { k: x[0], href: x[1], label: x[2], on: cur === x[0] }; });
  }
  function render() {
    document.documentElement.lang = lang;
    var items = S.me && team() ? navItems() : [], bar = $('#tabbar');
    document.documentElement.classList.toggle('ta-has-tabbar', items.length > 0);
    document.documentElement.classList.toggle('fp-open', !!(S.fpanel && S.view === 'players'));
    if (bar) bar.innerHTML = items.map(function (x) { return '<a href="' + x.href + '"' + (x.on ? ' aria-current="page"' : '') + '>' + navIcon(x.k) + '<span>' + esc(x.label) + '</span></a>'; }).join('');
    $('#top').innerHTML = '<div class="wrap top-in sec-top"><a class="brand" href="/captain/"><span><b>LDHML <i>' + esc(t('title')) + '</i></b></span></a>' +
      (items.length ? '<nav class="nav" aria-label="' + esc(t('title')) + '">' + items.map(function (x) { return '<a href="' + x.href + '"' + (x.on ? ' aria-current="page"' : '') + '>' + esc(x.label) + '</a>'; }).join('') + '</nav>' : '') +
      '<div class="ta-tools">' + acctMenu(S.me ? S.me.name : '') + '</div></div>';
    var msg = S.msg ? '<p class="ta-msg ta-' + S.msg.kind + '" role="' + (S.msg.kind === 'err' ? 'alert' : 'status') + '">' + esc(S.msg.text) + '</p>' : '';
    var asking = S.me && S.sub && team();
    $('#main').setAttribute('data-ready', S.booting ? '' : '1');   // shared/guard.js: the page started
    demoBar(S.demoMode || (S.me && S.me.demo));
    $('#main').innerHTML = msg + (!S.me ? viewLogin() : asking ? viewAsk() : S.view === 'players' ? viewPlayers() : viewTeam());
    if (asking) window.LDBuilder.mount($('#cp-builder'), S.sub, ctx());
    $('#foot').innerHTML = '<p>' + t('foot') + '</p>';
    document.title = 'LDHML | ' + t('title');
  }

  /* ---------- data ---------- */
  function load() {
    return Promise.all([api('/teams'), api('/replacements')]).then(function (rs) {
      if (rs[0].status === 401) { S.me = null; S.step = 'email'; S.sub = null; say('err', t('e_session')); return; }
      S.teams = rs[0].data.teams || [];
      S.reqs = rs[1].data.replacements || [];
      S.today = rs[1].data.today || '';
      if (!S.teams.some(function (x) { return x.id === S.teamId; })) S.teamId = S.teams.length ? S.teams[0].id : null;
      route();
      if (!S.teamId) { S.games = []; return; }
      if (S.view === 'players') return api('/players?team=' + S.teamId).then(function (r) { S.players = (r.ok && r.data.players) || []; });
      return api('/lineups?team=' + S.teamId).then(function (r) { S.games = (r.ok && r.data.games) || []; });
    });
  }
  /* #remplacement: the builder page for the current team; anything else: the team page. */
  function route() {
    S.view = location.hash === '#joueurs' ? 'players' : 'team';
    var m = /^#remplacement(?:\/(\w+))?$/.exec(location.hash);
    if (m && S.teamId) { var key = S.teamId + '/' + (m[1] || ''); if (!S.sub || S.sub.key !== key) { S.sub = window.LDBuilder.state({ area: 'captain', teamId: S.teamId, slot: m[1] || '' }); S.sub.key = key; } }
    else S.sub = null;
  }
  // the player filters: typed fields keep the focus; selects apply at once
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.fpanel) { S.fpanel = false; render(); } });
  document.addEventListener('focusin', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-select')) e.target.select(); });
  document.addEventListener('input', function (e) {
    var x = e.target; if (!x.hasAttribute || !x.hasAttribute('data-cpf') || x.tagName === 'SELECT') return;
    S.pf[x.getAttribute('data-cpf')] = x.value; var id = x.id, pos = x.selectionStart; render();
    var n = id && document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
  });
  document.addEventListener('change', function (e) {
    var x = e.target; if (!x.hasAttribute) return;
    if (x.hasAttribute('data-cplg')) { S.pf.lg = x.value; render(); }
    else if (x.tagName === 'SELECT' && x.hasAttribute('data-cpf')) { S.pf[x.getAttribute('data-cpf')] = x.value; render(); }
  });
  window.addEventListener('hashchange', function () {
    S.msg = S.flash; S.flash = null;
    if (!S.me) { render(); return; }
    if (/^#remplacement/.test(location.hash)) { route(); render(); document.documentElement.scrollTop = 0; } else refresh();
  });
  var refresh = function () { return load().then(render); };
  var pickTeam = function (id) { S.teamId = id; try { localStorage.setItem('ldhml-captain-team', String(id)); } catch (e) { /* ignore */ } };

  /* ---------- events ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id !== 'f-email' && f.id !== 'f-code' && f.id !== 'f-demo' && f.id !== 'f-demo-pick') return;   // the builder handles its own form
    e.preventDefault();
    var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ''; };
    S.msg = null;
    if (f.id === 'f-demo') {
      S.demoKey = v('key');
      api('/demo-accounts?key=' + encodeURIComponent(S.demoKey)).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.demoCaps = r.data.captains || []; render();
      });
      return;
    }
    if (f.id === 'f-demo-pick') {
      api('/demo-login', 'POST', { key: S.demoKey, captain_id: Number(v('captain')) }).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.me = r.data.captain; S.msg = null; refresh();
      });
      return;
    }
    if (f.id === 'f-email') {
      S.email = v('email');
      api('/login/start', 'POST', { email: S.email }).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.step = 'code'; S.devCode = r.data.devCode || ''; render();
        var c = $('#f-code input'); if (c) c.focus();
      });
    } else {
      api('/login/verify', 'POST', { email: S.email, code: v('code') }).then(function (r) {
        if (!r.ok) { say('err', errMsg(r)); render(); return; }
        S.me = r.data.captain; S.devCode = ''; refresh();
      });
    }
  });
  document.addEventListener('toggle', function (e) { var k = e.target && e.target.getAttribute && e.target.getAttribute('data-game-key'); if (k) S.openGames[k] = e.target.open; }, true);
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act],[data-team],[data-cancel],[data-hide],[data-ask-game],[data-share],[data-share-go],[data-share-copy],[data-share-close],[data-cpsex],[data-cppos],[data-cpst],[data-cpsort],[data-fpanel],[data-fpanel-close],[data-fclear]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'lang') { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ } render(); return; }
    if (act === 'other-email') { S.step = 'email'; S.devCode = ''; S.msg = null; render(); return; }
    if (act === 'logout') { api('/logout', 'POST', {}).then(function () { S.me = null; S.step = 'email'; S.msg = null; S.sub = null; render(); }); return; }
    if (act === 'ask') { S.msg = null; location.hash = '#remplacement'; return; }
    if (b.hasAttribute('data-team')) { pickTeam(Number(b.getAttribute('data-team'))); S.msg = null; refresh(); return; }
    if (b.hasAttribute('data-ask-game')) { e.preventDefault(); S.msg = null; location.hash = '#remplacement/' + b.getAttribute('data-ask-game'); return; }
    if (b.hasAttribute('data-fpanel') || b.hasAttribute('data-fpanel-close')) { S.fpanel = b.hasAttribute('data-fpanel'); render(); var fo = S.fpanel ? document.querySelector('#fpanel button, #fpanel select') : document.querySelector('[data-fpanel]'); if (fo) fo.focus(); return; }
    if (b.hasAttribute('data-fclear')) { S.pf = { q: '', sex: '', pos: '', st: '', lg: '', smin: '', smax: '', rfrom: '', rto: '' }; render(); return; }
    if (b.hasAttribute('data-cpsex')) { S.pf.sex = b.getAttribute('data-cpsex'); render(); return; }
    if (b.hasAttribute('data-cppos')) { S.pf.pos = b.getAttribute('data-cppos'); S.pf.rfrom = S.pf.rto = ''; render(); return; }
    if (b.hasAttribute('data-cpst')) { S.pf.st = b.getAttribute('data-cpst'); render(); return; }
    if (b.hasAttribute('data-cpsort')) { var sk = b.getAttribute('data-cpsort'); S.ps = S.ps.k === sk ? { k: sk, d: -S.ps.d } : { k: sk, d: sk === 'sal' ? -1 : 1 }; render(); return; }
    if (b.hasAttribute('data-share')) { shareReq(Number(b.getAttribute('data-share'))); return; }
    if (b.hasAttribute('data-share-go')) { shareReq(Number(b.getAttribute('data-share-go'))); return; }
    if (b.hasAttribute('data-share-copy')) { shareReq(Number(b.getAttribute('data-share-copy')), true); return; }
    if (b.hasAttribute('data-share-close')) { S.shared = null; render(); return; }
    if (b.hasAttribute('data-hide')) { api('/replacements/' + b.getAttribute('data-hide') + '/hide', 'POST', {}).then(function (r) { if (r.ok) say('ok', t('hidden')); else say('err', errMsg(r)); refresh(); }); return; }
    if (b.hasAttribute('data-cancel')) {
      if (!window.confirm(t('confirmCancel'))) return;
      api('/replacements/' + b.getAttribute('data-cancel') + '/cancel', 'POST', {}).then(function (r) { if (r.ok) say('ok', t('cancelled')); else say('err', errMsg(r)); refresh(); });
    }
  });

  /* ---------- start ---------- */
  S.booting = true; render();   // "Chargement…" at once, not a blank page
  Promise.all([fetch('/data/season.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), api('/me'),
    fetch('/api/public/season').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (rs) {
    S.booting = false; S.data = rs[0]; S.demoMode = !!(rs[2] && rs[2].demo);
    if (rs[1].ok) { S.me = rs[1].data.captain; return refresh(); }
    render();
  }).catch(function () { S.booting = false; say('err', t('e_net')); render(); });
})();
