/* The stats site data refresh, run in the admin's browser (Configuration > Données du site public; owner, 2026-10-30).
 * The steps of "npm run fetch:force" (shared/refresh.js), then one commit on GitHub through the Worker (src/publish.js),
 * then the Pages build of that commit. The browser reads NBHPA; the Worker never does (rule 1).
 * Polite (rule 3): one request at a time, a pause between requests (1.5 s, like the script), nothing while the tab is
 * hidden, a 429 stops the run. A league that fails its checks keeps its old data (rule 4).
 * LDRefreshRun(o): o = { api(path, method, body) -> Promise<{ ok, status, data }>, leagues: [slug] | null (all),
 *   log(key, params, kind 'info'|'ok'|'warn'|'err'), ctl: { stop: false } }. Resolves { state: 'done'|'error'|'stopped', commit }. */
(function () {
  'use strict';
  var R = function () { return window.LDRefresh; };
  var sleep = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
  var delay = function () { return window.LDHML_REFRESH_DELAY != null ? window.LDHML_REFRESH_DELAY : 1500; };
  var stopErr = function (code) { var e = new Error(code); e.code = code; return e; };

  window.LDRefreshRun = async function (o) {
    var log = o.log, ctl = o.ctl || {};
    var b = await o.api('/refresh/base');
    if (!b.ok) { log('baseErr', { error: (b.data && b.data.error) || b.status }, 'err'); return { state: 'error' }; }
    if (!b.data.configured) { log('notConfigured', {}, 'err'); return { state: 'error' }; }
    var base = b.data;
    log('base', { sha: base.sha.slice(0, 7), branch: base.branch, repo: base.repo });
    var raw = function (p, text) { return fetch(base.raw + p, { cache: 'no-store' }).then(function (r) { return r.ok ? (text ? r.text() : r.json()) : null; }, function () { return null; }); };
    var cfg = await raw('leagues.json');
    if (!cfg || !cfg.leagues) { log('baseErr', { error: 'leagues.json' }, 'err'); return { state: 'error' }; }

    var hiddenSaid = false;
    var waitVisible = async function () {
      while (document.hidden) { if (!hiddenSaid) { hiddenSaid = true; log('paused', {}, 'warn'); } if (ctl.stop) throw stopErr('stopped'); await sleep(500); }
      if (hiddenSaid) { hiddenSaid = false; log('resumed', {}); }
    };
    // the Node script's http(): 3 tries with a growing pause; a 429 stops everything (NBHPA asks us to slow down)
    var get = async function (url, init, kind) {
      for (var i = 1; i <= 3; i++) {
        if (ctl.stop) throw stopErr('stopped');
        await waitVisible();
        var res = null, err = null;
        try { res = await fetch(url, init); } catch (e) { err = e; }
        if (res && res.ok) return kind === 'json' ? res.json() : res.text();
        if (res && res.status === 429) throw stopErr('rate');
        if (res && res.status < 500) throw new Error('HTTP ' + res.status);
        if (i === 3) throw err || new Error('HTTP ' + (res ? res.status : '?'));
        await sleep(delay() * i * 2);
      }
    };

    var want = function (lg) { return !o.leagues || o.leagues.indexOf(lg.slug) >= 0; };
    var files = {}, lists = {}, done = [];
    for (var k = 0; k < cfg.leagues.length; k++) {
      var lg = cfg.leagues[k];
      if (!want(lg)) continue;
      log('league', { lg: lg.short });
      var oldBox = await raw('data/' + lg.slug + '/box.json');
      try {
        var io = { get: get, sleep: sleep, delay: delay(), warn: function (m) { log('warn', { msg: m.trim() }, 'warn'); },
          step: function (key, p) { log('step_' + key, p || {}); } };
        var rawLg = await R().fetchLeague(lg, cfg, oldBox, io);
        var res = R().assemble(rawLg, lg, cfg, oldBox, io.warn);
        if (res.problems.length) log('refused', { lg: lg.short, problems: res.problems.join('; ') }, 'err');
        else {
          Object.assign(files, R().leagueFiles(lg.slug, res.out));
          lists[lg.slug] = { players: res.out.players, goalies: res.out.goalies };
          done.push(lg.slug);
          log('leagueOk', { lg: lg.short, teams: res.out.teams.length, games: res.out.games.length, players: res.out.players.length, goalies: res.out.goalies.length, box: res.boxSaved }, 'ok');
        }
      } catch (e) {
        if (e.code === 'stopped') { log('stopped', {}, 'warn'); return { state: 'stopped' }; }
        if (e.code === 'rate') { log('rate', {}, 'err'); return { state: 'error' }; }
        log('leagueErr', { lg: lg.short, msg: e.message }, 'err');
      }
      await sleep(delay());
    }
    if (!done.length) { log('nothing', {}, 'err'); return { state: 'error' }; }

    // our person ids, from the lists of every league (like syncFromData: the leagues not read keep their saved lists)
    for (var j = 0; j < cfg.leagues.length; j++) {
      var s = cfg.leagues[j].slug;
      if (!lists[s]) lists[s] = { players: (await raw('data/' + s + '/players.json')) || [], goalies: (await raw('data/' + s + '/goalies.json')) || [] };
    }
    var reg0 = await raw('registry/people.json');
    if (!reg0) { log('regErr', {}, 'err'); return { state: 'error' }; }
    var r = R().syncRegistry(reg0, R().registryRows(lists), { since: cfg.seasonName });
    if (r.problems.length) log('regRefused', { problems: r.problems.join('; ') }, 'err');   // the script saves the leagues anyway
    else if (r.added || r.changed) { files['registry/people.json'] = R().serializeRegistry(r.reg); log('registry', { total: r.reg.people.length, added: r.added, changed: r.changed }, 'ok'); }
    else log('regSame', { total: r.reg.people.length });

    if (ctl.stop) { log('stopped', {}, 'warn'); return { state: 'stopped' }; }
    log('publishing', { n: Object.keys(files).length });
    var p = await o.api('/refresh/publish', 'POST', { base: base.sha, files: files });
    if (!p.ok) { log('pubErr', { error: (p.data && p.data.error) || p.status, detail: p.data && (p.data.problem || p.data.path || p.data.step || p.data.wait) || '' }, 'err'); return { state: 'error' }; }
    log('published', { sha: p.data.commit.slice(0, 7), url: p.data.url }, 'ok');

    // the Pages build of that commit (GitHub Actions), about a minute
    var last = '';
    for (var n = 0; n < 40; n++) {
      await sleep(window.LDHML_REFRESH_POLL != null ? window.LDHML_REFRESH_POLL : n ? 10000 : 4000);
      var st = await o.api('/refresh/status?sha=' + p.data.commit);
      var d = st.ok ? st.data : { status: 'unknown' };
      if (d.status === 'completed') {
        if (d.conclusion === 'success') log('live', { url: cfg.siteUrl || '' }, 'ok');
        else log('buildFail', { url: d.url || '' }, 'err');
        return { state: d.conclusion === 'success' ? 'done' : 'error', commit: p.data.commit };
      }
      if (d.status !== last) { last = d.status; log('build', { status: d.status, url: d.url || '' }); }
      if (d.status === 'unknown') break;
    }
    log('buildLong', {}, 'warn');
    return { state: 'done', commit: p.data.commit };
  };
})();
