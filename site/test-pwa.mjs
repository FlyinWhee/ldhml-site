// The site must be installable: manifest, icons and service worker next to every page.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(root, 'leagues.json'), 'utf8'));
const dirs = [['', ''], ...cfg.leagues.map((l) => [l.slug, '../'])];
for (const [slug] of dirs) {
  const base = path.join(root, 'dist', slug);
  const html = await readFile(path.join(base, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, `${slug || 'hub'}: manifest linked`);
  assert.match(html, /serviceWorker\.register\('sw\.js'\)/, `${slug || 'hub'}: service worker registered`);
  const m = JSON.parse(await readFile(path.join(base, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone'); assert.ok(m.name && m.short_name && m.start_url && m.scope);
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'), 'icon sizes');
  for (const i of m.icons) await access(path.join(base, i.src));
  const sw = await readFile(path.join(base, 'sw.js'), 'utf8');
  assert.match(sw, /u\.origin !== location\.origin\) return/, 'league server calls are not intercepted');
}
assert.ok(!(await readFile(path.join(root, 'dist/artifact/draft/index.html'), 'utf8')).includes('serviceWorker'), 'no service worker in the preview build');
console.log('PWA test passed: manifest, icons and service worker for 7 pages.');
