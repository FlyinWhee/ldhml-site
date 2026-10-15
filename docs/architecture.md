# Architecture

## Repository map

```
leagues.json            Sections, league list, league_id, season_id, category ids, themes, rank systems. The one config file.
build.mjs               Static build. Inlines everything into single-file pages. Also writes PWA files.
package.json            Scripts. Only dependency: jsdom (scraper and tests).
shared/parsers.js       Parsers for NBHPA responses. Runs in the browser AND in Node (global LDParsers).
shared/look.js          How teams look on every page: colours, badges, code chips (global LDLook). See docs/presentation.md.
scraper/                Node scripts that fill data/ (fetch, import-raw, lib), registry.mjs (our ids), and their tests.
data/<slug>/*.json      Cache: meta, teams, games, players, goalies, box. Committed to git.
registry/people.json    Our person ids (L0001) with the NBHPA id as foreign key. Source of truth, NOT a cache. Committed.
site/template.html      Page shell of a league page (placeholders for CSS, JS, data).
site/style.css          All CSS (shared by hub and league pages).
site/themes.mjs         Per-league theme tokens. build.mjs turns them into CSS.
site/js/1-core.js       Data model, STR (fr/en), helpers, tables. Opens the shared IIFE.
site/js/2-views.js      Routes, views, header, search, events.
site/js/3-live.js       Live engine (polling NBHPA from the browser).
site/people.mjs         Build-time people index: person > section instance > league (pure function).
site/hub/               Entry page and section pages (hub.html, hub.css, hub.js). Separate small app.
site/test-*.mjs         jsdom tests of the built pages.
assets/logos/           League logos (WebP for pages, PNG for tab icon). Inlined as data URIs.
assets/pwa/             PWA icons per logo (192, 512, maskable). Copied to dist/icons.
scripts/                refresh.bat (Windows) and unraid-refresh.sh: run the scraper and push data/.
.github/workflows/      Pages deploy (build only), with a preview of each branch (preview.yml starts it).
docs/                   This documentation.
```

## The three layers of data

1. **Source:** public NBHPA endpoints on `admin.nbhpa.com` (see `data-formats.md`).
2. **Cache (`data/`):** made by `scraper/fetch.mjs`. Committed. Baked into every page at build time. It makes the first paint instant and keeps the site useful if NBHPA is slow or blocks the visitor.
3. **Live (`3-live.js`):** in the browser. Reads the source, compares with what the page holds, and replaces or fills in. Never required: if every request fails, the cache is shown and the footer says live data is not available.

The scraper and the browser use the **same parsers** (`shared/parsers.js`). A change to a parser changes both.

## Build output

`node build.mjs` writes:

```
dist/index.html                       entry page (one card per section)
dist/<section>/index.html             section page (2): leagues, players, player profiles
dist/<section>/<league>/index.html    one per league (6), for example dist/draft/retro/
dist/<page>/manifest.webmanifest, dist/<page>/sw.js    PWA files, per page (entry, sections, leagues)
dist/icons/*.png                PWA icons (shared)
dist/artifact/...               same tree for the Artifact preview (entry page is a fragment, no PWA files)
dist/preview/<branch>/...       (on Pages only) the same site built from another branch
dist/.nojekyll
```

Every page is **one self-contained HTML file**: CSS, JS, JSON data, and logos (data URIs) are inline.
Only Google Fonts load from outside (Hanken Grotesk, Teko, and Playfair Display on vintage/hub).
Team logos load from `admin.nbhpa.com` at runtime (`team.logo` is a relative path on that host).

JS concatenation order (it matters, all files share one scope):
`shared/parsers.js`, `shared/look.js`, then `site/js/*.js` sorted by file name (`1-core`, `2-views`, `3-live`).
The template wraps the result in `(function(){ 'use strict'; ... })();`. So **a variable declared in
1-core.js is visible in 2-views.js and 3-live.js**. Names are global to that IIFE; avoid collisions.

## Runtime model inside a league page

- `D` = parsed `#league-data` JSON: `meta, teams, games, players, goalies, box, league, section, sections, registry, ids, base, root`.
  `registry` = the leagues of this section (for the picker). `base` = `../` (section page), `root` = `../../` (entry page).
  `ids` = `{ pids: { player_id: our id }, nids: { nid: our id }, who: { our id: { lg: [other leagues of the section], xs: [other sections] } } }`.
- People: `buildModel()` first maps every stats row to our id (by `nid`; a person not in the registry gets `n<nid>`) and adds up the rows
  of one person (NBHPA can give one person several `player_id`). `PID` maps `player_id` to our id; `U(id)` applies it. Box rows hold
  `player_id`, so code that reads box rows uses `U()`. `people[id].rank` is `{ s, g }` (a rank per position).
- `buildModel()` (1-core.js) derives lookups from `D`: `teams`, `T` (by id), `TA` (by abb), `games`, `gameById`,
  `results`, `BOX`, `logS/logG` (per-player game logs from box scores), `splitS/splitG` (per-player, per-team splits),
  `skaters`, `goalies` (scoped list, see below), `people` (one entry per person, with `.skater` and `.goalie`).
- The live engine mutates `D` (new standings, games, players, box scores) and sets `LIVE.modelDirty`; `flush()` calls `buildModel()` and re-renders.
- State kept in the page: `ui` (sort, filters), `SCOPE`, `lang`, `LIVE`. Nothing else is global.
- Storage (all optional, wrapped in try/catch): `ldhml-lang`, `ldhml-theme`, `ldhml-scope`.

### Scope: "main team" vs "all"

A person may play for several teams (substitutes). The source gives ONE combined stat line. With
`SCOPE = 'main'` (default) the page rebuilds per-team lines from box scores (`splitS/splitG`) and shows the
person on their *main* team (most games; tie goes to the latest game) with a `SUB:` list of the other teams.
With `SCOPE = 'all'` the combined line from the source is shown. If the box scores for a person are missing,
the combined line is used as a fallback. This is why box scores for **all played games** must be loaded (see `live-engine.md`, "Cache-first box scores").

### Live overlay

`eff(g)` returns a game with the live score when a live clock exists. A game that has a live clock is
**never final**, even if the schedule already lists a running score. See `live-engine.md`.

## Routing

Hash routes, parsed in `parseRoute()` (2-views.js): `#home` (default), `#standings`, `#schedule`, `#players`,
`#goalies`, `#leaders`, `#live`, `#teams`, `#team-<id>`, `#player-<id>`, `#game-<id>`. Unknown hash goes to home.
`#player-<id>` takes our id; an old link with an NBHPA `player_id` still works (`parseRoute` maps it with `U`).
The entry page is `/`, sections are `/<section>/`, leagues are `/<section>/<league>/`. Deep links with hash work on GitHub Pages.

## Entry page and section pages

`site/hub/hub.js` is a small standalone app with two kinds of page (`H.kind`). It shares `style.css` and the parsers, not the league JS.
- `root` (`/`): one card per section (leagues, teams, players, next game night). It makes **no** request to NBHPA.
- `section` (`/<section>/`): one card per league of the section (leader, top scorer, next game nights). Routes `#home`, `#players` (list with
  NBHPA ranks per position), `#player-<id>` (profile in this section: ranks, our own ranks, one line per league, links to the league pages and
  to the other section). On load it re-reads the standings of its leagues from the API (one at a time, stops after 2 failures).
  The people data is the snapshot (the league pages have the live numbers).

## People and sections

```
person (our id L0001, NBHPA nid)           registry/people.json + NBHPA name, sex, rank { s, g }
 └─ instance per section (draft, teams)    our own ranks (rankSystems of that section), leagues
     └─ league membership                  teams, skater line s, goalie line g
```
`site/people.mjs` builds this at build time from `data/` and the registry. A section page gets only its own instances.
