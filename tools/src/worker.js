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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (!sameOrigin(req, url)) return fail(403, 'origin');
      if (demoRefuses(env, req, url)) return fail(403, 'demo_readonly');   // the online demo is read only (src/demo.js)
      if (url.pathname.startsWith('/api/admin/')) return await adminApi(req, env, url);
      if (url.pathname.startsWith('/api/captain/')) return await captainApi(req, env, url);
      // Public, read only, no personal data: the live season (en cours). The public site checks against it (npm run season:check).
      if (req.method === 'GET' && url.pathname === '/api/public/season') {
        const s = await liveSeason(env.DB);
        const off = s ? (await env.DB.prepare('SELECT league FROM season_leagues WHERE season_id = ? AND enabled = 0').bind(s.id).all()).results.map((r) => r.league) : [];
        return json({ season: s ? { key: s.key, name: s.name, nbhpa_season_id: s.nbhpa_season_id, leagues_off: off } : null, demo: isDemo(env) }, 200, { 'Access-Control-Allow-Origin': '*' });
      }
      return fail(404, 'not_found');
    } catch (e) {
      console.error(e);
      return fail(500, 'server');
    }
  }
};
