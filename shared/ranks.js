/* Rank scales: which rank is stronger. Used by range filters now, and by sub validation later.
 *
 * Runs in the browser (inlined by build.mjs into every page) and in Node (tests). ES5, no DOM.
 *   LDRanks.nbhpa                the NBHPA scale: a letter (category) + a level, lower level = stronger (H8 > H12).
 *                                A "+" is half a level stronger (W7+ is between W6 and W7). Each letter is its own scale.
 *   LDRanks.scale(values)        a scale from a list, strongest first (for our own rank systems, see rankSystems in leagues.json).
 * A scale has:
 *   key(r)         { cat, s } (cat = scale group, s = strength, LOWER = STRONGER), or null for a value that is not on the scale ("N/C", "")
 *   sort(list)     values in order: by group, strongest first; values not on the scale last
 *   inRange(r, from, to)   is r between from and to (inclusive, same group, either bound can be empty)
 */
(function (root) {
  var GROUPS = ['H', 'W', 'J'];
  function make(key) {
    var cmp = function (a, b) {
      var x = key(a), y = key(b);
      if (!x || !y) return x ? -1 : y ? 1 : String(a).localeCompare(String(b));
      return x.g - y.g || x.s - y.s;
    };
    return {
      key: key,
      sort: function (list) { return list.slice().sort(cmp); },
      inRange: function (r, from, to) {
        var k = key(r), f = from ? key(from) : null, t = to ? key(to) : null;
        if (!k || (from && !f) || (to && !t)) return false;
        if (f && t && f.cat === t.cat && f.s > t.s) { var z = f; f = t; t = z; } // "from" is the stronger bound
        if (f && (k.cat !== f.cat || k.s < f.s)) return false;
        if (t && (k.cat !== t.cat || k.s > t.s)) return false;
        return true;
      }
    };
  }
  var nbhpa = make(function (r) {
    var m = /^([A-Z]+)(\d+)(\+?)$/.exec(String(r || ''));
    if (!m) return null;
    var g = GROUPS.indexOf(m[1]);
    return { cat: m[1], g: g < 0 ? GROUPS.length : g, s: Number(m[2]) * 2 - (m[3] ? 1 : 0) };
  });
  function scale(values) {
    var pos = {};
    values.forEach(function (v, i) { pos[v] = i; });
    return make(function (r) { return Object.prototype.hasOwnProperty.call(pos, r) ? { cat: '', g: 0, s: pos[r] } : null; });
  }
  root.LDRanks = { nbhpa: nbhpa, scale: scale };
})(typeof window !== 'undefined' ? window : globalThis);
