/* The scroll position of the tool pages (admin and captain). Their pages are hash routes, so the browser alone keeps the
 * old page's scroll on a new page (owner, 2026-10-21: "not intuitive"). A new page opens at the top; Back and Forward
 * return to the place the person left. The tools have no in-page anchors: every hash is a page.
 * Use: in the hashchange handler, `var y = LDScroll.route();` first, then render, then `LDScroll.to(y)`. */
(function () {
  'use strict';
  try { history.scrollRestoration = 'manual'; } catch (e) { /* old browser: the default */ }
  var ys = {}, n = 0;
  try { ys = JSON.parse(sessionStorage.getItem('ldhml-scroll') || '{}') || {}; } catch (e) { ys = {}; }
  var key = function () { return history.state && history.state.ldk; };
  var mark = function () { history.replaceState({ ldk: 'k' + Date.now().toString(36) + '-' + (n++) }, ''); };
  if (!key()) mark();
  var cur = key();
  var save = function () { try { sessionStorage.setItem('ldhml-scroll', JSON.stringify(ys)); } catch (e) { /* ignore */ } };
  window.addEventListener('scroll', function () { ys[cur] = window.scrollY; }, { passive: true });
  window.addEventListener('pagehide', save);
  window.LDScroll = {
    // a page we know (Back, Forward): where the person was; a new page: the top (it is shown at once, before the data loads)
    route: function () {
      var k = key();
      if (k && k !== cur) { cur = k; return ys[k] || 0; }
      mark(); cur = key(); ys[cur] = 0; window.scrollTo(0, 0); return 0;
    },
    to: function (y) { window.scrollTo(0, y || 0); }
  };
})();
