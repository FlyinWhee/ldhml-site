# Testing

`npm test` runs, in order (stops at the first failure):

| Step | File | Checks |
|---|---|---|
| 1 | `scraper/test.mjs` | Parsers with real markup samples (standings, players, goalies, schedule, recap, live JSON, `weighGoals`, `niceName`). |
| 1b | `scraper/test-registry.mjs` | Our ids: stable, never reused, one record per `nid`, aliases, refuses contradictions; people index (merge of two `player_id`, rank per position, own ranks per section); the committed registry covers every person in `data/`. |
| 2 | `node build.mjs` | The build itself (placeholders, data load). |
| 3 | `site/test-all.mjs` | Runs `site/test-ui.mjs <slug>` for every league of `leagues.json`. |
| 4 | `site/test-hub.mjs` | Entry page: one card per section, links, fr/en, no request. Section pages: one card per league of the section, picker, player list, every profile, links to league pages and the other section, polite requests. |
| 5 | `site/test-live.mjs` | Live engine with a fake clock and fake server (see below). |
| 6 | `site/test-pwa.mjs` | Manifest, icons, service worker, no SW in the preview build. |

All tests use **jsdom** (no real browser, no layout, no CSS cascade for visibility). No network is used.

## `test-ui.mjs` (per league)
Loads `dist/<section>/<league>/index.html`, then: opens every top-level route; every team page; every player page; every game page (played games must have a scoreboard and 2 box tables); follows every internal link and fails on a broken one; checks that every person has our id, that an old `player_id` link still works, that a person with two `player_id` rows is listed once, and the cross links; checks the theme attribute, the picker, the footer link to the hub, standings order, the number of team cards, no `cphjoliette` link, no all-caps names, theme toggle, and goal tooltips.
It fails on any page script error (`jsdomError`).

## `test-live.mjs`
Builds a fake NBHPA server inside the test (`calls[]` records every request) and a fake clock (`LDHML_NOW`). It checks: the live clock of tonight's game is read and only tonight's games; live badge, nav dot, LED digits, period clock, penalty time left; goalie name cleaning; step 1b: the schedule lists a running score yet the game stays LIVE (no FINAL); game page uses the live score; bad answers do not wipe data; politeness (>= 300 ms between requests, no staff endpoints); game over: badge gone, a stats refresh is planned; no-network message.
If you change polling, rules or the live markup, update this test in the same commit.

## What the tests do NOT cover
- Layout, overlap, mobile menu, fonts, colors, dark mode.
- Real NBHPA behavior (their markup can change; parser tests use copied samples dated 2026-10-09).
- Service worker behavior in a browser.
- English wording.

## Manual regression checklist (run before a push that changes UI or live code)
1. `npm test` passes.
2. Open `dist/equipes/retro/index.html` (a file is fine), plus `dist/index.html` and a section page with a player profile, at 1280 px and at 400 px wide. Visit: home, standings, a team, a player, a game with a box score, schedule, live.
3. Header: at 900-1100 px the nav is one row, or cleanly two rows. No overlap of links with the fixed mobile menu at 400 px.
4. Toggle language (EN) and theme; toggle dark mode. Check contrast on the live card and the scoreboard.
5. Open the league picker; switch league; footer link to the hub works.
6. Game night only (real data): `#live` shows LIVE badge, clock, score, goalies, penalty box only when someone is in it; click the top of a card: goes to the game page; the game page stays LIVE (not FINAL) while play continues; a finished game goes to the collapsed section below.
7. Network panel: requests are spaced, no `livegame/` page, nothing while the tab is in the background.
8. After push: https://flyinwhee.github.io/ldhml-site/<section>/<league>/ loads with fresh data; the footer is empty (no "offline" line).

## Writing a new test
Copy the style of an existing file: top-level `await`, `node:assert/strict`, one JSDOM, `console.log` at the end. Add it to the `test` script in `package.json`. Prefer testing behavior (what the visitor sees) over internals.
For parser tests, copy a small real sample into `scraper/test.mjs`; do not invent markup.
