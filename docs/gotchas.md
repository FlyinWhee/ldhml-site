# Gotchas and past bugs

Each item is a trap that already cost time. Check this list before a change.

## Live and data
1. **Running score in the schedule.** The schedule shows the score of a game in progress, so `played(g)` is true for live games. Use `eff(g)` / `liveOf(id)`. (Bug: live games showed FINAL and vanished from the live page.)
2. **Two live cycles at once** broke the polite-gap test (93 ms between recaps). The test hook waits for `liveBusy`. Do not call `run()` directly.
3. **Old box format.** Goals with fewer than 6 items have no tally/value. `boxMissing` refetches them. Do not remove that check until every cached box is new.
4. **Goal value.** Women's goals count 2 in mixed leagues. The value comes from the step in the scorer's running tally (`weighGoals`), never from sex alone.
5. **Cloudflare.** Data-center IPs are challenged: GitHub runners, Workers, Worker cron. Do not add a server-side fetch. The scraper must run from a residential IP (Windows PC or Unraid at home).
6. **The scraper refuses to overwrite** when parsing finds problems (`assemble().problems`). That is intended. Read the message; do not bypass it.
7. **`fetchedAt` drives freshness.** If you change what `meta.fetchedAt` means, `boxMissing` changes too.
8. Do not `fetch` `/livegame/<id>` (staff page). Test `test-live` fails on `livegame/`, `admin/`, `socket`, `ajax`.
9. `fetch.mjs` always fetches recaps for new games and the last 3 days. There is no flag to skip them.
10. Times are Toronto local time. `todayStr()` uses `America/Toronto`. Do not use the visitor's time zone.

## UI
11. **Class `more` is the fixed mobile menu** (`#more.more`). A content link with class `more` overlaps the page on mobile. Use `lnk`.
12. `.lose` hover specificity: there are explicit fixes in `style.css`; a new row style may need one.
13. Header: one row at 900 px and wider; `fitNav()` adds class `two` (second row) when the nav does not fit. Test at 900-1100 px after any nav label change (French labels are longer).
14. A variable named `LANG` does not exist; the language variable is `lang`. (Bug: ReferenceError in `viewTeams`.)
15. Teams page sorts by name with `localeCompare(..., {sensitivity:'base', numeric:true})`, not by standings.
16. Penalty row ("Au banc des pénalités") must be hidden when nobody is in the box (`liveOnIce`).
17. A full-screen "live frame" on the game page was tried and rejected by the owner. Only the scoreboard border (`.gboard:has(.livebadge)`) stays.
18. The whole top of a live card/scoreboard is one link (`.lv-head`, `.sbc-head`). Keep it a link; the owner asked for "click anywhere at the top".
19. Finished games on the live page go in a collapsed `<details class="lv-done" id="lvdone">` **below** the live section. The open state is kept in `LIVE.doneOpen`.

## Build and deploy
20. **Placeholders** `/*__CSS__*/`, `/*__JS__*/`, `/*__DATA__*/` are replaced with function replacers so `$` in code is safe. Keep it so.
21. JSON in `<script>` is escaped for `<`, U+2028, U+2029 (`safe()`). Keep using it.
22. `site/test-all.mjs` runs `test-ui` for every dir in `dist/` except `artifact` and `icons`. A new non-league dir in `dist/` must be excluded there.
23. The service worker version is a hash of the HTML, so each deploy refreshes it. The SW never intercepts cross-origin requests (NBHPA calls). Do not change that: it would cache live data.
24. In the Artifact preview, live mode is blocked by the sandbox. Do not "fix" that.
25. Syncing a stale working copy over the repo overwrote the Unraid section of README once. Always `git pull` before you edit.
26. `.gitattributes` forces line endings for the scripts (`.sh` must stay LF). Keep it.
27. `dist/` and `node_modules/` and `raw/` are git-ignored. Do not commit them.

## Environment
28. Playwright is not a project dependency. It was used from the build sandbox only. The repo tests use jsdom.
29. jsdom does not do layout. Mobile and overlap bugs need a real browser look.

## Tests tied to the data snapshot
30. `site/test-ui.mjs` has a Retro-only block (`if (slug === 'retro')`). Most checks there are now computed from `data/` (top scorer, upcoming games, last night, multi-team players). Some names are still fixed: leader "Ghostbusters" in the standings, player "Michael Jobin", game `2539180` (scorer "Bellerose"), band text "TOP", search "gagnon", filter "lévesque". A data refresh can break them (it happened on 2026-10-15). When the test fails after a refresh and the page looks right, fix the test to read the value from `data/` instead of editing the data.
