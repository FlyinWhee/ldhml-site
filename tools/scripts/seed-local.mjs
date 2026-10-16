// Seed the LOCAL tools database from the stats data, for tests: the current season, its teams, the people,
// the player list of each section, and each player on their main team (most games) at their main position.
// No salaries, no birth dates (the league file will bring them). Safe to run again: existing rows stay.
//   node tools/scripts/seed-local.mjs        (after npm run build; local database only, never --remote)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WRANGLER = 'wrangler@4.151.1'; // same version as the npm scripts (package.json)
const sq = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const seasonKey = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The seed SQL (tested in tools/test/test-tools.mjs). data = dist/api/season.json, reg = registry/people.json. */
export function seedSql(data, reg, now = Math.floor(Date.now() / 1000)) {
  const nid = new Map((reg.people || []).map((p) => [p.id, p.nid]));
  const S = `(SELECT id FROM seasons WHERE nbhpa_season_id = ${data.seasonId} ORDER BY id LIMIT 1)`;
  const out = [];
  out.push(`INSERT INTO seasons (key, name, nbhpa_season_id, status, created_at) SELECT ${sq(seasonKey(data.seasonName))}, ${sq(data.seasonName)}, ${data.seasonId}, 'active', ${now}
    WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE nbhpa_season_id = ${data.seasonId}) AND NOT EXISTS (SELECT 1 FROM seasons WHERE key = ${sq(seasonKey(data.seasonName))});`);
  for (const l of data.leagues) for (const t of l.teams)
    out.push(`INSERT OR IGNORE INTO teams (season_id, league, name, abb, nbhpa_team_id, created_at) VALUES (${S}, ${sq(l.slug)}, ${sq(t.name)}, ${sq(t.abb)}, ${sq(t.id)}, ${now});`);
  const sectionOf = Object.fromEntries(data.leagues.map((l) => [l.slug, l.section]));
  for (const p of data.people) {
    out.push(`INSERT OR IGNORE INTO people (site_id, nid, name, sex, created_at) VALUES (${sq(p.id)}, ${sq(nid.get(p.id) || null)}, ${sq(p.name)}, ${sq(p.sex === 'm' || p.sex === 'f' ? p.sex : null)}, ${now});`);
    const P = `(SELECT id FROM people WHERE site_id = ${sq(p.id)})`;
    for (const sec of [...new Set(Object.keys(p.lg).map((slug) => sectionOf[slug]).filter(Boolean))])
      out.push(`INSERT OR IGNORE INTO section_players (season_id, section, person_id, created_at) VALUES (${S}, ${sq(sec)}, ${P}, ${now});`);
    for (const [slug, teams] of Object.entries(p.lg)) {
      const lg = data.leagues.find((l) => l.slug === slug), main = lg && lg.teams.find((t) => t.abb === teams[0]);
      if (!main) continue;
      const pos = (p.pos && p.pos[slug]) === 'g' ? 'g' : 's';
      out.push(`INSERT OR IGNORE INTO rosters (season_id, league, team_id, person_id, pos, added_at)
        SELECT ${S}, ${sq(slug)}, t.id, ${P}, '${pos}', ${now} FROM teams t WHERE t.season_id = ${S} AND t.league = ${sq(slug)} AND t.nbhpa_team_id = ${sq(main.id)};`);
    }
  }
  out.push(`INSERT INTO audit (at, actor_kind, action, target, detail) VALUES (${now}, 'system', 'seed.local', 'season:' || ${S}, '{"by":"seed-local script"}');`);
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--remote')) { console.error('The seed is for the LOCAL database only. The real database gets the league file.'); process.exit(1); }
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let data, reg;
  try { data = JSON.parse(readFileSync(path.join(root, 'dist/api/season.json'), 'utf8')); } catch { console.error('Run "npm run build" first (dist/api/season.json).'); process.exit(1); }
  reg = JSON.parse(readFileSync(path.join(root, 'registry/people.json'), 'utf8'));
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ldhml-')), 'seed.sql');
  writeFileSync(file, seedSql(data, reg));
  const r = spawnSync('npx', [WRANGLER, 'd1', 'execute', 'ldhml-tools', '--local', '-c', path.join(root, 'tools/wrangler.jsonc'), '--file', file], { stdio: 'inherit', shell: process.platform === 'win32' });
  rmSync(path.dirname(file), { recursive: true, force: true });
  process.exit(r.status ?? 1);
}
