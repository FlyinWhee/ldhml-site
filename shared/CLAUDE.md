# shared/

`look.js` (`LDLook`) holds how teams look on every page: colours, badges, code chips. ES5, browser only (inlined into every page), returns HTML strings. Read `../docs/presentation.md`. A change here changes every page.

`ranks.js` (`LDRanks`) holds rank scales: which rank is stronger, sorting, ranges. A lower NBHPA number is stronger. Browser and Node (`scraper/test-registry.mjs` tests it). Sub validation will use it.

`parsers.js` runs in two places: the browser (inlined into every page) and Node (`scraper/lib.mjs`, `build.mjs`). It exports `LDParsers` on `globalThis`/`window`.

`refresh.js` (`LDRefresh`) holds the steps of the data refresh: the NBHPA requests, `assemble` (the checks), the files of a league, our person ids (`syncRegistry`, `serializeRegistry`). Node (`scraper/fetch.mjs`, `lib.mjs`, `registry.mjs`) and the tools admin (Données du site public). It is never inlined into the stats site, so it may use `async` (an exception to the ES5 rule below). A change here changes the script AND the admin page: run `npm test`.

Rules (look, ranks, parsers):
- ES5 only, no imports, no Node APIs. The only host API it needs is `DOMParser` (jsdom provides it in Node).
- A change here changes the scraper AND the live page. Update `scraper/test.mjs` with a **real** markup sample.
- Functions: `niceName`, `parseStandings`, `parsePlayers`, `parseGoalies`, `parseSchedule`, `parseRecap`, `parseLive`, `weighGoals`.
- Row shapes are documented in `../docs/data-formats.md`. Views read box rows by index; changing a column order breaks them.
- `parseRecap` depends on the markup of `site_game_recap.php`. If NBHPA changes it, the scraper reports "unexpected page layout" and skips the game; the live page fetches nothing new.
