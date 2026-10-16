// Add (or re-enable) an admin. Admin emails never go into the git repo, so this writes straight to the database.
//   node tools/scripts/add-admin.mjs you@example.com "Your Name"            -> local database (npm run tools:dev)
//   node tools/scripts/add-admin.mjs you@example.com "Your Name" --remote   -> the real Cloudflare D1 database
// Needs wrangler (npx downloads it the first time).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WRANGLER = 'wrangler@4.151.1'; // same version as the npm scripts (package.json)
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const remote = process.argv.includes('--remote');
const email = String(args[0] || '').trim().toLowerCase(), name = String(args[1] || '').trim();
if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email) || /'/.test(name)) {
  console.error('Usage: node tools/scripts/add-admin.mjs <email> "<name>" [--remote]   (no apostrophes, sorry)');
  process.exit(1);
}
const now = Math.floor(Date.now() / 1000);
const sql = `INSERT INTO admins (email, name, created_at) VALUES ('${email}', '${name}', ${now}) ON CONFLICT(email) DO UPDATE SET disabled_at = NULL, name = excluded.name;` +
  ` INSERT INTO audit (at, actor_kind, action, target, detail) VALUES (${now}, 'system', 'admin.add', 'admin:' || (SELECT id FROM admins WHERE email = '${email}'), '{"by":"add-admin script"}');`;
const config = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.jsonc');
// The SQL goes through a temporary file: shells (Windows cmd especially) mangle quotes on the command line.
const file = path.join(mkdtempSync(path.join(tmpdir(), 'ldhml-')), 'add-admin.sql');
writeFileSync(file, sql);
const r = spawnSync('npx', [WRANGLER, 'd1', 'execute', 'ldhml-tools', remote ? '--remote' : '--local', '-c', config, '--file', file], { stdio: 'inherit', shell: process.platform === 'win32' });
rmSync(path.dirname(file), { recursive: true, force: true });
process.exit(r.status ?? 1);
