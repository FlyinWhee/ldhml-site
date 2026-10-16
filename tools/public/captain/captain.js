/* LDHML captain area. Talks to /api/captain/... (tools/src/captain-api.js). Plain JavaScript, no framework, fr/en.
 * Straight to the point: after sign-in the captain lands on their team (most captains have one). A team switcher shows
 * only for a captain with several teams (the last one chosen is remembered in this browser). No sections, no setup.
 * The replacement builder (its own page: #demande) and the request cards are shared with the admin area (shared/builder.js). */
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
      signOut: 'Déconnexion', lang: 'English', ask: 'Demander un remplacement', askTitle: 'Demande de remplacement', back: '← Mon équipe',
      myReqs: 'Mes demandes', noReqs: 'Aucune demande pour le moment.', roster: 'Alignement', emptyRoster: 'L’alignement n’est pas encore entré.',
      payroll: 'Masse salariale : {v}', payrollCap: 'Masse salariale : {v} / plafond {c}', posS: 'Joueur', posG: 'Gardien',
      noTeams: 'Aucune équipe pour le moment. Un administrateur de la ligue doit vous donner l’accès à votre équipe.',
      sent: 'Demande envoyée. Un administrateur va la traiter.', cancelReq: 'Annuler la demande', confirmCancel: 'Annuler cette demande ? Elle sera supprimée.', cancelled: 'Demande annulée et supprimée.',
      older: 'Demandes passées ({n})', season: 'Saison {s}',
      e_email: 'Adresse courriel invalide.', e_code: 'Code invalide ou expiré.', e_session: 'Votre session a expiré. Reconnectez-vous.',
      e_not_open: 'Cette demande n’est plus ouverte.', e_server: 'Erreur du serveur. Réessayez.', e_net: 'Le serveur ne répond pas.', e_origin: 'Requête refusée.',
      foot: 'Outils LDHML. Besoin d’aide ? Écrivez à l’administration de votre ligue : elle peut aussi faire la demande pour vous.'
    },
    en: {
      title: 'Captain', signIn: 'Captain sign-in', emailLabel: 'Your email address', sendCode: 'Get a code',
      codeSent: 'If this address has a captain account, a code was just sent to {e}. It expires in 10 minutes.',
      codeLabel: '6-digit code', verify: 'Sign in', otherEmail: 'Use another address', devCode: 'Code (local development): {c}',
      signOut: 'Sign out', lang: 'Français', ask: 'Request a replacement', askTitle: 'Replacement request', back: '← My team',
      myReqs: 'My requests', noReqs: 'No request yet.', roster: 'Roster', emptyRoster: 'The roster is not entered yet.',
      payroll: 'Payroll: {v}', payrollCap: 'Payroll: {v} / cap {c}', posS: 'Skater', posG: 'Goalie',
      noTeams: 'No team yet. A league admin must give you access to your team.',
      sent: 'Request sent. An admin will handle it.', cancelReq: 'Cancel the request', confirmCancel: 'Cancel this request? It will be deleted.', cancelled: 'Request cancelled and deleted.',
      older: 'Past requests ({n})', season: '{s} season',
      e_email: 'Invalid email address.', e_code: 'Invalid or expired code.', e_session: 'Your session expired. Sign in again.',
      e_not_open: 'This request is no longer open.', e_server: 'Server error. Try again.', e_net: 'The server does not answer.', e_origin: 'Request refused.',
      foot: 'LDHML tools. Need help? Write to your league’s admins: they can also make the request for you.'
    }
  };
  var t = function (k, v) { var s = STR[lang][k] != null ? STR[lang][k] : k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  var S = { me: null, step: 'email', email: '', devCode: '', msg: null, data: null, teams: [], teamId: null, reqs: [], today: '', sub: null, flash: null };
  try { S.teamId = Number(localStorage.getItem('ldhml-captain-team')) || null; } catch (e) { /* ignore */ }

  function api(path, method, body) {
    return fetch('/api/captain' + path, { method: method || 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); },
        function () { return { ok: false, status: 0, data: { error: 'net' } }; });
  }
  var errMsg = function (r) { return t('e_' + ((r.data && r.data.error) || 'server')); };
  var say = function (kind, text) { S.msg = { kind: kind, text: text }; };
  var money = function (v) { return v == null ? '—' : String(Math.round(v * 100) / 100); };
  var team = function () { return S.teams.filter(function (x) { return x.id === S.teamId; })[0]; };
  var leagueOf = function (slug) { return S.data && S.data.leagues.filter(function (l) { return l.slug === slug; })[0]; };
  var home = function (l) { return ((S.data && S.data.siteUrl) || '/') + l.sectionPath + '/' + l.path + '/'; };
  var ctx = function () {
    return { lang: lang, data: S.data, api: api,
      onSaved: function () { S.flash = { kind: 'ok', text: t('sent') }; S.sub = null; location.hash = '#equipe'; },
      onCancel: function () { S.sub = null; location.hash = '#equipe'; } };
  };

  /* Team identity like the stats site: crest, full name (link to the team page), league badge. */
  function teamHead(tm) {
    var l = leagueOf(tm.league) || { slug: tm.league, teams: [] };
    var dt = (l.teams || []).filter(function (x) { return x.id === tm.nbhpa_team_id; })[0] || {};
    var name = tm.nbhpa_team_id && l.path ? '<a class="tl strong" href="' + esc(home(l) + '#team-' + tm.nbhpa_team_id) + '">' + esc(tm.name) + '</a>' : '<b>' + esc(tm.name) + '</b>';
    var badge = l.path ? window.LDLook.leagueBadge({ slug: l.slug, short: l.short, name: l.name, logo: l.logo }, { href: home(l), title: l.name, theme: l.theme }) : '';
    return '<span class="tcell">' + window.LDLook.crest({ abb: tm.abb, logo: dt.logo }, tm.league, '') + name + '</span>' + badge;
  }
  function person(tm, p) {
    var l = leagueOf(tm.league);
    return p.site_id && l ? '<a class="lnk" href="' + esc(((S.data && S.data.siteUrl) || '/') + l.sectionPath + '/#player-' + p.site_id) + '">' + esc(p.name) + '</a>' : esc(p.name);
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
  function switcher() {
    if (S.teams.length < 2) return '';
    return '<div class="cp-switch" role="group">' + S.teams.map(function (x) {
      var l = leagueOf(x.league) || {};
      return '<button type="button" data-team="' + x.id + '" aria-pressed="' + (x.id === S.teamId) + '" title="' + esc(x.name + (l.name ? ' · ' + l.name : '')) + '">' +
        window.LDLook.crest({ abb: x.abb }, x.league, 'sm') + esc(x.name) + (l.short ? ' <span class="note">' + esc(l.short) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function viewTeam() {
    var tm = team();
    if (!tm) return '<h1 class="ph">' + t('title') + '</h1><p class="lede">' + t('noTeams') + '</p>';
    var reqs = S.reqs.filter(function (q) { return q.team.id === tm.id; });
    var open = function (q) { return (q.status === 'pending' || q.status === 'approved') && q.game_date >= S.today; };
    var current = reqs.filter(function (q) { return q.status === 'pending' || q.game_date >= S.today; }), older = reqs.filter(function (q) { return current.indexOf(q) < 0; });
    var card = function (q) { return window.LDBuilder.requestCard(q, ctx(), open(q) ? '<div class="bd-acts"><button type="button" class="lnk ad-linkbtn" data-cancel="' + q.id + '">' + t('cancelReq') + '</button></div>' : '', { team: false, result: q.status === 'pending' }); };
    var total = 0, cap = tm.rules && tm.rules.salary_cap != null ? tm.rules.salary_cap : null;
    tm.roster.forEach(function (r) { total += r.salary || 0; });
    var rows = tm.roster.map(function (r) { return '<tr><td>' + person(tm, r) + '</td><td>' + esc(r.pos === 'g' ? t('posG') : t('posS')) + '</td><td class="num">' + esc(money(r.salary)) + '</td></tr>'; }).join('');
    return switcher() + '<div class="cp-team">' + teamHead(tm) + '<span class="note">' + esc(t('season', { s: tm.season_name })) + '</span></div>' +
      '<p class="cp-ask"><button type="button" class="ad-btn" data-act="ask">' + t('ask') + '</button></p>' +
      '<section class="sec"><div class="sec-h"><h2>' + t('myReqs') + '</h2></div>' +
      (current.length ? '<div class="bd-reqs">' + current.map(card).join('') + '</div>' : '<p class="note">' + t('noReqs') + '</p>') +
      (older.length ? '<details class="ad-add"><summary>' + esc(t('older', { n: older.length })) + '</summary><div class="bd-reqs">' + older.map(card).join('') + '</div></details>' : '') + '</section>' +
      '<section class="sec cp-roster"><div class="sec-h"><h2>' + t('roster') + '</h2></div>' +
      (rows ? '<table class="tbl ad-roster"><tbody>' + rows + '</tbody></table>' : '<p class="note">' + t('emptyRoster') + '</p>') +
      '<p class="ad-payroll">' + esc(cap != null ? t('payrollCap', { v: money(total), c: money(cap) }) : t('payroll', { v: money(total) })) + '</p>' +
      (tm.rules && tm.rules.notes ? '<p class="note">' + esc(tm.rules.notes) + '</p>' : '') + '</section>';
  }
  /* The builder page (#demande): the team, then the guided steps. */
  function viewAsk() {
    return '<p class="ad-back"><a class="lnk" href="#equipe">' + t('back') + '</a></p><h1 class="ph">' + t('askTitle') + '</h1><div class="bd-page" id="cp-builder"></div>';
  }
  function render() {
    document.documentElement.lang = lang;
    $('#top').innerHTML = '<div class="wrap top-in sec-top"><a class="brand" href="/captain/"><span><b>LDHML <i>' + esc(t('title')) + '</i></b><small>' + esc(S.me ? S.me.name : '') + '</small></span></a>' +
      '<div class="ad-tools"><button type="button" class="lgbtn" data-act="lang">' + t('lang') + '</button>' + (S.me ? '<button type="button" class="lgbtn" data-act="logout">' + t('signOut') + '</button>' : '') + '</div></div>';
    var msg = S.msg ? '<p class="ad-msg ad-' + S.msg.kind + '" role="' + (S.msg.kind === 'err' ? 'alert' : 'status') + '">' + esc(S.msg.text) + '</p>' : '';
    var asking = S.me && S.sub && team();
    $('#main').innerHTML = msg + (!S.me ? viewLogin() : asking ? viewAsk() : viewTeam());
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
    });
  }
  /* #demande: the builder page for the current team; anything else: the team page. */
  function route() {
    if (location.hash === '#demande' && S.teamId) { if (!S.sub || S.sub.teamId !== S.teamId) S.sub = window.LDBuilder.state({ area: 'captain', teamId: S.teamId }); }
    else S.sub = null;
  }
  window.addEventListener('hashchange', function () {
    S.msg = S.flash; S.flash = null;
    if (!S.me) { render(); return; }
    if (location.hash === '#demande') { route(); render(); document.documentElement.scrollTop = 0; } else refresh();
  });
  var refresh = function () { return load().then(render); };
  var pickTeam = function (id) { S.teamId = id; try { localStorage.setItem('ldhml-captain-team', String(id)); } catch (e) { /* ignore */ } };

  /* ---------- events ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id !== 'f-email' && f.id !== 'f-code') return;   // the builder handles its own form
    e.preventDefault();
    var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ''; };
    S.msg = null;
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
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act],[data-team],[data-cancel]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'lang') { lang = lang === 'fr' ? 'en' : 'fr'; try { localStorage.setItem('ldhml-lang', lang); } catch (err) { /* ignore */ } render(); return; }
    if (act === 'other-email') { S.step = 'email'; S.devCode = ''; S.msg = null; render(); return; }
    if (act === 'logout') { api('/logout', 'POST', {}).then(function () { S.me = null; S.step = 'email'; S.msg = null; S.sub = null; render(); }); return; }
    if (act === 'ask') { S.msg = null; location.hash = '#demande'; return; }
    if (b.hasAttribute('data-team')) { pickTeam(Number(b.getAttribute('data-team'))); S.msg = null; render(); return; }
    if (b.hasAttribute('data-cancel')) {
      if (!window.confirm(t('confirmCancel'))) return;
      api('/replacements/' + b.getAttribute('data-cancel') + '/cancel', 'POST', {}).then(function (r) { if (r.ok) say('ok', t('cancelled')); else say('err', errMsg(r)); refresh(); });
    }
  });

  /* ---------- start ---------- */
  Promise.all([fetch('/data/season.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), api('/me')]).then(function (rs) {
    S.data = rs[0];
    if (rs[1].ok) { S.me = rs[1].data.captain; return refresh(); }
    render();
  });
})();
