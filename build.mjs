// Build the static site: inline the data snapshot into the template.
//   dist/index.html     full page, ready for any static host (GitHub Pages, Cloudflare Pages, Netlify)
//   dist/artifact.html  same page as a fragment, for hosts that add their own <html> wrapper
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = async (p) => readFile(path.join(root, p), 'utf8');

const names = ['meta', 'teams', 'games', 'players', 'goalies', 'box'];
const data = {};
for (const n of names) data[n] = JSON.parse(await read(`data/${n}.json`));

// Keep the JSON safe inside a <script> tag.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(data)
  .replace(/</g, '\\u003c')
  .split(LS).join('\\u2028')
  .split(PS).join('\\u2029');

// The site source is split in site/style.css and site/js/*.js (joined in file-name order).
const jsParts = (await readdir(path.join(root, 'site/js'))).filter((f) => f.endsWith('.js')).sort();
const parsers = await read('shared/parsers.js');
const js = [parsers, ...(await Promise.all(jsParts.map((f) => read(`site/js/${f}`))))].join('\n');
const css = await read('site/style.css');
let template = await read('site/template.html');
for (const key of ['/*__CSS__*/', '/*__JS__*/', '/*__DATA__*/']) {
  if (!template.includes(key)) throw new Error(`Placeholder ${key} missing in template`);
}
// Replace with functions so that "$" in the code is never read as a replacement pattern.
const fragment = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js)
  .replace('/*__DATA__*/', () => json);

const title = (fragment.match(/<title>(.*?)<\/title>/s) ?? [, 'LDHML Retro Stats'])[1];
const body = fragment.replace(/<title>.*?<\/title>\s*/s, '');
const page = `<!doctype html>
<html lang="fr" data-league="retro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="Classement, calendrier, feuilles de match et statistiques de la ligue LDHML Retro, hockey balle.">
<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;

await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/index.html'), page);
await writeFile(path.join(root, 'dist/artifact.html'), fragment);
console.log(`Built dist/index.html (${(page.length / 1024).toFixed(1)} KB) and dist/artifact.html`);
