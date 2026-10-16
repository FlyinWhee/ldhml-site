// Build the static site.
//   dist/index.html                       LDHML entry page (one card per section: draft leagues, team leagues)
//   dist/<section>/index.html             section page: its leagues and its players (for example /equipes/)
//   dist/<section>/<league>/index.html    one page per league, with its own theme (for example /draft/retro/)
//   dist/artifact/...          the same tree for the Artifact preview (the home page is a fragment)
// Every page is one self-contained file: CSS, JS, parsers and a data snapshot are inlined.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { themeCss, cardCss } from './site/themes.mjs';
import { peopleIndex } from './site/people.mjs';

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
// shared/: parsers (data), look (how teams and leagues look), ranks (rank scales: which rank is stronger). Both go into every page, so every page reads and shows data the same way.
const parsers = (await read('shared/parsers.js')) + '\n' + (await read('shared/look.js')) + '\n' + (await read('shared/ranks.js'));
const leagueJs = [parsers, ...(await Promise.all(jsParts.map((f) => read(`site/js/${f}`))))].join('\n');
const hubJs = [parsers, await read('site/hub/hub.js')].join('\n');
const baseCss = await read('site/style.css');
let leagueCss = baseCss + '\n' + themeCss() + '\n' + cardCss(); // cardCss: [data-t] tokens, for league badges of other leagues
let hubCss = baseCss + '\n' + await read('site/hub/hub.css') + '\n' + cardCss();

const fill = (tpl, css, js, data) => {
  for (const key of ['/*__CSS__*/', '/*__JS__*/', '/*__DATA__*/']) if (!tpl.includes(key)) throw new Error(`Placeholder ${key} missing in template`);
  // Functions as replacements, so that "$" in the code is never read as a replacement pattern.
  return tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('/*__DATA__*/', () => data);
};
const splitTitle = (fragment) => ({
  title: (fragment.match(/<title>(.*?)<\/title>/s) ?? [, 'LDHML'])[1],
  body: fragment.replace(/<title>.*?<\/title>\s*/s, '')
});
const page = (fragment, { title, theme, description, icon, pwa }) => {
  const { body } = splitTitle(fragment);
  const pwaHead = pwa ? `
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0A1218">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${pwa.shortName}">
<link rel="apple-touch-icon" href="${pwa.up}icons/${pwa.icon}-192.png">` : '';
  const pwaScript = pwa ? `\n<script>if('serviceWorker' in navigator&&location.protocol==='https:'){addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})})}</script>` : '';
  return `<!doctype html>
<html lang="fr" data-league="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">${icon ? `\n<link rel="icon" href="${icon}">` : ''}${pwaHead}
<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}${pwaScript}
</body>
</html>
`;
};


// ---- installable app (PWA): manifest, icons and a small service worker per page ----
const manifestOf = ({ name, shortName, icon, description }) => JSON.stringify({
  id: './', name, short_name: shortName, description, lang: 'fr', dir: 'ltr',
  start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: '#0A1218', theme_color: '#0A1218',
  icons: [
    { src: `${icon.up}icons/${icon.key}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${icon.up}icons/${icon.key}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${icon.up}icons/${icon.key}-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2);
// Pages: network first (a new release shows at once), the stored copy only when offline. Fonts: stored after first use.
// Calls to the league server are never intercepted, so live data always comes from the network.
const swOf = (version) => `// LDHML service worker ${version}
const CACHE = 'ldhml-${version}';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request('./', { cache: 'reload' })).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ldhml-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then((c) => c.match(r).then((hit) => { const net = fetch(r).then((res) => { c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; })));
    return;
  }
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(new Request('./'), copy)); return res; })
      .catch(() => caches.open(CACHE).then((c) => c.match('./', { ignoreSearch: true }))));
    return;
  }
  e.respondWith(caches.open(CACHE).then((c) => c.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }))));
});
`;

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
// League logos for the league badges: defined ONCE per page in CSS (.lg-logo-<key>), a badge only names the class.
// (An inline data URI in every badge made the player list several MB per render.)
const logoCss = Object.entries(icons).map(([k, v]) => `.lg-logo-${k} { background-image: url("${v}"); }`).join('\n');
leagueCss += '\n' + logoCss;
hubCss += '\n' + logoCss;
const hubIcon = 'data:image/png;base64,' + (await readFile(path.join(root, 'assets/logos/hub-icon.png'))).toString('base64');
logos.hero = 'data:image/webp;base64,' + (await readFile(path.join(root, 'assets/logos/dek-hero.webp'))).toString('base64');
// ---- sections: the first level of the site (draft leagues, team leagues). Each league belongs to one. ----
const pathOf = (lg) => lg.path || lg.slug;
const sections = cfg.sections.map((s) => ({ ...s, leagues: leagues.filter(({ lg }) => lg.section === s.key) }));
for (const { lg } of leagues) if (!sections.some((s) => s.key === lg.section)) throw new Error(`League ${lg.slug}: unknown section "${lg.section}" (see "sections" in leagues.json)`);
const sectionLinks = Object.fromEntries(cfg.sections.map((s) => [s.key, { path: s.path, name: s.name }]));

// ---- people: our own ids (registry/people.json), one instance per section ----
const reg = JSON.parse(await read('registry/people.json').catch(() => '{"next":1,"people":[]}'));
const { people, missing } = peopleIndex(cfg, leagues, reg, nice);
if (missing.length) console.warn(`${missing.length} people are not in registry/people.json yet (temporary ids). Run "npm run registry".`);
const personByNid = new Map(Object.values(people).map((p) => [p.nid, p]));

// ---- home page data: a small summary of each league ----
// Teams carry id, code, name and logo, so every page can show the badge, the colour and a link (docs/presentation.md).
const summary = leagues.map(({ lg, data }) => {
  const played = data.games.filter((g) => g.as != null && g.hs != null && !g.cancelled);
  const teamName = Object.fromEntries(data.teams.map((t) => [t.id, t]));
  const scorer = [...data.players].sort((a, b) => b.p - a.p || b.g - a.g)[0];
  return {
    slug: lg.slug, path: pathOf(lg), section: lg.section, name: lg.name, short: lg.short, theme: lg.theme, logo: lg.logo, categoryId: lg.categoryId,
    teams: data.teams.length, played: played.length, total: data.games.filter((g) => !g.cancelled).length,
    teamList: data.teams.map((t) => ({ id: t.id, abb: t.abb, name: nice(t.name), logo: t.logo })),
    top: [...data.teams].sort((a, b) => a.pos - b.pos).slice(0, 3).map((t) => ({ id: t.id, abb: t.abb, name: nice(t.name), pos: t.pos, w: t.w, l: t.l, t: t.t, pts: t.pts, gp: t.gp })),
    scorer: scorer && scorer.p > 0 ? { id: personByNid.get(scorer.nid)?.id, name: nice(scorer.name), abb: scorer.teams[0], p: scorer.p } : null,
    upcoming: data.games.filter((g) => !(g.as != null && g.hs != null) && !g.cancelled).map((g) => ({ date: g.date, time: g.time, away: teamName[g.away]?.abb, home: teamName[g.home]?.abb })),
    fetchedAt: data.meta.fetchedAt
  };
});
const common = { leagueId: cfg.leagueId, seasonId: cfg.seasonId, season: cfg.seasonName, logos };
const sectionOf = (s) => ({ key: s.key, path: s.path, name: s.name, logo: s.logo, theme: s.theme });
const peopleIn = (key) => Object.values(people).filter((p) => p.in[key]).length;
// Entry page: one card per section.
const rootData = { ...common, kind: 'root', sections: sections.map((s) => ({ ...sectionOf(s), people: peopleIn(s.key), leagues: summary.filter((l) => l.section === s.key) })) };
// Section page: its leagues and its people (only what this section knows about them).
const sectionData = (s) => ({
  ...common, kind: 'section', section: sectionOf(s), sections: sectionLinks, up: '../',
  rankSystems: (cfg.rankSystems ?? []).filter((r) => r.section === s.key).map((r) => ({ key: r.key, name: r.name })),
  leagues: summary.filter((l) => l.section === s.key),
  people: Object.values(people).filter((p) => p.in[s.key]).map((p) => ({
    id: p.id, name: p.name, sex: p.sex, rank: p.rank, ranks: p.in[s.key].ranks, lg: p.in[s.key].leagues, xs: Object.keys(p.in).filter((k) => k !== s.key)
  }))
});
// League page: maps from NBHPA ids to our ids, and where else each person plays.
const leagueIds = (lg, data) => {
  const ids = { pids: {}, nids: {}, who: {} };
  for (const row of [...data.players, ...data.goalies]) {
    const p = personByNid.get(row.nid);
    if (!p) continue;
    ids.nids[p.nid] = p.id;
    for (const pid of p.pids) ids.pids[pid] = p.id;
    const other = Object.entries(p.in[lg.section].leagues).filter(([s]) => s !== lg.slug);
    ids.who[p.id] = { lg: other.map(([slug, m]) => ({ slug, teams: m.teams })), xs: Object.keys(p.in).filter((k) => k !== lg.section) };
  }
  return ids;
};

// ---- write ----
const outDirs = [path.join(root, 'dist'), path.join(root, 'dist/artifact')];
await rm(path.join(root, 'dist'), { recursive: true, force: true });
const hubTpl = await read('site/hub/hub.html');
const rootFragment = fill(hubTpl, hubCss, hubJs, safe(rootData));
const leagueTpl = await read('site/template.html');
const sha = (html) => createHash('sha1').update(html).digest('hex').slice(0, 10);
let total = 0;
for (const out of outDirs) {
  await mkdir(out, { recursive: true });
  const isArtifact = out.endsWith('artifact');
  // The artifact host adds its own <html> wrapper to the main page, so that one is a fragment.
  const rootHtml = isArtifact ? rootFragment : page(rootFragment, { title: 'LDHML', theme: 'default', icon: hubIcon, description: 'Classements, calendriers et statistiques des ligues LDHML, hockey balle.', pwa: { up: '', icon: 'hub', shortName: 'LDHML' } });
  await writeFile(path.join(out, 'index.html'), rootHtml);
  if (!isArtifact) {
    await mkdir(path.join(out, 'icons'), { recursive: true });
    for (const f of await readdir(path.join(root, 'assets/pwa'))) await writeFile(path.join(out, 'icons', f), await readFile(path.join(root, 'assets/pwa', f)));
    await writeFile(path.join(out, 'manifest.webmanifest'), manifestOf({ name: 'LDHML', shortName: 'LDHML', description: 'Ligues LDHML, hockey balle', icon: { up: '', key: 'hub' } }));
    await writeFile(path.join(out, 'sw.js'), swOf(sha(rootHtml)));
  }
  for (const s of sections) {
    const sdir = path.join(out, s.path);
    const sname = `LDHML ${s.name.fr}`;
    const shtml = page(fill(hubTpl, hubCss, hubJs, safe(sectionData(s))), { title: `${sname} | ${cfg.seasonName}`, theme: 'default', icon: s.logo ? icons[s.logo] : hubIcon, description: `Ligues ${s.name.fr} de la LDHML : classements, calendriers, joueurs.`, pwa: isArtifact ? null : { up: '../', icon: s.logo || 'hub', shortName: sname } });
    await mkdir(sdir, { recursive: true });
    await writeFile(path.join(sdir, 'index.html'), shtml);
    if (!isArtifact) {
      await writeFile(path.join(sdir, 'manifest.webmanifest'), manifestOf({ name: sname, shortName: sname, description: `${sname}, ${cfg.seasonName}`, icon: { up: '../', key: s.logo || 'hub' } }));
      await writeFile(path.join(sdir, 'sw.js'), swOf(sha(shtml)));
    }
    // The leagues of this section, with their teams and small logo (64 px tab icon), for the picker and the league badges.
    const registry = s.leagues.map(({ lg, data }) => ({ slug: lg.slug, path: pathOf(lg), name: lg.name, short: lg.short, theme: lg.theme, logo: lg.logo,
      teams: data.teams.map((t) => ({ id: t.id, abb: t.abb, name: nice(t.name) })) }));
    for (const { lg, data } of s.leagues) {
      const D = { ...data, league: { slug: lg.slug, path: pathOf(lg), theme: lg.theme, short: lg.short, name: lg.name, logo: lg.logo ? logos[lg.logo] : null },
        section: { key: s.key, path: s.path, name: s.name }, sections: sectionLinks, registry, ids: leagueIds(lg, data), base: '../', root: '../../' };
      const frag = fill(leagueTpl, leagueCss, leagueJs, safe(D));
      const html = page(frag, { title: `${lg.name} | ${cfg.seasonName}`, theme: lg.theme, icon: lg.logo ? icons[lg.logo] : null, description: `Classement, calendrier, feuilles de match et statistiques de ${lg.name}, hockey balle.`, pwa: isArtifact ? null : { up: '../../', icon: lg.logo || 'hub', shortName: `LDHML - ${lg.short}` } });
      const ldir = path.join(sdir, pathOf(lg));
      await mkdir(ldir, { recursive: true });
      await writeFile(path.join(ldir, 'index.html'), html);
      if (!isArtifact) {
        await writeFile(path.join(ldir, 'manifest.webmanifest'), manifestOf({ name: lg.name.replace(/^LDHML\s+/, 'LDHML - '), shortName: `LDHML - ${lg.short}`, description: `${lg.name}, ${cfg.seasonName}`, icon: { up: '../../', key: lg.logo || 'hub' } }));
        await writeFile(path.join(ldir, 'sw.js'), swOf(sha(html)));
      }
      total += html.length;
    }
  }
}
await writeFile(path.join(root, 'dist/.nojekyll'), '');

// ---- data export: the current season as one JSON file (public data only: leagues, teams, players and our ids) ----
// dist/api/season.json on the stats site, and /data/season.json in the tools Worker (it checks captain access against it).
const seasonExport = {
  generatedAt: new Date().toISOString(), leagueId: cfg.leagueId, seasonId: cfg.seasonId, seasonName: cfg.seasonName, siteUrl: cfg.siteUrl,
  sections: cfg.sections.map((s) => ({ key: s.key, path: s.path, name: s.name })),
  leagues: leagues.map(({ lg, data }) => ({ slug: lg.slug, section: lg.section, path: pathOf(lg), sectionPath: sectionLinks[lg.section].path, name: lg.name, short: lg.short, theme: lg.theme, logo: lg.logo,
    teams: data.teams.map((t) => ({ id: t.id, abb: t.abb, name: nice(t.name), logo: t.logo })) })),
  people: Object.values(people).filter((p) => /^L\d+$/.test(p.id)).map((p) => ({ id: p.id, name: p.name, sex: p.sex,
    lg: Object.fromEntries(Object.values(p.in).flatMap((inst) => Object.entries(inst.leagues).map(([slug, m]) => [slug, m.teams]))),   // teams, main team first
    pos: Object.fromEntries(Object.values(p.in).flatMap((inst) => Object.entries(inst.leagues).map(([slug, m]) => [slug, (m.s ? 's' : '') + (m.g ? 'g' : '')]))) }))
};
await mkdir(path.join(root, 'dist/api'), { recursive: true });
await writeFile(path.join(root, 'dist/api/season.json'), JSON.stringify(seasonExport));

// ---- tools (Cloudflare Worker static assets): dist-tools/ = tools/public + the site look + the season data ----
const toolsOut = path.join(root, 'dist-tools');
// Empty the folder instead of deleting it: "wrangler dev" watches it, and Windows refuses to delete a watched folder.
await mkdir(toolsOut, { recursive: true });
for (const e of await readdir(toolsOut)) await rm(path.join(toolsOut, e), { recursive: true, force: true });
const copyDir = async (from, to) => {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    if (e.isDirectory()) await copyDir(path.join(from, e.name), path.join(to, e.name));
    else await writeFile(path.join(to, e.name), await readFile(path.join(from, e.name)));
  }
};
await copyDir(path.join(root, 'tools/public'), toolsOut);
await mkdir(path.join(toolsOut, 'assets'), { recursive: true });
await mkdir(path.join(toolsOut, 'data'), { recursive: true });
await writeFile(path.join(toolsOut, 'assets/site.css'), hubCss);                 // same tokens, badges and league logos as the site
await writeFile(path.join(toolsOut, 'assets/look.js'), await read('shared/look.js'));
await writeFile(path.join(toolsOut, 'assets/ranks.js'), await read('shared/ranks.js'));
await writeFile(path.join(toolsOut, 'data/season.json'), JSON.stringify(seasonExport));
console.log(`Built the home page, ${sections.length} sections (${sections.map((s) => s.path).join(', ')}) and ${leagues.length} leagues: ${leagues.map((l) => `${sectionLinks[l.lg.section].path}/${pathOf(l.lg)}`).join(', ')} (about ${(total / outDirs.length / leagues.length / 1024).toFixed(0)} KB each). ${Object.keys(people).length} people.`);
