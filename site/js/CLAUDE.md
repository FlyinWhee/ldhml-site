# site/js/

Three files, concatenated in file-name order into ONE function scope (after `shared/parsers.js`). A name declared in one file is visible in the next.

| File | Contains | Do not |
|---|---|---|
| `1-core.js` | `D`, `STR`/`COLS` (fr/en), `buildModel()`, `LIVE` state, `eff/boxOf/liveOf`, link helpers, table engine | Put DOM event wiring here. |
| `2-views.js` | views, `VIEWS`, `parseRoute`, `render`, header, search, event handlers | Fetch data here. |
| `3-live.js` | polling and live updates | Add requests without reading `../../docs/live-engine.md`. |

Style: ES5 (`var`, `function`, no arrow functions, no `import`/`class`). HTML is built as strings; escape with `esc()`.
Adding a file: name it `4-xxx.js` (order matters). Add a test.

Checklist for any change here:
1. New text? Add it to both `fr` and `en` in `STR` (and `COLS`).
2. Is a game final or live? Use `eff()`, `liveOf()`. Never `played()` alone.
3. Is it a name? Use `pLink` / `abbLinks` / `teamCell` / `crest`. Names must stay links. Teams look the same everywhere (`shared/look.js`, `../../docs/presentation.md`).
4. Is it a content link? Class `lnk`. Never `more`.
5. Does it change polling? Update `../test-live.mjs` and `../../docs/live-engine.md`.
6. Run `npm test`.
