/* The replacement builder and the request card, shared by the captain area and the admin area (an admin builds
 * requests for captains who are less at ease with tech). Plain JavaScript (ES5), fr/en, no framework.
 * The checks are made by the server (tools/src/replacements.js); this file only shows them and helps choose.
 *
 *   var b = LDBuilder.state({ area: 'captain' | 'admin', teamId, teams })   teams: choices [{ id, name, abb }] (admin) or null
 *   LDBuilder.mount(el, b, ctx)   renders into el and keeps its state in b, so the page can re-render around it (mount again)
 *       ctx = { lang, data (season.json), api(path, method, body) -> Promise<{ ok, status, data }>, onSaved(result) }
 *   LDBuilder.requestCard(q, ctx, actionsHtml)   one request (queue, history): the same in both areas
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
      note: 'Note pour l’administrateur', noteReq: 'Une vérification échoue : expliquez pourquoi la demande devrait être acceptée quand même.',
      approveNow: 'Approuver tout de suite (je fais la demande pour le capitaine)', send: 'Envoyer la demande', save: 'Enregistrer', cancel: 'Annuler',
      needLines: 'Cochez au moins un absent et choisissez son remplaçant.', needSub: 'Choisissez un remplaçant pour chaque absent.',
      rules: 'Règles de la ligue', capRule: 'plafond {c}', ageRule: 'âge minimum : hommes {m}, femmes {f}, gardiens {g}', ageYear: '(dans l’année du match)', ageGame: '(à la date du match)',
      k_absent: 'Alignement', k_listed: 'Liste des joueurs', k_own: 'Pas déjà dans l’équipe', k_busy: 'Libre à cette heure', k_age: 'Âge {min}+', k_age0: 'Âge', k_salary: 'Salaires', k_cap: 'Plafond', k_dup: 'Doublon',
      x_absent: '{a} n’est pas dans l’alignement de l’équipe.', x_listed: '{s} n’est pas sur la liste des joueurs de la section cette saison. Un administrateur peut l’ajouter.',
      x_own: '{s} est déjà dans l’alignement de cette équipe.', x_busy: '{s} joue à la même heure (avec {abb}).', x_busyReq: '{s} remplace déjà à la même heure (demande no {req}, {abb}).',
      x_age: '{s} n’a pas l’âge minimum ({min} ans comme {pos}).', x_ageBirth: 'Date de naissance de {s} inconnue : l’âge ({min} ans) est à vérifier.',
      x_ageBday: '{s} atteint {min} ans le mois du match : à vérifier.', x_ageSex: 'Sexe de {s} inconnu : l’âge est à vérifier.',
      x_salary: 'Salaire inconnu : {who}.', x_dup: 'Une autre demande ouverte pour ce match nomme les mêmes joueurs (no {ids}).',
      capLine: 'Masse salariale : {b} − {o} + {i} = {a} · plafond {c}', capOver: 'dépasse de {v}', capMissing: '{n} joueurs de l’alignement sans salaire',
      payroll: 'Masse salariale : {b} · plafond {c}',
      r_ok: 'Tout est conforme', r_warn: 'À vérifier', r_fail: 'Non conforme',
      st_pending: 'En attente', st_approved: 'Approuvée', st_refused: 'Refusée', st_cancelled: 'Annulée',
      by: 'Demandée par {n} · {d}', byAdmin: 'Faite par l’administration ({n}) · {d}', decided: '{s} par {n} · {d}', reqNo: 'Demande no {id}', noteFrom: 'Note',
      e_note_required: 'Une vérification échoue : une note est requise.', e_game: 'Match invalide.', e_replacement: 'Demande invalide.', e_team: 'Équipe introuvable.',
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
      note: 'Note for the admin', noteReq: 'A check fails: explain why the request should be accepted anyway.',
      approveNow: 'Approve now (I am making the request for the captain)', send: 'Send the request', save: 'Save', cancel: 'Cancel',
      needLines: 'Tick at least one absent player and choose their replacement.', needSub: 'Choose a replacement for each absent player.',
      rules: 'League rules', capRule: 'cap {c}', ageRule: 'minimum age: men {m}, women {f}, goalies {g}', ageYear: '(during the game’s year)', ageGame: '(on the game date)',
      k_absent: 'Roster', k_listed: 'Player list', k_own: 'Not already on the team', k_busy: 'Free at that time', k_age: 'Age {min}+', k_age0: 'Age', k_salary: 'Salaries', k_cap: 'Cap', k_dup: 'Duplicate',
      x_absent: '{a} is not on the team’s roster.', x_listed: '{s} is not on the section’s player list this season. An admin can add them.',
      x_own: '{s} is already on this team’s roster.', x_busy: '{s} plays at the same time (with {abb}).', x_busyReq: '{s} already replaces at the same time (request no. {req}, {abb}).',
      x_age: '{s} does not meet the minimum age ({min} as a {pos}).', x_ageBirth: '{s}’s birth date is unknown: the age ({min}) must be checked.',
      x_ageBday: '{s} turns {min} in the month of the game: to check.', x_ageSex: '{s}’s sex is unknown: the age must be checked.',
      x_salary: 'Unknown salary: {who}.', x_dup: 'Another open request for this game names the same players (no. {ids}).',
      capLine: 'Payroll: {b} − {o} + {i} = {a} · cap {c}', capOver: 'over by {v}', capMissing: '{n} roster players without a salary',
      payroll: 'Payroll: {b} · cap {c}',
      r_ok: 'All checks pass', r_warn: 'To check', r_fail: 'Does not pass',
      st_pending: 'Pending', st_approved: 'Approved', st_refused: 'Refused', st_cancelled: 'Cancelled',
      by: 'Asked by {n} · {d}', byAdmin: 'Made by the admins ({n}) · {d}', decided: '{s} by {n} · {d}', reqNo: 'Request no. {id}', noteFrom: 'Note',
      e_note_required: 'A check fails: a note is required.', e_game: 'Invalid game.', e_replacement: 'Invalid request.', e_team: 'Team not found.',
      e_session: 'Your session expired. Sign in again.', e_server: 'Server error. Try again.', e_net: 'The server does not answer.'
    }
  };
  function t(lang, k, v) {
    var s = (STR[lang] || STR.fr)[k]; if (s == null) s = k;
    Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); });
    return s;
  }
  var money = function (v) { return v == null ? '—' : String(Math.round(v * 100) / 100); };
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
  function person(ctx, league, name, siteId) {
    var l = leagueOf(ctx, league);
    return siteId && l ? '<a class="lnk" href="' + esc(((ctx.data && ctx.data.siteUrl) || '/') + l.sectionPath + '/#player-' + siteId) + '">' + esc(name) + '</a>' : esc(name);
  }
  var locale = function (ctx) { return ctx.lang === 'en' ? 'en-CA' : 'fr-CA'; };
  var day = function (ctx, d) { try { return new Date(d + 'T12:00:00').toLocaleDateString(locale(ctx), { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; } };
  var stamp = function (ctx, sec) { return sec ? new Date(sec * 1000).toLocaleString(locale(ctx), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : ''; };
  /* "jeu. 16 oct. · 18:00 · contre GHO · Surface X 1" from the team's point of view */
  function gameText(ctx, league, teamNb, g) {
    var l = leagueOf(ctx, league) || { teams: [] };
    var abb = function (id) { return ((l.teams || []).filter(function (x) { return x.id === id; })[0] || {}).abb || '?'; };
    var isHome = g.home === teamNb, opp = abb(isHome ? g.away : g.home);
    return day(ctx, g.date) + (g.time ? ' · ' + g.time : '') + ' · ' + (isHome ? t(ctx.lang, 'vs') : t(ctx.lang, 'at')) + ' ' + opp + (g.venue ? ' · ' + g.venue + (g.court ? ' ' + g.court : '') : '');
  }
  function requestGame(ctx, q) {
    var l = leagueOf(ctx, q.league), g = q.game_id && l && (l.games || []).filter(function (x) { return x.id === q.game_id; })[0];
    if (g) return gameText(ctx, q.league, q.team.nbhpa_team_id, g);
    return day(ctx, q.game_date) + (q.game_time ? ' · ' + q.game_time : '') + (q.game_label ? ' · ' + q.game_label : '');
  }
  var posName = function (ctx, p) { return t(ctx.lang, p === 'g' ? 'posG' : 'posS'); };

  /* ---------- checks: grouped by line (absent -> replacement), then the team checks (cap, duplicates) ---------- */
  function explain(ctx, c, names) {
    var L = ctx.lang, d = c.d || {}, n = names[c.line] || {}, v = { a: n.a || '?', s: n.s || '?' };
    if (c.k === 'absent') return t(L, 'x_absent', v);
    if (c.k === 'listed') return t(L, 'x_listed', v);
    if (c.k === 'own') return t(L, 'x_own', v);
    if (c.k === 'busy') return t(L, d.req ? 'x_busyReq' : 'x_busy', { s: v.s, abb: d.abb || '?', req: d.req });
    if (c.k === 'age') {
      var av = { s: v.s, min: d.min, pos: posName(ctx, d.pos).toLowerCase() };
      return t(L, c.s === 'fail' ? 'x_age' : d.why === 'no_birth' ? 'x_ageBirth' : d.why === 'birthday' ? 'x_ageBday' : 'x_ageSex', av);
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
      return '<li class="bd-cl"><div class="bd-cl-h"><span class="bd-chks">' + chip(ctx, c) + '</span></div><p class="bd-why bd-' + c.s + '">' + esc(text) + '</p></li>';
    }).join('');
    return '<ul class="bd-checks">' + html + '</ul>';
  }
  var resultChip = function (ctx, r) { return '<span class="bd-res bd-' + r + '"><i aria-hidden="true">' + ICON[r] + '</i>' + esc(t(ctx.lang, 'r_' + r)) + '</span>'; };

  /* ---------- a request: the same card in the queue, the history and the captain's list ---------- */
  function requestCard(q, ctx, actions) {
    var L = ctx.lang;
    var names = q.lines.map(function (l) { return { a: l.absent_name, s: l.sub_name }; });
    var lines = q.lines.map(function (l) {
      return '<li>' + person(ctx, q.league, l.absent_name, l.absent_site) + ' <span class="note">' + esc(posName(ctx, l.absent_pos)) + ' · ' + esc(money(l.absent_salary)) + '</span>' +
        ' <span class="bd-arrow" aria-hidden="true">→</span> <b>' + person(ctx, q.league, l.sub_name, l.sub_site) + '</b> <span class="note">' + esc(posName(ctx, l.sub_pos)) + ' · ' + esc(money(l.sub_salary)) + '</span></li>';
    }).join('');
    var who = q.created_kind === 'admin' ? t(L, 'byAdmin', { n: q.created_name || '—', d: stamp(ctx, q.created_at) }) : t(L, 'by', { n: q.created_name || '—', d: stamp(ctx, q.created_at) });
    var dec = q.decided_at ? t(L, 'decided', { s: t(L, 'st_' + q.status), n: q.decided_name || '—', d: stamp(ctx, q.decided_at) }) : q.cancelled_at ? t(L, 'st_cancelled') + ' · ' + stamp(ctx, q.cancelled_at) : '';
    return '<article class="bd-req bd-st-' + esc(q.status) + '" data-req="' + q.id + '" style="--tc:' + window.LDLook.colorVar(q.league, q.team.abb) + '">' +
      '<div class="bd-req-h">' + teamHead(ctx, q.team, q.league) + '<span class="bd-st">' + esc(t(L, 'st_' + q.status)) + '</span>' + resultChip(ctx, q.result) + '</div>' +
      '<p class="bd-game"><b>' + esc(requestGame(ctx, q)) + '</b> <span class="note">' + esc(t(L, 'reqNo', { id: q.id })) + '</span></p>' +
      '<ul class="bd-lines">' + lines + '</ul>' + checksHtml(ctx, q.checks, names, q.lines, q.payroll) +
      (q.note ? '<p class="bd-note"><b>' + esc(t(L, 'noteFrom')) + ' :</b> ' + esc(q.note) + '</p>' : '') +
      '<p class="note">' + esc(who) + (dec ? '<br>' + esc(dec) : '') + '</p>' + (q.decision_note ? '<p class="bd-note">' + esc(q.decision_note) + '</p>' : '') +
      (actions || '') + '</article>';
  }

  /* ---------- the builder ---------- */
  function state(o) {
    return { area: o.area || 'captain', teamId: o.teamId || null, teams: o.teams || null, d: null, loading: false, slot: '', date: '', time: '',
      lines: [], note: '', approve: o.area === 'admin', check: null, msg: null, seq: 0, cseq: 0, saving: false, el: null, ctx: null };
  }
  var slotQuery = function (b) {
    if (b.slot && b.slot !== 'manual') return '&game=' + encodeURIComponent(b.slot);
    if (b.slot === 'manual' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) return '&date=' + b.date + (/^\d{2}:\d{2}$/.test(b.time) ? '&time=' + b.time : '');
    return '';
  };
  var slotReady = function (b) { return !!slotQuery(b); };
  var complete = function (b) { return b.lines.filter(function (l) { return l.sub_id; }); };
  var errText = function (b, r) { return t(b.ctx.lang, 'e_' + ((r.data && r.data.error) || 'server')); };

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
    var o = { team_id: b.teamId, lines: complete(b).map(function (l) { return { absent_id: l.absent_id, sub_id: l.sub_id, sub_pos: l.sub_pos }; }) };
    if (b.slot && b.slot !== 'manual') o.game_id = b.slot; else { o.game_date = b.date; o.game_time = b.time || null; }
    return o;
  }

  /* A candidate for one line: 'ok' | 'warn' | 'fail' and why. The server checks again; this only sorts the list. */
  function judge(b, c, line) {
    var d = b.d, L = b.ctx.lang, why = [], s = 'ok';
    var worse = function (x) { if (x === 'fail' || (x === 'warn' && s === 'ok')) s = x; };
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
    var cands = {}; (d.candidates || []).forEach(function (c) { cands[c.id] = c; });
    b.lines.forEach(function (l) {
      pay -= sal[l.absent_id] || 0;
      if (l !== line && l.sub_id && cands[l.sub_id]) pay += (l.sub_pos === 'g' ? cands[l.sub_id].salary_g : cands[l.sub_id].salary_s) || 0;
    });
    return cap - pay;
  }
  function subSelect(b, line) {
    var L = b.ctx.lang, used = {};
    b.lines.forEach(function (l) { if (l !== line && l.sub_id) used[l.sub_id] = 1; });
    var groups = { ok: [], warn: [], fail: [] };
    (b.d.candidates || []).forEach(function (c) {
      if (used[c.id]) return;
      var j = judge(b, c, line);
      groups[j.s].push('<option value="' + c.id + '"' + (line.sub_id === c.id ? ' selected' : '') + '>' + esc(c.name + ' · ' + (j.sal == null ? t(L, 'noSalary') : money(j.sal)) +
        (c.team ? ' · ' + c.team.abb : '') + (j.why.length ? ' (' + j.why.join(', ') + ')' : '')) + '</option>');
    });
    var og = function (k, label) { return groups[k].length ? '<optgroup label="' + esc(t(L, label, { n: groups[k].length })) + '">' + groups[k].join('') + '</optgroup>' : ''; };
    return '<select class="ctl" data-b-sub="' + line.absent_id + '" data-b-key="sub-' + line.absent_id + '" aria-label="' + esc(t(L, 'chooseSub')) + '"><option value="">' + esc(t(L, 'chooseSub')) + '</option>' +
      og('ok', 'gOk') + og('warn', 'gWarn') + og('fail', 'gFail') + '</select>';
  }
  function gameSelect(b) {
    var L = b.ctx.lang, d = b.d, today = d.today, up = [], past = [];
    d.games.forEach(function (g) {
      var o = '<option value="' + esc(g.id) + '"' + (b.slot === g.id ? ' selected' : '') + '>' + esc(gameText(b.ctx, d.team.league, d.team.nbhpa_team_id, g)) + '</option>';
      (g.date >= today ? up : past).push(o);
    });
    past.reverse();
    var sel = '<label>' + esc(t(L, 'game')) + '<select class="ctl" data-b-slot data-b-key="slot"><option value="">' + esc(t(L, 'chooseGame')) + '</option>' +
      (up.length ? '<optgroup label="' + esc(t(L, 'upcoming')) + '">' + up.join('') + '</optgroup>' : '') +
      (past.length ? '<optgroup label="' + esc(t(L, 'past')) + '">' + past.join('') + '</optgroup>' : '') +
      '<option value="manual"' + (b.slot === 'manual' ? ' selected' : '') + '>' + esc(t(L, 'manual')) + '</option></select></label>';
    var manual = b.slot === 'manual' ? '<span class="ad-pair"><label>' + esc(t(L, 'date')) + '<input class="ctl" type="date" data-b-date data-b-key="date" value="' + esc(b.date) + '"></label>' +
      '<label>' + esc(t(L, 'time')) + '<input class="ctl" type="time" data-b-time data-b-key="time" value="' + esc(b.time) + '"></label></span>' : '';
    return sel + manual + (!d.games.length ? '<p class="note">' + esc(t(L, 'noGames')) + '</p>' : '');
  }
  function rulesLine(b) {
    var r = b.d.rules, L = b.ctx.lang;
    if (!r) return '';
    var parts = [];
    if (r.salary_cap != null) parts.push(t(L, 'capRule', { c: money(r.salary_cap) }));
    if (r.min_age_m != null || r.min_age_f != null || r.min_age_g != null) parts.push(t(L, 'ageRule', { m: r.min_age_m == null ? '—' : r.min_age_m, f: r.min_age_f == null ? '—' : r.min_age_f, g: r.min_age_g == null ? '—' : r.min_age_g }) + ' ' + t(L, r.age_on === 'year' ? 'ageYear' : 'ageGame'));
    if (!parts.length && !r.notes) return '';
    return '<p class="note bd-rules"><b>' + esc(t(L, 'rules')) + ' :</b> ' + esc(parts.join(' · ')) + (r.notes ? (parts.length ? ' · ' : '') + esc(r.notes) : '') + '</p>';
  }
  function html(b) {
    var L = b.ctx.lang, d = b.d, h = '';
    if (b.msg) h += '<p class="ad-msg ad-err" role="alert">' + esc(b.msg) + '</p>';
    if (b.teams && b.teams.length > 1) {
      h += '<label class="bd-team">' + esc(t(L, 'team')) + '<select class="ctl" data-b-team data-b-key="team"><option value="">' + esc(t(L, 'chooseTeam')) + '</option>' + b.teams.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === b.teamId ? ' selected' : '') + '>' + esc(x.name + ' (' + x.abb + ')') + '</option>'; }).join('') + '</select></label>';
    }
    if (!b.teamId) return h;
    if (!d) return h + (b.loading ? '<p class="note">' + esc(t(L, 'loading')) + '</p>' : '');
    if (!(b.teams && b.teams.length > 1)) h += '<p class="bd-team">' + teamHead(b.ctx, d.team, d.team.league) + '</p>';
    h += rulesLine(b);
    h += '<section class="bd-step"><h3 class="ad-h3">' + esc(t(L, 'step1')) + '</h3><div class="bd-row">' + gameSelect(b) + '</div></section>';
    h += '<section class="bd-step"><h3 class="ad-h3">' + esc(t(L, 'step2')) + '</h3>';
    if (!d.roster.length) h += '<p class="note">' + esc(t(L, 'emptyRoster')) + '</p>';
    else if (!slotReady(b)) h += '<p class="note">' + esc(t(L, 'pickGameFirst')) + '</p>';
    else if (!d.candidates) h += '<p class="note">' + esc(t(L, 'loading')) + '</p>';
    else h += '<ul class="bd-roster">' + d.roster.map(function (p) {
      var line = b.lines.filter(function (l) { return l.absent_id === p.person_id; })[0];
      return '<li class="bd-pl' + (line ? ' bd-on' : '') + '"><label class="bd-abs"><input type="checkbox" data-b-absent="' + p.person_id + '" data-b-key="abs-' + p.person_id + '"' + (line ? ' checked' : '') + '>' +
        '<span><b>' + esc(p.name) + '</b> <span class="note">' + esc(posName(b.ctx, p.pos)) + ' · ' + esc(money(p.salary)) + '</span></span></label>' +
        (line ? '<div class="bd-sub">' + subSelect(b, line) + '<select class="ctl ad-sm" data-b-pos="' + p.person_id + '" data-b-key="pos-' + p.person_id + '" aria-label="' + esc(t(L, 'subPos')) + '">' +
          '<option value="s"' + (line.sub_pos === 's' ? ' selected' : '') + '>' + esc(t(L, 'posS')) + '</option><option value="g"' + (line.sub_pos === 'g' ? ' selected' : '') + '>' + esc(t(L, 'posG')) + '</option></select></div>' : '') + '</li>';
    }).join('') + '</ul>';
    h += '</section>';
    var c = b.check, lines = complete(b);
    if (c) {
      var cands = {}; (d.candidates || []).forEach(function (x) { cands[x.id] = x; });
      var ros = {}; d.roster.forEach(function (x) { ros[x.person_id] = x; });
      var names = lines.map(function (l) { return { a: (ros[l.absent_id] || {}).name, s: (cands[l.sub_id] || {}).name }; });
      var sums = lines.map(function (l) { var x = cands[l.sub_id] || {}; return { absent_salary: (ros[l.absent_id] || {}).salary, sub_salary: l.sub_pos === 'g' ? x.salary_g : x.salary_s }; });
      h += '<section class="bd-step"><h3 class="ad-h3">' + esc(t(L, 'step3')) + ' ' + resultChip(b.ctx, c.result) + '</h3>' + checksHtml(b.ctx, c.checks, names, sums, c.payroll) + '</section>';
    }
    var need = !slotReady(b) ? '' : !b.lines.length ? t(L, 'needLines') : lines.length < b.lines.length ? t(L, 'needSub') : '';
    var noteReq = c && c.result === 'fail';
    h += '<label class="bd-notel">' + esc(t(L, 'note')) + '<textarea class="ctl" rows="2" maxlength="1000" data-b-note data-b-key="note"' + (noteReq ? ' required' : '') + '>' + esc(b.note) + '</textarea></label>' +
      (noteReq ? '<p class="note bd-fail">' + esc(t(L, 'noteReq')) + '</p>' : '') +
      (b.area === 'admin' ? '<label class="bd-check"><input type="checkbox" data-b-approve' + (b.approve ? ' checked' : '') + '> ' + esc(t(L, 'approveNow')) + '</label>' : '') +
      (need ? '<p class="note">' + esc(need) + '</p>' : '') +
      '<div class="ad-modal-f"><button type="button" class="lnk ad-linkbtn" data-act="close-modal">' + esc(t(L, 'cancel')) + '</button>' +
      '<button class="ad-btn" type="submit"' + (need || !slotReady(b) || !lines.length || b.saving ? ' disabled' : '') + '>' + esc(t(L, b.area === 'admin' ? 'save' : 'send')) + '</button></div>';
    return h;
  }
  function draw(b) {
    var el = b.el;
    if (!el || !el.isConnected) return;
    var a = document.activeElement, key = a && el.contains(a) ? a.getAttribute('data-b-key') : null;
    el.innerHTML = '<form class="ad-form ad-col bd" data-b-form novalidate>' + html(b) + '</form>';
    if (key) { var n = el.querySelector('[data-b-key="' + key + '"]'); if (n) n.focus(); }
  }
  function bind(el) {
    if (el.__ldbBound) return;
    el.__ldbBound = true;
    el.addEventListener('change', function (e) {
      var b = el.__ldb, x = e.target;
      if (x.hasAttribute('data-b-team')) { b.teamId = Number(x.value) || null; b.d = null; b.slot = ''; b.lines = []; b.check = null; b.msg = null; load(b); return; }
      if (x.hasAttribute('data-b-slot')) { b.slot = x.value; b.check = null; b.msg = null; if (b.slot !== 'manual' || slotReady(b)) load(b); else { b.d.candidates = null; draw(b); } return; }
      if (x.hasAttribute('data-b-date') || x.hasAttribute('data-b-time')) { b.date = el.querySelector('[data-b-date]').value; b.time = el.querySelector('[data-b-time]').value; if (slotReady(b)) load(b); return; }
      if (x.hasAttribute('data-b-absent')) {
        var pid = Number(x.getAttribute('data-b-absent'));
        if (x.checked) { var p = b.d.roster.filter(function (r) { return r.person_id === pid; })[0]; b.lines.push({ absent_id: pid, sub_id: null, sub_pos: p ? p.pos : 's' }); }
        else b.lines = b.lines.filter(function (l) { return l.absent_id !== pid; });
        draw(b); check(b); return;
      }
      var ln = function (a) { var id = Number(x.getAttribute(a)); return b.lines.filter(function (l) { return l.absent_id === id; })[0]; };
      if (x.hasAttribute('data-b-sub')) { ln('data-b-sub').sub_id = Number(x.value) || null; draw(b); check(b); return; }
      if (x.hasAttribute('data-b-pos')) { ln('data-b-pos').sub_pos = x.value === 'g' ? 'g' : 's'; draw(b); check(b); return; }
      if (x.hasAttribute('data-b-approve')) { b.approve = x.checked; }
    });
    el.addEventListener('input', function (e) { if (e.target.hasAttribute('data-b-note')) el.__ldb.note = e.target.value; });
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = el.__ldb;
      if (b.saving) return;
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

  window.LDBuilder = { state: state, mount: mount, requestCard: requestCard, checksHtml: checksHtml, t: t, STR: STR };
})();
