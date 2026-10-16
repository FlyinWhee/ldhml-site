// Seed the LOCAL tools database from the stats data, for tests: the current season, its teams, the people,
// the player list of each section, and each player on their main team (most games) at their main position.
// No salaries, no birth dates (the league file will bring them). Safe to run again: existing rows stay.
//   node tools/scripts/seed-local.mjs          (after npm run build; local database only, never --remote)
//   node tools/scripts/seed-local.mjs --demo   also FAKE salaries (from the stats, 2 to 6; goalies 4; Retro teams under
//                                              the 41 cap), fake birth dates (only where empty) and Retro rules. Never real data.
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

/** Demo salaries for local tests only (never real data), per section, from the season's stats:
 *  skaters by points per game (pulled toward the average when few games), ranked and spread from 2 to 6 in steps
 *  of 0.5 (2 when no skater games); every goalie salary is 4 (owner, for testing).
 *  Then every Retro team (main team, main position, as the seed puts them) is brought under the cap: its best-paid
 *  skater loses 0.5 until the team fits. stats = { slug: { players } } (data/<slug>/*.json).
 *  Returns Map "section:L0001" -> { s, g }. */
export function demoSalaries(data, reg, stats, caps = { retro: 41 }) {
  const byNid = new Map(), byPid = new Map();
  for (const p of reg.people || []) { if (p.nid) byNid.set(String(p.nid), p.id); for (const x of p.pids || []) byPid.set(String(x), p.id); }
  const who = (row) => byNid.get(String(row.nid)) || byPid.get(String(row.id));
  const sectionOf = Object.fromEntries(data.leagues.map((l) => [l.slug, l.section]));
  const acc = new Map();   // "section:id" -> { gp, p }
  const get = (k) => { if (!acc.has(k)) acc.set(k, { gp: 0, p: 0 }); return acc.get(k); };
  for (const [slug, st] of Object.entries(stats)) {
    const sec = sectionOf[slug];
    if (!sec) continue;
    for (const r of st.players || []) { const id = who(r); if (id) { const a = get(sec + ':' + id); a.gp += r.gp || 0; a.p += r.p || 0; } }
  }
  const spread = (list) => {   // [[key, score]] -> Map key -> salary 2..6 by rank
    const sorted = list.slice().sort((x, y) => x[1] - y[1]), n = sorted.length, out = new Map();
    sorted.forEach(([k], i) => out.set(k, 2 + Math.round((n > 1 ? i / (n - 1) : 0.5) * 8) / 2));
    return out;
  };
  const all = [...acc.entries()];
  const sk = spread(all.filter(([, a]) => a.gp > 0).map(([k, a]) => [k, a.p / (a.gp + 1)]));
  const sal = new Map();
  for (const p of data.people) for (const sec of new Set(Object.keys(p.lg).map((s) => sectionOf[s]))) {
    const k = sec + ':' + p.id;
    sal.set(k, { s: sk.get(k) ?? 2, g: 4 });
  }
  for (const [slug, cap] of Object.entries(caps)) {
    const lg = data.leagues.find((l) => l.slug === slug);
    if (!lg) continue;
    for (const t of lg.teams) {
      const members = data.people.filter((p) => p.lg[slug] && p.lg[slug][0] === t.abb)
        .map((p) => ({ v: sal.get(lg.section + ':' + p.id), pos: (p.pos && p.pos[slug]) === 'g' ? 'g' : 's' }));
      const total = () => members.reduce((x, m) => x + m.v[m.pos], 0);
      while (total() > cap) {
        const top = members.filter((m) => m.pos === 's' && m.v.s > 2).sort((a, b) => b.v[b.pos] - a.v[a.pos])[0];
        if (!top) break;
        top.v[top.pos] -= 0.5;
      }
    }
  }
  return sal;
}

/** Demo values for local tests only: the salaries above (only where empty), fake birth dates (the same on every run,
 *  only where empty) and Retro rules if none (cap 41; ages 40, 35, 30). */
export function demoSql(data, reg, stats, now = Math.floor(Date.now() / 1000)) {
  const h = (str, salt) => { let x = salt; for (const c of str) x = (x * 31 + c.charCodeAt(0)) % 100003; return x; };
  const S = `(SELECT id FROM seasons WHERE nbhpa_season_id = ${data.seasonId} ORDER BY id LIMIT 1)`;
  const sal = demoSalaries(data, reg, stats);
  const out = [];
  for (const p of data.people) {
    const P = `(SELECT id FROM people WHERE site_id = ${sq(p.id)})`;
    out.push(`UPDATE people SET birth_year = ${1958 + (h(p.id, 3) % 41)}, birth_month = ${1 + (h(p.id, 5) % 12)} WHERE site_id = ${sq(p.id)} AND birth_year IS NULL;`);
  }
  for (const [k, v] of sal) {
    const [sec, id] = k.split(':');
    out.push(`UPDATE section_players SET salary_s = ${v.s}, salary_g = ${v.g} WHERE season_id = ${S} AND section = ${sq(sec)} AND person_id = (SELECT id FROM people WHERE site_id = ${sq(id)}) AND salary_s IS NULL AND salary_g IS NULL;`);
  }
  out.push(`INSERT OR IGNORE INTO league_rules (season_id, league, salary_cap, min_age_m, min_age_f, min_age_g, notes, updated_at) VALUES (${S}, 'retro', 41, 40, 35, 30, 'DÉMO : plafond et âges de test', ${now});`);
  out.push(`INSERT INTO audit (at, actor_kind, action, target, detail) VALUES (${now}, 'system', 'seed.demo', 'season:' || ${S}, '{"by":"seed-local script --demo"}');`);
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--remote')) { console.error('The seed is for the LOCAL database only. The real database gets the league file.'); process.exit(1); }
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let data, reg;
  try { data = JSON.parse(readFileSync(path.join(root, 'dist/api/season.json'), 'utf8')); } catch { console.error('Run "npm run build" first (dist/api/season.json).'); process.exit(1); }
  reg = JSON.parse(readFileSync(path.join(root, 'registry/people.json'), 'utf8'));
  const stats = Object.fromEntries(data.leagues.map((l) => { try { return [l.slug, { players: JSON.parse(readFileSync(path.join(root, 'data', l.slug, 'players.json'), 'utf8')) }]; } catch { return [l.slug, {}]; } }));
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ldhml-')), 'seed.sql');
  writeFileSync(file, seedSql(data, reg) + (process.argv.includes('--demo') ? '\n' + demoSql(data, reg, stats) : ''));
  const r = spawnSync('npx', [WRANGLER, 'd1', 'execute', 'ldhml-tools', '--local', '-c', path.join(root, 'tools/wrangler.jsonc'), '--file', file], { stdio: 'inherit', shell: process.platform === 'win32' });
  rmSync(path.dirname(file), { recursive: true, force: true });
  process.exit(r.status ?? 1);
}
