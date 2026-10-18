// Passwordless sign-in: an emailed one-time code, then a session cookie.
// Two kinds of account, kept apart: "admin" (table admins) and "captain" (table captains).
// Each kind has its own cookie and its own sessions; a session of one kind never opens the other area.
//
// Security rules (see tools/CLAUDE.md):
//   - Only an existing, active account gets a code. The answer is the same for any email (no account discovery).
//   - Codes: 6 digits, 10 minutes, single use, at most 5 tries; at most 5 codes per email and 20 per IP per hour.
//   - Stored: only keyed hashes (HMAC-SHA-256 with the CODE_PEPPER secret) of codes, emails, IPs and session tokens.
//   - Cookie: __Host- prefix, HttpOnly, Secure, SameSite=Strict.
import { now } from './http.js';

export const KINDS = {
  admin: { table: 'admins', cookie: '__Host-ldhml_admin', ttl: 7 * 86400 },
  captain: { table: 'captains', cookie: '__Host-ldhml_captain', ttl: 60 * 86400 }
};
export const CODE_TTL = 600, MAX_TRIES = 5, MAX_PER_EMAIL = 5, MAX_PER_IP = 20;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const keys = new Map();
async function hmac(secret, text) {
  if (!secret || secret.length < 16) throw new Error('CODE_PEPPER secret is missing or too short');
  let k = keys.get(secret);
  if (!k) { k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); keys.set(secret, k); }
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
const sameHex = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
function randomCode() {
  const max = Math.floor(0xffffffff / 1e6) * 1e6, x = new Uint32Array(1); // no modulo bias
  do crypto.getRandomValues(x); while (x[0] >= max);
  return String(x[0] % 1e6).padStart(6, '0');
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Step 1: ask for a code. Returns { code, user } when a code must be emailed, or {} (same outward answer either way). */
export async function startLogin(env, kind, email, ip) {
  const k = KINDS[kind], t = now(), pepper = env.CODE_PEPPER;
  const emailH = await hmac(pepper, kind + ':' + email), ipH = await hmac(pepper, 'ip:' + (ip || ''));
  await env.DB.prepare('DELETE FROM login_codes WHERE created_at < ?').bind(t - 86400).run();
  const byEmail = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE kind = ? AND email_h = ? AND created_at > ?').bind(kind, emailH, t - 3600).first('n');
  const byIp = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE ip_h = ? AND created_at > ?').bind(ipH, t - 3600).first('n');
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) return { limited: true };
  const user = await env.DB.prepare(`SELECT id, email, name FROM ${k.table} WHERE email = ? AND disabled_at IS NULL`).bind(email).first();
  const code = randomCode();
  await env.DB.prepare('INSERT INTO login_codes (kind, email_h, user_id, code_h, ip_h, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(kind, emailH, user ? user.id : null, await hmac(pepper, emailH + ':' + code), ipH, t, t + CODE_TTL).run();
  return user ? { code, user } : {};
}

/** Step 2: check the code. Returns { token, user } (a new session) or null. */
export async function verifyLogin(env, kind, email, code) {
  const k = KINDS[kind], t = now(), pepper = env.CODE_PEPPER;
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const emailH = await hmac(pepper, kind + ':' + email);
  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE kind = ? AND email_h = ? AND user_id IS NOT NULL AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1')
    .bind(kind, emailH, t).first();
  if (!row || row.attempts >= MAX_TRIES) return null;
  await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
  if (!sameHex(await hmac(pepper, emailH + ':' + code), row.code_h)) return null;
  const user = await env.DB.prepare(`SELECT id, email, name FROM ${k.table} WHERE id = ? AND disabled_at IS NULL`).bind(row.user_id).first();
  if (!user) return null;
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('UPDATE login_codes SET used_at = ? WHERE kind = ? AND email_h = ? AND used_at IS NULL').bind(t, kind, emailH),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    env.DB.prepare('INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await hmac(pepper, 's:' + token), kind, user.id, t, t + k.ttl),
    env.DB.prepare(`UPDATE ${k.table} SET last_login_at = ? WHERE id = ?`).bind(t, user.id)
  ]);
  return { token, user };
}

/** A new session for an account (the demo sign-in; the code sign-in makes its own). Returns the token. */
export async function newSession(env, kind, userId) {
  const k = KINDS[kind], t = now(), token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    env.DB.prepare('INSERT INTO sessions (token_h, kind, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await hmac(env.CODE_PEPPER, 's:' + token), kind, userId, t, t + k.ttl),
    env.DB.prepare(`UPDATE ${k.table} SET last_login_at = ? WHERE id = ?`).bind(t, userId)
  ]);
  return token;
}
/** Two secrets equal? Compared through HMAC, so neither the length nor the content leaks through the timing. */
export async function sameSecret(env, a, b) { return sameHex(await hmac(env.CODE_PEPPER, 'k:' + a), await hmac(env.CODE_PEPPER, 'k:' + b)); }

const tokenOf = (req, kind) => {
  const m = String(req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + KINDS[kind].cookie + '=([A-Za-z0-9_-]{20,})'));
  return m ? m[1] : null;
};

/** The signed-in account of this kind, or null. */
export async function sessionUser(env, req, kind) {
  const token = tokenOf(req, kind);
  if (!token) return null;
  return env.DB.prepare(`SELECT u.id, u.email, u.name FROM sessions s JOIN ${KINDS[kind].table} u ON u.id = s.user_id
    WHERE s.token_h = ? AND s.kind = ? AND s.expires_at > ? AND u.disabled_at IS NULL`).bind(await hmac(env.CODE_PEPPER, 's:' + token), kind, now()).first();
}

export async function endSession(env, req, kind) {
  const token = tokenOf(req, kind);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_h = ?').bind(await hmac(env.CODE_PEPPER, 's:' + token)).run();
}

export const sessionCookie = (kind, token) => `${KINDS[kind].cookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${KINDS[kind].ttl}`;
export const clearCookie = (kind) => `${KINDS[kind].cookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
