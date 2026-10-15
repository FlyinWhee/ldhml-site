// Run the UI smoke test once per league of leagues.json (pages are in dist/<section>/<league>/).
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
if (!cfg.leagues.length) throw new Error('No league in leagues.json');
for (const { slug } of cfg.leagues) {
  const r = spawnSync(process.execPath, [path.join(root, 'site/test-ui.mjs'), slug], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`UI test failed for ${slug}`); process.exit(1); }
}
