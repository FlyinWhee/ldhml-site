/* The game-night lineup of one team for one game (owner, 2026-11-20; docs/tools.md "Game-night lineups"). Shared by the
 * captain area (and the admin area later). Plain JavaScript (ES5), fr/en, mobile first.
 *
 *   var st = LDLineup.state({ teamId, gameRef })
 *   LDLineup.mount(el, st, ctx)   renders into el and keeps its state in st (the page can re-render around it: mount again)
 *       ctx = the builder's ctx: { lang, data (season.json), api(path, method, body), ... }
 *
 * The roster, each player present or absent with their number; an absent player gets a replacement (the same judging as the
 * builder: eligible first, the reason for the others), or nobody (the team plays short). Every change is saved at once:
 * no deadline, no lock (owner: up to the last minute, never a chore). A lineup whose checks all pass is approved at once;
 * a problem waits for an admin (the strip on top says which). The server checks everything again (tools/src/replacements.js).
 */
(function () {
  'use strict';
  var B = function () { return window.LDBuilder; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var STR = {
    fr: {
      title: 'Alignement', present: 'Présent', absent: 'Absent', addSub: '+ Remplaçant', short: 'ou on joue à court', change: 'Changer', none: 'Personne',
      noTitle: 'Numéro de la saison', noHint: 'Le numéro habituel de {n} dans l’équipe (les matchs joués gardent l’ancien).', noSave: 'OK', noNb: 'numéro NBHPA',
      subNo: 'Numéro ce soir', subNoPh: '#', pickTitle: 'Remplaçant pour {n}', pos: 'Position', search: 'Chercher un joueur…', close: 'Fermer',
      eligible: 'Admissibles', toCheck: 'À vérifier ({n})', notOk: 'Non admissibles ({n})', noneOk: 'Aucun joueur admissible : cherchez par nom, ou voyez « À vérifier ».',
      fits: 'Admissible', noTeam: 'Sans équipe', guest: 'Joueur hors-ligue…', guestName: 'Nom', guestSex: 'Sexe', guestAge: 'Âge (optionnel)', guestNid: 'No NBHPA (optionnel)',
      guestUse: 'Utiliser ce joueur', guestErr: 'Le nom et le sexe sont requis.', sexM: 'Homme', sexF: 'Femme',
      stNone: 'Alignement régulier : aucun changement.', stOk: 'Alignement valide, confirmé automatiquement.', stAdmin: 'Alignement approuvé par un admin.',
      stPending: 'À valider par un admin', stSaving: 'Enregistrement…', stErr: 'Pas enregistré : {e}', changed: 'Modifié {d}{by}', byWho: ' par {n}',
      dupNo: 'Numéro {no} en double : {names}.', noNoYet: 'Sans numéro : {names}.', note: 'Note pour l’admin (optionnel)', notePh: 'Ex. : seul disponible ce soir',
      counts: '{s} joueurs · {g} gardien(s)', loading: 'Chargement…', rules: 'Règles', back: '← Mon équipe', played: 'Match joué', goalieTag: 'G'
    },
    en: {
      title: 'Lineup', present: 'In', absent: 'Out', addSub: '+ Replacement', short: 'or play short', change: 'Change', none: 'Nobody',
      noTitle: 'Season number', noHint: '{n}’s usual number on the team (games played keep the old one).', noSave: 'OK', noNb: 'NBHPA number',
      subNo: 'Number tonight', subNoPh: '#', pickTitle: 'Replacement for {n}', pos: 'Position', search: 'Find a player…', close: 'Close',
      eligible: 'Eligible', toCheck: 'To check ({n})', notOk: 'Not eligible ({n})', noneOk: 'No eligible player: search by name, or see “To check”.',
      fits: 'Eligible', noTeam: 'No team', guest: 'Player not on the list…', guestName: 'Name', guestSex: 'Sex', guestAge: 'Age (optional)', guestNid: 'NBHPA no. (optional)',
      guestUse: 'Use this player', guestErr: 'Name and sex are required.', sexM: 'Man', sexF: 'Woman',
      stNone: 'Regular lineup: no change.', stOk: 'Valid lineup, confirmed automatically.', stAdmin: 'Lineup approved by an admin.',
      stPending: 'To be validated by an admin', stSaving: 'Saving…', stErr: 'Not saved: {e}', changed: 'Changed {d}{by}', byWho: ' by {n}',
      dupNo: 'Number {no} twice: {names}.', noNoYet: 'No number: {names}.', note: 'Note for the admin (optional)', notePh: 'E.g.: the only one free tonight',
      counts: '{s} players · {g} goalie(s)', loading: 'Loading…', rules: 'Rules', back: '← My team', played: 'Game played', goalieTag: 'G'
    }
  };
  var t = function (ctx, k, v) { var s = (STR[ctx.lang] || STR.fr)[k]; if (s == null) s = k; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };

  function state(o) { return { teamId: o.teamId, gameRef: o.gameRef, d: null, lines: [], note: '', saved: null, saving: 0, err: '', pick: null, q: '', open: {}, edit: null, guest: null, el: null, ctx: null, seq: 0 }; }

  /* ---------- data ---------- */
  function load(st) {
    var seq = ++st.seq;
    st.ctx.api('/replacements/builder?team=' + st.teamId + '&game=' + encodeURIComponent(st.gameRef)).then(function (r) {
      if (seq !== st.seq) return;
      if (!r.ok) { st.err = B().t(st.ctx.lang, 'e_' + ((r.data && r.data.error) || 'server')); st.d = { failed: true }; draw(st); return; }
      st.d = r.data;
      var cur = r.data.current;
      st.saved = cur;
      st.note = cur && cur.note || '';
      st.lines = cur ? cur.lines.map(function (l) { return { absent_id: l.absent_id, sub_id: l.sub_id, sub_pos: l.sub_pos, sub_jersey: l.sub_jersey || '', guest: l.guest, name: l.sub_name, sex: l.sub_sex }; }) : [];
      draw(st);
    });
  }
  var body = function (st) {
    return { team_id: st.teamId, game_ref: Number(st.gameRef), note: st.note || null, lines: st.lines.map(function (l) {
      var o = { absent_id: l.absent_id, sub_pos: l.sub_pos, sub_jersey: l.sub_jersey || null };
      if (l.guest) o.guest = l.guest; else if (l.sub_id) o.sub_id = l.sub_id;
      return o;
    }) };
  };
  /* Every change is saved at once; the newest answer wins. */
  function save(st) {
    var seq = ++st.saving; st.err = ''; draw(st);
    st.ctx.api('/replacements/lineup', 'POST', body(st)).then(function (r) {
      if (seq !== st.saving) return;
      st.saving = 0;
      if (!r.ok) { st.err = B().t(st.ctx.lang, 'e_' + ((r.data && r.data.error) || 'server')); draw(st); return; }
      st.saved = r.data.id ? { id: r.data.id, status: r.data.status, auto: r.data.auto, result: r.data.result, checks: r.data.checks || [], payroll: r.data.payroll,
        updated_at: Math.floor(Date.now() / 1000), updated_name: null, note: st.note } : null;
      draw(st);
      if (st.ctx.onLineup) st.ctx.onLineup(r.data);
    });
  }

  /* ---------- helpers ---------- */
  var lineOf = function (st, pid) { return st.lines.filter(function (l) { return l.absent_id === pid; })[0]; };
  var rosterOf = function (st, pid) { return st.d.roster.filter(function (r) { return r.person_id === pid; })[0] || {}; };
  var candOf = function (st, id) { return (st.d.candidates || []).filter(function (c) { return c.id === id; })[0]; };
  var subName = function (st, l) { if (l.guest) return l.guest.name; var c = l.sub_id && candOf(st, l.sub_id); return c ? c.name : l.name || '?'; };
  var bview = function (st) { return { d: st.d, lines: st.lines, ctx: st.ctx }; };   // what LDBuilder.groups / judge read
  /* The numbers of the night: the present regulars (their season number) and the replacements (their number tonight). */
  function numberIssues(st) {
    var by = {}, missing = [];
    st.d.roster.forEach(function (r) { if (lineOf(st, r.person_id)) return; if (r.jersey) (by[r.jersey] = by[r.jersey] || []).push(r.name); else missing.push(r.name); });
    st.lines.forEach(function (l) { if (!l.sub_id && !l.guest) return; var n = subName(st, l); if (l.sub_jersey) (by[l.sub_jersey] = by[l.sub_jersey] || []).push(n); else missing.push(n); });
    var dups = Object.keys(by).filter(function (k) { return by[k].length > 1; }).map(function (k) { return { no: k, names: by[k] }; });
    return { dups: dups, missing: missing };
  }

  /* ---------- the page ---------- */
  function stateStrip(st) {
    var ctx = st.ctx, s = st.saved, cls, text, extra = '';
    if (st.saving) { cls = 'lu-busy'; text = t(ctx, 'stSaving'); }
    else if (st.err) { cls = 'bd-fail'; text = t(ctx, 'stErr', { e: st.err }); }
    else if (!s) { cls = 'lu-none'; text = t(ctx, 'stNone'); }
    else if (s.status === 'approved') { cls = 'bd-ok'; text = '✓ ' + t(ctx, s.auto ? 'stOk' : 'stAdmin'); }
    else {
      cls = 'bd-' + (s.result === 'fail' ? 'fail' : 'warn'); text = '! ' + t(ctx, 'stPending');
      var sums = { out: 0, in: 0 };
      st.lines.forEach(function (l) { sums.out += rosterOf(st, l.absent_id).salary || 0; var c = l.sub_id && candOf(st, l.sub_id); if (c) sums.in += (l.sub_pos === 'g' ? c.salary_g : c.salary_s) || 0; });
      var names = st.lines.map(function (l) { return { a: rosterOf(st, l.absent_id).name, s: l.sub_id || l.guest ? subName(st, l) : B().t(ctx.lang, 'nobody') }; });
      var bad = (s.checks || []).filter(function (c) { return c.s !== 'ok'; }).map(function (c) {
        return '<li class="bd-' + c.s + '">' + esc(c.k === 'cap' && s.payroll ? B().capText(ctx, s.payroll, sums.out, sums.in) : B().explain(ctx, c, names)) + '</li>'; });
      if (bad.length) extra = '<ul class="lu-why">' + bad.join('') + '</ul>';
    }
    var when = s && s.updated_at && !st.saving ? '<span class="lu-when">' + esc(t(ctx, 'changed', { d: B().stamp(ctx, s.updated_at), by: s.updated_name ? t(ctx, 'byWho', { n: s.updated_name }) : '' })) + '</span>' : '';
    var nb = numberIssues(st), warn = nb.dups.map(function (x) { return '<li class="bd-warn">' + esc(t(ctx, 'dupNo', { no: x.no, names: x.names.join(', ') })) + '</li>'; }).join('') +
      (nb.missing.length ? '<li class="lu-soft">' + esc(t(ctx, 'noNoYet', { names: nb.missing.join(', ') })) + '</li>' : '');
    return '<div class="lu-state ' + cls + '" role="status" aria-live="polite"><p><b>' + esc(text) + '</b>' + when + '</p>' + extra + (warn ? '<ul class="lu-why">' + warn + '</ul>' : '') + '</div>';
  }
  function numberBtn(st, r) {
    var ctx = st.ctx;
    if (st.edit === r.person_id) {
      return '<span class="lu-noedit"><input class="ctl lu-noin" data-lu-noin="' + r.person_id + '" inputmode="numeric" maxlength="3" value="' + esc(r.jersey || '') + '" aria-label="' + esc(t(ctx, 'noTitle')) + '">' +
        '<button type="button" class="ta-btn ta-btn-sm" data-lu-nosave="' + r.person_id + '">' + esc(t(ctx, 'noSave')) + '</button></span>';
    }
    return '<button type="button" class="lu-no' + (r.jersey_nbhpa ? ' lu-nb' : '') + '" data-lu-noedit="' + r.person_id + '" title="' + esc(t(ctx, 'noTitle') + (r.jersey_nbhpa ? ' (' + t(ctx, 'noNb') + ')' : '')) + '">' + esc(r.jersey || '#') + '</button>';
  }
  function playerRow(st, r) {
    var ctx = st.ctx, l = lineOf(st, r.person_id), out = !!l, lg = st.d.team.league;
    var pos = B().posName(ctx, r.pos) + (r.sex ? ' · ' + B().t(ctx.lang, r.sex === 'f' ? 'sxF' : 'sxM') : '');
    var head = '<div class="lu-row">' + numberBtn(st, r) + '<span class="lu-nm"><b>' + B().person(ctx, lg, r.name, r.site_id, r.person_id) + '</b><small>' + esc(pos) + '</small></span>' +
      '<button type="button" class="lu-tg' + (out ? ' lu-off' : '') + '" data-lu-out="' + r.person_id + '" aria-pressed="' + out + '">' + esc(t(ctx, out ? 'absent' : 'present')) + '</button></div>';
    if (!out) return '<li class="lu-p">' + head + '</li>';
    var sub;
    if (l.sub_id || l.guest) {
      var c = l.sub_id && candOf(st, l.sub_id), j = c ? B().judge(bview(st), c, l) : { s: l.guest ? 'fail' : 'ok', why: [] };
      sub = '<div class="lu-sub lu-has bd-' + j.s + '"><input class="ctl lu-noin lu-subno" data-lu-subno="' + r.person_id + '" inputmode="numeric" maxlength="3" value="' + esc(l.sub_jersey || '') + '" placeholder="' + esc(t(ctx, 'subNoPh')) + '" aria-label="' + esc(t(ctx, 'subNo')) + '">' +
        '<span class="lu-nm"><b>' + (l.guest ? esc(l.guest.name) + ' ' + B().guestTag(ctx, l.guest) : B().person(ctx, lg, subName(st, l), c && c.site_id, l.sub_id)) + '</b><small>' + esc(B().posName(ctx, l.sub_pos)) +
        (j.why.length ? ' · ' + B().ICON[j.s] + ' ' + esc(j.why.join(', ')) : '') + '</small></span>' +
        '<button type="button" class="lnk ta-linkbtn" data-lu-pick="' + r.person_id + '">' + esc(t(ctx, 'change')) + '</button></div>';
    } else {
      sub = '<div class="lu-sub"><button type="button" class="ta-btn ta-btn-sm" data-lu-pick="' + r.person_id + '">' + esc(t(ctx, 'addSub')) + '</button><span class="note">' + esc(t(ctx, 'short')) + '</span></div>';
    }
    return '<li class="lu-p lu-out">' + head + sub + '</li>';
  }
  /* The replacement picker: a sheet over the page (full screen on a phone). Same sex only; eligible first. */
  function picker(st) {
    var ctx = st.ctx, l = lineOf(st, st.pick), r = rosterOf(st, st.pick);
    if (!l) return '';
    var g = B().groups(bview(st), l), q = st.q, card = function (x) {
      var c = x.c, j = x.j, tm = c.team ? '<span class="lu-ctm">' + window.LDLook.crest({ abb: c.team.abb }, st.d.team.league, 'sm') + esc(c.team.abb) + '</span>' : '<span class="lu-ctm note">' + esc(t(ctx, 'noTeam')) + '</span>';
      return '<button type="button" class="bd-cand bd-' + j.s + (l.sub_id === c.id ? ' bd-on' : '') + '" data-lu-sub="' + c.id + '"><span class="bd-cn"><b>' + esc(c.name) + '</b>' + tm + '</span>' +
        '<span class="bd-cs">' + esc(j.sal == null ? '—' : B().money(j.sal)) + '</span>' + (j.why.length ? '<span class="bd-cw">' + B().ICON[j.s] + ' ' + esc(j.why.join(', ')) + '</span>' : '<span class="bd-cw bd-ok">✓ ' + esc(t(ctx, 'fits')) + '</span>') + '</button>';
    };
    var list;
    if (q) {
      var all = g.ok.concat(g.warn, g.fail).filter(function (x) { return fold(x.c.name).indexOf(fold(q)) >= 0; }).slice(0, 20);
      list = all.length ? '<div class="bd-cands">' + all.map(card).join('') + '</div>' : '<p class="note">' + esc(B().t(ctx.lang, 'noMatchGuest')) + '</p>';
    } else {
      list = '<p class="bd-sub-h">' + esc(t(ctx, 'eligible')) + '</p>' + (g.ok.length ? '<div class="bd-cands">' + g.ok.map(card).join('') + '</div>' : '<p class="note">' + esc(t(ctx, 'noneOk')) + '</p>') +
        (g.warn.length ? '<details class="bd-other"><summary>' + esc(t(ctx, 'toCheck', { n: g.warn.length })) + '</summary><div class="bd-cands">' + g.warn.map(card).join('') + '</div></details>' : '') +
        (g.fail.length ? '<details class="bd-other"><summary>' + esc(t(ctx, 'notOk', { n: g.fail.length })) + '</summary><div class="bd-cands">' + g.fail.map(card).join('') + '</div></details>' : '');
    }
    var gs = st.guest;
    var guest = gs ? '<fieldset class="bd-guest"><legend>' + esc(t(ctx, 'guest')) + '</legend>' + (gs.err ? '<p class="ta-msg ta-err" role="alert">' + esc(t(ctx, 'guestErr')) + '</p>' : '') +
      '<label>' + esc(t(ctx, 'guestName')) + '<input class="ctl" data-lu-gf="name" maxlength="80" autocomplete="off" value="' + esc(gs.name) + '"></label>' +
      '<div class="seg" role="group" aria-label="' + esc(t(ctx, 'guestSex')) + '">' + ['m', 'f'].map(function (k) { return '<button type="button" data-lu-gsex="' + k + '" aria-pressed="' + (gs.sex === k) + '">' + esc(t(ctx, k === 'f' ? 'sexF' : 'sexM')) + '</button>'; }).join('') + '</div>' +
      '<div class="ta-pair"><label>' + esc(t(ctx, 'guestAge')) + '<input class="ctl" data-lu-gf="age" inputmode="numeric" maxlength="3" value="' + esc(gs.age) + '"></label><label>' + esc(t(ctx, 'guestNid')) + '<input class="ctl" data-lu-gf="nid" inputmode="numeric" maxlength="12" value="' + esc(gs.nid) + '"></label></div>' +
      '<p><button type="button" class="ta-btn ta-btn-sm" data-lu-guse>' + esc(t(ctx, 'guestUse')) + '</button></p></fieldset>' : '<p><button type="button" class="lnk ta-linkbtn" data-lu-gopen>' + esc(t(ctx, 'guest')) + '</button></p>';
    return '<div class="lu-back" data-lu-close></div><div class="lu-sheet" role="dialog" aria-modal="true" aria-label="' + esc(t(ctx, 'pickTitle', { n: r.name })) + '">' +
      '<div class="lu-sh"><b>' + esc(t(ctx, 'pickTitle', { n: r.name })) + '</b><button type="button" class="fp-x" data-lu-close aria-label="' + esc(t(ctx, 'close')) + '">×</button></div>' +
      '<div class="lu-sb"><div class="seg" role="group" aria-label="' + esc(t(ctx, 'pos')) + '">' + ['s', 'g'].map(function (k) { return '<button type="button" data-lu-pos="' + k + '" aria-pressed="' + (l.sub_pos === k) + '">' + esc(B().posName(ctx, k)) + '</button>'; }).join('') + '</div>' +
      '<input class="ctl bd-search" type="search" data-lu-q value="' + esc(q) + '" placeholder="' + esc(t(ctx, 'search')) + '" aria-label="' + esc(t(ctx, 'search')) + '">' +
      ((l.sub_id || l.guest) ? '<p><button type="button" class="lnk ta-linkbtn" data-lu-nobody>' + esc(t(ctx, 'none')) + ' (' + esc(t(ctx, 'short')) + ')</button></p>' : '') +
      list + guest + '</div></div>';
  }
  function html(st) {
    var ctx = st.ctx, d = st.d;
    if (!d) return '<p class="note">' + esc(t(ctx, 'loading')) + '</p>';
    if (d.failed) return '<p class="ta-msg ta-err">' + esc(st.err) + '</p>';
    var g = (d.games || []).filter(function (x) { return String(x.id) === String(st.gameRef); })[0];
    var head = '<div class="lu-head">' + B().teamHead(ctx, d.team, d.team.league) + (g ? '<p class="lu-game"><b>' + esc(B().gameText(ctx, g)) + '</b>' + (g.venue ? ' <span class="note">' + esc(g.venue + (g.court ? ' ' + g.court : '')) + '</span>' : '') +
      (g.date < d.today ? ' <span class="cp-tag">' + esc(t(ctx, 'played')) + '</span>' : '') + '</p>' : '') + '</div>';
    var list = B().rosterOrder(d.roster, function (r) { return r.salary; }).map(function (r) { return playerRow(st, r); }).join('');
    var nS = 0, nG = 0;
    d.roster.forEach(function (r) { var l = lineOf(st, r.person_id); if (!l) { if (r.pos === 'g') nG++; else nS++; } else if (l.sub_id || l.guest) { if (l.sub_pos === 'g') nG++; else nS++; } });
    var note = st.saved && st.saved.status === 'pending' || st.note ? '<label class="lu-note">' + esc(t(ctx, 'note')) + '<textarea class="ctl" data-lu-note rows="2" maxlength="1000" placeholder="' + esc(t(ctx, 'notePh')) + '">' + esc(st.note) + '</textarea></label>' : '';
    return head + stateStrip(st) + '<p class="note lu-counts">' + esc(t(ctx, 'counts', { s: nS, g: nG })) + '</p><ol class="lu-list">' + list + '</ol>' + note + (st.pick ? picker(st) : '');
  }
  function draw(st) {
    if (!st.el) return;
    var keep = document.activeElement && st.el.contains(document.activeElement) ? document.activeElement.getAttribute('data-lu-q') !== null ? 'q' : null : null;
    st.el.innerHTML = html(st);
    document.documentElement.classList.toggle('lu-sheet-open', !!st.pick);
    if (keep === 'q') { var qi = st.el.querySelector('[data-lu-q]'); if (qi) { qi.focus(); var n = qi.value.length; try { qi.setSelectionRange(n, n); } catch (e) { /* ignore */ } } }
  }

  /* ---------- events ---------- */
  function bind(el) {
    if (el.__lu) return;
    el.__lu = true;
    el.addEventListener('click', function (e) {
      var st = el.__st, x = e.target.closest && e.target.closest('[data-lu-out],[data-lu-pick],[data-lu-sub],[data-lu-pos],[data-lu-close],[data-lu-nobody],[data-lu-noedit],[data-lu-nosave],[data-lu-gopen],[data-lu-gsex],[data-lu-guse]');
      if (!st || !x) return;
      var num = function (a) { return Number(x.getAttribute(a)); };
      if (x.hasAttribute('data-lu-out')) {   // present <-> absent (an absent player starts with nobody, at their position)
        var pid = num('data-lu-out'), l = lineOf(st, pid);
        if (l) st.lines = st.lines.filter(function (y) { return y !== l; });
        else st.lines.push({ absent_id: pid, sub_id: null, guest: null, sub_pos: rosterOf(st, pid).pos || 's', sub_jersey: '' });
        save(st); return;
      }
      if (x.hasAttribute('data-lu-pick')) { st.pick = num('data-lu-pick'); st.q = ''; st.guest = null; draw(st); var qi = el.querySelector('[data-lu-q]'); if (qi && window.matchMedia && window.matchMedia('(min-width: 700px)').matches) qi.focus(); return; }
      if (x.hasAttribute('data-lu-close')) { st.pick = null; draw(st); return; }
      var cur = st.pick != null && lineOf(st, st.pick);
      if (x.hasAttribute('data-lu-pos') && cur) { cur.sub_pos = x.getAttribute('data-lu-pos'); if (cur.sub_id || cur.guest) save(st); else draw(st); return; }
      if (x.hasAttribute('data-lu-sub') && cur) {
        var c = candOf(st, num('data-lu-sub'));
        cur.sub_id = c.id; cur.guest = null; cur.name = c.name; cur.sex = c.sex; cur.sub_jersey = cur.sub_jersey || '';
        st.pick = null; save(st); return;
      }
      if (x.hasAttribute('data-lu-nobody') && cur) { cur.sub_id = null; cur.guest = null; cur.sub_jersey = ''; st.pick = null; save(st); return; }
      if (x.hasAttribute('data-lu-gopen')) { st.guest = { name: '', sex: rosterOf(st, st.pick).sex || '', age: '', nid: '' }; draw(st); return; }
      if (x.hasAttribute('data-lu-gsex') && st.guest) { st.guest.sex = x.getAttribute('data-lu-gsex'); draw(st); return; }
      if (x.hasAttribute('data-lu-guse') && st.guest && cur) {
        var gs = st.guest;
        if (!gs.name.trim() || !gs.sex) { gs.err = true; draw(st); return; }
        cur.guest = { name: gs.name.trim(), sex: gs.sex, age: gs.age ? Number(gs.age) : null, nid: gs.nid || null }; cur.sub_id = null;
        st.guest = null; st.pick = null; save(st); return;
      }
      if (x.hasAttribute('data-lu-noedit')) { st.edit = num('data-lu-noedit'); draw(st); var ni = el.querySelector('[data-lu-noin="' + st.edit + '"]'); if (ni) { ni.focus(); ni.select(); } return; }
      if (x.hasAttribute('data-lu-nosave')) { saveNumber(st, num('data-lu-nosave')); return; }
    });
    el.addEventListener('input', function (e) {
      var st = el.__st, x = e.target;
      if (!st || !x.hasAttribute) return;
      if (x.hasAttribute('data-lu-q')) { st.q = x.value; draw(st); return; }
      if (x.hasAttribute('data-lu-gf') && st.guest) { st.guest[x.getAttribute('data-lu-gf')] = x.value; return; }
    });
    el.addEventListener('change', function (e) {
      var st = el.__st, x = e.target;
      if (!st || !x.hasAttribute) return;
      if (x.hasAttribute('data-lu-subno')) { var l = lineOf(st, Number(x.getAttribute('data-lu-subno'))); if (l) { l.sub_jersey = x.value.replace(/\D/g, '').slice(0, 3); save(st); } return; }
      if (x.hasAttribute('data-lu-note')) { st.note = x.value; if (st.saved) save(st); return; }
    });
    el.addEventListener('keydown', function (e) {
      var st = el.__st; if (!st) return;
      if (e.key === 'Escape' && st.pick != null) { st.pick = null; draw(st); }
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-lu-noin') && !e.target.hasAttribute('data-lu-subno')) { e.preventDefault(); saveNumber(st, Number(e.target.getAttribute('data-lu-noin'))); }
    });
  }
  /* A regular's season number (the team's roster): saved for the season; the games already played keep their own copy. */
  function saveNumber(st, pid) {
    var inp = st.el.querySelector('[data-lu-noin="' + pid + '"]'), v = inp ? inp.value.replace(/\D/g, '').slice(0, 3) : '';
    st.ctx.api('/replacements/jersey', 'POST', { team_id: st.teamId, person_id: pid, jersey: v || null }).then(function (r) {
      if (!r.ok) { st.err = B().t(st.ctx.lang, 'e_' + ((r.data && r.data.error) || 'server')); draw(st); return; }
      var row = rosterOf(st, pid); row.jersey = v || null; row.jersey_nbhpa = false; st.edit = null; draw(st);
    });
  }
  function mount(el, st, ctx) {
    st.el = el; st.ctx = ctx; el.__st = st; bind(el);
    if (!st.d) { draw(st); load(st); } else draw(st);
  }
  window.LDLineup = { state: state, mount: mount, STR: STR };
})();
