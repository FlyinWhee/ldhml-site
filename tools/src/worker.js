// LDHML tools: one Cloudflare Worker. It serves the tool pages (static assets, built into dist-tools/ by build.mjs)
// and the API (/api/...). Read tools/CLAUDE.md first.
//   /admin/     admin area (sign-in, captains, seasons)        API: /api/admin/...
//   /captain/   captain area (my team, replacement requests)   API: /api/captain/...
// This Worker never fetches NBHPA (Cloudflare servers are blocked there). It reads our own snapshot: /data/season.json.
import { fail, sameOrigin } from './http.js';
import { adminApi } from './admin-api.js';
import { captainApi } from './captain-api.js';
import { json } from './http.js';
import { liveSeason } from './seasons.js';
import { isDemo, demoRefuses } from './demo.js';

/* One area per address (owner, 2026-11-20): ADMIN_URL (https://admin.ldhml.com/) serves the admin at its root, CAPTAIN_URL
 * (https://capitaine.ldhml.com/) the captain area. "/" shows the area's page (same files: /admin/..., /captain/...); the
 * other area's pages redirect to their own address. Without these vars (the demo, local) both areas stay at /admin/ and
 * /captain/ on one address. Each address keeps its own cookies (__Host-), so the two sessions never mix. */
const AREAS = { admin: '/admin/', captain: '/captain/' };
export function areaRoute(req, env, url) {
  if (!env.ADMIN_URL || !env.CAPTAIN_URL) return null;
  const host = { [new URL(env.ADMIN_URL).host]: 'admin', [new URL(env.CAPTAIN_URL).host]: 'captain' }[url.host];
  if (!host) return null;
  const other = host === 'admin' ? 'captain' : 'admin', p = url.pathname;
  if (p === '/') return env.ASSETS.fetch(new Request(new URL(AREAS[host], url.origin), req));
  if (p === AREAS[host] || p === AREAS[host] + 'index.html') return Response.redirect(new URL('/' + url.search, url.origin).href, 302);
  if (p.startsWith(AREAS[other])) {
    const rest = p.slice(AREAS[other].length);
    return Response.redirect(new URL((rest === 'index.html' ? '' : rest) + url.search, env[other === 'admin' ? 'ADMIN_URL' : 'CAPTAIN_URL']).href, 302);
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return areaRoute(req, env, url) || env.ASSETS.fetch(req);
    try {
      if (!sameOrigin(req, url)) return fail(403, 'origin');
      if (demoRefuses(env, req, url)) return fail(403, 'demo_readonly');   // the online demo is read only (src/demo.js)
      if (url.pathname.startsWith('/api/admin/')) return await adminApi(req, env, url);
      if (url.pathname.startsWith('/api/captain/')) return await captainApi(req, env, url);
      // Public, read only, no personal data: the live season (en cours). The public site checks against it (npm run season:check).
      if (req.method === 'GET' && url.pathname === '/api/public/season') {
        const s = await liveSeason(env.DB);
        const off = s ? (await env.DB.prepare('SELECT league FROM season_leagues WHERE season_id = ? AND enabled = 0').bind(s.id).all()).results.map((r) => r.league) : [];
        return json({ season: s ? { key: s.key, name: s.name, nbhpa_season_id: s.nbhpa_season_id, leagues_off: off } : null, demo: isDemo(env),
          urls: { admin: env.ADMIN_URL || null, captain: env.CAPTAIN_URL || null } }, 200, { 'Access-Control-Allow-Origin': '*' });
      }
      return fail(404, 'not_found');
    } catch (e) {
      console.error(e);
      return fail(500, 'server');
    }
  }
};
