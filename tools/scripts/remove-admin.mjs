// Delete an admin for good: the account, its sessions and sign-in codes. Audit rows keep the actions (by admin number).
// Rows the admin created or revoked lose that link (created_by / revoked_by = NULL): D1 enforces foreign keys.
//   node tools/scripts/remove-admin.mjs someone@example.com            -> local database
//   node tools/scripts/remove-admin.mjs someone@example.com --remote   -> the real Cloudflare D1 database
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_REFS } from '../src/admins.js';   // the columns that point to an admin (same list as the admin page)

const WRANGLER = 'wrangler@4.151.1'; // same version as the npm scripts (package.json)

/** The SQL of the removal (tested in tools/test/test-tools.mjs). */
export function removeAdminSql(email, now = Math.floor(Date.now() / 1000)) {
  if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) throw new Error('bad email');
  const id = `(SELECT id FROM admins WHERE email = '${email}')`;
  return [
    `INSERT INTO audit (at, actor_kind, action, target, detail) SELECT ${now}, 'system', 'admin.remove', 'admin:' || id, '{"by":"remove-admin script"}' FROM admins WHERE email = '${email}';`,
    ...ADMIN_REFS.map(([tb, col]) => `UPDATE ${tb} SET ${col} = NULL WHERE ${col} = ${id};`),
    `UPDATE replacements SET created_by = NULL WHERE created_kind = 'admin' AND created_by = ${id};`,
    `DELETE FROM sessions WHERE kind = 'admin' AND user_id = ${id};`,
    `DELETE FROM login_codes WHERE kind = 'admin' AND user_id = ${id};`,
    `DELETE FROM admins WHERE email = '${email}';`
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const remote = process.argv.includes('--remote');
  const email = String(process.argv.slice(2).find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
  let sql;
  try { sql = removeAdminSql(email); } catch { console.error('Usage: node tools/scripts/remove-admin.mjs <email> [--remote]'); process.exit(1); }
  const config = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.jsonc');
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ldhml-')), 'remove-admin.sql');
  writeFileSync(file, sql);
  const r = spawnSync('npx', [WRANGLER, 'd1', 'execute', 'ldhml-tools', remote ? '--remote' : '--local', '-c', config, '--file', file], { stdio: 'inherit', shell: process.platform === 'win32' });
  rmSync(path.dirname(file), { recursive: true, force: true });
  process.exit(r.status ?? 1);
}
