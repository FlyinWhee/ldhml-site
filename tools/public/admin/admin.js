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
      addPlayer: 'Ajouter un joueur…', addToList: 'Ajouter une personne existante à la liste', personField: 'Personne', salaryS: 'Salaire joueur (M)', salaryG: 'Salaire gardien (M)', add: 'Ajouter',
      newPerson: 'Nouvelle personne', sex: 'Sexe', sexM: 'H', sexF: 'F', birth: 'Naissance', month: 'Mois', year: 'Année',
      filterName: 'Filtrer par nom', nPlayers: '{n} joueurs', noPlayers: 'Aucun joueur dans cette liste.', teamsCol: 'Équipes', removeFromList: 'Retirer de la liste',
      confirmRemoveList: 'Retirer {n} de la liste de cette section pour cette saison ?', confirmDeletePerson: 'Supprimer définitivement {n} ? Toutes les saisons : listes et alignements. Impossible d’annuler.',
      seedHint: 'Tests locaux : « node tools/scripts/seed-local.mjs » remplit les listes et les alignements à partir des données actuelles.',
      teamsLede: 'Les équipes de la ligue choisie : leurs capitaines et leurs alignements officiels. Seuls les administrateurs les modifient.', rosterH: 'Alignement', orNewCaptain: 'Ou créer un nouveau capitaine', accounts: 'Comptes des capitaines ({n})', e_pickOrNew: 'Choisissez un capitaine, ou entrez le nom et le courriel d’un nouveau.',
      importTeams: 'Importer les équipes des données NBHPA', noTeams: 'Aucune équipe pour cette saison.', newTeam: 'Nouvelle équipe', abb: 'Code', nbhpaTeam: 'No d’équipe NBHPA (facultatif)',
      pos: 'Position', posS: 'Joueur', posG: 'Gardien', payroll: 'Masse salariale : {v}', payrollCap: 'Masse salariale : {v} / {c}', overCap: 'au-dessus du plafond', missingSalary: '{n} sans salaire',
      removeFromRoster: 'Retirer de l’alignement', confirmRemoveRoster: 'Retirer {n} de cette équipe ? L’historique reste.', confirmDeleteTeam: 'Supprimer l’équipe {n} ?', emptyRoster: 'Alignement vide.',
      noTeamsYet: 'Aucune équipe pour cette saison : créez-les dans l’onglet Équipes.',
      rulesLede: 'Une ligne de réglages par ligue et par saison. Les vérifications des remplacements s’y appuieront, une règle à la fois.',
      salaryCap: 'Plafond salarial (M)', minAgeM: 'Âge min. hommes', minAgeF: 'Âge min. femmes', minAgeG: 'Âge min. gardiens', notes: 'La règle en mots', ruleNone: 'Aucune règle.',
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
      addPlayer: 'Add a player…', addToList: 'Add an existing person to the list', personField: 'Person', salaryS: 'Skater salary (M)', salaryG: 'Goalie salary (M)', add: 'Add',
      newPerson: 'New person', sex: 'Sex', sexM: 'M', sexF: 'W', birth: 'Birth', month: 'Month', year: 'Year',
      filterName: 'Filter by name', nPlayers: '{n} players', noPlayers: 'No player in this list.', teamsCol: 'Teams', removeFromList: 'Remove from the list',
      confirmRemoveList: 'Remove {n} from this section’s list for this season?', confirmDeletePerson: 'Delete {n} for good? Every season: lists and rosters. This cannot be undone.',
      seedHint: 'Local tests: "node tools/scripts/seed-local.mjs" fills the lists and rosters from the current data.',
      teamsLede: 'The teams of the chosen league: their captains and official rosters. Only admins change them.', rosterH: 'Roster', orNewCaptain: 'Or create a new captain', accounts: 'Captain accounts ({n})', e_pickOrNew: 'Pick a captain, or enter the name and email of a new one.',
      importTeams: 'Import the teams from the NBHPA data', noTeams: 'No team for this season.', newTeam: 'New team', abb: 'Code', nbhpaTeam: 'NBHPA team no. (optional)',
      pos: 'Position', posS: 'Skater', posG: 'Goalie', payroll: 'Payroll: {v}', payrollCap: 'Payroll: {v} / {c}', overCap: 'over the cap', missingSalary: '{n} without a salary',
      removeFromRoster: 'Remove from the roster', confirmRemoveRoster: 'Remove {n} from this team? The history stays.', confirmDeleteTeam: 'Delete the team {n}?', emptyRoster: 'Empty roster.',
      noTeamsYet: 'No team for this season: create them in the Teams tab.',
      rulesLede: 'One row of settings per league and season. Replacement checks will use it, one rule at a time.',
      salaryCap: 'Salary cap (M)', minAgeM: 'Min. age men', minAgeF: 'Min. age women', minAgeG: 'Min. age goalies', notes: 'The rule in words', ruleNone: 'No rule.',
      e_person: 'Invalid person: a name is required; birth: month 1 to 12 with a year.', e_person_exists: 'This person already exists (same site or NBHPA no.).',
      e_section_player: 'Invalid addition (salaries are positive numbers).', e_on_roster: 'This person is on a roster of this section. Remove them first.',
      e_team_exists: 'This team already exists.', e_team_in_use: 'This team has players or an active captain. Remove them first.', e_roster: 'Invalid addition.',
      e_not_registered: 'This person is not on this section’s player list for this season.', e_already_on_roster: 'Already on a team of this league this season: {team}.',
      e_rules: 'Invalid rules (positive numbers).'
    }
  };
  /* Texts added with the scope bar and the modals. */
  var STR2 = {
    fr: {
      captainsLede: 'Les capitaines de la ligue choisie, équipe par équipe. Un capitaine peut avoir des accès dans plusieurs ligues.',
      teamCaptains: 'Capitaines', noCaptainTeam: 'Aucun capitaine.', addCaptainToTeam: 'Ajouter un capitaine', withoutAccess: 'Capitaines sans accès dans cette ligue ({n})',
      giveAccess: 'Donner un accès', accessTitle: 'Donner un accès · {l}', captainField: 'Capitaine', chooseCaptain: 'Capitaine…', editCaptainTitle: 'Modifier le capitaine',
      newPersonTitle: 'Nouvelle personne', addExisting: 'Ajouter une personne existante', editPersonTitle: 'Modifier {n}', editTeamTitle: 'Modifier l’équipe', newTeamTitle: 'Nouvelle équipe · {l}',
      close: 'Fermer', plAll: 'Toute la section', plIn: 'Dans cette ligue', plFree: 'Sans équipe dans cette ligue', elsewhere: 'Ailleurs :',
      noTeamsLeague: 'Aucune équipe dans cette ligue pour cette saison.',
      tabSetup: 'Configuration', setupLede: 'Ce qui se règle une fois par saison : les saisons, puis pour chaque ligue ses règles et ses équipes (avec le lien vers NBHPA).',
      rulesH: 'Règles', teamsSetup: 'Équipes', nTeamsLg: '{n} équipes', playersShort: 'Joueurs', importLeague: 'Importer les équipes depuis NBHPA',
      setupLink: 'Les équipes se créent et se modifient dans',
      colS: 'J$', colG: 'G$', colSFull: 'Salaire joueur (millions)', colGFull: 'Salaire gardien (millions)', fAll: 'Tous', fAllData: 'Toutes les données',
      fNoSal: 'Sans salaire', fNoBirth: 'Sans naissance', fNoNid: 'Sans no NBHPA', from: 'de', to: 'à',
      fAllPos: 'Toutes positions', fSkaters: 'Joueurs', fGoalies: 'Gardiens', colPos: 'Salaire', colPosFull: 'Salaire à sa position (G$ pour un gardien, J$ sinon), en millions',
      colNid: 'NBHPA', colNidFull: 'No de joueur NBHPA (obligatoire à partir de 2027)', nidField: 'No NBHPA (facultatif)',
      nidHint: 'Le no de joueur NBHPA deviendra obligatoire en 2027 (compte NBHPA requis pour tous). Il lie la personne aux statistiques.',
      editSeason: 'Modifier la saison', confirmActivate: 'Mettre « {n} » en cours ? {o} passera en Archivée (lecture seule).',
      archivedBanner: 'Saison archivée : lecture seule. Pour la modifier, changez son statut dans Configuration.', e_season_archived: 'Cette saison est archivée : lecture seule.',
      liveMismatch: 'Le site public montre la saison {p} (no NBHPA {pn}) ; la saison en cours des outils est {t} (no NBHPA {tn}). Changez l’une des deux (docs/operations.md, « Nouvelle saison »).',
      noLive: 'Aucune saison en cours. Choisissez-en une dans Configuration (Modifier, Statut : En cours).', liveHint: 'Une seule saison est en cours : c’est la référence des outils (capitaines, accueil) et du site public. Une saison archivée est en lecture seule.',
      leagueOn: 'Active cette saison', leagueOffNote: 'Ligue désactivée pour cette saison : elle n’apparaît plus dans les outils pour cette saison, et ne prend plus de remplacements. Ses données restent.',
      e_league_off: 'Cette ligue est désactivée pour cette saison.', e_season_league: 'Réglage invalide.',
      tabHome: 'Accueil', homeTitle: 'Tableau de bord', kToValidate: 'À valider', kNextNight: 'Prochaine soirée', kNoCaptain: 'Équipes sans capitaine', kMissing: 'Données à compléter',
      kOfTeams: 'sur {n} équipes', kOnFile: '{n} remplacement(s) déclaré(s)', kMissSub: 'joueurs sans salaire · {b} sans naissance · {d} sans no NBHPA', kNothing: 'rien à valider', kAllComplete: 'tout est complet',
      pToValidate: 'À valider', seeAllSubs: 'Voir tous les remplacements →', noPending: 'Rien à valider. ✓', pNights: 'Prochaines soirées', pTodo: 'À compléter',
      todoNoCap: '{n} équipe(s) sans capitaine', todoRules: 'Ligues sans règles :', todoMiss: '{n} sans salaire · {b} sans naissance · {d} sans no NBHPA', todoNever: '{n} capitaine(s) jamais connecté(s)',
      todoNone: 'Tout est complet. ✓', auditLink: 'Journal des actions →', nightGames: '{n} match(s)', nightSubs: '{v} validé(s) · {p} à valider', noNight: 'Aucun match à venir.',
      sortDefault: 'Tri par défaut (hommes, femmes, gardiens ; salaire)', editOn: '✎ Modifier', editOff: 'Terminer les modifications', editMode: 'Mode modification',
      tabCal: 'Calendrier', calLede: 'Les soirées de match de la ligue choisie : pour chaque équipe, ce qui change ce soir-là (remplaçants validés ✓ ou à valider !, absents), avec la masse salariale du soir.',
      calNoData: 'Pas de calendrier pour cette saison dans les données.', calNone: 'Aucun match ce soir-là.', backCal: '← Calendrier',
      tabSubs: 'Remplacements', subsLede: 'Les remplacements déclarés dans la ligue choisie, vérifiés avant d’arriver ici : vous les validez. Vous pouvez aussi en déclarer un pour un capitaine.',
      newSub: 'Déclarer un remplacement', backTeams: '← Équipes', backSubs: '← Remplacements', subForTeam: 'Remplacement', subTitle: 'Remplacement · {l}', subSaved: 'Remplacement déclaré.', noSubs: 'Aucun remplacement.',
      sf_pending: 'À valider', sf_approved: 'Validés', sf_refused: 'Refusés', sf_all: 'Tous',
      approve: 'Valider', refuse: 'Refuser', cancelReq: 'Annuler le remplacement', decisionNote: 'Note pour le capitaine (facultatif)',
      confirmApproveFail: 'Des vérifications échouent pour ce remplacement. Le valider quand même ?', confirmCancelReq: 'Annuler ce remplacement ? Il sera supprimé.',
      approved: 'Remplacement validé.', refused: 'Remplacement refusé.', cancelledMsg: 'Remplacement annulé et supprimé.',
      e_not_pending: 'Ce remplacement a déjà été traité.', e_not_open: 'Ce remplacement n’est plus ouvert.', e_decision: 'Décision invalide.',
      e_note_required: 'Une vérification échoue : une note est requise.', e_game: 'Match invalide.', e_replacement: 'Remplacement invalide.',
      ageOn: 'Âge compté', ageOnGame: 'à la date du match', ageOnYear: 'dans l’année du match'
    },
    en: {
      captainsLede: 'The captains of the chosen league, team by team. A captain can have access in several leagues.',
      teamCaptains: 'Captains', noCaptainTeam: 'No captain.', addCaptainToTeam: 'Add a captain', withoutAccess: 'Captains without access in this league ({n})',
      giveAccess: 'Give access', accessTitle: 'Give access · {l}', captainField: 'Captain', chooseCaptain: 'Captain…', editCaptainTitle: 'Edit the captain',
      newPersonTitle: 'New person', addExisting: 'Add an existing person', editPersonTitle: 'Edit {n}', editTeamTitle: 'Edit the team', newTeamTitle: 'New team · {l}',
      close: 'Close', plAll: 'Whole section', plIn: 'In this league', plFree: 'No team in this league', elsewhere: 'Elsewhere:',
      noTeamsLeague: 'No team in this league for this season.',
      tabSetup: 'Setup', setupLede: 'What you set once a season: the seasons, then for each league its rules and its teams (with the NBHPA link).',
      rulesH: 'Rules', teamsSetup: 'Teams', nTeamsLg: '{n} teams', playersShort: 'Players', importLeague: 'Import the teams from NBHPA',
      setupLink: 'Teams are created and edited in',
      colS: 'S$', colG: 'G$', colSFull: 'Skater salary (millions)', colGFull: 'Goalie salary (millions)', fAll: 'All', fAllData: 'All data',
      fNoSal: 'No salary', fNoBirth: 'No birth date', fNoNid: 'No NBHPA no.', from: 'from', to: 'to',
      fAllPos: 'All positions', fSkaters: 'Skaters', fGoalies: 'Goalies', colPos: 'Salary', colPosFull: 'Salary at their position (G$ for a goalie, S$ otherwise), in millions',
      colNid: 'NBHPA', colNidFull: 'NBHPA player no. (required from 2027)', nidField: 'NBHPA no. (optional)',
      nidHint: 'The NBHPA player no. becomes required in 2027 (an NBHPA account for everyone). It links the person to the stats.',
      editSeason: 'Edit the season', confirmActivate: 'Make “{n}” the current season? {o} will become Archived (read only).',
      archivedBanner: 'Archived season: read only. To change it, change its status in Setup.', e_season_archived: 'This season is archived: read only.',
      liveMismatch: 'The public site shows the {p} season (NBHPA no. {pn}); the tools’ current season is {t} (NBHPA no. {tn}). Change one of them (docs/operations.md, “New season”).',
      noLive: 'No current season. Choose one in Setup (Edit, Status: Active).', liveHint: 'One season is current: it is the reference for the tools (captains, home) and the public site. An archived season is read only.',
      leagueOn: 'Active this season', leagueOffNote: 'League switched off for this season: it no longer shows in the tools for this season and takes no replacement. Its data stays.',
      e_league_off: 'This league is switched off for this season.', e_season_league: 'Invalid setting.',
      tabHome: 'Home', homeTitle: 'Dashboard', kToValidate: 'To validate', kNextNight: 'Next game night', kNoCaptain: 'Teams without a captain', kMissing: 'Data to complete',
      kOfTeams: 'of {n} teams', kOnFile: '{n} replacement(s) declared', kMissSub: 'players without a salary · {b} without birth date · {d} without NBHPA no.', kNothing: 'nothing to validate', kAllComplete: 'everything is complete',
      pToValidate: 'To validate', seeAllSubs: 'See all the replacements →', noPending: 'Nothing to validate. ✓', pNights: 'Next game nights', pTodo: 'To complete',
      todoNoCap: '{n} team(s) without a captain', todoRules: 'Leagues without rules:', todoMiss: '{n} without a salary · {b} without birth date · {d} without NBHPA no.', todoNever: '{n} captain(s) never signed in',
      todoNone: 'Everything is complete. ✓', auditLink: 'Action log →', nightGames: '{n} game(s)', nightSubs: '{v} validated · {p} to validate', noNight: 'No upcoming game.',
      sortDefault: 'Default order (men, women, goalies; salary)', editOn: '✎ Edit', editOff: 'Finish editing', editMode: 'Edit mode',
      tabCal: 'Schedule', calLede: 'The game nights of the chosen league: for each team, what changes that night (replacements validated ✓ or to validate !, absent players), with the night’s payroll.',
      calNoData: 'No schedule for this season in the data.', calNone: 'No game that night.', backCal: '← Schedule',
      tabSubs: 'Replacements', subsLede: 'The replacements declared in the chosen league, checked before they get here: you validate them. You can also declare one for a captain.',
      newSub: 'Declare a replacement', backTeams: '← Teams', backSubs: '← Replacements', subForTeam: 'Replacement', subTitle: 'Replacement · {l}', subSaved: 'Replacement declared.', noSubs: 'No replacement.',
      sf_pending: 'To validate', sf_approved: 'Validated', sf_refused: 'Refused', sf_all: 'All',
      approve: 'Validate', refuse: 'Refuse', cancelReq: 'Cancel the replacement', decisionNote: 'Note for the captain (optional)',
      confirmApproveFail: 'Some checks fail for this replacement. Validate it anyway?', confirmCancelReq: 'Cancel this replacement? It will be deleted.',
      approved: 'Replacement validated.', refused: 'Replacement refused.', cancelledMsg: 'Replacement cancelled and deleted.',
      e_not_pending: 'This replacement was already handled.', e_not_open: 'This replacement is no longer open.', e_decision: 'Invalid decision.',
      e_note_required: 'A check fails: a note is required.', e_game: 'Invalid game.', e_replacement: 'Invalid replacement.',
      ageOn: 'Age counted', ageOnGame: 'on the game date', ageOnYear: 'during the game’s year'
    }
  };
  Object.keys(STR2).forEach(function (k) { Object.keys(STR2[k]).forEach(function (n) { STR[k][n] = STR2[k][n]; }); });
  var t = function (k, v) { var s = STR[lang][k] != null ? STR[lang][k] : k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  /* ---------- state ----------
   * Scope: season, section, league. Every working tab shows only that context. Section and league are remembered in this browser. */
  var S = { me: null, step: 'email', email: '', devCode: '', msg: null, tab: 'home', seasons: [], captains: [], audit: [], data: null, seasonId: null,
    section: null, league: null, teams: [], rules: [], players: [], allPeople: [], pq: '', plf: '', pf: { pos: '', sex: '', miss: '', smin: '', smax: '' }, ps: { k: 'grp', d: 1 }, modal: null, accountsOpen: false,
    subs: [], pending: {}, sf: 'pending', sub: null, subFrom: 'subs', flash: null, cal: null, calDate: null, dash: null, edit: false };
  var TABS = ['home', 'teams', 'cal', 'subs', 'players', 'setup', 'audit'];   // audit: a link at the bottom of the home page, not in the menu
  var OLD_TABS = { seasons: 'setup', rules: 'setup', captains: 'teams' };   // old links still land somewhere sensible
  try { var sc = JSON.parse(localStorage.getItem('ldhml-admin-scope') || 'null'); if (sc) { S.section = sc.section || null; S.league = sc.league || null; } } catch (e) { /* storage can be blocked */ }
  function saveScope() { try { localStorage.setItem('ldhml-admin-scope', JSON.stringify({ section: S.section, league: S.league })); } catch (e) { /* ignore */ } }

  function api(path, method, body) {
    return fetch('/api/admin' + path, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); },
        function () { return { ok: false, status: 0, data: { error: 'net' } }; });
  }
  var errMsg = function (r) { return t('e_' + ((r.data && r.data.error) || 'server'), r.data || {}); };
  function say(kind, text) { S.msg = { kind: kind, text: text }; }

  /* ---------- stats data helpers: leagues, teams, players (public) ---------- */
  var leagueOf = function (slug) { return S.data && S.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var site = function () { return (S.data && S.data.siteUrl) || '/'; };
  var nameOf = function (s) { return s && s.name ? (s.name[lang] || s.name.fr) : ''; };
  var curSeason = function () { return S.seasons.filter(function (x) { return x.id === S.seasonId; })[0]; };
  var leagueHome = function (l) { return site() + l.sectionPath + '/' + l.path + '/'; };
  /* A league switched off for the chosen season (season_leagues.enabled = 0) is hidden from the working tabs; Configuration shows it. */
  var leagueOff = function (slug) { return S.rules.some(function (r) { return r.league === slug && r.enabled === 0; }); };
  var sectionLeagues = function () { return S.data ? S.data.leagues.filter(function (l) { return l.section === S.section && !leagueOff(l.slug); }) : []; };
  var money = function (v) { return v == null ? '—' : (Math.round(v * 100) / 100) + 'M'; };   // salaries are in millions
  var personName = function (id) { var p = S.data && S.data.people.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; };
  function personLink(id) {
    var p = S.data && S.data.people.filter(function (x) { return x.id === id; })[0];
    var l = p && leagueOf(Object.keys(p.lg)[0]);
    return l ? '<a class="lnk" href="' + esc(site() + l.sectionPath + '/#player-' + id) + '">' + esc(p.name) + '</a>' : esc(personName(id));
  }
  var personCell = function (p) { return p.site_id ? personLink(p.site_id) : esc(p.name); };
  /* A person in a league context (a team's roster): their page in that league; the section page when they have not played in it. */
  function personIn(slug, p) {
    var dp = p.site_id && S.data && S.data.people.filter(function (x) { return x.id === p.site_id; })[0], l = leagueOf(slug);
    if (!dp || !l || !dp.lg[slug]) return personCell(p);
    return '<a class="lnk" href="' + esc(leagueHome(l) + '#player-' + p.site_id) + '">' + esc(p.name) + '</a>';
  }
  var fmt = function (sec) { return sec ? new Date(sec * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : ''; };
  /* League and team identity (docs/presentation.md): league badges, team chips and crests from shared/look.js. */
  var leagueOnly = function (l, link) { return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { href: link === false ? '' : leagueHome(l), title: l.name, theme: l.theme }); };
  function teamBadge(slug, abb, name, nbhpaId) {
    var l = leagueOf(slug) || { slug: slug, short: slug, name: slug, theme: 'default' };
    return window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, {
      href: l.path ? leagueHome(l) : '', title: l.name, theme: l.theme, teams: [{ abb: abb, name: name, href: nbhpaId && l.path ? leagueHome(l) + '#team-' + nbhpaId : '' }]
    });
  }
  var accessBadge = function (a) { return teamBadge(a.league, a.team_abb, a.team_name, a.team_id); };
  var rosterBadge = function (r) { return teamBadge(r.league, r.abb, r.team_name, r.nbhpa_team_id); };
  function teamHead(tm) {
    var l = leagueOf(tm.league) || { slug: tm.league, teams: [] };
    var dataTeam = (l.teams || []).filter(function (x) { return x.id === tm.nbhpa_team_id; })[0] || {};
    return '<span class="tcell">' + window.LDLook.crest({ abb: tm.abb, logo: dataTeam.logo }, tm.league, 'sm') +
      (tm.nbhpa_team_id && l.path ? '<a class="tl strong" href="' + esc(leagueHome(l) + '#team-' + tm.nbhpa_team_id) + '">' + esc(tm.name) + '</a>' : '<b>' + esc(tm.name) + '</b>') + '</span>';
  }

  /* ---------- the scope bar: season, section, league ---------- */
  function fixScope() {
    var secs = (S.data && S.data.sections) || [];
    if (!secs.some(function (s) { return s.key === S.section; })) S.section = secs.length ? secs[0].key : null;
    var lgs = sectionLeagues();
    if (!lgs.some(function (l) { return l.slug === S.league; })) S.league = lgs.length ? lgs[0].slug : null;
  }
  function seasonSelect() {
    if (!S.seasons.length) return '<p class="note">' + t('noSeason') + '</p>';
    return '<label class="ad-inline">' + t('season') + ' <select class="ctl" id="ad-season">' + S.seasons.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === S.seasonId ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(t('st_' + s.status)) + '</option>';
    }).join('') + '</select></label>';
  }
  /* Équipes and Joueurs open in read mode; "Modifier" shows the controls that change things (they carry "ad-ed"). */
  var editToggle = function () {
    return '<span class="ad-edtog">' + (S.edit ? '<span class="ad-edbadge">' + t('editMode') + '</span><button type="button" class="ad-btn ad-btn-sm" data-act="edit-toggle" aria-pressed="true">' + t('editOff') + '</button>'
      : '<button type="button" class="ad-btn ad-btn-sm ad-ghost" data-act="edit-toggle" aria-pressed="false">' + t('editOn') + '</button>') + '</span>';
  };
  function scopeBar(level, extra) {
    var secs = (S.data && S.data.sections) || [];
    var sec = '<div class="seg" role="group" aria-label="' + esc(t('section')) + '">' + secs.map(function (s) {
      return '<button type="button" data-sec="' + esc(s.key) + '" aria-pressed="' + (S.section === s.key) + '">' + esc(nameOf(s)) + '</button>';
    }).join('') + '</div>';
    var lgs = level === 'league' ? '<div class="ad-lgpick" role="group" aria-label="' + esc(t('league')) + '">' + sectionLeagues().map(function (l) {
      return '<button type="button" class="ad-lgbtn" data-lg="' + esc(l.slug) + '" aria-pressed="' + (S.league === l.slug) + '" title="' + esc(l.name) + '">' + leagueOnly(l, false) + (S.pending[l.slug] ? '<span class="ad-cnt" title="' + esc(t('sf_pending')) + '">' + S.pending[l.slug] + '</span>' : '') + '</button>';
    }).join('') + '</div>' : '';
    return '<div class="ad-scope">' + seasonSelect() + sec + lgs + (extra || '') + '</div>';
  }

  /* ---------- views ---------- */
  function viewLogin() {
    var form = S.step === 'email'
      ? '<form id="f-email" class="ad-form ad-login"><label>' + t('emailLabel') + '<input class="ctl" type="email" name="email" autocomplete="email" required value="' + esc(S.email) + '"></label><button class="ad-btn" type="submit">' + t('sendCode') + '</button></form>'
      : '<p class="lede">' + esc(t('codeSent', { e: S.email })) + '</p>' + (S.devCode ? '<p class="note ad-dev">' + esc(t('devCode', { c: S.devCode })) + '</p>' : '') +
        '<form id="f-code" class="ad-form ad-login"><label>' + t('codeLabel') + '<input class="ctl" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="ad-btn" type="submit">' + t('verify') + '</button></form>' +
        '<p class="note"><button type="button" class="lnk ad-linkbtn" data-act="other-email">' + t('otherEmail') + '</button></p>';
    return '<h1 class="ph">' + t('signIn') + '</h1>' + form;
  }

  /* A captain in a team card: name, email, edit, and × to remove this access. */
  function teamCaptain(c, acc) {
    return '<li class="ad-cap ad-cap-sm' + (c.disabled_at ? ' ad-off' : '') + '"><div class="ad-cap-who"><b>' + esc(c.name) + '</b>' + (c.disabled_at ? ' <em class="subtag">' + t('disabled') + '</em>' : '') +
      '<span class="note">' + esc(c.email) + '</span></div><div class="ad-acts ad-ed"><button type="button" class="lnk ad-linkbtn" data-edit-cap="' + c.id + '">' + t('edit') + '</button>' +
      '<button type="button" class="ad-x" data-revoke="' + acc.id + '" title="' + esc(t('revoke')) + '" aria-label="' + esc(t('revoke')) + '">×</button></div></li>';
  }
  /* A captain account in the accounts panel: everything, with their access of this season as badges. */
  function captainAccount(c) {
    var person = c.person_id ? '<span class="note">' + esc(t('profile')) + ' : ' + personLink(c.person_id) + '</span>' : '';
    var acc = c.access.filter(function (a) { return a.season_id === S.seasonId; });
    return '<li class="ad-cap' + (c.disabled_at ? ' ad-off' : '') + '" data-cap="' + c.id + '"><div class="ad-cap-who"><b>' + esc(c.name) + '</b>' + (c.disabled_at ? ' <em class="subtag">' + t('disabled') + '</em>' : '') +
      '<span>' + esc(c.email) + '</span>' + person + '<span class="note">' + esc(c.last_login_at ? t('lastLogin', { d: fmt(c.last_login_at) }) : t('never')) + '</span>' +
      '<span class="lgbs">' + (acc.length ? acc.map(accessBadge).join('') : '<span class="note">' + t('noAccess') + '</span>') + '</span></div>' +
      '<div class="ad-acts ad-ed">' + (c.disabled_at ? '' : '<button type="button" class="lnk ad-linkbtn" data-access-cap="' + c.id + '">' + t('giveAccess') + '</button>') +
      '<button type="button" class="lnk ad-linkbtn" data-edit-cap="' + c.id + '">' + t('edit') + '</button>' +
      '<button type="button" class="lnk ad-linkbtn" data-' + (c.disabled_at ? 'enable' : 'disable') + '="' + c.id + '">' + t(c.disabled_at ? 'enable' : 'disable') + '</button>' +
      '<button type="button" class="ad-del" data-delete-cap="' + c.id + '" data-name="' + esc(c.name) + '">' + t('del') + '</button></div></li>';
  }
  function accountsPanel() {
    return '<details class="ad-add" id="ad-accounts"' + (S.accountsOpen ? ' open' : '') + '><summary>' + esc(t('accounts', { n: S.captains.length })) + '</summary>' +
      '<p class="ad-ed"><button type="button" class="ad-btn ad-btn-sm" data-act="new-cap">' + t('newCaptain') + '</button></p>' +
      (S.captains.length ? '<ul class="ad-caps">' + S.captains.map(captainAccount).join('') + '</ul>' : '<p class="note">' + t('noCaptains') + '</p>') + '</details>';
  }

  /* Person and salary fields of the forms (salaries in millions). */
  var monthOpts = function (sel) { var o = '<option value="">' + t('month') + '</option>'; for (var i = 1; i <= 12; i++) o += '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + '</option>'; return o; };
  var sexOpts = function (sel) { return '<option value="">—</option><option value="m"' + (sel === 'm' ? ' selected' : '') + '>' + t('sexM') + '</option><option value="f"' + (sel === 'f' ? ' selected' : '') + '>' + t('sexF') + '</option>'; };
  var birthTxt = function (p) { return p.birth_year ? (p.birth_month ? (p.birth_month < 10 ? '0' : '') + p.birth_month + '/' : '') + p.birth_year : '—'; };
  function personFields(p) {
    p = p || {};
    return '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(p.name || '') + '"></label>' +
      '<label>' + t('sex') + '<select class="ctl ad-sm" name="sex">' + sexOpts(p.sex) + '</select></label>' +
      '<label>' + t('birth') + '<span class="ad-pair"><select class="ctl ad-sm" name="birth_month" aria-label="' + esc(t('month')) + '">' + monthOpts(p.birth_month) + '</select>' +
      '<input class="ctl ad-sm" name="birth_year" inputmode="numeric" maxlength="4" placeholder="' + esc(t('year')) + '" aria-label="' + esc(t('year')) + '" value="' + esc(p.birth_year || '') + '"></span></label>' +
      '<label>' + t('nidField') + '<input class="ctl" name="nid" inputmode="numeric" maxlength="12" autocomplete="off" value="' + esc(p.nid || '') + '"></label><p class="note">' + t('nidHint') + '</p>';
  }
  function salaryFields(p) {
    p = p || {};
    return '<label>' + t('salaryS') + '<input class="ctl ad-sm" name="salary_s" inputmode="decimal" value="' + esc(p.salary_s == null ? '' : p.salary_s) + '"></label>' +
      '<label>' + t('salaryG') + '<input class="ctl ad-sm" name="salary_g" inputmode="decimal" value="' + esc(p.salary_g == null ? '' : p.salary_g) + '"></label>';
  }
  /* The league player list (per section and season): sortable columns, filters (name, league, sex, missing data, J$ range).
   * Salaries in millions, one column per position (J$ skater, G$ goalie), the full label on hover. */
  var birthKey = function (p) { return p.birth_year ? p.birth_year * 12 + (p.birth_month || 6) : null; };
  var SORTS = { name: function (p) { return p.name.toLowerCase(); }, sex: function (p) { return p.sex || ''; }, birth: birthKey, nid: function (p) { return p.nid ? Number(p.nid) : null; },
    s: function (p) { return p.salary_s; }, g: function (p) { return p.salary_g; } };
  function sortHead(k, label, title, cls) {
    var on = S.ps.k === k, arrow = '';   // the sort mark comes from the site CSS (th[aria-sort]), as on the stats pages
    return '<th class="' + (cls || '') + '"' + (on ? ' aria-sort="' + (S.ps.d > 0 ? 'ascending' : 'descending') + '"' : '') + '><button type="button" class="ad-sort" data-psort="' + k + '"' +
      (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label) + arrow + '</button></th>';
  }
  function viewPlayers() {
    var head = '<h1 class="ph">' + t('tabPlayers') + '</h1><p class="lede">' + t('playersLede') + '</p>' + scopeBar('section', editToggle());
    if (!curSeason()) return head;
    var q = S.pq.trim().toLowerCase(), lgs = sectionLeagues(), f = S.pf;
    var inLg = function (p) { return p.rosters.some(function (r) { return r.league === S.league; }); };
    var num = function (v) { return v === '' || v == null || isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')); };
    var smin = num(f.smin), smax = num(f.smax);
    /* Position: a goalie on a roster of this section, or a goalie this season in the stats (any league of the section). */
    var dataPos = {}; (S.data ? S.data.people : []).forEach(function (x) { dataPos[x.id] = lgs.map(function (l) { return (x.pos || {})[l.slug] || ''; }).join(''); });
    var plays = function (p, k) { return p.rosters.some(function (r) { return r.pos === k; }) || (p.site_id && (dataPos[p.site_id] || '').indexOf(k) >= 0); };
    var isG = function (p) { return plays(p, 'g'); }, isS = function (p) { return plays(p, 's') || !isG(p); };
    /* The salary the range filters: G$ for goalies, J$ for skaters; with both, each person's salary at their own position. */
    var salOf = function (p) { return f.pos === 'g' ? p.salary_g : f.pos === 's' ? p.salary_s : isG(p) && !plays(p, 's') ? p.salary_g : p.salary_s; };
    var list = S.players.filter(function (p) {
      return (!q || p.name.toLowerCase().indexOf(q) >= 0) && (S.plf === 'in' ? inLg(p) : S.plf === 'free' ? !inLg(p) : true) &&
        (!f.sex || p.sex === f.sex) && (f.miss !== 'sal' || p.salary_s == null || p.salary_g == null) && (f.miss !== 'birth' || !p.birth_year) && (f.miss !== 'nid' || !p.nid) &&
        (f.pos !== 'g' || isG(p)) && (f.pos !== 's' || isS(p)) &&
        (smin == null || (salOf(p) != null && salOf(p) >= smin)) && (smax == null || (salOf(p) != null && salOf(p) <= smax));
    });
    var key = SORTS[S.ps.k] || SORTS.name, d = S.ps.d;
    /* default order (owner): men, women, goalies; salary at their position, high to low */
    if (S.ps.k === 'grp') list = window.LDBuilder.rosterOrder(list.map(function (p) { return { p: p, name: p.name, sex: p.sex, pos: isG(p) && !plays(p, 's') ? 'g' : 's' }; }),
      function (x) { return x.pos === 'g' ? x.p.salary_g : x.p.salary_s; }).map(function (x) { return x.p; });
    else list.sort(function (a, b) {
      var x = key(a), y = key(b);
      if (x == null && y == null) return a.name.localeCompare(b.name, 'fr');
      if (x == null) return 1; if (y == null) return -1;   // empty values last, either way
      return (x < y ? -d : x > y ? d : 0) || a.name.localeCompare(b.name, 'fr');
    });
    var lgName = (leagueOf(S.league) || {}).short || '';
    var seg = function (attr, cur, opts) { return '<div class="seg" role="group">' + opts.map(function (o) { return '<button type="button" ' + attr + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; };
    var filters = seg('data-plf', S.plf, [['', t('plAll')], ['in', t('plIn')], ['free', t('plFree')]]) + (S.plf && lgs.length > 1 ? '<div class="ad-lgpick">' + lgs.map(function (l) {
      return '<button type="button" class="ad-lgbtn" data-lg="' + esc(l.slug) + '" aria-pressed="' + (S.league === l.slug) + '" title="' + esc(l.name) + '">' + leagueOnly(l, false) + '</button>';
    }).join('') + '</div>' : (S.plf ? '<span class="note">' + esc(lgName) + '</span>' : ''));
    var rl = f.pos === 'g' ? ['colG', 'colGFull'] : f.pos === 's' ? ['colS', 'colSFull'] : ['colPos', 'colPosFull'];
    var more = seg('data-pfpos', f.pos, [['', t('fAllPos')], ['s', t('fSkaters')], ['g', t('fGoalies')]]) + seg('data-pfsex', f.sex, [['', t('fAll')], ['m', t('sexM')], ['f', t('sexF')]]) +
      seg('data-pfmiss', f.miss, [['', t('fAllData')], ['sal', t('fNoSal')], ['birth', t('fNoBirth')], ['nid', t('fNoNid')]]) +
      '<span class="ad-range" title="' + esc(t(rl[1])) + '">' + esc(t(rl[0])) + ' <input id="ad-smin" class="ctl ad-xs" data-pf="smin" inputmode="decimal" value="' + esc(f.smin) + '" placeholder="' + esc(t('from')) + '" aria-label="' + esc(t(rl[1]) + ' ' + t('from')) + '">' +
      '–<input id="ad-smax" class="ctl ad-xs" data-pf="smax" inputmode="decimal" value="' + esc(f.smax) + '" placeholder="' + esc(t('to')) + '" aria-label="' + esc(t(rl[1]) + ' ' + t('to')) + '"></span>';
    var rows = list.map(function (p) {
      return '<tr><td><b>' + personCell(p) + '</b></td><td class="num' + (p.nid ? '' : ' ad-missing') + '">' + esc(p.nid || '—') + '</td><td>' + esc(p.sex === 'm' ? t('sexM') : p.sex === 'f' ? t('sexF') : '—') + '</td><td class="num">' + esc(birthTxt(p)) + '</td>' +
        '<td class="num">' + esc(money(p.salary_s)) + '</td><td class="num">' + esc(money(p.salary_g)) + '</td><td><div class="lgbs">' + p.rosters.map(rosterBadge).join('') + '</div></td>' +
        '<td class="ad-acts ad-ed"><button type="button" class="lnk ad-linkbtn" data-edit-person-btn="' + p.id + '">' + t('edit') + '</button>' +
        '<button type="button" class="lnk ad-linkbtn" data-del-list="' + p.sp_id + '" data-name="' + esc(p.name) + '">' + t('removeFromList') + '</button>' +
        '<button type="button" class="ad-del" data-del-person="' + p.id + '" data-name="' + esc(p.name) + '">' + t('del') + '</button></td></tr>';
    }).join('');
    return head + '<p class="ad-btns ad-ed"><button type="button" class="ad-btn ad-btn-sm" data-act="list-add">' + t('addExisting') + '</button><button type="button" class="ad-btn ad-btn-sm" data-act="person-new">' + t('newPerson') + '</button></p>' +
      '<section class="sec"><div class="controls"><input id="ad-pq" class="ctl" type="search" data-pq placeholder="' + esc(t('filterName')) + '" value="' + esc(S.pq) + '" aria-label="' + esc(t('filterName')) + '">' + filters +
      (S.ps.k !== 'grp' ? '<button type="button" class="lnk ad-linkbtn" data-psort="grp">' + t('sortDefault') + '</button>' : '') +
      '<span class="count">' + esc(t('nPlayers', { n: list.length })) + '</span></div><div class="controls ad-more">' + more + '</div>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl ad-tbl ad-players"><thead><tr>' + sortHead('name', t('name')) + sortHead('nid', t('colNid'), t('colNidFull'), 'num') + sortHead('sex', t('sex')) + sortHead('birth', t('birth'), '', 'num') +
        sortHead('s', t('colS'), t('colSFull'), 'num') + sortHead('g', t('colG'), t('colGFull'), 'num') + '<th>' + t('teamsCol') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="empty">' + t('noPlayers') + '</p>' + (S.players.length ? '' : '<p class="note">' + t('seedHint') + '</p>')) + '</section>';
  }

  /* Our teams of the chosen league, with their rosters. */
  function teamCard(tm, l, rule) {
    var missing = 0, total = 0;
    tm.roster.forEach(function (r) { var v = r.pos === 'g' ? r.salary_g : r.salary_s; if (v == null) missing++; else total += v; });
    var cap = rule && rule.salary_cap != null ? rule.salary_cap : null, over = cap != null && total > cap;
    var rows = window.LDBuilder.rosterOrder(tm.roster, function (r) { return r.pos === 'g' ? r.salary_g : r.salary_s; }).map(function (r) {
      return '<tr><td>' + personIn(tm.league, r) + '</td><td class="ad-sx">' + esc(r.sex === 'f' ? t('sexF') : r.sex === 'm' ? t('sexM') : '—') + '</td><td>' + esc(r.pos === 'g' ? t('posG') : t('posS')) + '</td><td class="num">' + esc(money(r.pos === 'g' ? r.salary_g : r.salary_s)) + '</td>' +
        '<td class="ad-ed"><button type="button" class="ad-x" data-roster-remove="' + r.id + '" data-name="' + esc(r.name) + '" title="' + esc(t('removeFromRoster')) + '" aria-label="' + esc(t('removeFromRoster')) + '">×</button></td></tr>';
    }).join('');
    var caps = S.captains.map(function (c) { return { c: c, a: c.access.filter(function (a) { return a.season_id === S.seasonId && a.team_ref === tm.id; })[0] }; }).filter(function (x) { return x.a; });
    return '<article class="ad-team" data-team="' + tm.id + '" style="--tc:' + window.LDLook.colorVar(l.slug, tm.abb) + '"><div class="ad-team-h">' + teamHead(tm) +
      '<span class="note">' + esc(tm.abb) + '</span></div>' +
      '<div class="ad-tcaps"><h3 class="ad-h3">' + t('teamCaptains') + '</h3>' + (caps.length ? '<ul class="ad-caps">' + caps.map(function (x) { return teamCaptain(x.c, x.a); }).join('') + '</ul>' : '<p class="note">' + t('noCaptainTeam') + '</p>') +
      '<button type="button" class="lnk ad-linkbtn ad-ed" data-access-team="' + tm.id + '">+ ' + t('addCaptainToTeam') + '</button></div>' +
      '<h3 class="ad-h3 ad-h3-row">' + t('rosterH') + ' <button type="button" class="ad-btn ad-btn-sm ad-ar" data-sub-team="' + tm.id + '">' + t('subForTeam') + '…</button></h3>' +
      (rows ? '<table class="tbl ad-roster"><tbody>' + rows + '</tbody></table>' : '<p class="note">' + t('emptyRoster') + '</p>') +
      '<p class="ad-payroll' + (over ? ' ad-over' : '') + '">' + esc(cap != null ? t('payrollCap', { v: money(total), c: money(cap) }) : t('payroll', { v: money(total) })) +
      (over ? ' · <b>' + t('overCap') + '</b>' : '') + (missing ? ' · ' + esc(t('missingSalary', { n: missing })) : '') + '</p>' +
      '<form class="ad-grant ad-ed" data-addroster="' + tm.id + '"><input class="ctl" name="person" list="ad-free" autocomplete="off" required aria-label="' + esc(t('personField')) + '" placeholder="' + esc(t('personField')) + '">' +
      '<select class="ctl ad-sm" name="pos" aria-label="' + esc(t('pos')) + '"><option value="s">' + t('posS') + '</option><option value="g">' + t('posG') + '</option></select>' +
      '<button class="ad-btn ad-btn-sm" type="submit">' + t('add') + '</button></form></article>';
  }
  function viewTeams() {
    var s = curSeason(), l = leagueOf(S.league);
    var head = '<h1 class="ph">' + t('tabTeams') + '</h1><p class="lede">' + t('teamsLede') + '</p>' + scopeBar('league', editToggle());
    if (!s || !l) return head;
    var rule = S.rules.filter(function (r) { return r.league === l.slug; })[0];
    var teams = S.teams.filter(function (x) { return x.league === l.slug; });
    var onRoster = {}; teams.forEach(function (x) { x.roster.forEach(function (r) { onRoster[r.person_id] = 1; }); });
    var free = S.players.filter(function (p) { return !onRoster[p.id]; });
    return head + '<p class="note">' + t('setupLink') + ' <a class="lnk" href="#setup">' + t('tabSetup') + '</a></p>' +
      '<datalist id="ad-free">' + free.map(function (p) { return '<option value="' + esc(p.name + ' · #' + p.id) + '">'; }).join('') + '</datalist>' +
      (teams.length ? '<div class="ad-teams">' + teams.map(function (tm) { return teamCard(tm, l, rule); }).join('') + '</div>' : '<p class="note">' + t('noTeamsLeague') + '</p>') +
      accountsPanel();
  }

  /* ---------- Configuration: what is set once a season ----------
   * Seasons; then, for the chosen season, one card per league: its rules (one row) and its team setup (NBHPA link). */
  function leagueSetup(l, s) {
    var val = function (v) { return v == null ? '' : esc(v); };
    var r = S.rules.filter(function (x) { return x.league === l.slug; })[0] || {};
    var teams = S.teams.filter(function (x) { return x.league === l.slug; });
    var have = {}; teams.forEach(function (x) { if (x.nbhpa_team_id) have[x.nbhpa_team_id] = 1; });
    var canImport = s.nbhpa_season_id === S.data.seasonId && (l.teams || []).some(function (x) { return !have[x.id]; });
    var rows = teams.map(function (tm) {
      return '<tr><td>' + teamHead(tm) + '</td><td>' + esc(tm.abb) + '</td><td class="num">' + esc(tm.nbhpa_team_id || '—') + '</td><td class="num">' + tm.roster.length + '</td>' +
        '<td class="ad-acts ad-ar"><button type="button" class="lnk ad-linkbtn" data-edit-team-btn="' + tm.id + '">' + t('edit') + '</button><button type="button" class="ad-del" data-del-team="' + tm.id + '" data-name="' + esc(tm.name) + '">' + t('del') + '</button></td></tr>';
    }).join('');
    var off = leagueOff(l.slug);
    return '<article class="ad-lgset' + (off ? ' ad-lgoff' : '') + '" data-league-setup="' + esc(l.slug) + '"><div class="ad-lgset-h">' + leagueOnly(l) + '<span class="note">' + esc(t('nTeamsLg', { n: teams.length })) + '</span>' +
      '<label class="ad-switch ad-ar"><input type="checkbox" data-league-on="' + esc(l.slug) + '"' + (off ? '' : ' checked') + '> ' + t('leagueOn') + '</label></div>' +
      (off ? '<p class="note ad-offnote">' + t('leagueOffNote') + '</p>' : '') +
      '<h3 class="ad-h3">' + t('rulesH') + '</h3><form class="ad-form ad-row ad-rule" data-rules="' + esc(l.slug) + '">' +
      '<label>' + t('salaryCap') + '<input class="ctl ad-sm" name="salary_cap" inputmode="decimal" value="' + val(r.salary_cap) + '"></label>' +
      '<label>' + t('minAgeM') + '<input class="ctl ad-sm" name="min_age_m" inputmode="numeric" value="' + val(r.min_age_m) + '"></label>' +
      '<label>' + t('minAgeF') + '<input class="ctl ad-sm" name="min_age_f" inputmode="numeric" value="' + val(r.min_age_f) + '"></label>' +
      '<label>' + t('minAgeG') + '<input class="ctl ad-sm" name="min_age_g" inputmode="numeric" value="' + val(r.min_age_g) + '"></label>' +
      '<label>' + t('ageOn') + '<select class="ctl" name="age_on"><option value="game">' + t('ageOnGame') + '</option><option value="year"' + (r.age_on === 'year' ? ' selected' : '') + '>' + t('ageOnYear') + '</option></select></label>' +
      '<label class="ad-wide">' + t('notes') + '<input class="ctl" name="notes" maxlength="500" value="' + val(r.notes) + '"></label>' +
      '<button class="ad-btn ad-btn-sm ad-ar" type="submit">' + t('save') + '</button></form>' +
      '<h3 class="ad-h3">' + t('teamsSetup') + '</h3>' +
      (rows ? '<div class="tbl-wrap"><table class="tbl ad-tbl"><thead><tr><th>' + t('team') + '</th><th>' + t('abb') + '</th><th class="num">NBHPA</th><th class="num">' + t('playersShort') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="note">' + t('noTeamsLeague') + '</p>') +
      '<p class="ad-btns ad-ar"><button type="button" class="ad-btn ad-btn-sm" data-team-new="' + esc(l.slug) + '">' + t('newTeam') + '</button>' +
      (canImport ? '<button type="button" class="ad-btn ad-btn-sm" data-import-league="' + esc(l.slug) + '">' + t('importLeague') + '</button>' : '') + '</p></article>';
  }
  function viewSetup() {
    var s = curSeason();
    var seasonRows = S.seasons.map(function (x) { return '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.key) + '</td><td class="num">' + esc(x.nbhpa_season_id || '') + '</td><td>' + esc(t('st_' + x.status)) + '</td><td>' + esc(fmt(x.created_at)) + '</td><td class="ad-acts"><button type="button" class="lnk ad-linkbtn" data-edit-season="' + x.id + '">' + t('edit') + '</button><button type="button" class="ad-del" data-delete-season="' + x.id + '" data-name="' + esc(x.name) + '">' + t('del') + '</button></td></tr>'; }).join('');
    var html = '<h1 class="ph">' + t('tabSetup') + '</h1><p class="lede">' + t('setupLede') + '</p>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('seasons') + '</h2></div><p class="note">' + t('seasonHint') + '</p>' +
      (S.seasons.length ? '<div class="tbl-wrap"><table class="tbl ad-tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('key') + '</th><th class="num">' + t('nbhpaId') + '</th><th>' + t('status') + '</th><th>' + t('created') + '</th><th></th></tr></thead><tbody>' + seasonRows + '</tbody></table></div>' : '<p class="empty">' + t('noSeasons') + '</p>') +
      '<p><button type="button" class="ad-btn ad-btn-sm" data-act="season-new">' + t('newSeason') + '</button></p></section>';
    if (!s || !S.data) return html;
    return html + '<div class="ad-scope">' + seasonSelect() + '</div>' + (S.data.sections || []).map(function (sec) {
      return '<section class="sec"><div class="sec-h"><h2>' + esc(nameOf(sec)) + '</h2></div><div class="ad-lgsets">' +
        S.data.leagues.filter(function (l) { return l.section === sec.key; }).map(function (l) { return leagueSetup(l, s); }).join('') + '</div></section>';
    }).join('');
  }
  /* ---------- Replacements: the league's queue and history; admins can also build a request for a captain ---------- */
  var builderCtx = function () {
    return { lang: lang, data: S.data, api: api,
      onSaved: function (res) { S.flash = { kind: 'ok', text: res.status === 'approved' ? t('approved') : t('subSaved') }; S.sub = null; location.hash = '#' + S.subFrom; },
      onCancel: function () { S.sub = null; location.hash = '#' + S.subFrom; } };
  };
  function subActions(q) {
    if (q.status === 'pending') return '<div class="bd-acts ad-ar" data-decide-box="' + q.id + '"><input class="ctl" name="dnote" maxlength="1000" placeholder="' + esc(t('decisionNote')) + '" aria-label="' + esc(t('decisionNote')) + '">' +
      '<button type="button" class="ad-btn ad-btn-sm" data-decide="approve" data-id="' + q.id + '" data-result="' + esc(q.result) + '">' + t('approve') + '</button>' +
      '<button type="button" class="ad-del" data-decide="refuse" data-id="' + q.id + '">' + t('refuse') + '</button></div>';
    if (q.status === 'approved') return '<div class="bd-acts ad-ar"><button type="button" class="lnk ad-linkbtn" data-cancel-req="' + q.id + '">' + t('cancelReq') + '</button></div>';
    return '';
  }
  /* The builder, a page of its own (#subs/new, or #subs/new/<team> from a team card). */
  function viewSubBuild() {
    var tm = S.sub.teamId && S.teams.filter(function (x) { return x.id === S.sub.teamId; })[0];
    var l = leagueOf(tm ? tm.league : S.league);
    S.sub.league = S.league;
    if (S.sub.pick) { S.sub.teams = leagueTeams(); if (!S.sub.teamId && S.sub.teams.length === 1) S.sub.teamId = S.sub.teams[0].id; }
    return '<p class="ad-back"><a class="lnk" href="#' + S.subFrom + '">' + t(S.subFrom === 'teams' ? 'backTeams' : S.subFrom === 'cal' ? 'backCal' : 'backSubs') + '</a></p>' +
      '<h1 class="ph">' + t('newSub') + '</h1>' + (l ? '<p>' + leagueOnly(l) + '</p>' : '') + '<div class="bd-page" id="ad-builder"></div>';
  }
  var leagueTeams = function () { return S.teams.filter(function (x) { return x.league === S.league; }).map(function (x) { return { id: x.id, name: x.name, abb: x.abb }; }); };
  /* ---------- Home: the dashboard (what needs the admins now) ----------
   * Four key numbers; the replacements to validate (soonest game first, with Valider / Refuser); the next game night of each
   * league; a to-do list where each item opens the place to fix it. The action log is a link at the bottom. */
  var torontoToday = function () { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); };
  function viewHome() {
    var live = S.seasons.filter(function (x) { return x.status === 'active'; })[0];
    var warn = !S.seasons.length ? '' : !live ? '<p class="ad-msg ad-err" role="alert">' + esc(t('noLive')) + '</p>'
      : S.data && live.nbhpa_season_id !== S.data.seasonId ? '<p class="ad-msg ad-err" role="alert">' + esc(t('liveMismatch', { p: S.data.seasonName, pn: S.data.seasonId, t: live.name, tn: live.nbhpa_season_id || '—' })) + '</p>' : '';
    var head = '<h1 class="ph">' + t('homeTitle') + '</h1>' + warn + '<div class="ad-scope">' + seasonSelect() + '</div>';
    var s = curSeason(), d = S.dash;
    if (!s || !d || !S.data) return head + '<p class="ad-foot-link"><a class="lnk" href="#audit">' + t('auditLink') + '</a></p>';
    var ctx = builderCtx(), today = torontoToday(), open = function (q) { return q.status === 'pending' || q.status === 'approved'; };
    var tile = function (cls, label, value, sub, href) { return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="ad-kpi ' + cls + '"><span class="ad-kl">' + esc(label) + '</span><span class="ad-kv">' + value + '</span>' + (sub ? '<span class="ad-ks">' + sub + '</span>' : '') + '</' + (href ? 'a' : 'div') + '>'; };
    var pending = S.subs.filter(function (q) { return q.status === 'pending'; }).sort(function (a, b) { return (a.game_date + (a.game_time || '')).localeCompare(b.game_date + (b.game_time || '')); });
    var byLg = {}; pending.forEach(function (q) { byLg[q.league] = (byLg[q.league] || 0) + 1; });
    var pendSub = Object.keys(byLg).map(function (slug) { var l = leagueOf(slug); return l ? leagueOnly(l, false) + ' <b>' + byLg[slug] + '</b>' : ''; }).join(' ') || esc(t('kNothing'));
    // the next game night of each league (the schedule is the stats snapshot of this season)
    var inData = s.nbhpa_season_id === S.data.seasonId;
    var nights = inData ? S.data.leagues.filter(function (l) { return !leagueOff(l.slug); }).map(function (l) {
      var gs = (l.games || []).filter(function (g) { return !g.cancelled && g.date >= today; }), date = gs.length ? gs.map(function (g) { return g.date; }).sort()[0] : null;
      var subs = date ? S.subs.filter(function (q) { return q.league === l.slug && q.game_date === date && open(q); }) : [];
      return { l: l, date: date, games: gs.filter(function (g) { return g.date === date; }).length, v: subs.filter(function (q) { return q.status === 'approved'; }).length, p: subs.filter(function (q) { return q.status === 'pending'; }).length };
    }).filter(function (n) { return n.date; }).sort(function (a, b) { return a.date.localeCompare(b.date); }) : [];
    var first = nights[0], firstDay = first ? nights.filter(function (n) { return n.date === first.date; }) : [];
    var nextV = first ? esc(window.LDBuilder.day(ctx, first.date)) : '—';
    var nextS = first ? firstDay.map(function (n) { return leagueOnly(n.l, false); }).join(' ') + ' · ' + esc(t('kOnFile', { n: firstDay.reduce(function (a, n) { return a + n.v + n.p; }, 0) })) : esc(t('noNight'));
    var miss = d.missing.reduce(function (a, m) { return { s: a.s + (m.no_salary || 0), b: a.b + (m.no_birth || 0), n: a.n + (m.no_nid || 0) }; }, { s: 0, b: 0, n: 0 });
    var kpis = '<div class="ad-kpis">' + tile('ad-k-val' + (pending.length ? ' ad-k-hot' : ''), t('kToValidate'), String(pending.length), pendSub, '#subs') +
      tile('ad-k-night', t('kNextNight'), nextV, nextS, first ? '#cal' : '') +
      tile('ad-k-cap', t('kNoCaptain'), String(d.noCaptain.length), esc(t('kOfTeams', { n: d.teams })), '#teams') +
      tile('ad-k-miss', t('kMissing'), String(miss.s), esc(miss.s || miss.b || miss.n ? t('kMissSub', { b: miss.b, d: miss.n }) : t('kAllComplete')), '#players') + '</div>';
    var val = '<section class="ad-panel"><h2 class="ad-ph">' + t('pToValidate') + '</h2>' +
      (pending.length ? '<div class="bd-reqs">' + pending.slice(0, 6).map(function (q) { return window.LDBuilder.requestCard(q, ctx, subActions(q), { league: true }); }).join('') + '</div>' : '<p class="note">' + t('noPending') + '</p>') +
      '<p><a class="lnk" href="#subs">' + t('seeAllSubs') + '</a></p></section>';
    var nightsP = '<section class="ad-panel"><h2 class="ad-ph">' + t('pNights') + '</h2>' + (nights.length ? '<ul class="ad-nights">' + nights.map(function (n) {
      return '<li><button type="button" class="ad-night" data-home-cal="' + esc(n.l.slug) + ':' + n.date + '">' + leagueOnly(n.l, false) + '<b>' + esc(window.LDBuilder.day(ctx, n.date)) + '</b>' +
        '<span class="note">' + esc(t('nightGames', { n: n.games })) + (n.v + n.p ? ' · ' + esc(t('nightSubs', { v: n.v, p: n.p })) : '') + '</span></button></li>';
    }).join('') + '</ul>' : '<p class="note">' + t('noNight') + '</p>') + '</section>';
    var todo = [], noCap = d.noCaptain.filter(function (x) { return !leagueOff(x.league); });
    if (noCap.length) {
      var capByLg = {}; noCap.forEach(function (x) { (capByLg[x.league] = capByLg[x.league] || []).push(x); });
      todo.push('<li><b>' + esc(t('todoNoCap', { n: noCap.length })) + '</b><div class="lgbs">' + Object.keys(capByLg).map(function (slug) {
        var l = leagueOf(slug) || { slug: slug, short: slug, name: slug, theme: 'default' };
        return '<button type="button" class="ad-lgbtn" data-home-teams="' + esc(slug) + '">' + window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { theme: l.theme, teams: capByLg[slug].map(function (x) { return { abb: x.abb, name: x.name }; }) }) + '</button>';
      }).join('') + '</div></li>');
    }
    var noRules = S.data.leagues.filter(function (l) { return !leagueOff(l.slug) && d.rulesLeagues.indexOf(l.slug) < 0; });
    if (noRules.length) todo.push('<li><b>' + esc(t('todoRules')) + '</b> <a class="lgbs ad-todo-a" href="#setup">' + noRules.map(function (l) { return leagueOnly(l, false); }).join('') + '</a></li>');
    d.missing.forEach(function (m) {
      if (!m.no_salary && !m.no_birth && !m.no_nid) return;
      var sec = (S.data.sections || []).filter(function (x) { return x.key === m.section; })[0];
      var link = function (kind, text) { return '<button type="button" class="lnk ad-linkbtn" data-home-miss="' + esc(m.section) + ':' + kind + '">' + esc(text) + '</button>'; };
      todo.push('<li><b>' + esc(nameOf(sec) || m.section) + ' :</b> ' + link('sal', m.no_salary + ' ' + t('fNoSal').toLowerCase()) + ' · ' + link('birth', m.no_birth + ' ' + t('fNoBirth').toLowerCase()) + ' · ' + link('nid', m.no_nid + ' ' + t('fNoNid').toLowerCase()) + '</li>');
    });
    if (d.captainsNeverIn) todo.push('<li><button type="button" class="lnk ad-linkbtn" data-home-accounts>' + esc(t('todoNever', { n: d.captainsNeverIn })) + '</button></li>');
    var todoP = '<section class="ad-panel"><h2 class="ad-ph">' + t('pTodo') + '</h2>' + (todo.length ? '<ul class="ad-todo">' + todo.join('') + '</ul>' : '<p class="note">' + t('todoNone') + '</p>') + '</section>';
    return head + kpis + '<div class="ad-grid2"><div class="ad-col">' + val + '</div><div class="ad-col">' + nightsP + todoP + '</div></div>' +
      '<p class="ad-foot-link"><a class="lnk" href="#audit">' + t('auditLink') + '</a></p>';
  }
  /* ---------- Calendar: the game nights of the league, each game with both teams' actual lineups ---------- */
  function viewCal() {
    var head = '<h1 class="ph">' + t('tabCal') + '</h1><p class="lede">' + t('calLede') + '</p>' + scopeBar('league');
    var c = S.cal;
    if (!curSeason() || !leagueOf(S.league) || !c) return head;
    if (c.noData) return head + '<p class="note">' + t('calNoData') + '</p>';
    var ctx = builderCtx();
    var chips = '<div class="ld-dates" role="group" aria-label="' + esc(t('tabCal')) + '">' + c.dates.map(function (d) {
      return '<button type="button" data-cal-date="' + d + '" aria-pressed="' + (d === c.date) + '"' + (d < c.today ? ' class="ld-past"' : '') + '>' + esc(window.LDBuilder.day(ctx, d)) + '</button>'; }).join('') + '</div>';
    var act = function (lu, g) { return lu.team.id ? '<button type="button" class="lnk ad-linkbtn ad-ar" data-sub-game="' + lu.team.id + ':' + g.id + '">' + t('subForTeam') + '…</button>' : ''; };
    return head + chips + (c.date ? '<h2 class="ad-h3">' + esc(window.LDBuilder.day(ctx, c.date)) + '</h2>' : '') +
      (c.games.length ? '<div class="ld-nights">' + c.games.map(function (item) { return window.LDBuilder.gameHtml(item, ctx, act); }).join('') + '</div>' : '<p class="note">' + t('calNone') + '</p>');
  }
  function viewSubs() {
    if (S.sub) return viewSubBuild();
    var s = curSeason(), l = leagueOf(S.league);
    var head = '<h1 class="ph">' + t('tabSubs') + '</h1><p class="lede">' + t('subsLede') + '</p>' + scopeBar('league');
    if (!s || !l) return head;
    var mine = S.subs.filter(function (q) { return q.league === l.slug; });
    var list = mine.filter(function (q) { return !S.sf || q.status === S.sf; });
    var n = function (st) { return mine.filter(function (q) { return q.status === st; }).length; };
    var seg = '<div class="seg" role="group">' + ['pending', 'approved', 'refused', ''].map(function (k) {
      return '<button type="button" data-sf="' + k + '" aria-pressed="' + (S.sf === k) + '">' + esc(t('sf_' + (k || 'all'))) + (k ? ' (' + n(k) + ')' : '') + '</button>';
    }).join('') + '</div>';
    return head + '<p class="ad-btns ad-ar"><button type="button" class="ad-btn ad-btn-sm" data-act="sub-new">' + t('newSub') + '</button></p>' +
      '<section class="sec"><div class="controls">' + seg + '</div>' +
      (list.length ? '<div class="bd-reqs">' + list.map(function (q) { return window.LDBuilder.requestCard(q, builderCtx(), subActions(q)); }).join('') + '</div>' : '<p class="empty">' + t('noSubs') + '</p>') + '</section>';
  }
  function viewAudit() {
    var rows = S.audit.map(function (a) { return '<tr><td>' + esc(fmt(a.at)) + '</td><td>' + esc(a.actor_name || (a.actor_kind === 'system' ? t('system') : a.actor_kind + ':' + a.actor_id)) + '</td><td><code>' + esc(a.action) + '</code></td><td>' + esc(a.target || '') + '</td><td class="ad-detail">' + esc(a.detail || '') + '</td></tr>'; }).join('');
    return '<h1 class="ph">' + t('audit') + '</h1><p class="lede">' + t('auditNote') + '</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('when') + '</th><th>' + t('who') + '</th><th>' + t('what') + '</th><th>' + t('target') + '</th><th>' + t('detail') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- modals: every add and edit form ----------
   * S.modal = { kind, id?, team? }. One modal at a time; Escape, the backdrop or the close button closes it. */
  var peopleList = function () { return S.data ? S.data.people.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); }) : []; };
  var capPeople = function () { return '<datalist id="ad-people">' + peopleList().map(function (p) { return '<option value="' + esc(p.name + ' · ' + p.id) + '">'; }).join('') + '</datalist>'; };
  var btns = '<div class="ad-modal-f"><button type="button" class="lnk ad-linkbtn" data-act="close-modal">' + 'CANCEL' + '</button><button class="ad-btn" type="submit">' + 'SAVE' + '</button></div>';
  var footer = function (saveLabel) { return btns.replace('CANCEL', t('cancel')).replace('SAVE', saveLabel || t('save')); };
  function modalBody(m) {
    var cap = m.id && S.captains.filter(function (c) { return c.id === m.id; })[0];
    var l = leagueOf(S.league);
    if (m.kind === 'cap-new') return { title: t('newCaptain'), body: '<form id="f-cap" class="ad-form ad-col">' +
      '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80"></label><label>' + t('email') + '<input class="ctl" type="email" name="email" required></label>' +
      '<label>' + t('player') + '<input class="ctl" name="person" list="ad-people" autocomplete="off"></label><p class="note">' + t('playerHint') + '</p>' + capPeople() + footer(t('create')) + '</form>' };
    if (m.kind === 'cap-edit' && cap) return { title: t('editCaptainTitle'), body: '<form class="ad-form ad-col" data-edit="' + cap.id + '">' +
      '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(cap.name) + '"></label>' +
      '<label>' + t('email') + '<input class="ctl" type="email" name="email" required value="' + esc(cap.email) + '"></label>' +
      '<label>' + t('player') + '<input class="ctl" name="person" list="ad-people" autocomplete="off" value="' + esc(cap.person_id ? personName(cap.person_id) + ' · ' + cap.person_id : '') + '"></label>' +
      '<p class="note">' + t('editEmailNote') + '</p>' + capPeople() + footer() + '</form>' };
    if (m.kind === 'access' && l) {
      var teams = S.teams.filter(function (x) { return x.league === l.slug; });
      /* From a team: pick an existing captain, or create a new one (created, then given the access, in one step). */
      var capField = m.id ? '<input type="hidden" name="captain" value="' + m.id + '"><p><b>' + esc((cap || {}).name || '') + '</b></p>'
        : '<label>' + t('captainField') + '<select class="ctl" name="captain"><option value="">' + t('chooseCaptain') + '</option>' + S.captains.filter(function (c) { return !c.disabled_at; }).map(function (c) {
          return '<option value="' + c.id + '">' + esc(c.name) + ' · ' + esc(c.email) + '</option>'; }).join('') + '</select></label>' +
          '<fieldset class="ad-or"><legend>' + t('orNewCaptain') + '</legend>' +
          '<label>' + t('name') + '<input class="ctl" name="name" maxlength="80"></label><label>' + t('email') + '<input class="ctl" type="email" name="email"></label>' +
          '<label>' + t('player') + '<input class="ctl" name="person" list="ad-people" autocomplete="off"></label>' + capPeople() + '</fieldset>';
      var teamField = m.team ? '<input type="hidden" name="team" value="' + m.team + '"><p>' + teamHead(teams.filter(function (x) { return x.id === m.team; })[0] || { abb: '?', name: '?', league: l.slug }) + '</p>'
        : '<label>' + t('team') + '<select class="ctl" name="team" required><option value="">' + t('chooseTeam') + '</option>' + teams.map(function (x) {
          return '<option value="' + x.id + '">' + esc(x.name) + ' (' + esc(x.abb) + ')</option>'; }).join('') + '</select></label>';
      return { title: t('accessTitle', { l: l.name }), body: '<form id="f-access" class="ad-form ad-col">' + teamField + capField + footer(t('grant')) + '</form>' };
    }
    if (m.kind === 'list-add') {
      var inList = {}; S.players.forEach(function (p) { inList[p.id] = 1; });
      return { title: t('addToList'), body: '<form id="f-addlist" class="ad-form ad-col"><label>' + t('personField') + '<input class="ctl" name="person" list="ad-allpeople" autocomplete="off" required></label>' + salaryFields() +
        '<datalist id="ad-allpeople">' + S.allPeople.filter(function (p) { return !inList[p.id]; }).map(function (p) { return '<option value="' + esc(p.name + ' · #' + p.id) + '">'; }).join('') + '</datalist>' + footer(t('add')) + '</form>' };
    }
    if (m.kind === 'person-new') return { title: t('newPersonTitle'), body: '<form id="f-newperson" class="ad-form ad-col">' + personFields() + salaryFields() + footer(t('create')) + '</form>' };
    var p = m.id && S.players.filter(function (x) { return x.id === m.id; })[0];
    if (m.kind === 'person-edit' && p) return { title: t('editPersonTitle', { n: p.name }), body: '<form class="ad-form ad-col" data-edit-person="' + p.id + '">' +
      '<input type="hidden" name="site_id" value="' + esc(p.site_id || '') + '">' + personFields(p) + salaryFields(p) + footer() + '</form>' };
    var tm = m.id && S.teams.filter(function (x) { return x.id === m.id; })[0];
    var teamFields = function (x) { x = x || {}; return '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="80" value="' + esc(x.name || '') + '"></label>' +
      '<label>' + t('abb') + '<input class="ctl ad-sm" name="abb" required maxlength="6" value="' + esc(x.abb || '') + '"></label>' +
      '<label>' + t('nbhpaTeam') + '<input class="ctl ad-sm" name="nbhpa" inputmode="numeric" value="' + esc(x.nbhpa_team_id || '') + '"></label>'; };
    if (m.kind === 'team-edit' && tm) return { title: t('editTeamTitle'), body: '<form class="ad-form ad-col" data-edit-team="' + tm.id + '">' + teamFields(tm) + footer() + '</form>' };
    var nl = leagueOf(m.league) || l;
    if (m.kind === 'team-new' && nl) return { title: t('newTeamTitle', { l: nl.name }), body: '<form class="ad-form ad-col" data-newteam="' + esc(nl.slug) + '">' + teamFields() + footer(t('create')) + '</form>' };
    if (m.kind === 'season-new') {
      var d = S.data || {}, known = S.seasons.some(function (x) { return x.nbhpa_season_id === d.seasonId; });
      return { title: t('newSeason'), body: '<form id="f-season" class="ad-form ad-col">' +
        '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="60" value="' + esc(known ? '' : (d.seasonName || '')) + '"></label>' +
        '<label>' + t('nbhpaId') + '<input class="ctl" name="nbhpa" inputmode="numeric" value="' + esc(known ? '' : (d.seasonId || '')) + '"></label>' +
        '<label>' + t('status') + statusSelect(S.seasons.some(function (x) { return x.status === 'active'; }) ? 'upcoming' : 'active') + '</label>' +
        '<p class="note">' + t('seasonHint') + ' ' + t('liveHint') + '</p>' + footer(t('create')) + '</form>' };
    }
    var se = m.kind === 'season-edit' && S.seasons.filter(function (x) { return x.id === m.id; })[0];
    if (se) return { title: t('editSeason'), body: '<form class="ad-form ad-col" data-edit-season-f="' + se.id + '">' +
      '<label>' + t('name') + '<input class="ctl" name="name" required maxlength="60" value="' + esc(se.name) + '"></label>' +
      '<label>' + t('nbhpaId') + '<input class="ctl" name="nbhpa" inputmode="numeric" value="' + esc(se.nbhpa_season_id || '') + '"></label>' +
      '<label>' + t('status') + statusSelect(se.status) + '</label><p class="note">' + t('liveHint') + '</p>' + footer() + '</form>' };
    return null;
  }
  var statusSelect = function (cur) { return '<select class="ctl" name="status">' + ['active', 'upcoming', 'archived'].map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + t('st_' + k) + '</option>'; }).join('') + '</select>'; };
  function modalHtml(msg) {
    var b = S.modal && modalBody(S.modal);
    if (!b) { S.modal = null; return ''; }
    return '<div class="ad-modal-back" data-act="close-modal"></div><div class="ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-mt">' +
      '<div class="ad-modal-h"><h2 id="ad-mt">' + esc(b.title) + '</h2><button type="button" class="ad-x" data-act="close-modal" aria-label="' + esc(t('close')) + '">×</button></div>' + msg + b.body + '</div>';
  }
  function openModal(m) {
    S.modal = m; S.msg = null; render();
    var f = $('#modal .ad-modal input:not([type=hidden]), #modal .ad-modal select'); if (f) f.focus();
  }

  function render() {
    document.documentElement.lang = lang;
    var pend = Object.keys(S.pending).reduce(function (a, k) { return a + S.pending[k]; }, 0);
    var tabs = [['home', t('tabHome')], ['teams', t('tabTeams')], ['cal', t('tabCal')], ['subs', t('tabSubs') + (pend ? ' (' + pend + ')' : '')], ['players', t('tabPlayers')], ['setup', t('tabSetup')]];
    $('#top').innerHTML = '<div class="wrap top-in sec-top"><a class="brand" href="/admin/"><span><b>LDHML <i>Admin</i></b><small>' + esc(S.me ? S.me.email : t('title')) + '</small></span></a>' +
      (S.me ? '<nav class="nav" aria-label="Admin">' + tabs.map(function (x) { return '<a href="#' + x[0] + '"' + (S.tab === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>' : '') +
      '<div class="ad-tools"><button type="button" class="lgbtn" data-act="lang">' + t('lang') + '</button>' + (S.me ? '<button type="button" class="lgbtn" data-act="logout">' + t('signOut') + '</button>' : '') + '</div></div>';
    var msg = S.msg ? '<p class="ad-msg ad-' + S.msg.kind + '" role="' + (S.msg.kind === 'err' ? 'alert' : 'status') + '">' + esc(S.msg.text) + '</p>' : '';
    var views = { home: viewHome, cal: viewCal, subs: viewSubs, players: viewPlayers, teams: viewTeams, setup: viewSetup, audit: viewAudit };
    /* A message about a modal's form shows in the modal. */
    $('#main').innerHTML = (S.modal ? '' : msg) + (!S.me ? viewLogin() : (views[S.tab] || viewHome)());
    var archived = !!(S.me && curSeason() && curSeason().status === 'archived' && S.tab !== 'audit');
    $('#main').classList.toggle('ad-editing', !!(S.me && S.edit && !archived && (S.tab === 'teams' || S.tab === 'players')));
    $('#main').classList.toggle('ad-archived', archived);
    if (archived && !S.modal) $('#main').insertAdjacentHTML('afterbegin', '<p class="ad-msg ad-arch" role="status">' + esc(t('archivedBanner')) + '</p>');
    $('#modal').innerHTML = S.me && S.modal ? modalHtml(msg) : '';
    document.documentElement.classList.toggle('ad-modal-open', !!(S.me && S.modal));
    if (S.me && S.sub && S.tab === 'subs') window.LDBuilder.mount($('#ad-builder'), S.sub, builderCtx());
    $('#foot').innerHTML = '<p>' + t('foot') + '</p>';
    document.title = 'LDHML | ' + t('title');
  }

  /* ---------- data ---------- */
  function load() {
    return Promise.all([api('/seasons'), api('/captains'), S.tab === 'audit' ? api('/audit') : Promise.resolve(null)]).then(function (rs) {
      if (rs[0].status === 401) { S.me = null; S.step = 'email'; S.modal = null; say('err', t('e_session')); return; }
      S.seasons = rs[0].data.seasons || [];
      S.captains = rs[1].data.captains || [];
      if (rs[2]) S.audit = rs[2].data.audit || [];
      if (!S.seasons.some(function (s) { return s.id === S.seasonId; })) {
        var cur = S.seasons.filter(function (s) { return s.status === 'active'; })[0] || S.seasons.filter(function (s) { return S.data && s.nbhpa_season_id === S.data.seasonId; })[0] || S.seasons[0];
        S.seasonId = cur ? cur.id : null;
      }
      fixScope();
      var more = [];
      if (S.seasonId) more.push(api('/rules?season=' + S.seasonId).then(function (r) { S.rules = r.data.rules || []; }));
      if (S.seasonId) more.push(api('/replacements/pending?season=' + S.seasonId).then(function (r) { S.pending = r.data.counts || {}; }));
      if (S.seasonId && S.tab === 'cal' && S.league) more.push(api('/lineups?season=' + S.seasonId + '&league=' + encodeURIComponent(S.league) + (S.calDate ? '&date=' + S.calDate : '')).then(function (r) { S.cal = r.ok ? r.data : null; if (S.cal) S.calDate = S.cal.date; }));
      if (S.seasonId && S.tab === 'home') more.push(api('/dashboard?season=' + S.seasonId).then(function (r) { S.dash = r.ok ? r.data : null; }));
      if (S.seasonId && (S.tab === 'subs' || S.tab === 'home')) more.push(api('/replacements?season=' + S.seasonId).then(function (r) { S.subs = r.data.replacements || []; }));
      if (S.seasonId && ['teams', 'setup', 'subs'].indexOf(S.tab) >= 0) more.push(api('/teams?season=' + S.seasonId).then(function (r) { S.teams = r.data.teams || []; S.rules = r.data.rules || []; }));
      if (S.seasonId && S.section && ['players', 'teams'].indexOf(S.tab) >= 0) more.push(api('/people?season=' + S.seasonId + '&section=' + S.section).then(function (r) { S.players = r.data.players || []; }));
      if (S.tab === 'players') more.push(api('/people?all=1').then(function (r) { S.allPeople = r.data.people || []; }));
      return Promise.all(more);
    });
  }
  var refresh = function () { return load().then(render); };
  function done(r, okText) {
    if (r.ok) { S.modal = null; say('ok', okText || t('saved')); return refresh(); }
    if (r.status === 401) { S.me = null; S.step = 'email'; S.modal = null; }
    say('err', errMsg(r)); render();
  }
  var numOrNull = function (s) { return s === '' ? null : Number(String(s).replace(',', '.')); };
  var personBody = function (v) { return { name: v('name'), sex: v('sex') || null, birth_month: v('birth_month') || null, birth_year: v('birth_year') || null, site_id: v('site_id') || null, nid: v('nid') || null }; };
  var listBody = function (v, personId) { return { season_id: S.seasonId, section: S.section, person_id: personId, salary_s: numOrNull(v('salary_s')), salary_g: numOrNull(v('salary_g')) }; };

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
      api('/captains/' + f.getAttribute('data-edit'), 'POST', { name: v('name'), email: v('email'), person_id: pm ? pm[0] : null }).then(function (r) { done(r); });
    } else if (f.id === 'f-cap') {
      var m = /L\d{4,}/.exec(v('person'));
      api('/captains', 'POST', { name: v('name'), email: v('email'), person_id: m ? m[0] : null }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-edit-season-f')) {
      var sid = Number(f.getAttribute('data-edit-season-f')), live = S.seasons.filter(function (x) { return x.status === 'active' && x.id !== sid; })[0];
      if (v('status') === 'active' && live && !window.confirm(t('confirmActivate', { n: v('name'), o: live.name }))) return;
      api('/seasons/' + sid, 'POST', { name: v('name'), nbhpa_season_id: v('nbhpa'), status: v('status') }).then(function (r) { done(r); });
    } else if (f.id === 'f-season') {
      var live2 = S.seasons.filter(function (x) { return x.status === 'active'; })[0];
      if (v('status') === 'active' && live2 && !window.confirm(t('confirmActivate', { n: v('name'), o: live2.name }))) return;
      api('/seasons', 'POST', { name: v('name'), nbhpa_season_id: v('nbhpa'), status: v('status') }).then(function (r) { done(r); });
    } else if (f.id === 'f-access') {
      var grant = function (capId) { api('/access', 'POST', { captain_id: capId, team_ref: Number(v('team')) }).then(function (r) { done(r); }); };
      if (v('captain')) { grant(Number(v('captain'))); return; }
      if (!v('name') || !v('email')) { say('err', t('e_pickOrNew')); render(); return; }
      var pc = /L\d{4,}/.exec(v('person'));
      api('/captains', 'POST', { name: v('name'), email: v('email'), person_id: pc ? pc[0] : null }).then(function (r) {
        if (!r.ok) { done(r); return; }
        grant(r.data.id);
      });
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
        api('/section-players', 'POST', listBody(v, id)).then(function (r2) { done(r2); });
      });
    } else if (f.hasAttribute('data-addroster')) {
      var pr = /#(\d+)\s*$/.exec(v('person'));
      if (!pr) { say('err', t('e_roster')); render(); return; }
      api('/rosters', 'POST', { team_id: Number(f.getAttribute('data-addroster')), person_id: Number(pr[1]), pos: v('pos') }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-newteam')) {
      api('/teams', 'POST', { season_id: S.seasonId, league: f.getAttribute('data-newteam'), name: v('name'), abb: v('abb'), nbhpa_team_id: v('nbhpa') || null }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-edit-team')) {
      api('/teams/' + f.getAttribute('data-edit-team'), 'POST', { name: v('name'), abb: v('abb'), nbhpa_team_id: v('nbhpa') || null }).then(function (r) { done(r); });
    } else if (f.hasAttribute('data-rules')) {
      api('/rules', 'POST', { season_id: S.seasonId, league: f.getAttribute('data-rules'), salary_cap: numOrNull(v('salary_cap')), min_age_m: numOrNull(v('min_age_m')),
        min_age_f: numOrNull(v('min_age_f')), min_age_g: numOrNull(v('min_age_g')), age_on: v('age_on') || null, notes: v('notes') || null }).then(function (r) { done(r); });
    }
  });
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'ad-accounts') S.accountsOpen = e.target.open; }, true);
  /* Team logos in badges (shared/look.js): show once loaded, remove on error (the colour and code stay). */
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  document.addEventListener('input', function (e) {
    var x = e.target;
    if (!x.hasAttribute || !(x.hasAttribute('data-pq') || x.hasAttribute('data-pf'))) return;
    if (x.hasAttribute('data-pq')) S.pq = x.value; else S.pf[x.getAttribute('data-pf')] = x.value;
    var pos = x.selectionStart, id = x.id;
    render();
    var n = document.getElementById(id);
    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'ad-season') { S.seasonId = Number(e.target.value); S.msg = null; refresh(); }
    if (e.target.hasAttribute && e.target.hasAttribute('data-league-on')) {
      api('/season-leagues', 'POST', { season_id: S.seasonId, league: e.target.getAttribute('data-league-on'), enabled: e.target.checked }).then(function (r) { done(r); });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.modal) { S.modal = null; S.msg = null; render(); } });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act],[data-revoke],[data-disable],[data-enable],[data-delete-cap],[data-delete-season],[data-edit-cap],[data-access-cap],[data-access-team],' +
      '[data-sec],[data-lg],[data-plf],[data-edit-person-btn],[data-del-list],[data-del-person],[data-roster-remove],[data-edit-team-btn],[data-del-team],[data-team-new],[data-import-league],[data-sub-team],[data-sf],[data-decide],[data-cancel-req],[data-psort],[data-pfsex],[data-pfmiss],[data-pfpos],[data-cal-date],[data-sub-game],[data-home-cal],[data-home-teams],[data-home-miss],[data-home-accounts],[data-edit-season]');
    if (!b) return;
    var act = b.getAttribute('data-act'), nm = b.getAttribute('data-name');
    var num = function (a) { return Number(b.getAttribute(a)); };
    if (act === 'lang') { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ } render(); return; }
    if (act === 'other-email') { S.step = 'email'; S.devCode = ''; S.msg = null; render(); return; }
    if (act === 'logout') { api('/logout', 'POST', {}).then(function () { S.me = null; S.step = 'email'; S.msg = null; S.modal = null; render(); }); return; }
    if (act === 'close-modal') { S.modal = null; S.msg = null; render(); return; }
    if (act === 'edit-toggle') { S.edit = !S.edit; S.msg = null; render(); return; }
    /* home: each item opens the place to act, in the right scope */
    var goScope = function (slug, hash) { var l = leagueOf(slug); if (l) { S.section = l.section; S.league = slug; saveScope(); } location.hash = hash; };
    if (b.hasAttribute('data-home-cal')) { var hc = b.getAttribute('data-home-cal').split(':'); S.calDate = hc[1]; goScope(hc[0], '#cal'); return; }
    if (b.hasAttribute('data-home-teams')) { goScope(b.getAttribute('data-home-teams'), '#teams'); return; }
    if (b.hasAttribute('data-home-miss')) { var hm = b.getAttribute('data-home-miss').split(':'); S.section = hm[0]; S.league = null; fixScope(); saveScope(); S.plf = ''; S.pf.miss = hm[1]; location.hash = '#players'; return; }
    if (b.hasAttribute('data-home-accounts')) { S.accountsOpen = true; location.hash = '#teams'; return; }
    /* scope */
    if (b.hasAttribute('data-sec')) { S.section = b.getAttribute('data-sec'); S.league = null; fixScope(); saveScope(); S.msg = null; refresh(); return; }
    if (b.hasAttribute('data-lg')) { S.league = b.getAttribute('data-lg'); saveScope(); S.msg = null; if (S.tab === 'cal') { S.calDate = null; refresh(); } else render(); return; }
    if (b.hasAttribute('data-cal-date')) { S.calDate = b.getAttribute('data-cal-date'); refresh(); return; }
    if (b.hasAttribute('data-sub-game')) { var sg = b.getAttribute('data-sub-game').split(':'); S.subFrom = 'cal'; location.hash = '#subs/new/' + sg[0] + '/' + sg[1]; return; }
    if (b.hasAttribute('data-plf')) { S.plf = b.getAttribute('data-plf'); render(); return; }
    if (b.hasAttribute('data-sf')) { S.sf = b.getAttribute('data-sf'); render(); return; }
    if (b.hasAttribute('data-psort')) { var pk = b.getAttribute('data-psort'); S.ps = pk === 'grp' ? { k: 'grp', d: 1 } : S.ps.k === pk ? { k: pk, d: -S.ps.d } : { k: pk, d: pk === 's' || pk === 'g' ? -1 : 1 }; render(); return; }
    if (b.hasAttribute('data-pfsex')) { S.pf.sex = b.getAttribute('data-pfsex'); render(); return; }
    if (b.hasAttribute('data-pfpos')) { S.pf.pos = b.getAttribute('data-pfpos'); render(); return; }
    if (b.hasAttribute('data-pfmiss')) { S.pf.miss = b.getAttribute('data-pfmiss'); render(); return; }
    /* modals */
    if (act === 'new-cap') { openModal({ kind: 'cap-new' }); return; }
    if (b.hasAttribute('data-edit-cap')) { openModal({ kind: 'cap-edit', id: num('data-edit-cap') }); return; }
    if (b.hasAttribute('data-access-cap')) { openModal({ kind: 'access', id: num('data-access-cap') }); return; }
    if (b.hasAttribute('data-access-team')) { openModal({ kind: 'access', team: num('data-access-team') }); return; }
    if (act === 'list-add') { openModal({ kind: 'list-add' }); return; }
    if (act === 'person-new') { openModal({ kind: 'person-new' }); return; }
    if (b.hasAttribute('data-edit-person-btn')) { openModal({ kind: 'person-edit', id: num('data-edit-person-btn') }); return; }
    if (b.hasAttribute('data-edit-team-btn')) { openModal({ kind: 'team-edit', id: num('data-edit-team-btn') }); return; }
    if (b.hasAttribute('data-team-new')) { openModal({ kind: 'team-new', league: b.getAttribute('data-team-new') }); return; }
    if (act === 'season-new') { openModal({ kind: 'season-new' }); return; }
    if (b.hasAttribute('data-edit-season')) { openModal({ kind: 'season-edit', id: num('data-edit-season') }); return; }
    /* replacements: the builder in a modal (from a team card: that team; from the tab: a team of the league to choose) */
    if (b.hasAttribute('data-sub-team')) { S.subFrom = 'teams'; location.hash = '#subs/new/' + b.getAttribute('data-sub-team'); return; }
    if (act === 'sub-new') { S.subFrom = 'subs'; location.hash = '#subs/new'; return; }
    if (b.hasAttribute('data-decide')) {
      var dec = b.getAttribute('data-decide'), box = b.closest('[data-decide-box]'), dn = box ? box.querySelector('[name=dnote]').value.trim() : '';
      if (dec === 'approve' && b.getAttribute('data-result') === 'fail' && !window.confirm(t('confirmApproveFail'))) return;
      api('/replacements/' + b.getAttribute('data-id') + '/decide', 'POST', { decision: dec, note: dn || null }).then(function (r) { done(r, dec === 'approve' ? t('approved') : t('refused')); });
      return;
    }
    if (b.hasAttribute('data-cancel-req')) { if (window.confirm(t('confirmCancelReq'))) api('/replacements/' + b.getAttribute('data-cancel-req') + '/cancel', 'POST', {}).then(function (r) { done(r, t('cancelledMsg')); }); return; }
    if (b.hasAttribute('data-import-league')) { api('/teams/import', 'POST', { season_id: S.seasonId, league: b.getAttribute('data-import-league') }).then(function (r) { done(r); }); return; }
    /* actions */
    if (b.hasAttribute('data-revoke')) { if (window.confirm(t('confirmRevoke'))) api('/access/' + b.getAttribute('data-revoke') + '/revoke', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-disable')) { if (window.confirm(t('confirmDisable'))) api('/captains/' + b.getAttribute('data-disable') + '/disable', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-enable')) { api('/captains/' + b.getAttribute('data-enable') + '/enable', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-delete-cap')) { if (window.confirm(t('confirmDeleteCap', { n: nm }))) api('/captains/' + b.getAttribute('data-delete-cap') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-delete-season')) { if (window.confirm(t('confirmDeleteSeason', { n: nm }))) api('/seasons/' + b.getAttribute('data-delete-season') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-del-list')) { if (window.confirm(t('confirmRemoveList', { n: nm }))) api('/section-players/' + b.getAttribute('data-del-list') + '/delete', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-del-person')) { if (window.confirm(t('confirmDeletePerson', { n: nm }))) api('/people/' + b.getAttribute('data-del-person') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
    if (b.hasAttribute('data-roster-remove')) { if (window.confirm(t('confirmRemoveRoster', { n: nm }))) api('/rosters/' + b.getAttribute('data-roster-remove') + '/remove', 'POST', {}).then(function (r) { done(r); }); return; }
    if (b.hasAttribute('data-del-team')) { if (window.confirm(t('confirmDeleteTeam', { n: nm }))) api('/teams/' + b.getAttribute('data-del-team') + '/delete', 'POST', {}).then(function (r) { done(r, t('deleted')); }); return; }
  });
  /* Routes: #<tab>, and #subs/new[/<team id>[/<game id>]] for the builder page (a game from the calendar starts at step 2). */
  function route() {
    var parts = location.hash.replace('#', '').split('/'), h = OLD_TABS[parts[0]] || parts[0];
    var before = S.tab;
    S.tab = TABS.indexOf(h) >= 0 ? h : 'home';
    if (S.tab !== before) S.edit = false;   // edit mode never follows to another tab
    if (S.tab === 'subs' && parts[1] === 'new') {
      var team = Number(parts[2]) || null, key = parts.slice(2).join('/');
      if (!S.sub || S.sub.key !== key) { S.sub = window.LDBuilder.state({ area: 'admin', teamId: team, slot: parts[3] || '' }); S.sub.key = key; }
      S.sub.pick = !team;
    } else S.sub = null;
  }
  window.addEventListener('hashchange', function () {
    route();
    S.msg = S.flash; S.flash = null; S.modal = null;
    if (S.me) refresh(); else render();
  });

  /* ---------- start ---------- */
  route();
  Promise.all([fetch('/data/season.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), api('/me')]).then(function (rs) {
    S.data = rs[0];
    fixScope();
    if (rs[1].ok) { S.me = rs[1].data.admin; return refresh(); }
    render();
  });
})();
