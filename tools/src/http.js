// Small HTTP helpers for the tools Worker.

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
export const fail = (status, error, extra = {}) => json({ error, ...extra }, status);

// A write must come from our own pages: the browser sends Origin on POST. No Origin, or another site: refused (CSRF).
export const sameOrigin = (req, url) => req.method === 'GET' || req.method === 'HEAD' || req.headers.get('Origin') === url.origin;

// JSON body, small, of the right type. Returns null when it is not acceptable.
export async function readJson(req, max = 8192) {
  if (!String(req.headers.get('Content-Type') || '').startsWith('application/json')) return null;
  const text = await req.text();
  if (text.length > max) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

export const isLocal = (url) => url.hostname === 'localhost' || url.hostname === '127.0.0.1';
export const now = () => Math.floor(Date.now() / 1000);

// Inputs
export const cleanEmail = (v) => {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};
export const cleanText = (v, max = 120) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : null;
};
