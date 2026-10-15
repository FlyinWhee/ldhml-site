/* How teams look, on every page (league pages, section pages, entry page). Read docs/presentation.md first.
 *
 * One file, so a team has the same colour, the same badge and the same name everywhere.
 * It runs in the browser (inlined by build.mjs into every page). ES5, no DOM access, returns HTML strings.
 *   LDLook.teamColor(slug, abb)    [colour, ink]: the ink is the text colour on top of the team colour
 *   LDLook.colorVar(slug, abb)     value for style="--tc:..." (sets --tc and --tx together)
 *   LDLook.crest(team, slug, size) team badge: the team colour with the code, and the team logo on top when it loads
 *   LDLook.abbLink(team, slug, href)  team code chip in the team colour, a link (title = full name)
 * team = { abb, name?, logo? }. size = '' | 'sm' | 'lg'.
 * A page that shows crests needs the two image handlers that the league pages and hub.js have: a logo gets class "ok"
 * when it loads (CSS shows it), and is removed when it fails (the colour and the code stay).
 */
(function (root) {
  var LOGO_BASE = 'https://admin.nbhpa.com/';
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /* Team colours taken from a league's own team artwork, by league slug. [colour, ink]. */
  var COLORS = {
    retro: {     // season 5, fall 2026
      FLI: ['#F29B0F', '#1A1204'],  // Flintstones: amber
      CAL: ['#8E44C9', '#FFFFFF'],  // Câlinours: purple
      GIJ: ['#1D9A7C', '#FFFFFF'],  // GI Joe: teal green
      GOO: ['#D9B51E', '#1A1604'],  // Goonies: gold
      GHO: ['#C8202F', '#FFFFFF'],  // Ghostbusters: red
      JAW: ['#2A9FCF', '#FFFFFF'],  // Jaws: ocean blue
      MAS: ['#3162E0', '#FFFFFF'],  // Masters of the Universe: royal blue
      TMN: ['#2FA84F', '#FFFFFF'],  // TMNT: green
      TRA: ['#EA4A2B', '#FFFFFF'],  // Transformers: Autobot red-orange
      TOP: ['#66748A', '#FFFFFF']   // Top Gun: steel silver
    }
  };
  /* Leagues without artwork colours: a stable colour made from the team code. */
  var hashColor = function (abb) {
    var h = 0, i;
    for (i = 0; i < abb.length; i++) h = (h * 31 + abb.charCodeAt(i)) % 360;
    return ['hsl(' + h + ', 52%, 38%)', '#FFFFFF'];
  };
  var teamColor = function (slug, abb) { return (COLORS[slug] && COLORS[slug][abb]) || hashColor(String(abb || '')); };
  var colorVar = function (slug, abb) { var x = teamColor(slug, abb); return x[0] + ';--tx:' + x[1]; };
  function crest(team, slug, size) {
    var abb = team ? team.abb : '?';
    var logo = team && team.logo ? '<img src="' + LOGO_BASE + esc(team.logo) + '" alt="" loading="lazy" decoding="async">' : '';
    return '<span class="crest' + (size ? ' crest-' + size : '') + '" style="--tc:' + colorVar(slug, abb) + '"><span aria-hidden="true">' + esc(abb) + '</span>' + logo + '</span>';
  }
  function abbLink(team, slug, href) {
    return href ? '<a href="' + esc(href) + '" style="--tc:' + colorVar(slug, team.abb) + '" title="' + esc(team.name || team.abb) + '">' + esc(team.abb) + '</a>' : '<span>' + esc(team.abb) + '</span>';
  }
  root.LDLook = { LOGO_BASE: LOGO_BASE, teamColor: teamColor, colorVar: colorVar, crest: crest, abbLink: abbLink };
})(typeof window !== 'undefined' ? window : globalThis);
