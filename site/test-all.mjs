// Run the UI smoke test once per league built in dist/.
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const slugs = (await readdir(path.join(root, 'dist'), { withFileTypes: true })).filter((e) => e.isDirectory() && e.name !== 'artifact').map((e) => e.name);
if (!slugs.length) throw new Error('No league found in dist/');
for (const slug of slugs) {
  const r = spawnSync(process.execPath, [path.join(root, 'site/test-ui.mjs'), slug], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`UI test failed for ${slug}`); process.exit(1); }
}
