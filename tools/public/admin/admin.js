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
      edit: 'Modifier', save: 'Enregistrer', cancel: 'Annuler', editEmailNote: 'Un nouveau courriel ferme les sessions ouvertes du capitaine et annule un code en attente.',
      saved: 'Enregistré.', confirmRevoke: 'Retirer cet accès ?', confirmDisable: 'Désactiver ce capitaine ? Ses sessions seront fermées.', del: 'Supprimer', deleted: 'Supprimé.',
      confirmDeleteCap: 'Supprimer définitivement {n} ? Le compte, ses accès (toutes les saisons) et ses données personnelles dans le journal seront effacés. Impossible d’annuler.',
      confirmDeleteSeason: 'Supprimer la saison {n} ? Impossible d’annuler.', e_season_in_use: 'Des capitaines ont encore un accès actif dans cette saison. Retirez ces accès d’abord.',
      e_email: 'Adresse courriel invalide.', e_code: 'Code invalide ou expiré.', e_session: 'Votre session a expiré. Reconnectez-vous.',
      e_season: 'Saison invalide : un nom est requis, et le no NBHPA doit être un nombre.', e_season_exists: 'Cette saison existe déjà.',
      e_captain: 'Capitaine invalide : un nom et un courriel sont requis.', e_captain_exists: 'Un capitaine a déjà ce courriel.', e_access: 'Accès invalide.',
      e_no_season_data: 'Pas de données d’équipes pour cette saison.', e_team: 'Équipe introuvable.', e_access_exists: 'Ce capitaine a déjà cet accès.',
      e_server: 'Erreur du serveur. Réessayez.', e_origin: 'Requête refusée.', e_net: 'Le serveur ne répond pas.',
      lang: 'English', foot: 'Outils LDHML. Les courriels restent dans la base de données des outils, jamais sur le site public.',
      tabPlayers: 'Joueurs', tabTeams: 'Équipes', tabRules: 'Règles', section: 'Section',
      playersLede: 'La liste des joueurs de la ligue, par section et par saison. Une personne reste la même d’une saison à l’autre.',
      addPlayer: 'Ajouter un joueur…', addToList: 'Ajouter une personne existante à la liste', personField: 'Personne', salaryS: 'Salaire joueur', salaryG: 'Salaire gardien', add: 'Ajouter',
      newPerson: 'Nouvelle personne', sex: 'Sexe', sexM: 'H', sexF: 'F', birth: 'Naissance', month: 'Mois', year: 'Année',
      filterName: 'Filtrer par nom', nPlayers: '{n} joueurs', noPlayers: 'Aucun joueur dans cette liste.', teamsCol: 'Équipes', removeFromList: 'Retirer de la liste',
      confirmRemoveList: 'Retirer {n} de la liste de cette section pour cette saison ?', confirmDeletePerson: 'Supprimer définitivement {n} ? Toutes les saisons : listes et alignements. Impossible d’annuler.',
      seedHint: 'Tests locaux : « node tools/scripts/seed-local.mjs » remplit les listes et les alignements à partir des données actuelles.',
      teamsLede: 'Nos équipes, par saison et par ligue, avec leurs alignements officiels. Seuls les administrateurs les modifient.',
      importTeams: 'Importer les équipes des données NBHPA', noTeams: 'Aucune équipe pour cette saison.', newTeam: 'Nouvelle équipe', abb: 'Code', nbhpaTeam: 'No d’équipe NBHPA (facultatif)',
      pos: 'Position', posS: 'Joueur', posG: 'Gardien', payroll: 'Masse salariale : {v}', payrollCap: 'Masse salariale : {v} / {c}', overCap: 'au-dessus du plafond', missingSalary: '{n} sans salaire',
      removeFromRoster: 'Retirer de l’alignement', confirmRemoveRoster: 'Retirer {n} de cette équipe ? L’historique reste.', confirmDeleteTeam: 'Supprimer l’équipe {n} ?', emptyRoster: 'Alignement vide.',
      noTeamsYet: 'Aucune équipe pour cette saison : créez-les dans l’onglet Équipes.',
      rulesLede: 'Une ligne de réglages par ligue et par saison. Les vérifications des remplacements s’y appuieront, une règle à la fois.',
      salaryCap: 'Plafond salarial', minAgeM: 'Âge min. hommes', minAgeF: 'Âge min. femmes', minAgeG: 'Âge min. gardiens', notes: 'La règle en mots', ruleNone: 'Aucune règle.',
      e_person: 'Personne invalide : un nom est requis ; naissance : mois de 1 à 12 avec une année.', e_person_exists: 'Cette personne existe déjà (même no de site ou NBHPA).',
      e_section_player: 'Ajout invalide (les salaires sont des nombres positifs).', e_on_roster: 'Cette personne est dans un alignement de cette section. Retirez-la d’abord.',
      e_team_exists: 'Cette équipe existe déjà.', e_team_in_use: 'Cette équipe a des joueurs ou un capitaine actif. Retirez-les d’abord.', e_roster: 'Ajout invalide.',
      e_not_registered: 'Cette personne n’est pas dans la liste des joueurs de cette section pour cette saison.', e_already_on_roster: 'Déjà dans une équipe de cette ligue cette saison : {team}.',
      e_rules: 'Règles invalides (nombres positifs).'
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
      edit: 'Edit', save: 'Save', cancel: 'Cancel', editEmailNote: 'A new email closes the captain’s open sessions and cancels a pending code.',
      saved: 'Saved.', confirmRevoke: 'Remove this access?', confirmDisable: 'Disable this captain? Their sessions will be closed.', del: 'Delete', deleted: 'Deleted.',
      confirmDeleteCap: 'Delete {n} for good? The account, its access (every season) and its personal data in the log will be erased. This cannot be undone.',
      confirmDeleteSeason: 'Delete the {n} season? This cannot be undone.', e_season_in_use: 'Captains still have active access in this season. Remove that access first.',
      e_email: 'Invalid email address.', e_code: 'Invalid or expired code.', e_session: 'Your session expired. Sign in again.',
      e_season: 'Invalid season: a name is required, and the NBHPA no. must be a number.', e_season_exists: 'This season already exists.',
      e_captain: 'Invalid captain: a name and an email are required.', e_captain_exists: 'A captain already has this email.', e_access: 'Invalid access.',
      e_no_season_data: 'No team data for this season.', e_team: 'Team not found.', e_access_exists: 'This captain already has this access.',
      e_server: 'Server error. Try again.', e_origin: 'Request refused.', e_net: 'The server does not answer.',
      lang: 'Français', foot: 'LDHML tools. Emails stay in the tools database, never on the public site.',
      tabPlayers: 'Players', tabTeams: 'Teams', tabRules: 'Rules', section: 'Section',
      playersLede: 'The league player list, per section and per season. A person stays the same person from one season to the next.',
      addPlayer: 'Add a player…', addToList: 'Add an existing person to the list', personField: 'Person', salaryS: 'Skater salary', salaryG: 'Goalie salary', add: 'Add',
      newPerson: 'New person', sex: 'Sex', sexM: 'M', sexF: 'W', birth: 'Birth', month: 'Month', year: 'Year',
      filterName: 'Filter by name', nPlayers: '{n} players', noPlayers: 'No player in this list.', teamsCol: 'Teams', removeFromList: 'Remove from the list',
      confirmRemoveList: 'Remove {n} from this section’s list for this season?', confirmDeletePerson: 'Delete {n} for good? Every season: lists and rosters. This cannot be undone.',
      seedHint: 'Local tests: "node tools/scripts/seed-local.mjs" fills the lists and rosters from the current data.',
      teamsLede: 'Our teams, per season and league, with their official rosters. Only admins change them.',
      importTeams: 'Import the teams from the NBHPA data', noTeams: 'No team for this season.', newTeam: 'New team', abb: 'Code', nbhpaTeam: 'NBHPA team no. (optional)',
      pos: 'Position', posS: 'Skater', posG: 'Goalie', payroll: 'Payroll: {v}', payrollCap: 'Payroll: {v} / {c}', overCap: 'over the cap', missingSalary: '{n} without a salary',
      removeFromRoster: 'Remove from the roster', confirmRemoveRoster: 'Remove {n} from this team? The history stays.', confirmDeleteTeam: 'Delete the team {n}?', emptyRoster: 'Empty roster.',
      noTeamsYet: 'No team for this season: create them in the Teams tab.',
      rulesLede: 'One row of settings per league and season. Replacement checks will use it, one rule at a time.',
      salaryCap: 'Salary cap', minAgeM: 'Min. age men', minAgeF: 'Min. age women', minAgeG: 'Min. age goalies', notes: 'The rule in words', ruleNone: 'No rule.',
      e_person: 'Invalid person: a name is required; birth: month 1 to 12 with a year.', e_person_exists: 'This person already exists (same site or NBHPA no.).',
      e_section_player: 'Invalid addition (salaries are positive numbers).', e_on_roster: 'This person is on a roster of this section. Remove them first.',
      e_team_exists: 'This team already exists.', e_team_in_use: 'This team has players or an active captain. Remove them first.', e_roster: 'Invalid addition.',
      e_not_registered: 'This person is not on this section’s player list for this season.', e_already_on_roster: 'Already on a team of this league this season: {team}.',
      e_rules: 'Invalid rules (positive numbers).'
    }
  };
  var t = function (k, v) { var s = STR[lang][k] != null ? STR[lang][k] : k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  /* state */
  var S = { me: null, step: 'email', email: '', devCode: '', msg: null, tab: 'captains', seasons: [], captains: [], audit: [], data: null, seasonId: null, editId: null,
    section: null, teams: [], rules: [], players: [], allPeople: [], editPerson: null, editTeam: null, pq: '' };
  var TABS = ['captains', 'players', 'teams', 'rules', 'seasons', 'audit'];

  function api(path, method, body) {
    return fetch('/api/admin' + path, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); },
        function () { return { ok: false, status: 0, data: { error: 'net' } }; });
  }
  var errMsg = function (r) { return t('e_' + ((r.data && r.data.error) || 'server'), r.data || {}); };
  function say(kind, text) { S.msg = { kind: kind, text: text }; }

  /* stats data: leagues, teams, players (public) */
  var leagueOf = function (slug) { return S.data && S.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var site = function () { return (S.data && S.data.siteUrl) || '/'; };
  function accessBadge(a) {
    var l = leagueOf(a.league) || { slug: a.league, short: a.league, name: a.league, theme: 'default' };
    var home = site() + (l.sectionPath ? l.sectionPath + '/' + l.path + '/' : '');
    return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, {
      href: home, title: l.name, theme: l.theme, teams: [{ abb: a.team_abb, name: a.team_name, href: a.team_id ? home + '#team-' + a.team_id : '' }]
    });
  }
  var nameOf = function (s) { return s && s.name ? (s.name[lang] || s.name.fr) : ''; };
  var curSeason = function () { return S.seasons.filter(function (x) { return x.id === S.seasonId; })[0]; };
  var leagueHome = function (l) { return site() + l.sectionPath + '/' + l.path + '/'; };
  var money = function (v) { return v == null ? '—' : String(Math.round(v * 100) / 100); };
  /* A roster entry as a league badge with the team chip (docs/presentation.md); the team links to the stats site when it has an NBHPA id. */
  function rosterBadge(r) {
    var l = leagueOf(r.league) || { slug: r.league, short: r.league, name: r.league, theme: 'default' };
    return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, {
      href: l.path ? leagueHome(l) : '', title: l.name, theme: l.theme, teams: [{ abb: r.abb, name: r.team_name, href: r.nbhpa_team_id && l.path ? leagueHome(l) + '#team-' + r.nbhpa_team_id : '' }]
    });
  }
  /* A league alone (no team chips): the badge links to the league on the stats site. */
  var leagueOnly = function (l) { return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { href: leagueHome(l), title: l.name, theme: l.theme }); };
  /* A person's name: a link to their stats profile when they have our site id. */
  var personCell = function (p) { return p.site_id ? personLink(p.site_id) : esc(p.name); };
  function sectionSeg() {
    var secs = (S.data && S.data.sections) || [];
    return '<div class="seg" role="group" aria-label="' + esc(t('section')) + '">' + secs.map(function (s) {
      return '<button type="button" data-sec="' + esc(s.key) + '" aria-pressed="' + (S.section === s.key) + '">' + esc(nameOf(s)) + '</button>';
    }).join('') + '</div>';
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
  /* Give access to one of OUR teams of the season (Teams tab). */
  function grantForm(c) {
    if (!curSeason()) return '';
    if (!S.teams.length) return '<p class="note">' + t('noTeamsYet') + '</p>';
    var slugs = S.teams.map(function (x) { return x.league; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return '<form class="ad-grant" data-grant="' + c.id + '"><select class="ctl" name="league" aria-label="' + esc(t('league')) + '" required><option value="">' + t('chooseLeague') + '</option>' +
      slugs.map(function (slug) { var l = leagueOf(slug); return '<option value="' + esc(slug) + '">' + esc(l ? l.name : slug) + '</option>'; }).join('') + '</select>' +
      '<select class="ctl" name="team" aria-label="' + esc(t('team')) + '" required disabled><option value="">' + t('chooseTeam') + '</option></select>' +
      '<button class="ad-btn ad-btn-sm" type="submit">' + t('grant') + '</button></form>';
  }
  function viewCaptains() {
    var seasonName = (S.seasons.filter(function (x) { return x.id === S.seasonId; })[0] || {}).name || '';
    var people = S.data ? S.data.people.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); }) : [];
    var rows = S.captains.map(function (c) {
      var mine = c.access.filter(function (a) { return a.season_id === S.seasonId; }), other = c.access.length - mine.length;
      var person = c.person_id ? '<div class="note">' + esc(t('profile')) + ' : ' + personLink(c.person_id) + ' (' + esc(c.person_id) + ')</div>' : '';
      /* Edit mode: name, email and player link in a small form in place of the first two cells. */
      var who = S.editId === c.id
        ? '<td colspan="2"><form class="ad-form ad-edit" data-edit="' + c.id + '">' +
          '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(c.name) + '"></label>' +
          '<label>' + t('email') + '<input class="ctl" type="email" name="email" required value="' + esc(c.email) + '"></label>' +
          '<label>' + t('player') + '<input class="ctl" name="person" list="ad-people" autocomplete="off" value="' + esc(c.person_id ? personName(c.person_id) + ' · ' + c.person_id : '') + '"></label>' +
          '<button class="ad-btn ad-btn-sm" type="submit">' + t('save') + '</button><button type="button" class="lnk ad-linkbtn" data-act="cancel-edit">' + t('cancel') + '</button>' +
          '<p class="note ad-edit-note">' + t('editEmailNote') + '</p></form></td>'
        : '<td><b>' + esc(c.name) + '</b>' + person + '<div class="note">' + esc(c.last_login_at ? t('lastLogin', { d: fmt(c.last_login_at) }) : t('never')) + '</div></td>' +
          '<td>' + esc(c.email) + (c.disabled_at ? ' <em class="subtag">' + t('disabled') + '</em>' : '') + '</td>';
      return '<tr' + (c.disabled_at ? ' class="ad-off"' : '') + '>' + who +
        '<td><div class="lgbs">' + (mine.length ? mine.map(function (a) { return '<span class="ad-acc">' + accessBadge(a) + '<button type="button" class="ad-x" data-revoke="' + a.id + '" title="' + esc(t('revoke')) + '" aria-label="' + esc(t('revoke')) + '">×</button></span>'; }).join('') : '<span class="note">' + t('noAccess') + '</span>') +
        (other ? ' <span class="note">' + esc(t('otherSeasons', { n: other })) + '</span>' : '') + '</div>' + (c.disabled_at ? '' : grantForm(c)) + '</td>' +
        '<td class="ad-acts"><button type="button" class="lnk ad-linkbtn" data-edit-cap="' + c.id + '">' + t('edit') + '</button>' +
        '<button type="button" class="lnk ad-linkbtn" data-' + (c.disabled_at ? 'enable' : 'disable') + '="' + c.id + '">' + t(c.disabled_at ? 'enable' : 'disable') + '</button>' +
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
  /* ---------- the league player list (per section and season) ---------- */
  var monthOpts = function (sel) { var o = '<option value="">' + t('month') + '</option>'; for (var i = 1; i <= 12; i++) o += '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + '</option>'; return o; };
  var sexOpts = function (sel) { return '<option value="">—</option><option value="m"' + (sel === 'm' ? ' selected' : '') + '>' + t('sexM') + '</option><option value="f"' + (sel === 'f' ? ' selected' : '') + '>' + t('sexF') + '</option>'; };
  var birthTxt = function (p) { return p.birth_year ? (p.birth_month ? (p.birth_month < 10 ? '0' : '') + p.birth_month + '/' : '') + p.birth_year : '—'; };
  function personFields(p) {
    p = p || {};
    return '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(p.name || '') + '"></label>' +
      '<label>' + t('sex') + '<select class="ctl ad-sm" name="sex">' + sexOpts(p.sex) + '</select></label>' +
      '<label>' + t('birth') + '<span class="ad-pair"><select class="ctl ad-sm" name="birth_month" aria-label="' + esc(t('month')) + '">' + monthOpts(p.birth_month) + '</select>' +
      '<input class="ctl ad-sm" name="birth_year" inputmode="numeric" maxlength="4" placeholder="' + esc(t('year')) + '" aria-label="' + esc(t('year')) + '" value="' + esc(p.birth_year || '') + '"></span></label>';
  }
  var salaryFields = function (p) {
    p = p || {};
    return '<label>' + t('salaryS') + '<input class="ctl ad-sm" name="salary_s" inputmode="decimal" value="' + esc(p.salary_s == null ? '' : p.salary_s) + '"></label>' +
      '<label>' + t('salaryG') + '<input class="ctl ad-sm" name="salary_g" inputmode="decimal" value="' + esc(p.salary_g == null ? '' : p.salary_g) + '"></label>';
  };
  function viewPlayers() {
    var s = curSeason();
    var head = '<h1 class="ph">' + t('tabPlayers') + '</h1><p class="lede">' + t('playersLede') + '</p><div class="controls">' + seasonSelect() + sectionSeg() + '</div>';
    if (!s) return head;
    var inList = {}; S.players.forEach(function (p) { inList[p.id] = 1; });
    var q = S.pq.trim().toLowerCase();
    var list = S.players.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0; });
    var rows = list.map(function (p) {
      if (S.editPerson === p.id) {
        return '<tr><td colspan="6"><form class="ad-form ad-edit" data-edit-person="' + p.id + '"><input type="hidden" name="site_id" value="' + esc(p.site_id || '') + '"><input type="hidden" name="nid" value="' + esc(p.nid || '') + '">' +
          personFields(p) + salaryFields(p) + '<button class="ad-btn ad-btn-sm" type="submit">' + t('save') + '</button><button type="button" class="lnk ad-linkbtn" data-act="cancel-person">' + t('cancel') + '</button></form></td></tr>';
      }
      return '<tr><td><b>' + personCell(p) + '</b></td><td>' + esc(p.sex === 'm' ? t('sexM') : p.sex === 'f' ? t('sexF') : '—') + '</td><td class="num">' + esc(birthTxt(p)) + '</td>' +
        '<td class="num">' + esc(money(p.salary_s)) + ' / ' + esc(money(p.salary_g)) + '</td><td><div class="lgbs">' + p.rosters.map(rosterBadge).join('') + '</div></td>' +
        '<td class="ad-acts"><button type="button" class="lnk ad-linkbtn" data-edit-person-btn="' + p.id + '">' + t('edit') + '</button>' +
        '<button type="button" class="lnk ad-linkbtn" data-del-list="' + p.sp_id + '" data-name="' + esc(p.name) + '">' + t('removeFromList') + '</button>' +
        '<button type="button" class="ad-del" data-del-person="' + p.id + '" data-name="' + esc(p.name) + '">' + t('del') + '</button></td></tr>';
    }).join('');
    var others = S.allPeople.filter(function (p) { return !inList[p.id]; });
    /* The list comes first; the two add forms wait in a closed panel. */
    return head + '<details class="ad-add" id="ad-add"' + (S.addOpen ? ' open' : '') + '><summary>' + t('addPlayer') + '</summary>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('addToList') + '</h2></div><form id="f-addlist" class="ad-form ad-row">' +
      '<label>' + t('personField') + '<input class="ctl" name="person" list="ad-allpeople" autocomplete="off" required></label>' + salaryFields() +
      '<button class="ad-btn" type="submit">' + t('add') + '</button></form>' +
      '<datalist id="ad-allpeople">' + others.map(function (p) { return '<option value="' + esc(p.name + ' · #' + p.id) + '">'; }).join('') + '</datalist></section>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('newPerson') + '</h2></div><form id="f-newperson" class="ad-form ad-row">' + personFields() + salaryFields() +
      '<button class="ad-btn" type="submit">' + t('create') + '</button></form></section></details>' +
      '<section class="sec"><div class="controls"><input id="ad-pq" class="ctl" type="search" data-pq placeholder="' + esc(t('filterName')) + '" value="' + esc(S.pq) + '" aria-label="' + esc(t('filterName')) + '"><span class="count">' + esc(t('nPlayers', { n: list.length })) + '</span></div>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl ad-tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('sex') + '</th><th class="num">' + t('birth') + '</th><th class="num">' + t('salaryS') + ' / ' + t('salaryG') + '</th><th>' + t('teamsCol') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">' + t('noPlayers') + '</p><p class="note">' + t('seedHint') + '</p>') + '</section>';
  }

  /* ---------- our teams and their rosters ---------- */
  function teamCard(tm, l, rule) {
    var dataTeam = (l.teams || []).filter(function (x) { return x.id === tm.nbhpa_team_id; })[0] || {};
    var crest = window.LDLook.crest({ abb: tm.abb, logo: dataTeam.logo }, l.slug, 'sm');
    var missing = 0, total = 0;
    tm.roster.forEach(function (r) { var v = r.pos === 'g' ? r.salary_g : r.salary_s; if (v == null) missing++; else total += v; });
    var cap = rule && rule.salary_cap != null ? rule.salary_cap : null, over = cap != null && total > cap;
    var head = S.editTeam === tm.id
      ? '<form class="ad-form ad-edit" data-edit-team="' + tm.id + '"><label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(tm.name) + '"></label>' +
        '<label>' + t('abb') + '<input class="ctl ad-sm" name="abb" required maxlength="6" value="' + esc(tm.abb) + '"></label>' +
        '<label>' + t('nbhpaTeam') + '<input class="ctl ad-sm" name="nbhpa" inputmode="numeric" value="' + esc(tm.nbhpa_team_id || '') + '"></label>' +
        '<button class="ad-btn ad-btn-sm" type="submit">' + t('save') + '</button><button type="button" class="lnk ad-linkbtn" data-act="cancel-team">' + t('cancel') + '</button></form>'
      : '<div class="ad-team-h"><span class="tcell">' + crest + (tm.nbhpa_team_id ? '<a class="tl strong" href="' + esc(leagueHome(l) + '#team-' + tm.nbhpa_team_id) + '">' + esc(tm.name) + '</a>' : '<b>' + esc(tm.name) + '</b>') + '</span>' +
        '<span class="note">' + esc(tm.abb) + (tm.nbhpa_team_id ? ' · NBHPA ' + esc(tm.nbhpa_team_id) : '') + '</span>' +
        '<span class="ad-acts"><button type="button" class="lnk ad-linkbtn" data-edit-team-btn="' + tm.id + '">' + t('edit') + '</button><button type="button" class="ad-del" data-del-team="' + tm.id + '" data-name="' + esc(tm.name) + '">' + t('del') + '</button></span></div>';
    var rows = tm.roster.map(function (r) {
      return '<tr><td>' + personCell(r) + '</td><td>' + esc(r.pos === 'g' ? t('posG') : t('posS')) + '</td><td class="num">' + esc(money(r.pos === 'g' ? r.salary_g : r.salary_s)) + '</td>' +
        '<td><button type="button" class="ad-x" data-roster-remove="' + r.id + '" data-name="' + esc(r.name) + '" title="' + esc(t('removeFromRoster')) + '" aria-label="' + esc(t('removeFromRoster')) + '">×</button></td></tr>';
    }).join('');
    return '<article class="ad-team" style="--tc:' + window.LDLook.colorVar(l.slug, tm.abb) + '">' + head +
      (rows ? '<table class="tbl ad-roster"><tbody>' + rows + '</tbody></table>' : '<p class="note">' + t('emptyRoster') + '</p>') +
      '<p class="ad-payroll' + (over ? ' ad-over' : '') + '">' + esc(cap != null ? t('payrollCap', { v: money(total), c: money(cap) }) : t('payroll', { v: money(total) })) +
      (over ? ' · <b>' + t('overCap') + '</b>' : '') + (missing ? ' · ' + esc(t('missingSalary', { n: missing })) : '') + '</p>' +
      '<form class="ad-grant" data-addroster="' + tm.id + '"><input class="ctl" name="person" list="ad-free-' + esc(l.slug) + '" autocomplete="off" required aria-label="' + esc(t('personField')) + '" placeholder="' + esc(t('personField')) + '">' +
      '<select class="ctl ad-sm" name="pos" aria-label="' + esc(t('pos')) + '"><option value="s">' + t('posS') + '</option><option value="g">' + t('posG') + '</option></select>' +
      '<button class="ad-btn ad-btn-sm" type="submit">' + t('add') + '</button></form></article>';
  }
  function viewTeams() {
    var s = curSeason();
    var head = '<h1 class="ph">' + t('tabTeams') + '</h1><p class="lede">' + t('teamsLede') + '</p><div class="controls">' + seasonSelect() + sectionSeg() + '</div>';
    if (!s || !S.data) return head;
    var leagues = S.data.leagues.filter(function (l) { return l.section === S.section; });
    /* Import: only for the season of the stats data, and only while some of its teams are missing. */
    var have = {}; S.teams.forEach(function (x) { if (x.nbhpa_team_id) have[x.league + ':' + x.nbhpa_team_id] = 1; });
    var canImport = s.nbhpa_season_id === S.data.seasonId && S.data.leagues.some(function (l) { return l.teams.some(function (x) { return !have[l.slug + ':' + x.id]; }); });
    var html = (!S.teams.length ? '<p class="note">' + t('noTeams') + '</p>' : '') +
      (canImport ? '<p><button type="button" class="ad-btn ad-btn-sm" data-act="import-teams">' + t('importTeams') + '</button></p>' : '');
    leagues.forEach(function (l) {
      var rule = S.rules.filter(function (r) { return r.league === l.slug; })[0];
      var teams = S.teams.filter(function (x) { return x.league === l.slug; });
      var onRoster = {}; teams.forEach(function (x) { x.roster.forEach(function (r) { onRoster[r.person_id] = 1; }); });
      var free = S.players.filter(function (p) { return !onRoster[p.id]; });
      html += '<section class="sec"><div class="sec-h"><h2>' + leagueOnly(l) + '</h2></div>' +
        '<datalist id="ad-free-' + esc(l.slug) + '">' + free.map(function (p) { return '<option value="' + esc(p.name + ' · #' + p.id) + '">'; }).join('') + '</datalist>' +
        '<div class="ad-teams">' + teams.map(function (tm) { return teamCard(tm, l, rule); }).join('') + '</div>' +
        '<form class="ad-form ad-row" data-newteam="' + esc(l.slug) + '"><label>' + t('newTeam') + '<input class="ctl" name="name" required maxlength="80"></label>' +
        '<label>' + t('abb') + '<input class="ctl ad-sm" name="abb" required maxlength="6"></label><label>' + t('nbhpaTeam') + '<input class="ctl ad-sm" name="nbhpa" inputmode="numeric"></label>' +
        '<button class="ad-btn ad-btn-sm" type="submit">' + t('create') + '</button></form></section>';
    });
    return head + html;
  }

  /* ---------- league rules: one row per league and season ---------- */
  function viewRules() {
    var s = curSeason();
    var head = '<h1 class="ph">' + t('tabRules') + '</h1><p class="lede">' + t('rulesLede') + '</p><div class="controls">' + seasonSelect() + '</div>';
    if (!s || !S.data) return head;
    var val = function (v) { return v == null ? '' : esc(v); };
    return head + (S.data.sections || []).map(function (sec) {
      return '<section class="sec"><div class="sec-h"><h2>' + esc(nameOf(sec)) + '</h2></div>' + S.data.leagues.filter(function (l) { return l.section === sec.key; }).map(function (l) {
        var r = S.rules.filter(function (x) { return x.league === l.slug; })[0] || {};
        return '<form class="ad-form ad-row ad-rule" data-rules="' + esc(l.slug) + '"><span class="ad-rule-lg">' + leagueOnly(l) + '</span>' +
          '<label>' + t('salaryCap') + '<input class="ctl ad-sm" name="salary_cap" inputmode="decimal" value="' + val(r.salary_cap) + '"></label>' +
          '<label>' + t('minAgeM') + '<input class="ctl ad-sm" name="min_age_m" inputmode="numeric" value="' + val(r.min_age_m) + '"></label>' +
          '<label>' + t('minAgeF') + '<input class="ctl ad-sm" name="min_age_f" inputmode="numeric" value="' + val(r.min_age_f) + '"></label>' +
          '<label>' + t('minAgeG') + '<input class="ctl ad-sm" name="min_age_g" inputmode="numeric" value="' + val(r.min_age_g) + '"></label>' +
          '<label class="ad-wide">' + t('notes') + '<input class="ctl" name="notes" maxlength="500" value="' + val(r.notes) + '"></label>' +
          '<button class="ad-btn ad-btn-sm" type="submit">' + t('save') + '</button></form>';
      }).join('') + '</section>';
    }).join('');
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
    var tabs = [['captains', t('tabCaptains')], ['players', t('tabPlayers')], ['teams', t('tabTeams')], ['rules', t('tabRules')], ['seasons', t('tabSeasons')], ['audit', t('tabAudit')]];
    $('#top').innerHTML = '<div class="wrap top-in sec-top"><a class="brand" href="/admin/"><span><b>LDHML <i>Admin</i></b><small>' + esc(S.me ? S.me.email : t('title')) + '</small></span></a>' +
      (S.me ? '<nav class="nav" aria-label="Admin">' + tabs.map(function (x) { return '<a href="#' + x[0] + '"' + (S.tab === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>' : '') +
      '<div class="ad-tools"><button type="button" class="lgbtn" data-act="lang">' + t('lang') + '</button>' + (S.me ? '<button type="button" class="lgbtn" data-act="logout">' + t('signOut') + '</button>' : '') + '</div></div>';
    var msg = S.msg ? '<p class="ad-msg ad-' + S.msg.kind + '" role="' + (S.msg.kind === 'err' ? 'alert' : 'status') + '">' + esc(S.msg.text) + '</p>' : '';
    var views = { captains: viewCaptains, players: viewPlayers, teams: viewTeams, rules: viewRules, seasons: viewSeasons, audit: viewAudit };
    $('#main').innerHTML = msg + (!S.me ? viewLogin() : (views[S.tab] || viewCaptains)());
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
      if (!S.section && S.data && S.data.sections.length) S.section = S.data.sections[0].key;
      /* What the tab needs, for the chosen season (and section). */
      var more = [];
      if (S.seasonId && ['captains', 'teams'].indexOf(S.tab) >= 0) more.push(api('/teams?season=' + S.seasonId).then(function (r) { S.teams = r.data.teams || []; S.rules = r.data.rules || []; }));
      if (S.seasonId && S.tab === 'rules') more.push(api('/rules?season=' + S.seasonId).then(function (r) { S.rules = r.data.rules || []; }));
      if (S.seasonId && S.section && ['players', 'teams'].indexOf(S.tab) >= 0) more.push(api('/people?season=' + S.seasonId + '&section=' + S.section).then(function (r) { S.players = r.data.players || []; }));
      if (S.tab === 'players') more.push(api('/people?all=1').then(function (r) { S.allPeople = r.data.people || []; }));
      return Promise.all(more);
    });
  }
  var numOrNull = function (s) { return s === '' ? null : Number(String(s).replace(',', '.')); };
  var personBody = function (v) { return { name: v('name'), sex: v('sex') || null, birth_month: v('birth_month') || null, birth_year: v('birth_year') || null, site_id: v('site_id') || null, nid: v('nid') || null }; };
  var listBody = function (v, personId) { return { season_id: S.seasonId, section: S.section, person_id: personId, salary_s: numOrNull(v('salary_s')), salary_g: numOrNull(v('salary_g')) }; };
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
    } else if (f.hasAttribute('data-edit')) {
      var pm = /L\d{4,}/.exec(v('person'));
      api('/captains/' + f.getAttribute('data-edit'), 'POST', { name: v('name'), email: v('email'), person_id: pm ? pm[0] : null }).then(function (r) {
        if (r.ok) S.editId = null;
        done(r);
      });
    } else if (f.id === 'f-cap') {
      var m = /L\d{4,}/.exec(v('person'));
      api('/captains', 'POST', { name: v('name'), email: v('email'), person_id: m ? m[0] : null }).then(function (r) { done(r); });
    } else if (f.id === 'f-season') {
      api('/seasons', 'POST', { name: v('name'), nbhpa_season_id: v('nbhpa'), status: v('status') }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-grant')) {
      api('/access', 'POST', { captain_id: Number(f.getAttribute('data-grant')), team_ref: Number(v('team')) }).then(function (r) { done(r); });
    } else if (f.id === 'f-addlist') {
      var pid = /#(\d+)\s*$/.exec(v('person'));
      if (!pid) { say('err', t('e_section_player')); render(); return; }
      api('/section-players', 'POST', listBody(v, Number(pid[1]))).then(function (r) { done(r); });
    } else if (f.id === 'f-newperson') {
      api('/people', 'POST', personBody(v)).then(function (r) {
        if (!r.ok) { done(r); return; }
        api('/section-players', 'POST', listBody(v, r.data.id)).then(function (r2) { done(r2); });
      });
    } else if (f.hasAttribute('data-edit-person')) {
      var id = Number(f.getAttribute('data-edit-person'));
      api('/people/' + id, 'POST', personBody(v)).then(function (r) {
        if (!r.ok) { done(r); return; }
        api('/section-players', 'POST', listBody(v, id)).then(function (r2) { if (r2.ok) S.editPerson = null; done(r2); });
      });
    } else if (f.hasAttribute('data-addroster')) {
      var pr = /#(\d+)\s*$/.exec(v('person'));
      if (!pr) { say('err', t('e_roster')); render(); return; }
      api('/rosters', 'POST', { team_id: Number(f.getAttribute('data-addroster')), person_id: Number(pr[1]), pos: v('pos') }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-newteam')) {
      api('/teams', 'POST', { season_id: S.seasonId, league: f.getAttribute('data-newteam'), name: v('name'), abb: v('abb'), nbhpa_team_id: v('nbhpa') || null }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-edit-team')) {
      api('/teams/' + f.getAttribute('data-edit-team'), 'POST', { name: v('name'), abb: v('abb'), nbhpa_team_id: v('nbhpa') || null }).then(function (r) { if (r.ok) S.editTeam = null; done(r); });
    } else if (f.hasAttribute('data-rules')) {
      api('/rules', 'POST', { season_id: S.seasonId, league: f.getAttribute('data-rules'), salary_cap: numOrNull(v('salary_cap')), min_age_m: numOrNull(v('min_age_m')),
        min_age_f: numOrNull(v('min_age_f')), min_age_g: numOrNull(v('min_age_g')), notes: v('notes') || null }).then(function (r) { done(r); });
    }
  });
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'ad-add') S.addOpen = e.target.open; }, true);
  /* Team logos in badges (shared/look.js): show once loaded, remove on error (the colour and code stay). */
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  document.addEventListener('input', function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-pq')) return;
    S.pq = e.target.value;
    var pos = e.target.selectionStart;
    render();
    var n = document.getElementById('ad-pq');
    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'ad-season') { S.seasonId = Number(el.value); S.msg = null; refresh(); return; }
    var f = el.closest && el.closest('[data-grant]');
    if (f && el.name === 'league') {
      var mine = S.teams.filter(function (x) { return x.league === el.value; }), team = f.elements.team;
      team.innerHTML = '<option value="">' + t('chooseTeam') + '</option>' + mine.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); })
        .map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + ' (' + esc(x.abb) + ')</option>'; }).join('');
      team.disabled = !mine.length;
    }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act],[data-revoke],[data-disable],[data-enable],[data-delete-cap],[data-delete-season],[data-edit-cap],' +
      '[data-sec],[data-edit-person-btn],[data-del-list],[data-del-person],[data-roster-remove],[data-edit-team-btn],[data-del-team]');
    if (!b) return;
    var act = b.getAttribute('data-act'), nm = b.getAttribute('data-name');
    /* roster layer */
    if (b.hasAttribute('data-sec')) { S.section = b.getAttribute('data-sec'); S.msg = null; S.editPerson = null; S.editTeam = null; refresh(); return; }
    if (act === 'import-teams') { api('/teams/import', 'POST', { season_id: S.seasonId }).then(function (r) { done(r); }); return; }
    if (act === 'cancel-person') { S.editPerson = null; render(); return; }
    if (act === 'cancel-team') { S.editTeam = null; render(); return; }
    if (b.hasAttribute('data-edit-person-btn')) { S.editPerson = Number(b.getAttribute('data-edit-person-btn')); S.msg = null; render(); return; }
    if (b.hasAttribute('data-edit-team-btn')) { S.editTeam = Number(b.getAttribute('data-edit-team-btn')); S.msg = null; render(); return; }
    if (b.hasAttribute('data-del-list')) { if (window.confirm(t('confirmRemoveList', { n: nm }))) api('/section-players/' + b.getAttribute('data-del-list') + '/delete', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-del-person')) { if (window.confirm(t('confirmDeletePerson', { n: nm }))) api('/people/' + b.getAttribute('data-del-person') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-roster-remove')) { if (window.confirm(t('confirmRemoveRoster', { n: nm }))) api('/rosters/' + b.getAttribute('data-roster-remove') + '/remove', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-del-team')) { if (window.confirm(t('confirmDeleteTeam', { n: nm }))) api('/teams/' + b.getAttribute('data-del-team') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (act === 'lang') { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ } render(); return; }
    if (act === 'other-email') { S.step = 'email'; S.devCode = ''; S.msg = null; render(); return; }
    if (act === 'logout') { api('/logout', 'POST', {}).then(function () { S.me = null; S.step = 'email'; S.msg = null; render(); }); return; }
    if (b.hasAttribute('data-revoke')) { if (window.confirm(t('confirmRevoke'))) api('/access/' + b.getAttribute('data-revoke') + '/revoke', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-disable')) { if (window.confirm(t('confirmDisable'))) api('/captains/' + b.getAttribute('data-disable') + '/disable', 'POST', {}).then(function (r) { done(r); }); return; }
    if (act === 'cancel-edit') { S.editId = null; S.msg = null; render(); return; }
    if (b.hasAttribute('data-edit-cap')) { S.editId = Number(b.getAttribute('data-edit-cap')); S.msg = null; render(); var n = $('[data-edit] [name=name]'); if (n) n.focus(); return; }
    if (b.hasAttribute('data-delete-cap')) { if (window.confirm(t('confirmDeleteCap', { n: b.getAttribute('data-name') }))) api('/captains/' + b.getAttribute('data-delete-cap') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-delete-season')) { if (window.confirm(t('confirmDeleteSeason', { n: b.getAttribute('data-name') }))) api('/seasons/' + b.getAttribute('data-delete-season') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-enable')) api('/captains/' + b.getAttribute('data-enable') + '/enable', 'POST', {}).then(function (r) { done(r); });
  });
  window.addEventListener('hashchange', function () {
    var h = location.hash.replace('#', '');
    S.tab = TABS.indexOf(h) >= 0 ? h : 'captains';
    S.editPerson = null; S.editTeam = null; S.editId = null;
    S.msg = null;
    if (S.me) refresh(); else render();
  });

  /* ---------- start ---------- */
  var h0 = location.hash.replace('#', '');
  if (TABS.indexOf(h0) >= 0) S.tab = h0;
  Promise.all([fetch('/data/season.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), api('/me')]).then(function (rs) {
    S.data = rs[0];
    if (rs[1].ok) { S.me = rs[1].data.admin; return refresh(); }
    render();
  });
})();
