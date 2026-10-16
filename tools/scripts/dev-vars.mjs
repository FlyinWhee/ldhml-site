// Create tools/.dev.vars (local secrets for "wrangler dev"; git-ignored) if it does not exist.
//   CODE_PEPPER  a random key for the sign-in hashes (local only; production has its own secret)
//   DEV=1        on localhost only, the sign-in code also comes back to the page (no email locally)
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.dev.vars');
if (existsSync(file)) { console.log('tools/.dev.vars already exists.'); process.exit(0); }
writeFileSync(file, `CODE_PEPPER=${randomBytes(24).toString('hex')}\nDEV=1\n`);
console.log('Created tools/.dev.vars');
