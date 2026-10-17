// Does the public site show the live season of the tools? Compares leagues.json (what the stats site fetches and builds)
// with the tools' live season (GET /api/public/season: name, NBHPA season no., leagues switched off; no personal data).
//   node scripts/season-check.mjs [tools address]     default: $TOOLS_URL, else http://localhost:8787 (the local tools)
// Exit 0: they agree. Exit 1: they differ (the steps are printed). Exit 2: the tools do not answer.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(root, 'leagues.json'), 'utf8'));
const base = (process.argv[2] || process.env.TOOLS_URL || 'http://localhost:8787').replace(/\/+$/, '');

let live;
try {
  const r = await fetch(base + '/api/public/season');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  live = (await r.json()).season;
} catch (e) {
  console.error(`The tools at ${base} do not answer (${e.message}). Start them (scripts\\tools-dev.bat) or give their address.`);
  process.exit(2);
}
console.log(`Public site (leagues.json): ${cfg.seasonName}, NBHPA season ${cfg.seasonId}, ${cfg.leagues.length} leagues.`);
if (!live) { console.log('Tools: no live season (en cours). Choose one in the admin area: Configuration, Modifier, Statut: En cours.'); process.exit(1); }
console.log(`Tools live season: ${live.name}, NBHPA season ${live.nbhpa_season_id ?? '(none)'}${live.leagues_off.length ? ', switched off: ' + live.leagues_off.join(', ') : ''}.`);

const problems = [];
if (live.nbhpa_season_id !== cfg.seasonId) problems.push(`The NBHPA season differs (${cfg.seasonId} on the public site, ${live.nbhpa_season_id ?? 'none'} in the tools).
  If the tools are right: in leagues.json set "seasonId": ${live.nbhpa_season_id} and "seasonName": "${live.name}", check each league's "categoryId"
  against the official standings page, delete data/, run npm run fetch:force (at home), npm test, push. See docs/operations.md, "New season".
  If the site is right: in the admin area, make the season with NBHPA no. ${cfg.seasonId} the current one (Configuration, Modifier).`);
else if (live.name !== cfg.seasonName) problems.push(`Same NBHPA season, other name ("${cfg.seasonName}" on the public site, "${live.name}" in the tools). Make them the same (leagues.json "seasonName", or the season name in Configuration).`);
const shown = cfg.leagues.map((l) => l.slug), off = live.leagues_off.filter((s) => shown.includes(s));
if (off.length) problems.push(`Leagues switched off this season in the tools but still on the public site: ${off.join(', ')}. Remove them from leagues.json (and their data/<league>/ folder), or switch them back on in Configuration.`);

if (!problems.length) { console.log('OK: the public site shows the live season.'); process.exit(0); }
console.log('\n' + problems.map((p, i) => `${i + 1}. ${p}`).join('\n\n'));
process.exit(1);
