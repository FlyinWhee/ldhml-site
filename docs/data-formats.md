# Data formats

All files are written by `saveLeague()` in `scraper/lib.mjs` as compact JSON (`JSON.stringify`, no spaces).
The browser keeps the same shapes in `D` and replaces them with live data in the same shapes.

## Source endpoints (host `admin.nbhpa.com`, CORS open, no sign-in)

| Data | Request | Response |
|---|---|---|
| Standings | `GET /table_data.php?order=pts_tiebreak DESC&group=team_id&league_id=&filters[][league_id]=&filters[][season_id]=&filters[][category_id]=&category_id=&public_site=1&class=Standings&fields[]=...&page=1` | JSON |
| Skaters | `POST /sites/site_stats_players.php?lang=fr` form `season_id, category_id, league_id` | HTML, data embedded as `stats_player` |
| Goalies | `POST /sites/site_stats_goalies.php?lang=fr` same form | HTML, same format |
| Schedule | `POST /sites/site_schedule_include.php?lang=fr` form + `view=list` | HTML rows |
| Box score | `GET /sites/site_game_recap.php?game_id=&league_id=10&lang=fr` | HTML |
| Live clock | `GET /livegame_json/<gameId>` | JSON, about 350 bytes |

The exact field list for standings is in `FIELDS` in `scraper/fetch.mjs` and in `3-live.js` (`FETCH.standings`). Keep both identical.

Not used on purpose: `https://admin.nbhpa.com/livegame/<id>` (official live page, linked only), any `admin/` path, WebSocket.

## `leagues.json`

```
{ leagueId, seasonId, seasonName, default, leagues: [ { slug, logo, categoryId, theme, short, name } ] }
```
`logo` is a key into `assets/logos` (`retro`, `vintage`, `draft`, `dek`). `theme` is a key in `site/themes.mjs`.

## `data/<slug>/meta.json`
`{ league:"LDHML", category, slug, name, season, leagueId, seasonId, categoryId, fetchedAt (ISO UTC), source }`.
`fetchedAt` drives box-score freshness (see live-engine.md).

## `teams.json` (array)
`{ id, name, abb, logo, pos, gp, w, l, t, otl, pts, gf, ga, diff, ppg }`. `pos` is the standings rank. `ppg` is points per game.
`id` is a string. `logo` is a path on admin.nbhpa.com.

## `games.json` (array)
`{ id, date "YYYY-MM-DD", time "HH:MM", venue, court, away, home, as, hs, cancelled }`.
`away`/`home` are team ids. `as`/`hs` are away/home score, `null` when not played. Times are Toronto local time.
`played(g)` = both scores not null. Note: the source also lists the **running score of a game in progress**.

## `players.json` / `goalies.json` (arrays)
Skater: `{ id, nid, name, sex "m"|"f", rank "H10", teams [abb], gp, g, a, p, pim, ppg, ppp, shg, shp, gwg, otg }`.
Goalie: `{ id, nid, name, sex, rank, teams, gp, w, l, t, sa, sv, ga, pct, gaa, gaat, so, g, a, pts, pim, mp, mpp, ppg_ }`.
`id` (source `player_id`) is the key used everywhere: links (`#player-<id>`), box scores, search. `nid` (source `nbhpa_player_id`) is the NBHPA-wide person id; the site does not use it.
There is **no birth date, age or photo**. `rank` is a skill level label (for example H10), not a standings rank.
`teams` has several entries when a person played for several teams. The stat line is then combined.

## `box.json`
```
{ names: { playerId: "M. BUREAU", ... },        // names seen in recaps (cleaned by niceName at load)
  games: { gameId: {
      t:  [ { id: teamId, sk: [ [playerId, number, G, A, PIM, PPG, PPP, SHG, SHP, GWG, OTG] ... ],
                          gk: [ [playerId, W, L, T, SA, SV, GA, SO, G, A, PIM] ... ] }, { ...second team } ],   // order = away, home as on the recap
      sh: [shotsTeam0, shotsTeam1],
      pg: [ [goals per period team0...], [goals per period team1...] ],
      goals: [ [period, "mm:ss", teamAbb, scorerId|null, [assistIds], runningTally, value|null] ... ],
      pens:  [ [period, "mm:ss", teamAbb, playerId|null, "description"] ... ],
      amb?: [teamAbb ...]                       // teams whose known goal values do not add up to the score
  } } }
```
Column order is fixed by `parseRecap`. Skater: recap columns B, A, PUN, BAN, PAN, BIN, PIN, BG, BE. Goalie: V, D, N/DP, TC, Arr, BC, BL, B, A, PUN. Read `parseRecap` before you change it. Other code reads these rows by index (`r[5]`...).
A recap of a game that has not started has `t: []`. `boxOf(id)` only accepts entries with exactly 2 teams.
**Old format:** goals with fewer than 6 items (before the tally was added). `boxMissing` treats them as missing and refetches them.

### Goal value (`goal[6]`)
The recap shows each scorer's running goal total. In mixed leagues a goal by a woman counts 2. `weighGoals(box, games, teams, players)`
computes the value of each goal as the step from the scorer's previous total (1 or 2). Team goals (no scorer) get `null`. If the known values do not add up to the final score, the team goes into `amb`. `weighGoals` runs in the scraper (`assemble`) and in the browser after a live recap.

## Live clock (`parseLive`)
`{ status, over, period, clock, gv, gh, sv, sh, penV[], penH[], goalieV, goalieH }`. `gv`/`gh` are visitor/home goals, `sv`/`sh` shots.
`penV/penH` are `{no, left}` (jersey number, time left). `status` is `"over"` at the end; anything else counts as live.
Goalie names come as `#30 - Name`; the prefix is removed.
Pre-game status values are matched by `isPre = /pre|not|sched|wait|upcom|ready/i`.

## Name cleaning (`niceName`)
Source names are inconsistent (`TOP GUN`, `Top Gun`). `niceName` fixes ALL-CAPS names; names with lower-case letters are untouched. Words of 1-2 letters, words without vowels and 3-letter non consonant-vowel-consonant words stay in capitals (`GI`, `TMNT`). If a 3-letter word is wrongly capitalised, add it to `WORDS` in `shared/parsers.js`. `buildModel` applies it to teams, players, goalies and box names.

## Known limits of the source
- Some goals have no scorer ("team goal"). Counted in team score, not in any player line.
- Penalties often have no player name.
- Saves and shots-against exist only when a goalie was recorded.
- Power-play, short-handed and overtime columns are hidden by the UI if all values are zero.
