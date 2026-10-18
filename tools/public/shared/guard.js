// Loaded first on the tool pages. When the page script cannot start (blocked by an extension, failed to load, a script
// error, no answer), it says so in the page instead of leaving it blank. A file of its own: the pages allow no inline
// script (Content-Security-Policy in _headers). Bilingual on purpose: it runs before the page knows the language.
(function () {
  var shown = false;
  function say(why) {
    var m = document.getElementById('main');
    if (shown || !m || m.getAttribute('data-ready')) return;
    shown = true;
    var p = document.createElement('p');
    p.className = 'ad-msg ad-err';
    p.setAttribute('role', 'alert');
    p.textContent = 'La page n’a pas pu démarrer (' + why + '). Rechargez-la. Si le problème reste, essayez une fenêtre privée ou un autre navigateur : une extension peut la bloquer. · ' +
      'The page could not start (' + why + '). Reload it. If it persists, try a private window or another browser: an extension may block it.';
    m.innerHTML = '';
    m.appendChild(p);
  }
  // a page script that fails to load (capture: load errors do not bubble), or a script error before the page is ready
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT') say('script ' + (t.getAttribute('src') || '?'));
    else if (e.message) say(e.message);
  }, true);
  window.addEventListener('unhandledrejection', function (e) { say(String((e.reason && e.reason.message) || e.reason || '?')); });
  setTimeout(function () { say('timeout'); }, 15000);
})();
