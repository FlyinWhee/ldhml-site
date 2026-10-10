// Optional Cloudflare Worker: a small cache in front of the public league pages.
// Why: if many people open the live page at the same time, the league server sees ONE request
// per cache period instead of one per visitor. Visitors use this Worker through <meta name="ldhml-api">.
//
// Deploy:  npx wrangler deploy worker/proxy.js --name ldhml-live --compatibility-date 2026-01-01
// Use:     set  <meta name="ldhml-api" content="https://ldhml-live.<you>.workers.dev">  in site/template.html
const ORIGIN = 'https://admin.nbhpa.com';
const ALLOW = [
  { re: /^\/livegame_json\/\d+$/, ttl: 10 },
  { re: /^\/table_data\.php$/, ttl: 60 },
  { re: /^\/sites\/site_(stats_players|stats_goalies|schedule_include|game_recap)\.php$/, ttl: 60 },
];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    // Diagnostic: answers without calling the league server. Shows where the caller comes from (as Cloudflare sees it).
    if (url.pathname === '/__ping') return new Response(JSON.stringify({ ok: true, asn: req.cf && req.cf.asn, org: req.cf && req.cf.asOrganization, country: req.cf && req.cf.country, bot: req.cf && req.cf.botManagement && req.cf.botManagement.score }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    const rule = ALLOW.find((r) => r.re.test(url.pathname));
    if (!rule || (req.method !== 'GET' && req.method !== 'POST')) return new Response('Not allowed', { status: 403, headers: CORS });

    const body = req.method === 'POST' ? await req.text() : null;
    // POST answers are cached too: the cache key includes the form body.
    const keyUrl = new URL(req.url);
    if (body) keyUrl.searchParams.set('__b', body);
    const key = new Request(keyUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return withCors(hit);

    const up = await fetch(ORIGIN + url.pathname + url.search, {
      method: req.method, body,
      headers: { 'Content-Type': req.headers.get('Content-Type') || 'application/x-www-form-urlencoded', 'User-Agent': 'ldhml-stats-proxy/0.1 (community stats viewer; cached)' },
    });
    const res = new Response(up.body, up);
    if (up.ok) {
      res.headers.set('Cache-Control', `public, max-age=${rule.ttl}`);
      ctx.waitUntil(cache.put(key, res.clone()));
    } else {
      res.headers.set('Cache-Control', 'public, max-age=10');
    }
    return withCors(res);
  },

};
function withCors(res) {
  const r = new Response(res.body, res);
  Object.entries(CORS).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}
