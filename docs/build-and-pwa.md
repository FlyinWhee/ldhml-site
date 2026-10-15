# Build, PWA, Artifact preview

## `build.mjs` step by step
1. Read `leagues.json`, `shared/parsers.js`, `site/js/*.js` (sorted), `site/style.css`, `site/themes.mjs`.
2. `leagueJs` = parsers + core + views + live. `hubJs` = parsers + hub.js. `leagueCss` = style + `themeCss()`. `hubCss` = style + hub.css + `cardCss()`.
3. `fill(template, css, js, data)` replaces the 3 placeholders (it throws if one is missing).
4. Data per league: reads `data/<slug>/{meta,teams,games,players,goalies,box}.json`, applies `niceName`, builds a summary per league. Reads `registry/people.json` and builds the people index (`site/people.mjs`). Per section: the league list for the picker (`registry`) and the section page data (leagues, people of the section). Per league: `ids` (NBHPA ids to our ids, other leagues and sections of each person).
5. Logos: `assets/logos/<key>.webp` (page) and `<key>-icon.png` (tab icon) become data URIs.
6. `page()` wraps the fragment in a full HTML document: lang, `data-league`, viewport (`viewport-fit=cover`), title, description, icon, and the PWA tags and registration script when `pwa` is set.
7. Writes `dist/` and `dist/artifact/`. PWA files are written only in `dist/` (not artifact).
8. Prints a size summary. A league page is a few hundred KB (box scores are the bulk).

## PWA
- Per page: `manifest.webmanifest` (`display: standalone`, `scope` and `start_url` relative to the page), `sw.js`, icons in `dist/icons/` (copied from `assets/pwa/`).
- App names: `LDHML - <short>` for leagues (for example "LDHML - Retro"), `LDHML <section>` for sections ("LDHML Draft", "LDHML Équipes"), "LDHML" for the entry page. Set in `manifestOf` calls. The owner asked for this so the home-screen label is descriptive.
- `sw.js` (`swOf(version)`): `version` = first 10 hex of sha1 of the page HTML, so every content change makes a new cache. Install: cache `./`, `skipWaiting`. Activate: delete old `ldhml-*` caches, claim clients.
  Fetch: non-GET ignored; Google Fonts: cache-first with refresh; **any other cross-origin request is not intercepted** (NBHPA calls and team logos go straight to the network); navigation: network first, cache fallback offline; same-origin assets: cache first.
- Registration only on `https:` (`location.protocol === 'https:'`), so local `file://` use is unaffected.
- Not verified in a real browser: offline behavior after install. There is no custom "Install" button (the browser menu "Add to Home screen" works on Android).
- Icons come from the logos (`assets/pwa/<key>-192.png`, `-512.png`, `-maskable.png`; keys: hub, retro, vintage, draft, dek). To change an icon, replace the PNGs, keep the sizes.

## Artifact preview (`dist/artifact/`)
The owner views a copy in the Claude Artifact viewer. It is a different host: no service worker, no network to NBHPA (sandbox), the hub is a *fragment* (the host adds `<html>`). Live mode is blocked there; the page shows the snapshot. After a change to built output, republish the preview. Docs-only changes need no republish.

## Output size and limits
Single-file pages keep the site simple (no asset paths, works from a file). Cost: every page repeats CSS/JS. If a page grows beyond a few MB, move `box` data to a separate fetched JSON before anything else.

## Adding to the build
- New static asset: inline it as a data URI in `build.mjs`, or copy it into `dist/` in the same way as `icons/`.
- New page type: add a template, a `fill()` call and a test. `site/test-all.mjs` reads `leagues.json`, so new folders in `dist/` do not confuse it.
