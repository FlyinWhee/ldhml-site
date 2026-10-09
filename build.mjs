// Build the static site.
//   dist/index.html            LDHML home page (one card per league)
//   dist/<slug>/index.html     one page per league, with its own theme (for example /retro/)
//   dist/artifact/...          the same tree for the Artifact preview (the home page is a fragment)
// Every page is one self-contained file: CSS, JS, parsers and a data snapshot are inlined.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { themeCss, cardCss } from './site/themes.mjs';

globalThis.DOMParser ??= class {}; // the parsers need a DOMParser only when they parse HTML
await import('./shared/parsers.js');
const nice = globalThis.LDParsers.niceName;

const root = path.dirname(fileURLToPath(import.meta.url));
const read = async (p) => readFile(path.join(root, p), 'utf8');
const cfg = JSON.parse(await read('leagues.json'));

// Keep the JSON safe inside a <script> tag.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');

const jsParts = (await readdir(path.join(root, 'site/js'))).filter((f) => f.endsWith('.js')).sort();
const parsers = await read('shared/parsers.js');
const leagueJs = [parsers, ...(await Promise.all(jsParts.map((f) => read(`site/js/${f}`))))].join('\n');
const hubJs = [parsers, await read('site/hub/hub.js')].join('\n');
const baseCss = await read('site/style.css');
const leagueCss = baseCss + '\n' + themeCss();
const hubCss = baseCss + '\n' + await read('site/hub/hub.css') + '\n' + cardCss();

const fill = (tpl, css, js, data) => {
  for (const key of ['/*__CSS__*/', '/*__JS__*/', '/*__DATA__*/']) if (!tpl.includes(key)) throw new Error(`Placeholder ${key} missing in template`);
  // Functions as replacements, so that "$" in the code is never read as a replacement pattern.
  return tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('/*__DATA__*/', () => data);
};
const splitTitle = (fragment) => ({
  title: (fragment.match(/<title>(.*?)<\/title>/s) ?? [, 'LDHML'])[1],
  body: fragment.replace(/<title>.*?<\/title>\s*/s, '')
});
const page = (fragment, { title, theme, description, icon }) => {
  const { body } = splitTitle(fragment);
  return `<!doctype html>
<html lang="fr" data-league="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">${icon ? `\n<link rel="icon" href="${icon}">` : ''}
<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
};

// ---- load the data of every league ----
const names = ['meta', 'teams', 'games', 'players', 'goalies', 'box'];
const leagues = [];
for (const lg of cfg.leagues) {
  const data = {};
  try { for (const n of names) data[n] = JSON.parse(await read(`data/${lg.slug}/${n}.json`)); }
  catch { console.warn(`No data for ${lg.slug}. Run "npm run fetch" first. League skipped.`); continue; }
  leagues.push({ lg, data });
}
if (!leagues.length) throw new Error('No league data found in data/<slug>/');
// ---- logos: one WebP (for the pages) and one small PNG (for the browser tab) per logo, inlined as data URIs ----
const logoKeys = [...new Set(cfg.leagues.map((l) => l.logo).filter(Boolean))];
const logos = {}, icons = {};
for (const k of logoKeys) {
  logos[k] = 'data:image/webp;base64,' + (await readFile(path.join(root, `assets/logos/${k}.webp`))).toString('base64');
  icons[k] = 'data:image/png;base64,' + (await readFile(path.join(root, `assets/logos/${k}-icon.png`))).toString('base64');
}
const hubIcon = 'data:image/png;base64,' + (await readFile(path.join(root, 'assets/logos/hub-icon.png'))).toString('base64');
logos.hero = 'data:image/webp;base64,' + (await readFile(path.join(root, 'assets/logos/dek-hero.webp'))).toString('base64');
const registry = leagues.map(({ lg }) => ({ slug: lg.slug, name: lg.name, short: lg.short, theme: lg.theme }));

// ---- home page data: a small summary of each league ----
const summary = leagues.map(({ lg, data }) => {
  const played = data.games.filter((g) => g.as != null && g.hs != null && !g.cancelled);
  const teamName = Object.fromEntries(data.teams.map((t) => [t.id, t]));
  const scorer = [...data.players].sort((a, b) => b.p - a.p || b.g - a.g)[0];
  return {
    slug: lg.slug, name: lg.name, short: lg.short, theme: lg.theme, logo: lg.logo, categoryId: lg.categoryId,
    teams: data.teams.length, played: played.length, total: data.games.filter((g) => !g.cancelled).length,
    top: [...data.teams].sort((a, b) => a.pos - b.pos).slice(0, 3).map((t) => ({ name: nice(t.name), pos: t.pos, w: t.w, l: t.l, t: t.t, pts: t.pts, gp: t.gp })),
    scorer: scorer && scorer.p > 0 ? { name: nice(scorer.name), p: scorer.p } : null,
    upcoming: data.games.filter((g) => !(g.as != null && g.hs != null) && !g.cancelled).map((g) => ({ date: g.date, time: g.time, away: teamName[g.away]?.abb, home: teamName[g.home]?.abb })),
    fetchedAt: data.meta.fetchedAt
  };
});
const hubData = { leagueId: cfg.leagueId, seasonId: cfg.seasonId, season: cfg.seasonName, logos, leagues: summary };

// ---- write ----
const outDirs = [path.join(root, 'dist'), path.join(root, 'dist/artifact')];
await rm(path.join(root, 'dist'), { recursive: true, force: true });
const hubFragment = fill(await read('site/hub/hub.html'), hubCss, hubJs, safe(hubData));
const leagueTpl = await read('site/template.html');
let total = 0;
for (const out of outDirs) {
  await mkdir(out, { recursive: true });
  const isArtifact = out.endsWith('artifact');
  // The artifact host adds its own <html> wrapper to the main page, so that one is a fragment.
  await writeFile(path.join(out, 'index.html'), isArtifact ? hubFragment : page(hubFragment, { title: 'LDHML', theme: 'default', icon: hubIcon, description: 'Classements, calendriers et statistiques des ligues LDHML, hockey balle.' }));
  for (const { lg, data } of leagues) {
    const D = { ...data, league: { slug: lg.slug, theme: lg.theme, short: lg.short, name: lg.name, logo: lg.logo ? logos[lg.logo] : null }, registry, base: '../' };
    const frag = fill(leagueTpl, leagueCss, leagueJs, safe(D));
    const html = page(frag, { title: `${lg.name} | ${cfg.seasonName}`, theme: lg.theme, icon: lg.logo ? icons[lg.logo] : null, description: `Classement, calendrier, feuilles de match et statistiques de ${lg.name}, hockey balle.` });
    await mkdir(path.join(out, lg.slug), { recursive: true });
    await writeFile(path.join(out, lg.slug, 'index.html'), html);
    total += html.length;
  }
}
await writeFile(path.join(root, 'dist/.nojekyll'), '');
console.log(`Built the home page and ${leagues.length} leagues: ${leagues.map((l) => l.lg.slug).join(', ')} (about ${(total / outDirs.length / leagues.length / 1024).toFixed(0)} KB each).`);
