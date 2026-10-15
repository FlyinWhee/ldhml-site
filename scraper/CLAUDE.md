# scraper/

Node scripts that fill `../data/`. Run them only from a residential connection (see `../docs/operations.md`).

- `lib.mjs`: `assemble(raw, lg, cfg, oldBox)` turns raw responses into snapshot files and reports `problems`; `saveLeague`; `readJson`; sets up jsdom `DOMParser` and loads `../shared/parsers.js`.
- `registry.mjs`: our person ids (`../registry/people.json`). `syncFromData()` runs at the end of `fetch.mjs` and `import-raw.mjs`; `npm run registry` runs it alone. Tested by `test-registry.mjs`.
- `fetch.mjs`: network. About 4 requests per league + recaps for new games and the last 3 days. 1.5 s pause. Does not overwrite on problems.
- `import-raw.mjs`: same assembly from a saved raw JSON file.
- `test.mjs`: parser tests with real samples. Part of `npm test`.

Rules: stay polite (pauses, clear User-Agent, no parallel requests). Keep the request shapes equal to `site/js/3-live.js` (`FETCH`, `fetchRecap`). Never write data that failed the checks in `assemble`.
