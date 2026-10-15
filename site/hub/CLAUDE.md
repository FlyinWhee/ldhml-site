# site/hub/

The LDHML entry page (`/`) and the section pages (`/<section>/`, `H.kind`). A small standalone app: `hub.html` (shell), `hub.css`, `hub.js`.
It gets `hubData` (league summaries, logos) from `build.mjs` in `<script id="hub-data">`.
It has its own `STR` (fr/en). It shares storage keys `ldhml-lang` and `ldhml-theme` with the league pages.
On load a section page reads its leagues' standings from the API (the entry page makes no request), one request at a time, and stops after failures.
`window.LDHML_NOW` (a string like `2026-10-09T10:00:00`) fakes today's date; used by `../test-hub.mjs` only.
Per-league card colors come from `cardCss()` in `../themes.mjs`.
