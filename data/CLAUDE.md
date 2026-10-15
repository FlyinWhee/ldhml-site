# data/

Cache of NBHPA data, one folder per league slug: `meta, teams, games, players, goalies, box` (`.json`, compact).
Written by `../scraper`. **Committed to git** and inlined into the pages by `../build.mjs`. It is a cache, not a source of truth.

- Do not edit by hand. Run `npm run fetch:force`.
- Do not reformat (the files are single-line JSON on purpose; diffs of refreshes are the only changes).
- Shapes: `../docs/data-formats.md`.
- New season: remove old files first (see `../docs/operations.md`), otherwise old box scores stay.
- A missing or partial cache is allowed: the page fills gaps from live data.
