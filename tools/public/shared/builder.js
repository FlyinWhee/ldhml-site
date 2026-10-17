/* The replacement builder and the request card, shared by the captain area and the admin area (an admin builds
 * requests for captains who are less at ease with tech). Plain JavaScript (ES5), fr/en, no framework.
 * The checks are made by the server (tools/src/replacements.js); this file only shows them and helps choose.
 *
 *   var b = LDBuilder.state({ area: 'captain' | 'admin', teamId, teams })   teams: choices [{ id, name, abb }] (admin) or null
 *   LDBuilder.mount(el, b, ctx)   renders into el and keeps its state in b, so the page can re-render around it (mount again)
 *       ctx = { lang, data (season.json), api(path, method, body) -> Promise<{ ok, status, data }>, onSaved(result), onCancel() }
 *       The builder is a page of its own in both areas (not a modal: it needs the room).
 *   LDBuilder.requestCard(q, ctx, actionsHtml, o)   one request (queue, history), compact: the problems in words,
 *       every check in a fold. o = { team: show the team (false on the captain's own team page), game: show the game (false under
 *       a game line), result: show the result chip }
 * Replacements are always the same sex as the absent player (every league): other-sex players are not offered.
 *   LDBuilder.lineupHtml(lu, ctx, o)   the changes to a team's lineup for a game (replacements in, absent players out), from /lineups
 *   LDBuilder.gameHtml(item, ctx, actFn)   a game of a night: both teams' lineups side by side (admin calendar)
 *   LDBuilder.t(lang, key, vars)
 * Leagues, teams and people look and link like the stats site (shared/look.js, docs/presentation.md).
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STR = {
    fr: {
      team: 'Équipe', chooseTeam: 'Choisir l’équipe…', game: 'Match', chooseGame: 'Choisir le match…', upcoming: 'À venir', past: 'Passés',
      manual: 'Autre date (match absent du calendrier)', date: 'Date', time: 'Heure', vs: 'contre', at: 'à',
      step1: '1. Le match', step2: '2. Qui est absent, et qui le remplace', step3: '3. Vérifications', loading: 'Chargement…',
      pickGameFirst: 'Choisissez d’abord le match : la liste des remplaçants en dépend (âge, horaire).',
      absent: 'Absent', posS: 'Joueur', posG: 'Gardien', chooseSub: 'Remplaçant…', subPos: 'Joue comme',
      gOk: 'Admissibles ({n})', gWarn: 'À vérifier ({n})', gFail: 'Non admissibles ({n})',
      rAge: 'âge', rAgeWarn: 'âge à vérifier', rBusy: 'joue à cette heure', rCap: 'dépasse le plafond', rNoSal: 'sans salaire', noSalary: 'sans salaire',
      emptyRoster: 'L’alignement de cette équipe est vide. Un administrateur doit l’entrer.', noGames: 'Aucun match de cette équipe dans les données : entrez la date.',
      note: 'Note pour l’administrateur', noteReq: 'Une vérification échoue : expliquez pourquoi le remplacement devrait être validé quand même.',
      approveNow: 'Valider tout de suite (je le déclare pour le capitaine)', send: 'Déclarer le remplacement', save: 'Enregistrer', cancel: 'Annuler',
      needLines: 'Cochez au moins un absent et choisissez son remplaçant.', needSub: 'Choisissez un remplaçant pour chaque absent.',
      rules: 'Règles de la ligue', capRule: 'plafond {c}', ageRule: 'âge minimum : hommes {m}, femmes {f}, gardiens {g}', ageYear: '(dans l’année du match)', ageGame: '(à la date du match)',
      q0: 'Pour quelle équipe ?', q1: 'Pour quel match ?', q2: 'Qui sera absent ?', q2hint: 'Touchez les joueurs qui seront absents.',
      q3: 'Qui le remplace ?', q3n: 'Qui les remplace ?', q4: 'Vérifier et envoyer', s1: 'Match', s2: 'Absents', s3: 'Remplaçants', s4: 'Envoi',
      otherGame: 'Un autre match (passé, plus tard, ou absent du calendrier)', next: 'Continuer', nextN: 'Continuer ({n} absents)', prev: 'Retour',
      replaceX: 'Remplacer {n}', change: 'Changer de remplaçant', budget: 'Le remplaçant peut coûter jusqu’à {v} (plafond).', seeMore: 'Voir {n} autres admissibles',
      toCheck: 'À vérifier ({n})', search: 'Chercher un joueur par son nom…', noMatch: 'Aucun joueur trouvé (même sexe seulement).',
      noneOk: 'Aucun remplaçant admissible. Cherchez un nom, ou voyez « À vérifier ».', suggested: 'Suggestions : admissibles, meilleur salaire d’abord',
      fits: 'admissible', noTeam: 'sans équipe', nAbsent: '{n} absent(s)', nSubs: '{n} remplaçant(s)', changeTeam: 'Changer d’équipe',
      sameSex: 'remplaçant du même sexe',
      ldAbsent: 'Absents', ldFor: 'remplace {n}', ldCounts: '{s} joueurs · {g} gardien(s)', ldPay: 'masse {a} / {c}', ldPayNoCap: 'masse {a}',
      ldNone: 'Aucun remplacement.', ldMissing: 'Équipe pas encore dans les outils (Configuration).', ldFull: 'Alignement régulier, aucun absent.', ldG: 'G', ldGoalieTitle: 'Gardien',
      guestBtn: 'Joueur hors-ligue…', guestLegend: 'Joueur hors-ligue (pas sur la liste)', guestName: 'Nom', guestSex: 'Sexe', sexM: 'Homme', sexF: 'Femme',
      guestAge: 'Âge (facultatif)', guestNid: 'No NBHPA (facultatif)', guestUse: 'Utiliser ce joueur',
      guestHint: 'Un joueur hors-ligue rend le remplacement non conforme : une note est requise, l’administration décide. Même sexe que {a}.',
      guestErr: 'Entrez le nom et le sexe. L’âge : un nombre de 10 à 120. Le no NBHPA : des chiffres.', guestTag: 'hors-ligue', guestNoList: 'pas sur la liste',
      yrs: '{n} ans', nbhpa: 'NBHPA {n}', noMatchGuest: 'Aucun joueur trouvé. S’il n’est pas sur la liste, utilisez « Joueur hors-ligue ».',
      k_guest: 'Hors-ligue', x_guest: '{s} est un joueur hors-ligue (pas sur la liste{nid}) : l’administration décide.', x_ageNoAge: 'Âge de {s} non fourni : à vérifier ({min} ans minimum).',
      rulesLink: 'Règles de la ligue', rulesTitle: 'Règles · {l}', close: 'Fermer',
      rl_sex: 'Le remplaçant est du même sexe que le joueur absent (toutes les ligues).',
      rl_list: 'Le remplaçant est sur la liste des joueurs de la section cette saison, et ne joue pas à la même heure.',
      rl_cap: 'Plafond salarial : {c} par équipe. Masse salariale − salaires des absents + salaires des remplaçants (au salaire de la position jouée) doit rester sous le plafond.',
      rl_age: 'Âge minimum des remplaçants : hommes {m}, femmes {f}, gardiens {g}, {when}.', rl_ageGame: 'à la date du match', rl_ageYear: 'atteint dans l’année du match',
      rl_send: 'Un remplacement non conforme peut quand même être déclaré, avec une note : l’administration décide.',
      k_sex: 'Même sexe', x_sex: '{s} n’est pas du même sexe que {a} : un remplacement est toujours du même sexe.', x_sexUnknown: 'Sexe inconnu ({who}) : à vérifier.', rSex: 'sexe inconnu',
      allChecks: 'Vérifications : {ok} ✓ · {warn} à vérifier · {fail} ✗', allOk: 'Toutes les vérifications passent ({n})', back: 'Retour',
      k_absent: 'Alignement', k_listed: 'Liste des joueurs', k_own: 'Pas déjà dans l’équipe', k_busy: 'Libre à cette heure', k_age: 'Âge {min}+', k_age0: 'Âge', k_salary: 'Salaires', k_cap: 'Plafond', k_dup: 'Doublon',
      x_absent: '{a} n’est pas dans l’alignement de l’équipe.', x_listed: '{s} n’est pas sur la liste des joueurs de la section cette saison. Un administrateur peut l’ajouter.',
      x_own: '{s} est déjà dans l’alignement de cette équipe.', x_busy: '{s} joue à la même heure (avec {abb}).', x_busyReq: '{s} remplace déjà à la même heure (remplacement no {req}, {abb}).',
      x_age: '{s} n’a pas l’âge minimum ({min} ans comme {pos}).', x_ageBirth: 'Date de naissance de {s} inconnue : l’âge ({min} ans) est à vérifier.',
      x_ageBday: '{s} atteint {min} ans le mois du match : à vérifier.', x_ageSex: 'Sexe de {s} inconnu : l’âge est à vérifier.',
      x_salary: 'Salaire inconnu : {who}.', x_dup: 'Un autre remplacement déclaré pour ce match nomme les mêmes joueurs (no {ids}).',
      capLine: 'Masse salariale : {b} − {o} + {i} = {a} · plafond {c}', capOver: 'dépasse de {v}', capMissing: '{n} joueurs de l’alignement sans salaire',
      payroll: 'Masse salariale : {b} · plafond {c}',
      r_ok: 'Tout est conforme', r_warn: 'À vérifier', r_fail: 'Non conforme',
      st_pending: 'À valider', st_approved: 'Validé', st_refused: 'Refusé', st_cancelled: 'Annulé',
      by: 'Déclaré par {n} · {d}', byAdmin: 'Déclaré par l’administration ({n}) · {d}', decided: '{s} par {n} · {d}', reqNo: 'Remplacement no {id}', noteFrom: 'Note',
      e_note_required: 'Une vérification échoue : une note est requise.', e_game: 'Match invalide.', e_replacement: 'Remplacement invalide.', e_team: 'Équipe introuvable.',
      e_session: 'Votre session a expiré. Reconnectez-vous.', e_server: 'Erreur du serveur. Réessayez.', e_net: 'Le serveur ne répond pas.'
    },
    en: {
      team: 'Team', chooseTeam: 'Choose the team…', game: 'Game', chooseGame: 'Choose the game…', upcoming: 'Upcoming', past: 'Past',
      manual: 'Another date (game not in the schedule)', date: 'Date', time: 'Time', vs: 'vs', at: 'at',
      step1: '1. The game', step2: '2. Who is absent, and who replaces them', step3: '3. Checks', loading: 'Loading…',
      pickGameFirst: 'Choose the game first: the replacement list depends on it (age, schedule).',
      absent: 'Absent', posS: 'Skater', posG: 'Goalie', chooseSub: 'Replacement…', subPos: 'Plays as',
      gOk: 'Eligible ({n})', gWarn: 'To check ({n})', gFail: 'Not eligible ({n})',
      rAge: 'age', rAgeWarn: 'age to check', rBusy: 'plays at that time', rCap: 'over the cap', rNoSal: 'no salary', noSalary: 'no salary',
      emptyRoster: 'This team’s roster is empty. An admin must enter it.', noGames: 'No game of this team in the data: enter the date.',
      note: 'Note for the admin', noteReq: 'A check fails: explain why the replacement should be validated anyway.',
      approveNow: 'Validate now (I am declaring it for the captain)', send: 'Declare the replacement', save: 'Save', cancel: 'Cancel',
      needLines: 'Tick at least one absent player and choose their replacement.', needSub: 'Choose a replacement for each absent player.',
      rules: 'League rules', capRule: 'cap {c}', ageRule: 'minimum age: men {m}, women {f}, goalies {g}', ageYear: '(during the game’s year)', ageGame: '(on the game date)',
      q0: 'Which team?', q1: 'Which game?', q2: 'Who will be absent?', q2hint: 'Tap the players who will be absent.',
      q3: 'Who replaces them?', q3n: 'Who replaces them?', q4: 'Check and send', s1: 'Game', s2: 'Absent', s3: 'Replacements', s4: 'Send',
      otherGame: 'Another game (past, later, or not in the schedule)', next: 'Continue', nextN: 'Continue ({n} absent)', prev: 'Back',
      replaceX: 'Replace {n}', change: 'Change the replacement', budget: 'The replacement can cost up to {v} (cap).', seeMore: 'See {n} more eligible',
      toCheck: 'To check ({n})', search: 'Search a player by name…', noMatch: 'No player found (same sex only).',
      noneOk: 'No eligible replacement. Search a name, or see “To check”.', suggested: 'Suggestions: eligible, best salary first',
      fits: 'eligible', noTeam: 'no team', nAbsent: '{n} absent', nSubs: '{n} replacement(s)', changeTeam: 'Change team',
      sameSex: 'replacement of the same sex',
      ldAbsent: 'Absent', ldFor: 'replaces {n}', ldCounts: '{s} skaters · {g} goalie(s)', ldPay: 'payroll {a} / {c}', ldPayNoCap: 'payroll {a}',
      ldNone: 'No replacement.', ldMissing: 'Team not in the tools yet (Setup).', ldFull: 'Regular roster, nobody absent.', ldG: 'G', ldGoalieTitle: 'Goalie',
      guestBtn: 'Player not on the list…', guestLegend: 'Player not on the list', guestName: 'Name', guestSex: 'Sex', sexM: 'Man', sexF: 'Woman',
      guestAge: 'Age (optional)', guestNid: 'NBHPA no. (optional)', guestUse: 'Use this player',
      guestHint: 'A player not on the list makes the replacement non-conforming: a note is required, the admins decide. Same sex as {a}.',
      guestErr: 'Enter the name and the sex. Age: a number from 10 to 120. NBHPA no.: digits.', guestTag: 'not on the list', guestNoList: 'not on the list',
      yrs: '{n} years old', nbhpa: 'NBHPA {n}', noMatchGuest: 'No player found. If they are not on the list, use “Player not on the list”.',
      k_guest: 'Not on the list', x_guest: '{s} is not on the list{nid}: the admins decide.', x_ageNoAge: '{s}’s age was not given: to check ({min} minimum).',
      rulesLink: 'League rules', rulesTitle: 'Rules · {l}', close: 'Close',
      rl_sex: 'The replacement is the same sex as the absent player (every league).',
      rl_list: 'The replacement is on the section’s player list this season, and does not play at the same time.',
      rl_cap: 'Salary cap: {c} per team. Payroll − absent players’ salaries + replacements’ salaries (at the salary of the position played) must stay under the cap.',
      rl_age: 'Minimum age of replacements: men {m}, women {f}, goalies {g}, {when}.', rl_ageGame: 'on the game date', rl_ageYear: 'reached during the game’s year',
      rl_send: 'A replacement that does not pass can still be declared, with a note: the admins decide.',
      k_sex: 'Same sex', x_sex: '{s} is not the same sex as {a}: a replacement is always the same sex.', x_sexUnknown: 'Unknown sex ({who}): to check.', rSex: 'sex unknown',
      allChecks: 'Checks: {ok} ✓ · {warn} to check · {fail} ✗', allOk: 'Every check passes ({n})', back: 'Back',
      k_absent: 'Roster', k_listed: 'Player list', k_own: 'Not already on the team', k_busy: 'Free at that time', k_age: 'Age {min}+', k_age0: 'Age', k_salary: 'Salaries', k_cap: 'Cap', k_dup: 'Duplicate',
      x_absent: '{a} is not on the team’s roster.', x_listed: '{s} is not on the section’s player list this season. An admin can add them.',
      x_own: '{s} is already on this team’s roster.', x_busy: '{s} plays at the same time (with {abb}).', x_busyReq: '{s} already replaces at the same time (replacement no. {req}, {abb}).',
      x_age: '{s} does not meet the minimum age ({min} as a {pos}).', x_ageBirth: '{s}’s birth date is unknown: the age ({min}) must be checked.',
      x_ageBday: '{s} turns {min} in the month of the game: to check.', x_ageSex: '{s}’s sex is unknown: the age must be checked.',
      x_salary: 'Unknown salary: {who}.', x_dup: 'Another declared replacement for this game names the same players (no. {ids}).',
      capLine: 'Payroll: {b} − {o} + {i} = {a} · cap {c}', capOver: 'over by {v}', capMissing: '{n} roster players without a salary',
      payroll: 'Payroll: {b} · cap {c}',
      r_ok: 'All checks pass', r_warn: 'To check', r_fail: 'Does not pass',
      st_pending: 'To validate', st_approved: 'Validated', st_refused: 'Refused', st_cancelled: 'Cancelled',
      by: 'Declared by {n} · {d}', byAdmin: 'Declared by the admins ({n}) · {d}', decided: '{s} by {n} · {d}', reqNo: 'Replacement no. {id}', noteFrom: 'Note',
      e_note_required: 'A check fails: a note is required.', e_game: 'Invalid game.', e_replacement: 'Invalid replacement.', e_team: 'Team not found.',
      e_session: 'Your session expired. Sign in again.', e_server: 'Server error. Try again.', e_net: 'The server does not answer.'
    }
  };
  function t(lang, k, v) {
    var s = (STR[lang] || STR.fr)[k]; if (s == null) s = k;
    Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); });
    return s;
  }
  var money = function (v) { return v == null ? '—' : (Math.round(v * 100) / 100) + 'M'; };   // salaries are in millions
  var ICON = { ok: '✓', warn: '!', fail: '✗' };

  /* ---------- look: leagues, teams, people, games (like the stats site) ---------- */
  var leagueOf = function (ctx, slug) { return ctx.data && ctx.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var home = function (ctx, l) { return ((ctx.data && ctx.data.siteUrl) || '/') + l.sectionPath + '/' + l.path + '/'; };
  function teamHead(ctx, team, league) {
    var l = leagueOf(ctx, league) || { slug: league, teams: [] };
    var dt = (l.teams || []).filter(function (x) { return x.id === team.nbhpa_team_id; })[0] || {};
    var name = team.nbhpa_team_id && l.path ? '<a class="tl strong" href="' + esc(home(ctx, l) + '#team-' + team.nbhpa_team_id) + '">' + esc(team.name) + '</a>' : '<b>' + esc(team.name) + '</b>';
    return '<span class="tcell">' + window.LDLook.crest({ abb: team.abb, logo: dt.logo }, league, 'sm') + name + '</span>';
  }
  /* A person in a league context: their page in that league (most detail); the section page when they have not played in it. */
  function person(ctx, league, name, siteId) {
    var l = leagueOf(ctx, league), dp = siteId && ctx.data && ctx.data.people.filter(function (x) { return x.id === siteId; })[0];
    if (!siteId || !l) return esc(name);
    var href = dp && dp.lg && dp.lg[l.slug] ? home(ctx, l) + '#player-' + siteId : ((ctx.data && ctx.data.siteUrl) || '/') + l.sectionPath + '/#player-' + siteId;
    return '<a class="lnk" href="' + esc(href) + '">' + esc(name) + '</a>';
  }
  var locale = function (ctx) { return ctx.lang === 'en' ? 'en-CA' : 'fr-CA'; };
  var day = function (ctx, d) { try { return new Date(d + 'T12:00:00').toLocaleDateString(locale(ctx), { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; } };
  var stamp = function (ctx, sec) { return sec ? new Date(sec * 1000).toLocaleString(locale(ctx), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : ''; };
  /* "jeu. 16 oct. · 18:00 · contre GHO · Surface X 1" from the team's point of view */
  function gameText(ctx, league, teamNb, g, noVenue) {
    var l = leagueOf(ctx, league) || { teams: [] };
    var abb = function (id) { return ((l.teams || []).filter(function (x) { return x.id === id; })[0] || {}).abb || '?'; };
    var isHome = g.home === teamNb, opp = abb(isHome ? g.away : g.home);
    return day(ctx, g.date) + (g.time ? ' · ' + g.time : '') + ' · ' + (isHome ? t(ctx.lang, 'vs') : t(ctx.lang, 'at')) + ' ' + opp + (g.venue && !noVenue ? ' · ' + g.venue + (g.court ? ' ' + g.court : '') : '');
  }
  function requestGame(ctx, q) {
    var l = leagueOf(ctx, q.league), g = q.game_id && l && (l.games || []).filter(function (x) { return x.id === q.game_id; })[0];
    if (g) return gameText(ctx, q.league, q.team.nbhpa_team_id, g, true);   // a card header: no venue (it is in the schedule)
    return day(ctx, q.game_date) + (q.game_time ? ' · ' + q.game_time : '') + (q.game_label ? ' · ' + q.game_label.split(' · ')[0] : '');
  }
  var guestTag = function (ctx, g) {
    var bits = [t(ctx.lang, 'guestTag'), t(ctx.lang, g.sex === 'f' ? 'sexF' : 'sexM')];
    if (g.age != null) bits.push(t(ctx.lang, 'yrs', { n: g.age }));
    if (g.nid) bits.push(t(ctx.lang, 'nbhpa', { n: g.nid }));
    return '<span class="bd-gtag">' + esc(bits.join(' · ')) + '</span>';
  };
  var posName = function (ctx, p) { return t(ctx.lang, p === 'g' ? 'posG' : 'posS'); };

  /* ---------- checks: grouped by line (absent -> replacement), then the team checks (cap, duplicates) ---------- */
  function explain(ctx, c, names) {
    var L = ctx.lang, d = c.d || {}, n = names[c.line] || {}, v = { a: n.a || '?', s: n.s || '?' };
    if (c.k === 'absent') return t(L, 'x_absent', v);
    if (c.k === 'listed') return t(L, 'x_listed', v);
    if (c.k === 'own') return t(L, 'x_own', v);
    if (c.k === 'guest') return t(L, 'x_guest', { s: v.s, nid: d.nid ? ' · ' + t(L, 'nbhpa', { n: d.nid }) : '' });
    if (c.k === 'sex') return c.s === 'fail' ? t(L, 'x_sex', v) : t(L, 'x_sexUnknown', { who: [!d.absent ? v.a : null, !d.sub ? v.s : null].filter(Boolean).join(', ') });
    if (c.k === 'busy') return t(L, d.req ? 'x_busyReq' : 'x_busy', { s: v.s, abb: d.abb || '?', req: d.req });
    if (c.k === 'age') {
      var av = { s: v.s, min: d.min, pos: posName(ctx, d.pos).toLowerCase() };
      return t(L, c.s === 'fail' ? 'x_age' : d.why === 'no_age' ? 'x_ageNoAge' : d.why === 'no_birth' ? 'x_ageBirth' : d.why === 'birthday' ? 'x_ageBday' : 'x_ageSex', av);
    }
    if (c.k === 'salary') return t(L, 'x_salary', { who: (d.missing || []).map(function (w) { return w === 'absent' ? v.a : v.s; }).join(', ') });
    if (c.k === 'dup') return t(L, 'x_dup', { ids: (d.ids || []).join(', ') });
    return '';
  }
  function chip(ctx, c) {
    var label = c.k === 'age' ? (c.d && c.d.min != null ? t(ctx.lang, 'k_age', { min: c.d.min }) : t(ctx.lang, 'k_age0')) : t(ctx.lang, 'k_' + c.k);
    return '<span class="bd-chk bd-' + c.s + '"><i aria-hidden="true">' + ICON[c.s] + '</i>' + esc(label) + '</span>';
  }
  function capText(ctx, p, outSum, inSum) {
    var L = ctx.lang;
    var s = t(L, 'capLine', { b: money(p.before), o: money(outSum), i: money(inSum), a: money(p.after), c: money(p.cap) });
    if (p.after > p.cap) s += ' · ' + t(L, 'capOver', { v: money(p.after - p.cap) });
    if (p.missing) s += ' · ' + t(L, 'capMissing', { n: p.missing });
    return s;
  }
  /* names: [{ a: absent name, s: replacement name }] by line; lines: [{ absent_salary, sub_salary }] for the cap sums */
  function checksHtml(ctx, checks, names, lines, payroll) {
    if (!checks || !checks.length) return '';
    var byLine = {}, team = [];
    checks.forEach(function (c) { if (c.line == null) team.push(c); else (byLine[c.line] = byLine[c.line] || []).push(c); });
    var html = Object.keys(byLine).map(function (i) {
      var cs = byLine[i], bad = cs.filter(function (c) { return c.s !== 'ok'; }), n = names[i] || {};
      return '<li class="bd-cl"><div class="bd-cl-h"><span>' + esc(n.a || '?') + ' → <b>' + esc(n.s || '?') + '</b></span><span class="bd-chks">' + cs.map(function (c) { return chip(ctx, c); }).join('') + '</span></div>' +
        bad.map(function (c) { return '<p class="bd-why bd-' + c.s + '">' + esc(explain(ctx, c, names)) + '</p>'; }).join('') + '</li>';
    }).join('');
    var outSum = 0, inSum = 0; (lines || []).forEach(function (l) { outSum += l.absent_salary || 0; inSum += l.sub_salary || 0; });
    html += team.map(function (c) {
      var text = c.k === 'cap' && payroll ? capText(ctx, payroll, outSum, inSum) : explain(ctx, c, names);
      /* a team check (cap, duplicates): one line, the numbers then the chip at the end */
      return '<li class="bd-cl bd-cl-team"><p class="bd-why bd-' + c.s + '">' + esc(text) + ' ' + chip(ctx, c) + '</p></li>';
    }).join('');
    return '<ul class="bd-checks">' + html + '</ul>';
  }
  var resultChip = function (ctx, r) { return '<span class="bd-res bd-' + r + '"><i aria-hidden="true">' + ICON[r] + '</i>' + esc(t(ctx.lang, 'r_' + r)) + '</span>'; };

  /* ---------- a request: the same compact card in the queue, the history and the captain's list ----------
   * Header: (team) game, status (result). One line per replacement. Then only the problems, in words; every check in a fold. */
  function requestCard(q, ctx, actions, o) {
    o = o || {};
    var L = ctx.lang;
    var names = q.lines.map(function (l) { return { a: l.absent_name, s: l.sub_name }; });
    var lines = q.lines.map(function (l) {
      return '<li>' + person(ctx, q.league, l.absent_name, l.absent_site) + ' <span class="bd-arrow" aria-hidden="true">→</span> <b>' + person(ctx, q.league, l.sub_name, l.sub_site) + '</b>' + (l.guest ? ' ' + guestTag(ctx, l.guest) : '') +
        ' <span class="note">' + esc(posName(ctx, l.sub_pos)) + ' · ' + esc(money(l.absent_salary)) + ' → ' + esc(money(l.sub_salary)) + '</span></li>';
    }).join('');
    var outSum = 0, inSum = 0; q.lines.forEach(function (l) { outSum += l.absent_salary || 0; inSum += l.sub_salary || 0; });
    var cs = q.checks || [], n = { ok: 0, warn: 0, fail: 0 };
    cs.forEach(function (c) { n[c.s]++; });
    var issues = cs.filter(function (c) { return c.s !== 'ok'; }).map(function (c) {
      var text = c.k === 'cap' && q.payroll ? capText(ctx, q.payroll, outSum, inSum) : explain(ctx, c, names);
      return '<li class="bd-' + c.s + '"><i aria-hidden="true">' + ICON[c.s] + '</i> ' + esc(text) + '</li>';
    }).join('');
    var more = cs.length ? '<details class="bd-more"><summary>' + esc(n.warn || n.fail ? t(L, 'allChecks', n) : t(L, 'allOk', { n: cs.length })) + '</summary>' + checksHtml(ctx, cs, names, q.lines, q.payroll) + '</details>' : '';
    var who = q.created_kind === 'admin' ? t(L, 'byAdmin', { n: q.created_name || '—', d: stamp(ctx, q.created_at) }) : t(L, 'by', { n: q.created_name || '—', d: stamp(ctx, q.created_at) });
    var dec = q.decided_at ? t(L, 'decided', { s: t(L, 'st_' + q.status), n: q.decided_name || '—', d: stamp(ctx, q.decided_at) }) : '';
    return '<article class="bd-req bd-st-' + esc(q.status) + '" data-req="' + q.id + '" style="--tc:' + window.LDLook.colorVar(q.league, q.team.abb) + '">' +
      '<div class="bd-req-h">' + (o.team === false ? '' : teamHead(ctx, q.team, q.league)) + (o.game === false ? '<span class="bd-game"></span>' : '<b class="bd-game">' + esc(requestGame(ctx, q)) + '</b>') +
      '<span class="bd-st">' + esc(t(L, 'st_' + q.status)) + '</span>' + (o.result === false ? '' : resultChip(ctx, q.result)) + '</div>' +
      '<ul class="bd-lines">' + lines + '</ul>' + (issues ? '<ul class="bd-issues">' + issues + '</ul>' : '') +
      (q.note ? '<p class="bd-note">' + esc(q.note) + '</p>' : '') + (q.decision_note ? '<p class="bd-note bd-dnote">' + esc(q.decision_note) + '</p>' : '') +
      more + '<p class="bd-meta">' + esc(t(L, 'reqNo', { id: q.id })) + ' · ' + esc(who) + (dec ? ' · ' + esc(dec) : '') + '</p>' + (actions || '') + '</article>';
  }

  /* ---------- the builder: a guided page, one question per step ----------
   * 1 the game (the next games as cards; any other game or a typed date in a fold), 2 who is absent (tap the players),
   * 3 a replacement for each (a few suggestions: eligible, best salary that fits; a search for anyone else),
   * 4 check and send. The stepper on top opens any step already reached. */
  var GAME_CARDS = 4, SUGGEST = 6;
  function state(o) {
    return { area: o.area || 'captain', teamId: o.teamId || null, teams: o.teams || null, d: null, loading: false, slot: o.slot || '', date: '', time: '',
      lines: [], note: '', approve: o.area === 'admin', check: null, msg: null, seq: 0, cseq: 0, saving: false, el: null, ctx: null,
      step: o.slot ? 2 : 1, q: {}, more: {}, league: o.league || null, gopen: {}, gform: {}, gerr: {} };
  }
  var slotQuery = function (b) {
    if (b.slot && b.slot !== 'manual') return '&game=' + encodeURIComponent(b.slot);
    if (b.slot === 'manual' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) return '&date=' + b.date + (/^\d{2}:\d{2}$/.test(b.time) ? '&time=' + b.time : '');
    return '';
  };
  var slotReady = function (b) { return !!slotQuery(b); };
  var complete = function (b) { return b.lines.filter(function (l) { return l.sub_id || l.guest; }); };
  var errText = function (b, r) { return t(b.ctx.lang, 'e_' + ((r.data && r.data.error) || 'server')); };
  /* The furthest step the request can be at now. */
  var reach = function (b) { return !slotReady(b) || !b.d || !b.d.candidates ? 1 : !b.lines.length ? 2 : complete(b).length < b.lines.length ? 3 : 4; };

  function load(b) {
    if (!b.teamId) { draw(b); return; }
    var seq = ++b.seq; b.loading = true; draw(b);
    b.ctx.api('/replacements/builder?team=' + b.teamId + slotQuery(b)).then(function (r) {
      if (seq !== b.seq) return;
      b.loading = false;
      if (!r.ok) { b.msg = errText(b, r); b.d = null; draw(b); return; }
      b.d = r.data;
      var on = {}; (b.d.roster || []).forEach(function (p) { on[p.person_id] = 1; });
      b.lines = b.lines.filter(function (l) { return on[l.absent_id]; });
      if (b.step > reach(b)) b.step = reach(b);
      draw(b); check(b);
    });
  }
  function check(b) {
    var lines = complete(b);
    if (!slotReady(b) || !lines.length) { b.check = null; draw(b); return; }
    var seq = ++b.cseq;
    b.ctx.api('/replacements/check', 'POST', body(b)).then(function (r) {
      if (seq !== b.cseq) return;
      b.check = r.ok ? r.data : null;
      if (!r.ok) b.msg = errText(b, r);
      draw(b);
    });
  }
  function body(b) {
    var o = { team_id: b.teamId, lines: complete(b).map(function (l) { return l.guest ? { absent_id: l.absent_id, guest: l.guest, sub_pos: l.sub_pos } : { absent_id: l.absent_id, sub_id: l.sub_id, sub_pos: l.sub_pos }; }) };
    if (b.slot && b.slot !== 'manual') o.game_id = b.slot; else { o.game_date = b.date; o.game_time = b.time || null; }
    return o;
  }
  var rosterOf = function (b, id) { return b.d.roster.filter(function (r) { return r.person_id === id; })[0] || {}; };
  var candOf = function (b, id) { return (b.d.candidates || []).filter(function (c) { return c.id === id; })[0]; };
  var fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };

  /* A candidate for one line: 'ok' | 'warn' | 'fail' and why. The server checks again; this only sorts and explains. */
  function judge(b, c, line) {
    var d = b.d, L = b.ctx.lang, why = [], s = 'ok';
    var worse = function (x) { if (x === 'fail' || (x === 'warn' && s === 'ok')) s = x; };
    if (!c.sex || !rosterOf(b, line.absent_id).sex) { worse('warn'); why.push(t(L, 'rSex')); }
    var age = c.age && c.age[line.sub_pos];
    if (age === 'fail') { worse('fail'); why.push(t(L, 'rAge')); } else if (age === 'warn') { worse('warn'); why.push(t(L, 'rAgeWarn')); }
    if (c.busy) { worse('fail'); why.push(t(L, 'rBusy') + ' (' + c.busy.abb + ')'); }
    var cap = d.rules && d.rules.salary_cap != null ? d.rules.salary_cap : null;
    var sal = line.sub_pos === 'g' ? c.salary_g : c.salary_s;
    if (cap != null) {
      if (sal == null) { worse('warn'); why.push(t(L, 'rNoSal')); }
      else if (sal > budget(b, line) + 1e-9) { worse('fail'); why.push(t(L, 'rCap')); }
    }
    return { s: s, why: why, sal: sal };
  }
  /* What this line's replacement may cost: cap - (payroll - every absent salary + the other lines' replacements). */
  function budget(b, line) {
    var d = b.d, cap = d.rules.salary_cap, pay = 0, sal = {};
    d.roster.forEach(function (r) { pay += r.salary || 0; sal[r.person_id] = r.salary || 0; });
    b.lines.forEach(function (l) {
      pay -= sal[l.absent_id] || 0;
      var c = l !== line && l.sub_id && candOf(b, l.sub_id);
      if (c) pay += (l.sub_pos === 'g' ? c.salary_g : c.salary_s) || 0;
    });
    return cap - pay;
  }
  /* The candidates of a line, same sex only, judged: { ok: [], warn: [], fail: [] }; ok sorted by salary (best first). */
  function groups(b, line) {
    var used = {}, absSex = rosterOf(b, line.absent_id).sex, g = { ok: [], warn: [], fail: [] };
    b.lines.forEach(function (l) { if (l !== line && l.sub_id) used[l.sub_id] = 1; });
    (b.d.candidates || []).forEach(function (c) {
      if (used[c.id] || (absSex && c.sex && c.sex !== absSex)) return;   // a replacement is always the same sex
      var j = judge(b, c, line);
      g[j.s].push({ c: c, j: j });
    });
    var bySal = function (x, y) { return (y.j.sal == null ? -1 : y.j.sal) - (x.j.sal == null ? -1 : x.j.sal) || x.c.name.localeCompare(y.c.name); };
    g.ok.sort(bySal); g.warn.sort(bySal);
    return g;
  }

  /* ---------- the four steps ---------- */
  var LABELS = ['s1', 's2', 's3', 's4'];
  function stepper(b) {
    var L = b.ctx.lang, r = reach(b), d = b.d;
    var done = [d && slotReady(b) ? slotText(b) : '', b.lines.length ? t(L, 'nAbsent', { n: b.lines.length }) : '', complete(b).length && complete(b).length === b.lines.length ? t(L, 'nSubs', { n: complete(b).length }) : '', ''];
    return '<ol class="bd-steps">' + LABELS.map(function (k, i) {
      var n = i + 1, cls = n === b.step ? ' bd-now' : n < b.step || (n <= r && done[i]) ? ' bd-done' : '';
      return '<li class="bd-sp' + cls + '"><button type="button" data-b-step="' + n + '"' + (n > r ? ' disabled' : '') + (n === b.step ? ' aria-current="step"' : '') + '>' +
        '<span class="bd-sn">' + (cls === ' bd-done' ? '✓' : n) + '</span><span class="bd-sl"><b>' + esc(t(L, k)) + '</b>' + (done[i] ? '<small>' + esc(done[i]) + '</small>' : '') + '</span></button></li>';
    }).join('') + '</ol>';
  }
  function slotText(b) {
    var d = b.d;
    if (b.slot === 'manual') return day(b.ctx, b.date) + (b.time ? ' · ' + b.time : '');
    var g = d.games.filter(function (x) { return x.id === b.slot; })[0];
    return g ? day(b.ctx, g.date) + (g.time ? ' · ' + g.time : '') : '';
  }
  function gameCard(b, g) {
    var d = b.d, l = leagueOf(b.ctx, d.team.league) || { teams: [] }, isHome = g.home === d.team.nbhpa_team_id;
    var opp = (l.teams || []).filter(function (x) { return x.id === (isHome ? g.away : g.home); })[0] || { abb: '?' };
    return '<button type="button" class="bd-gcard' + (b.slot === g.id ? ' bd-on' : '') + '" data-b-game="' + esc(g.id) + '" aria-pressed="' + (b.slot === g.id) + '">' +
      '<span class="bd-gday">' + esc(day(b.ctx, g.date)) + '</span><span class="bd-gtime">' + esc(g.time || '') + '</span>' +
      '<span class="bd-gopp">' + esc(t(b.ctx.lang, isHome ? 'vs' : 'at')) + ' ' + window.LDLook.crest({ abb: opp.abb, logo: opp.logo }, d.team.league, 'sm') + '<b title="' + esc(opp.name || opp.abb) + '">' + esc(opp.abb) + '</b></span>' +
      (g.venue ? '<span class="note">' + esc(g.venue + (g.court ? ' ' + g.court : '')) + '</span>' : '') + '</button>';
  }
  function step1(b) {
    var L = b.ctx.lang, d = b.d, up = d.games.filter(function (g) { return g.date >= d.today; }), past = d.games.filter(function (g) { return g.date < d.today; }).reverse();
    var cards = up.slice(0, GAME_CARDS), inCards = cards.some(function (g) { return g.id === b.slot; });
    var opt = function (g) { return '<option value="' + esc(g.id) + '"' + (b.slot === g.id ? ' selected' : '') + '>' + esc(gameText(b.ctx, d.team.league, d.team.nbhpa_team_id, g)) + '</option>'; };
    var other = '<label>' + esc(t(L, 'game')) + '<select class="ctl" data-b-slot data-b-key="slot"><option value="">' + esc(t(L, 'chooseGame')) + '</option>' +
      (up.length > GAME_CARDS ? '<optgroup label="' + esc(t(L, 'upcoming')) + '">' + up.slice(GAME_CARDS).map(opt).join('') + '</optgroup>' : '') +
      (past.length ? '<optgroup label="' + esc(t(L, 'past')) + '">' + past.map(opt).join('') + '</optgroup>' : '') +
      '<option value="manual"' + (b.slot === 'manual' ? ' selected' : '') + '>' + esc(t(L, 'manual')) + '</option></select></label>' +
      (b.slot === 'manual' ? '<span class="ad-pair"><label>' + esc(t(L, 'date')) + '<input class="ctl" type="date" data-b-date data-b-key="date" value="' + esc(b.date) + '"></label>' +
        '<label>' + esc(t(L, 'time')) + '<input class="ctl" type="time" data-b-time data-b-key="time" value="' + esc(b.time) + '"></label></span>' : '');
    return '<h2 class="bd-q">' + esc(t(L, 'q1')) + '</h2>' +
      (cards.length ? '<div class="bd-gcards">' + cards.map(function (g) { return gameCard(b, g); }).join('') + '</div>' : '<p class="note">' + esc(t(L, 'noGames')) + '</p>') +
      '<details class="bd-other"' + (!cards.length || (b.slot && !inCards) ? ' open' : '') + '><summary>' + esc(t(L, 'otherGame')) + '</summary><div class="bd-row">' + other + '</div></details>' +
      nav(b, 0, slotReady(b) && b.d.candidates ? 2 : 0);
  }
  function step2(b) {
    var L = b.ctx.lang, d = b.d;
    if (!d.roster.length) return '<h2 class="bd-q">' + esc(t(L, 'q2')) + '</h2><p class="note">' + esc(t(L, 'emptyRoster')) + '</p>' + nav(b, 1, 0);
    return '<h2 class="bd-q">' + esc(t(L, 'q2')) + '</h2><p class="note">' + esc(t(L, 'q2hint')) + '</p><div class="bd-tiles">' + d.roster.map(function (p) {
      var on = b.lines.some(function (l) { return l.absent_id === p.person_id; });
      return '<button type="button" class="bd-tile' + (on ? ' bd-on' : '') + '" data-b-absent="' + p.person_id + '" data-b-key="abs-' + p.person_id + '" aria-pressed="' + on + '">' +
        '<span class="bd-tick" aria-hidden="true">' + (on ? '✓' : '') + '</span><span><b>' + esc(p.name) + '</b><small>' + esc(posName(b.ctx, p.pos)) + ' · ' + esc(money(p.salary)) + '</small></span></button>';
    }).join('') + '</div>' + nav(b, 1, b.lines.length ? 3 : 0, b.lines.length ? t(L, 'nextN', { n: b.lines.length }) : '');
  }
  function candCard(b, line, x, chosen) {
    var c = x.c, j = x.j, L = b.ctx.lang;
    var tag = c.team ? '<span class="bd-ctm">' + window.LDLook.crest({ abb: c.team.abb }, b.d.team.league, 'sm') + esc(c.team.abb) + '</span>' : '<span class="bd-ctm note">' + esc(t(L, 'noTeam')) + '</span>';
    return '<button type="button" class="bd-cand bd-' + j.s + (chosen ? ' bd-on' : '') + '" data-b-pick="' + line.absent_id + ':' + c.id + '"' + (chosen ? ' aria-pressed="true"' : '') + '>' +
      '<span class="bd-cn"><b>' + esc(c.name) + '</b>' + tag + '</span><span class="bd-cs">' + esc(j.sal == null ? t(L, 'noSalary') : money(j.sal)) + '</span>' +
      (j.why.length ? '<span class="bd-cw">' + ICON[j.s] + ' ' + esc(j.why.join(', ')) + '</span>' : '<span class="bd-cw bd-ok">✓ ' + esc(t(L, 'fits')) + '</span>') + '</button>';
  }
  function lineBlock(b, line) {
    var L = b.ctx.lang, p = rosterOf(b, line.absent_id), g = groups(b, line), key = line.absent_id;
    var head = '<div class="bd-lh"><h3>' + esc(t(L, 'replaceX', { n: p.name })) + ' <small>' + esc(posName(b.ctx, p.pos)) + ' · ' + esc(money(p.salary)) + '</small></h3>' +
      '<div class="seg bd-pos" role="group" aria-label="' + esc(t(L, 'subPos')) + '">' + ['s', 'g'].map(function (k) {
        return '<button type="button" data-b-pos="' + key + ':' + k + '" aria-pressed="' + (line.sub_pos === k) + '">' + esc(posName(b.ctx, k)) + '</button>'; }).join('') + '</div></div>';
    var cap = b.d.rules && b.d.rules.salary_cap != null;
    var bud = cap ? '<p class="note">' + esc(t(L, 'budget', { v: money(budget(b, line)) })) + '</p>' : '';
    if (line.guest) {
      return '<section class="bd-line bd-set bd-gset">' + head + '<div class="bd-cand bd-fail bd-on"><span class="bd-cn"><b>' + esc(line.guest.name) + '</b></span><span class="bd-cs">—</span>' +
        '<span class="bd-cw">✗ ' + esc(t(L, 'guestNoList')) + ' · ' + guestTag(b.ctx, line.guest) + '</span></div>' +
        '<button type="button" class="lnk ad-linkbtn" data-b-unpick="' + key + '">' + esc(t(L, 'change')) + '</button></section>';
    }
    if (line.sub_id) {
      var c = candOf(b, line.sub_id);
      return '<section class="bd-line bd-set">' + head + (c ? candCard(b, line, { c: c, j: judge(b, c, line) }, true) : '') +
        '<button type="button" class="lnk ad-linkbtn" data-b-unpick="' + key + '">' + esc(t(L, 'change')) + '</button></section>';
    }
    var q = b.q[key] || '', list;
    if (q) {
      var all = g.ok.concat(g.warn, g.fail).filter(function (x) { return fold(x.c.name).indexOf(fold(q)) >= 0; }).slice(0, 12);
      list = all.length ? '<div class="bd-cands">' + all.map(function (x) { return candCard(b, line, x); }).join('') + '</div>' : '<p class="note">' + esc(t(L, 'noMatchGuest')) + '</p>';
    } else {
      var shown = b.more[key] ? g.ok : g.ok.slice(0, SUGGEST);
      list = (shown.length ? '<p class="bd-sub-h">' + esc(t(L, 'suggested')) + '</p><div class="bd-cands">' + shown.map(function (x) { return candCard(b, line, x); }).join('') + '</div>' : '<p class="note">' + esc(t(L, 'noneOk')) + '</p>') +
        (g.ok.length > shown.length ? '<button type="button" class="lnk ad-linkbtn" data-b-more="' + key + '">' + esc(t(L, 'seeMore', { n: g.ok.length - shown.length })) + '</button>' : '') +
        (g.warn.length ? '<details class="bd-other"><summary>' + esc(t(L, 'toCheck', { n: g.warn.length })) + '</summary><div class="bd-cands">' + g.warn.map(function (x) { return candCard(b, line, x); }).join('') + '</div></details>' : '');
    }
    if (!b.gopen[key]) list += '<p><button type="button" class="lnk ad-linkbtn bd-guestbtn" data-b-guest-open="' + key + '">+ ' + esc(t(L, 'guestBtn')) + '</button></p>';
    return '<section class="bd-line">' + head + bud + guestBlock(b, line, p) +
      '<input class="ctl bd-search" type="search" data-b-q="' + key + '" data-b-key="q-' + key + '" value="' + esc(q) + '" placeholder="' + esc(t(L, 'search')) + '" aria-label="' + esc(t(L, 'search')) + '">' + list + '</section>';
  }
  /* "Joueur hors-ligue": a player who is not on the list. Name and sex (the absent player's, to start with); age and
   * NBHPA no. optional. The request will not pass: a note is required and the admins decide. */
  function guestBlock(b, line, p) {
    var L = b.ctx.lang, key = line.absent_id;
    if (!b.gopen[key]) return '';
    var g = b.gform[key] || (b.gform[key] = { name: '', sex: p.sex || '', age: '', nid: '' });
    var fld = function (n, label, extra) { return '<label>' + esc(label) + '<input class="ctl" data-b-gf="' + key + ':' + n + '" data-b-key="gf-' + key + '-' + n + '" value="' + esc(g[n]) + '"' + (extra || '') + '></label>'; };
    return '<fieldset class="bd-guest"><legend>' + esc(t(L, 'guestLegend')) + '</legend>' +
      (b.gerr[key] ? '<p class="ad-msg ad-err" role="alert">' + esc(t(L, 'guestErr')) + '</p>' : '') +
      fld('name', t(L, 'guestName'), ' maxlength="80" autocomplete="off"') +
      '<div class="bd-gsex"><span class="bd-gl">' + esc(t(L, 'guestSex')) + '</span><div class="seg" role="group">' + ['m', 'f'].map(function (k) {
        return '<button type="button" data-b-gsex="' + key + ':' + k + '" aria-pressed="' + (g.sex === k) + '">' + esc(t(L, k === 'f' ? 'sexF' : 'sexM')) + '</button>'; }).join('') + '</div></div>' +
      '<div class="ad-pair">' + fld('age', t(L, 'guestAge'), ' inputmode="numeric" maxlength="3"') + fld('nid', t(L, 'guestNid'), ' inputmode="numeric" maxlength="12"') + '</div>' +
      '<p class="note">' + esc(t(L, 'guestHint', { a: p.name })) + '</p>' +
      '<p class="ad-btns"><button type="button" class="ad-btn ad-btn-sm" data-b-guest-save="' + key + '">' + esc(t(L, 'guestUse')) + '</button>' +
      '<button type="button" class="lnk ad-linkbtn" data-b-guest-close="' + key + '">' + esc(t(L, 'cancel')) + '</button></p></fieldset>';
  }
  function step3(b) {
    var L = b.ctx.lang, n = complete(b).length;
    return '<h2 class="bd-q">' + esc(t(L, b.lines.length > 1 ? 'q3n' : 'q3')) + '</h2>' + b.lines.map(function (l) { return lineBlock(b, l); }).join('') +
      nav(b, 2, n && n === b.lines.length ? 4 : 0);
  }
  function step4(b) {
    var L = b.ctx.lang, d = b.d, c = b.check, lines = complete(b);
    var names = lines.map(function (l) { return { a: rosterOf(b, l.absent_id).name, s: l.guest ? l.guest.name : (candOf(b, l.sub_id) || {}).name }; });
    var sums = lines.map(function (l) { var x = candOf(b, l.sub_id) || {}; return { absent_salary: rosterOf(b, l.absent_id).salary, sub_salary: l.guest ? null : l.sub_pos === 'g' ? x.salary_g : x.salary_s }; });
    var summary = '<div class="bd-sum"><p><b>' + esc(slotText(b)) + '</b>' + (b.slot !== 'manual' ? ' · ' + esc(gameText(b.ctx, d.team.league, d.team.nbhpa_team_id, d.games.filter(function (g) { return g.id === b.slot; })[0] || {}).split(' · ').slice(2).join(' · ')) : '') + '</p>' +
      '<ul class="bd-lines">' + lines.map(function (l, i) {
        return '<li>' + esc(names[i].a) + ' <span class="bd-arrow" aria-hidden="true">→</span> <b>' + esc(names[i].s) + '</b>' + (l.guest ? ' ' + guestTag(b.ctx, l.guest) : '') + ' <span class="note">' + esc(posName(b.ctx, l.sub_pos)) + ' · ' + esc(money(sums[i].absent_salary)) + ' → ' + esc(money(sums[i].sub_salary)) + '</span></li>';
      }).join('') + '</ul></div>';
    var checks = '';
    if (!c) checks = '<p class="note">' + esc(t(L, 'loading')) + '</p>';
    else {
      var outSum = 0, inSum = 0; sums.forEach(function (x) { outSum += x.absent_salary || 0; inSum += x.sub_salary || 0; });
      var issues = c.checks.filter(function (x) { return x.s !== 'ok'; }).map(function (x) {
        return '<li class="bd-' + x.s + '"><i aria-hidden="true">' + ICON[x.s] + '</i> ' + esc(x.k === 'cap' && c.payroll ? capText(b.ctx, c.payroll, outSum, inSum) : explain(b.ctx, x, names)) + '</li>'; }).join('');
      var capOk = c.checks.filter(function (x) { return x.k === 'cap' && x.s === 'ok'; })[0];
      checks = '<div class="bd-verdict bd-' + c.result + '">' + resultChip(b.ctx, c.result) + '</div>' +
        (issues ? '<ul class="bd-issues">' + issues + '</ul>' : '') + (capOk ? '<p class="note">' + esc(capText(b.ctx, c.payroll, outSum, inSum)) + '</p>' : '') +
        '<details class="bd-more"><summary>' + esc(t(L, 'allChecks', countBy(c.checks))) + '</summary>' + checksHtml(b.ctx, c.checks, names, sums, c.payroll) + '</details>';
    }
    var noteReq = c && c.result === 'fail';
    return '<h2 class="bd-q">' + esc(t(L, 'q4')) + '</h2>' + summary + checks +
      '<label class="bd-notel">' + esc(t(L, 'note')) + '<textarea class="ctl" rows="2" maxlength="1000" data-b-note data-b-key="note">' + esc(b.note) + '</textarea></label>' +
      (noteReq ? '<p class="note bd-fail">' + esc(t(L, 'noteReq')) + '</p>' : '') +
      (b.area === 'admin' ? '<label class="bd-check"><input type="checkbox" data-b-approve' + (b.approve ? ' checked' : '') + '> ' + esc(t(L, 'approveNow')) + '</label>' : '') +
      '<div class="bd-nav"><button type="button" class="lnk ad-linkbtn" data-b-step="3">← ' + esc(t(L, 'prev')) + '</button>' +
      '<button class="ad-btn" type="submit"' + (!c || b.saving ? ' disabled' : '') + '>' + esc(t(L, b.area === 'admin' ? 'save' : 'send')) + '</button></div>';
  }
  var countBy = function (cs) { var n = { ok: 0, warn: 0, fail: 0 }; cs.forEach(function (c) { n[c.s]++; }); return n; };
  /* Back / next buttons of a step. next = the step to go to (0: not yet). */
  function nav(b, prev, next, label) {
    var L = b.ctx.lang;
    return '<div class="bd-nav">' + (prev ? '<button type="button" class="lnk ad-linkbtn" data-b-step="' + prev + '">← ' + esc(t(L, 'prev')) + '</button>' : '<span></span>') +
      '<button type="button" class="ad-btn" data-b-step="' + (next || b.step + 1) + '"' + (next ? '' : ' disabled') + '>' + esc(label || t(L, 'next')) + '</button></div>';
  }
  function html(b) {
    var L = b.ctx.lang, d = b.d, h = '';
    if (b.msg) h += '<p class="ad-msg ad-err" role="alert">' + esc(b.msg) + '</p>';
    if (b.teams && b.teams.length > 1 && !b.teamId) {
      return h + '<h2 class="bd-q">' + esc(t(L, 'q0')) + '</h2><div class="bd-tiles">' + b.teams.map(function (x) {
        return '<button type="button" class="bd-tile" data-b-team="' + x.id + '"><span>' + (b.league ? window.LDLook.crest({ abb: x.abb }, b.league, 'sm') : '') + '<b>' + esc(x.name) + '</b><small>' + esc(x.abb) + '</small></span></button>';
      }).join('') + '</div>';
    }
    if (!b.teamId) return h;
    if (!d) return h + (b.loading ? '<p class="note">' + esc(t(L, 'loading')) + '</p>' : '');
    h += '<div class="bd-top"><p class="bd-team">' + teamHead(b.ctx, d.team, d.team.league) +
      (b.teams && b.teams.length > 1 ? ' <button type="button" class="lnk ad-linkbtn" data-b-team="">' + esc(t(L, 'changeTeam')) + '</button>' : '') + '</p>' +
      '<span class="bd-topacts"><button type="button" class="lnk ad-linkbtn" data-b-rules data-b-key="rules">' + esc(t(L, 'rulesLink')) + '</button>' +
      '<button type="button" class="lnk ad-linkbtn" data-b-cancel>' + esc(t(L, 'cancel')) + '</button></span></div>' + stepper(b);
    h += '<div class="bd-body">' + (b.step === 1 ? step1(b) : b.step === 2 ? step2(b) : b.step === 3 ? step3(b) : step4(b)) + '</div>';
    if (b.rulesOpen) h += rulesModal(b);
    return h;
  }
  /* The league rules: a link at the top (most people know them by heart), the full text in a small window. */
  function rulesModal(b) {
    var r = b.d.rules || {}, L = b.ctx.lang, l = leagueOf(b.ctx, b.d.team.league) || {}, dash = function (v) { return v == null ? '—' : v; };
    var items = [t(L, 'rl_sex'), t(L, 'rl_list')];
    if (r.salary_cap != null) items.push(t(L, 'rl_cap', { c: money(r.salary_cap) }));
    if (r.min_age_m != null || r.min_age_f != null || r.min_age_g != null) items.push(t(L, 'rl_age', { m: dash(r.min_age_m), f: dash(r.min_age_f), g: dash(r.min_age_g), when: t(L, r.age_on === 'year' ? 'rl_ageYear' : 'rl_ageGame') }));
    items.push(t(L, 'rl_send'));
    return '<div class="ad-modal-back" data-b-rules-close></div><div class="ad-modal bd-rmodal" role="dialog" aria-modal="true" aria-labelledby="bd-rt">' +
      '<div class="ad-modal-h"><h2 id="bd-rt">' + esc(t(L, 'rulesTitle', { l: l.short || b.d.team.league })) + '</h2><button type="button" class="ad-x" data-b-rules-close data-b-key="rules-x" aria-label="' + esc(t(L, 'close')) + '">×</button></div>' +
      '<ul class="bd-rlist">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (r.notes ? '<p class="bd-note">' + esc(r.notes) + '</p>' : '') +
      '<div class="ad-modal-f"><button type="button" class="ad-btn" data-b-rules-close>' + esc(t(L, 'close')) + '</button></div></div>';
  }
  function draw(b) {
    var el = b.el;
    if (!el || !el.isConnected) return;
    var a = document.activeElement, key = a && el.contains(a) ? a.getAttribute('data-b-key') : null, pos = null;
    try { pos = key && a.selectionStart; } catch (e) { pos = null; }
    el.innerHTML = '<form class="ad-form ad-col bd" data-b-form novalidate>' + html(b) + '</form>';
    if (key) { var n = el.querySelector('[data-b-key="' + key + '"]'); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } } }
  }
  function go(b, n) {
    b.step = Math.max(1, Math.min(n, reach(b)));
    draw(b);
    var s = b.el && b.el.querySelector('.bd-steps');
    if (s && s.scrollIntoView && s.getBoundingClientRect && s.getBoundingClientRect().top < 0) s.scrollIntoView({ block: 'start' });
  }
  function bind(el) {
    if (el.__ldbBound) return;
    el.__ldbBound = true;
    el.addEventListener('click', function (e) {
      var b = el.__ldb, x = e.target.closest && e.target.closest('[data-b-rules],[data-b-rules-close],[data-b-guest-open],[data-b-guest-close],[data-b-guest-save],[data-b-gsex],[data-b-team],[data-b-game],[data-b-absent],[data-b-pick],[data-b-unpick],[data-b-pos],[data-b-more],[data-b-step],[data-b-cancel]');
      if (!x || x.disabled) return;
      var v = function (a) { return x.getAttribute(a); }, ln = function (id) { return b.lines.filter(function (l) { return l.absent_id === Number(id); })[0]; };
      if (x.hasAttribute('data-b-cancel')) { if (b.ctx.onCancel) b.ctx.onCancel(); return; }
      if (x.hasAttribute('data-b-rules')) { b.rulesOpen = true; draw(b); var cx = el.querySelector('[data-b-key="rules-x"]'); if (cx) cx.focus(); return; }
      if (x.hasAttribute('data-b-rules-close')) { b.rulesOpen = false; draw(b); var rl = el.querySelector('[data-b-rules]'); if (rl) rl.focus(); return; }
      if (x.hasAttribute('data-b-team')) { b.teamId = Number(v('data-b-team')) || null; b.d = null; b.slot = ''; b.lines = []; b.check = null; b.msg = null; b.step = 1; load(b); return; }
      if (x.hasAttribute('data-b-game')) { b.slot = v('data-b-game'); b.check = null; b.msg = null; b.step = 2; load(b); return; }
      if (x.hasAttribute('data-b-step')) { go(b, Number(v('data-b-step'))); return; }
      if (x.hasAttribute('data-b-absent')) {
        var pid = Number(v('data-b-absent'));
        if (ln(pid)) b.lines = b.lines.filter(function (l) { return l.absent_id !== pid; });
        else b.lines.push({ absent_id: pid, sub_id: null, sub_pos: rosterOf(b, pid).pos || 's' });
        draw(b); check(b); return;
      }
      if (x.hasAttribute('data-b-pick')) { var pk = v('data-b-pick').split(':'); ln(pk[0]).sub_id = Number(pk[1]); b.q[pk[0]] = ''; draw(b); check(b); return; }
      if (x.hasAttribute('data-b-unpick')) { var ul = ln(v('data-b-unpick')); ul.sub_id = null; ul.guest = null; draw(b); check(b); return; }
      if (x.hasAttribute('data-b-guest-open')) { var gopen = v('data-b-guest-open'); b.gopen[gopen] = true; draw(b); var nf = el.querySelector('[data-b-key="gf-' + gopen + '-name"]'); if (nf) nf.focus(); return; }
      if (x.hasAttribute('data-b-guest-close')) { b.gopen[v('data-b-guest-close')] = false; b.gerr[v('data-b-guest-close')] = false; draw(b); return; }
      if (x.hasAttribute('data-b-gsex')) { var gs = v('data-b-gsex').split(':'); b.gform[gs[0]].sex = gs[1]; draw(b); return; }
      if (x.hasAttribute('data-b-guest-save')) {
        var gk = v('data-b-guest-save'), gf = b.gform[gk], age = String(gf.age).trim(), nid = String(gf.nid).trim();
        var okG = gf.name.trim() && (gf.sex === 'm' || gf.sex === 'f') && (!age || (/^\d+$/.test(age) && +age >= 10 && +age <= 120)) && (!nid || /^\d{1,12}$/.test(nid));
        if (!okG) { b.gerr[gk] = true; draw(b); return; }
        var gl = ln(gk); gl.guest = { name: gf.name.trim(), sex: gf.sex, age: age ? Number(age) : null, nid: nid || null }; gl.sub_id = null;
        b.gopen[gk] = false; b.gerr[gk] = false; draw(b); check(b); return;
      }
      if (x.hasAttribute('data-b-pos')) { var pp = v('data-b-pos').split(':'); ln(pp[0]).sub_pos = pp[1] === 'g' ? 'g' : 's'; draw(b); check(b); return; }
      if (x.hasAttribute('data-b-more')) { b.more[v('data-b-more')] = true; draw(b); }
    });
    el.addEventListener('keydown', function (e) { var b = el.__ldb; if (e.key === 'Escape' && b.rulesOpen) { e.stopPropagation(); b.rulesOpen = false; draw(b); } });
    el.addEventListener('change', function (e) {
      var b = el.__ldb, x = e.target;
      if (x.hasAttribute('data-b-slot')) { b.slot = x.value; b.check = null; b.msg = null; if (b.slot && b.slot !== 'manual') { b.step = 2; load(b); } else { if (b.d) b.d.candidates = null; draw(b); } return; }
      if (x.hasAttribute('data-b-date') || x.hasAttribute('data-b-time')) { b.date = el.querySelector('[data-b-date]').value; b.time = el.querySelector('[data-b-time]').value; if (slotReady(b)) load(b); return; }
      if (x.hasAttribute('data-b-approve')) b.approve = x.checked;
    });
    el.addEventListener('input', function (e) {
      var b = el.__ldb, x = e.target;
      if (x.hasAttribute('data-b-note')) b.note = x.value;
      if (x.hasAttribute('data-b-gf')) { var gp = x.getAttribute('data-b-gf').split(':'); b.gform[gp[0]][gp[1]] = x.value; }
      if (x.hasAttribute('data-b-q')) { b.q[x.getAttribute('data-b-q')] = x.value; draw(b); }
    });
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = el.__ldb;
      if (b.saving || b.step !== 4) return;
      var o = body(b); o.note = b.note.trim() || null; if (b.area === 'admin') o.approve = !!b.approve;
      b.saving = true; b.msg = null; draw(b);
      b.ctx.api('/replacements', 'POST', o).then(function (r) {
        b.saving = false;
        if (r.ok) { b.ctx.onSaved(r.data); return; }
        b.msg = errText(b, r); draw(b);
      });
    });
  }
  function mount(el, b, ctx) {
    if (!el) return;
    b.el = el; b.ctx = ctx; el.__ldb = b; bind(el);
    if (b.teamId && !b.d && !b.loading) load(b); else draw(b);
  }

  /* ---------- the changes to a team's lineup for a game (from /lineups) ----------
   * Only what changes (owner: the full roster is noise): the replacements (✓ approved, ! pending, with who they replace)
   * and the absent players struck through, with the night's counts and payroll against the cap.
   * o = { head: false (the page already shows the team), actions } */
  function lineupHtml(lu, ctx, o) {
    o = o || {};
    var L = ctx.lang, league = lu.team.league, head = o.head === false ? '' : '<div class="ld-h">' + teamHead(ctx, lu.team, league) + (o.actions || '') + '</div>';
    if (lu.missing) return '<div class="ld-team">' + head + '<p class="note">' + esc(t(L, 'ldMissing')) + '</p></div>';
    var g = function (p) { return p.pos === 'g' ? ' <abbr class="ld-g" title="' + esc(t(L, 'ldGoalieTitle')) + '">' + esc(t(L, 'ldG')) + '</abbr>' : ''; };
    var subs = lu.subs.map(function (x) {
      return '<li class="ld-sub ld-' + x.req.status + '"><span class="ld-mark" aria-hidden="true">' + (x.req.status === 'approved' ? '✓' : '!') + '</span><span><b>' + person(ctx, league, x.name, x.site_id) + '</b>' + g(x) +
        (x.guest ? ' ' + guestTag(ctx, x.guest) : '') + ' <span class="note">' + esc(t(L, 'ldFor', { n: x.for }) + ' · ' + t(L, 'st_' + x.req.status)) + '</span></span></li>';
    }).join('');
    var p = lu.payroll, over = p.cap != null && p.after > p.cap + 1e-9;
    var sum = t(L, 'ldCounts', lu.counts) + ' · ' + (p.cap != null ? t(L, 'ldPay', { a: money(p.after), c: money(p.cap) }) : t(L, 'ldPayNoCap', { a: money(p.after) }));
    return '<div class="ld-team" style="--tc:' + window.LDLook.colorVar(league, lu.team.abb) + '">' + head +
      '<p class="ld-sum' + (over ? ' bd-fail' : '') + '">' + esc(sum) + '</p>' +
      (subs ? '<ul class="ld-list">' + subs + '</ul>' : '<p class="ld-none">' + esc(t(L, 'ldNone')) + '</p>') +
      (lu.absents.length ? '<p class="ld-abs">' + esc(t(L, 'ldAbsent')) + ' : ' + lu.absents.map(function (a) { return '<s>' + esc(a.name) + '</s>'; }).join(', ') + '</p>' : '') + '</div>';
  }
  /* A game of a night: time, venue, then both teams side by side. actFn(lineup, game) -> HTML of the team's actions. */
  function gameHtml(item, ctx, actFn) {
    var gm = item.game;
    return '<article class="ld-game"><div class="ld-gh"><b>' + esc(gm.time || '') + '</b>' + (gm.venue ? ' <span class="note">' + esc(gm.venue + (gm.court ? ' ' + gm.court : '')) + '</span>' : '') + '</div>' +
      '<div class="ld-cols">' + item.teams.map(function (lu) { return lineupHtml(lu, ctx, { actions: actFn ? actFn(lu, gm) : '' }); }).join('<span class="ld-vs" aria-hidden="true">@</span>') + '</div></article>';
  }

  window.LDBuilder = { state: state, mount: mount, requestCard: requestCard, checksHtml: checksHtml, lineupHtml: lineupHtml, gameHtml: gameHtml,
    day: function (ctx, d) { return day(ctx, d); }, gameText: function (ctx, league, nb, g) { return gameText(ctx, league, nb, g, true); }, t: t, STR: STR };
})();
