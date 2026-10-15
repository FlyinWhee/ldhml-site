# shared/

`look.js` (`LDLook`) holds how teams look on every page: colours, badges, code chips. ES5, browser only (inlined into every page), returns HTML strings. Read `../docs/presentation.md`. A change here changes every page.

`parsers.js` runs in two places: the browser (inlined into every page) and Node (`scraper/lib.mjs`, `build.mjs`). It exports `LDParsers` on `globalThis`/`window`.

Rules:
- ES5 only, no imports, no Node APIs. The only host API it needs is `DOMParser` (jsdom provides it in Node).
- A change here changes the scraper AND the live page. Update `scraper/test.mjs` with a **real** markup sample.
- Functions: `niceName`, `parseStandings`, `parsePlayers`, `parseGoalies`, `parseSchedule`, `parseRecap`, `parseLive`, `weighGoals`.
- Row shapes are documented in `../docs/data-formats.md`. Views read box rows by index; changing a column order breaks them.
- `parseRecap` depends on the markup of `site_game_recap.php`. If NBHPA changes it, the scraper reports "unexpected page layout" and skips the game; the live page fetches nothing new.
