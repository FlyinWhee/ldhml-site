// LDHML tools: one Cloudflare Worker. It serves the tool pages (static assets, built into dist-tools/ by build.mjs)
// and the API (/api/...). Read tools/CLAUDE.md first.
//   /admin/     admin area (sign-in, captains, seasons)        API: /api/admin/...
//   /captain/   captain area (planned)                         API: /api/captain/... (planned)
// This Worker never fetches NBHPA (Cloudflare servers are blocked there). It reads our own snapshot: /data/season.json.
import { fail, sameOrigin } from './http.js';
import { adminApi } from './admin-api.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (!sameOrigin(req, url)) return fail(403, 'origin');
      if (url.pathname.startsWith('/api/admin/')) return await adminApi(req, env, url);
      return fail(404, 'not_found');
    } catch (e) {
      console.error(e);
      return fail(500, 'server');
    }
  }
};
