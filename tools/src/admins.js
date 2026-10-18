// Admin accounts. Super admins come from the SUPER_ADMINS secret (comma-separated emails; never in git): they can sign
// in even before their row exists (the row is created, or enabled again, at sign-in), they manage the other admins,
// and the page can neither disable nor delete them. Everything else is the same for every admin.
import { json, fail, readJson, cleanEmail, cleanText, now } from './http.js';

/** The super admin emails (lower case). */
export function superEmails(env) {
  return new Set(String(env.SUPER_ADMINS || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
}
export const isSuper = (env, admin) => !!admin && superEmails(env).has(String(admin.email).toLowerCase());

/** At sign-in: a super admin email gets its row (created, or enabled again). The answer to the visitor stays the same. */
export async function ensureSuperAdmin(env, email) {
  if (!superEmails(env).has(email)) return;
  const row = await env.DB.prepare('SELECT id, disabled_at FROM admins WHERE email = ?').bind(email).first();
  if (!row) {
    const r = await env.DB.prepare('INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)').bind(email, email.split('@')[0], now()).run();
    await env.DB.prepare("INSERT INTO audit (at, actor_kind, action, target, detail) VALUES (?, 'system', 'admin.bootstrap', ?, ?)").bind(now(), 'admin:' + r.meta.last_row_id, '{"by":"SUPER_ADMINS"}').run();
  } else if (row.disabled_at) {
    await env.DB.prepare('UPDATE admins SET disabled_at = NULL WHERE id = ?').bind(row.id).run();
  }
}

/** Every column that points to an admin (D1 enforces foreign keys): cleared when an admin is deleted. Shared with
 *  scripts/remove-admin.mjs. */
export const ADMIN_REFS = [['seasons', 'created_by'], ['captains', 'created_by'], ['captain_access', 'created_by'], ['captain_access', 'revoked_by'],
  ['people', 'created_by'], ['section_players', 'created_by'], ['teams', 'created_by'], ['rosters', 'added_by'], ['rosters', 'removed_by'],
  ['season_leagues', 'updated_by'], ['replacements', 'decided_by'], ['games', 'created_by'], ['games', 'updated_by'], ['league_players', 'created_by'], ['league_players', 'updated_by']];

/** Routes (super admins only): GET /admins, POST /admins, POST /admins/:id, POST /admins/:id/(disable|enable|delete). */
export async function adminsApi({ req, env, path, m, admin, audit }) {
  if (!/^\/admins(\/|$)/.test(path)) return null;
  if (!isSuper(env, admin)) return fail(403, 'super_only');
  const DB = env.DB, supers = superEmails(env);
  if (m === 'GET' && path === '/admins') {
    const { results } = await DB.prepare('SELECT id, email, name, created_at, last_login_at, disabled_at FROM admins ORDER BY name COLLATE NOCASE').all();
    return json({ admins: results.map((a) => ({ ...a, super: supers.has(a.email.toLowerCase()), me: a.id === admin.id })) });
  }
  if (m === 'POST' && path === '/admins') {
    const b = await readJson(req) || {}, email = cleanEmail(b.email), name = cleanText(b.name, 80);
    if (!email || !name) return fail(400, 'admin');
    if (await DB.prepare('SELECT 1 FROM admins WHERE email = ?').bind(email).first()) return fail(409, 'admin_exists');
    const r = await DB.prepare('INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)').bind(email, name, now()).run();
    await audit('admin.create', 'admin:' + r.meta.last_row_id, { name });
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  const x = path.match(/^\/admins\/(\d+)(?:\/(disable|enable|delete))?$/);
  if (m !== 'POST' || !x) return fail(404, 'not_found');
  const id = Number(x[1]), row = await DB.prepare('SELECT id, email, name FROM admins WHERE id = ?').bind(id).first();
  if (!row) return fail(404, 'admin');
  if (!x[2]) {   // edit the name
    const b = await readJson(req) || {}, name = cleanText(b.name, 80);
    if (!name) return fail(400, 'admin');
    await DB.prepare('UPDATE admins SET name = ? WHERE id = ?').bind(name, id).run();
    await audit('admin.update', 'admin:' + id, { name });
    return json({ ok: true });
  }
  if (supers.has(row.email.toLowerCase())) return fail(409, 'super_admin');   // set in SUPER_ADMINS: changed there only
  if (id === admin.id) return fail(409, 'self');
  if (x[2] === 'disable') {
    await DB.batch([DB.prepare('UPDATE admins SET disabled_at = ? WHERE id = ?').bind(now(), id), DB.prepare("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?").bind(id)]);
    await audit('admin.disable', 'admin:' + id);
    return json({ ok: true });
  }
  if (x[2] === 'enable') {
    await DB.prepare('UPDATE admins SET disabled_at = NULL WHERE id = ?').bind(id).run();
    await audit('admin.enable', 'admin:' + id);
    return json({ ok: true });
  }
  // delete for good: the links to the admin are cleared, the sessions and codes go; audit rows keep the actions (by number)
  await DB.batch([
    ...ADMIN_REFS.map(([tb, col]) => DB.prepare(`UPDATE ${tb} SET ${col} = NULL WHERE ${col} = ?`).bind(id)),
    DB.prepare("UPDATE replacements SET created_by = NULL WHERE created_kind = 'admin' AND created_by = ?").bind(id),
    DB.prepare("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?").bind(id),
    DB.prepare("DELETE FROM login_codes WHERE kind = 'admin' AND user_id = ?").bind(id),
    DB.prepare('DELETE FROM admins WHERE id = ?').bind(id)
  ]);
  await audit('admin.delete', 'admin:' + id, { name: row.name });
  return json({ ok: true });
}
