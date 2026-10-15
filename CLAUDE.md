# LDHML Stats site: agent entry point

Read this file first. Then read the `docs/` file that matches your task (table at the end).
Each subfolder has its own `CLAUDE.md` with local rules.

## What this project is

A static stats site for the LDHML ball/dek hockey leagues. The leagues run on the NBHPA platform
(`league_id=10`, `season_id=4307`, "Automne 2026"). There are six leagues: `retro`, `vintage`, `draft`,
`3v3-a`, `3v3-b`, `4v4-b`. Each league has its own URL, theme and logo.

The first level of the site is the **section**: `draft` (draft leagues, `/draft/`) and `teams` (the other leagues,
working name "Équipes", `/equipes/`). An entry page (`/`) splits into the two sections. Each section page lists its
leagues and its people. Leagues are at `/<section>/<league>/`. The two sections are kept apart on purpose; links
between them are for navigation only.

**People:** each person has **our own id** (`L0001`) in `registry/people.json` (a source of truth, not a cache). The NBHPA
person id (`nid`) is the foreign key. NBHPA `player_id` values are aliases (one person can have several). A person has one
*instance* per section they play in. A rank exists **per position** (skater `s`, goalie `g`): the NBHPA rank now, our own
rank systems later (for example a draft "salary" under a salary cap).

**Phase 2 (planned, not built):** tools for league captains and admins (only these two roles), for example substitute
requests that arrive pre-validated with all the information needed for one-step approval. Goal: fewer admin tasks,
lean on security and permissions. It needs writes, sign-in and stored state, so it needs a backend: see `docs/open-items.md`.

- Live site: https://flyinwhee.github.io/ldhml-site/ (GitHub Pages, repo `FlyinWhee/ldhml-site`).
- The site is French by default, with an English toggle.
- The owner is Mathieu (RevOps lead, Joliette QC). He is not a developer. Reply to him in
  Simplified Technical English (ASD-STE100): short sentences, one idea each, active voice, and flag blockers early.

## The architecture in one paragraph

There is no backend. `build.mjs` inlines CSS, JS, JSON data and logos into one HTML file per league
(`dist/<section>/<league>/index.html`), one per section (`dist/<section>/index.html`) and one entry page (`dist/index.html`). The JSON in `data/` is only a **cache**
(a snapshot made by `scraper/fetch.mjs` on the owner's computer). When a visitor opens a page, the browser
reads the **public NBHPA endpoints directly** (CORS is open) and fills in or replaces the cache. The page
must be 100 % functional with live data, and fast with only the cache.

```
NBHPA public endpoints --(residential IP only)--> scraper/fetch.mjs --> data/<slug>/*.json (cache)
                                                                            |
leagues.json + site/* + shared/parsers.js + assets/ ---- build.mjs ---> dist/ (single-file pages + PWA files)
                                                                            |
                                   git push main --> GitHub Actions --> GitHub Pages
                                                                            |
 visitor's browser <-- page (cache inside) <-- reads NBHPA endpoints directly (site/js/3-live.js)
```

## Hard rules (do not break these)

1. **No server-side fetching of NBHPA from the cloud.** Cloudflare blocks data-center IPs (GitHub runners,
   Workers, Worker cron). Only a browser on a normal connection, or a script on the owner's computer or
   home server, can read the data. The Pages workflow builds only. It never fetches.
2. **Never request staff paths.** The official live page `https://admin.nbhpa.com/livegame/<id>` is only
   *linked* (see `feedLink` in `site/js/2-views.js`). Never fetch it. `site/test-live.mjs` fails if a request goes to `livegame/`, `admin/`, `socket` or `ajax`.
3. **Be polite.** One request at a time, with a pause. Nothing runs while `document.hidden`. A 429 pauses 5 minutes. All numbers are in `POLL` (`site/js/3-live.js`). The owner asked to keep rates low. Do not raise them without asking.
4. **A bad answer never replaces good data.** Check the shape of a response before you store it (both in the scraper and in the browser).
5. **No `cphjoliette.com` links or wording** anywhere on the site. The site is not tied to one team.
6. **No player photos.** Team logos are fine. (Photos are a permission risk.)
7. **Every team name and player name is a link** (`#team-<id>`, `#player-<id>`). Use the helpers in `1-core.js`; do not write plain names.
   A player link uses **our id** (`L0001`), never an NBHPA `player_id`. Box scores hold `player_id` values: map them with `U()` (or pass them to `pLink`, which does it).
8. **French and English.** Every visible string goes through `STR` in `site/js/1-core.js` (fr and en). Never hard-code a user-facing string in a view.
9. **Content links use class `lnk`, never `more`.** `.more` is the fixed mobile menu. Using it for a link breaks the mobile layout.
10. **Open legal question:** NBHPA has not given permission for outside sites to use their public endpoints and logos. The owner will raise it with them. Do not add new data sources or heavier polling before that talk. Do not claim the site is "official".
11. **Never change, reuse or delete an id in `registry/people.json`.** Do not regenerate the file. See `registry/CLAUDE.md`.

## Commands

```
npm install
npm run fetch:force      # refresh data/ from NBHPA (run on a residential connection only)
npm run registry         # give our id to new people of data/ (fetch does it too)
npm run build            # dist/
npm test                 # the full chain (see docs/testing.md). Must pass before every commit.
```

Open `dist/<section>/<league>/index.html` (for example `dist/draft/retro/index.html`) to see a league. The entry page is `dist/index.html`, a section is `dist/<section>/index.html`.

## Where to change what

| I want to change | Go to |
|---|---|
| A parser, or a field the source sends | `shared/parsers.js`, then `scraper/test.mjs` |
| A page (table, card, layout) | `site/js/2-views.js` and `site/style.css` |
| A number, a rule, a derived stat | `site/js/1-core.js` (`buildModel`) |
| Live behavior, polling | `site/js/3-live.js` (and `site/test-live.mjs`) |
| A text (fr/en) | `STR` in `site/js/1-core.js` (entry and section pages: `STR` in `site/hub/hub.js`) |
| Entry page, section pages, section player page | `site/hub/hub.js`, `site/hub/hub.css` |
| People, our ids, ranks per position | `registry/` (data), `scraper/registry.mjs`, `site/people.mjs`, `scraper/test-registry.mjs` |
| A league look | `site/themes.mjs` |
| Add a league, a section or a new season | `leagues.json` (see `docs/operations.md`) |
| PWA, icons, build output | `build.mjs`, `assets/` (see `docs/build-and-pwa.md`) |

## Working method (to avoid regressions)

1. Read the file you change **and** its tests. Read `docs/gotchas.md`.
2. Make the smallest change. Do not reformat files.
3. Run `npm test`. If you change behavior, add or extend a test in the same commit.
4. For anything visual, look at it: build, open `dist/<section>/<league>/index.html` (desktop and a 400 px wide window). jsdom tests do not see layout.
5. Commit with a clear message. For a big or risky change, push a branch first: its preview is at `/preview/<branch>/` (see `docs/operations.md`). Push to `main`. Pages deploys by itself in about a minute.
6. After a push, check the live site: https://flyinwhee.github.io/ldhml-site/<section>/<league>/.

## The docs

| File | Read it when |
|---|---|
| `docs/architecture.md` | You need the big picture: files, build, data flow, page model |
| `docs/data-formats.md` | You touch `data/*.json`, parsers, or the source endpoints |
| `docs/live-engine.md` | You touch polling, live games, the box score cache |
| `docs/frontend.md` | You touch views, routes, STR, styles, themes, the hub |
| `docs/build-and-pwa.md` | You touch `build.mjs`, the service worker, icons, the Artifact preview |
| `docs/testing.md` | You run or write tests. Has the manual regression checklist |
| `docs/operations.md` | Refresh data, deploy, add a league, start a new season, Unraid |
| `docs/gotchas.md` | Always. Known traps and past bugs |
| `docs/decisions.md` | You want to know why something is done this way, or what was tried and dropped |
| `docs/open-items.md` | You look for the next task |
