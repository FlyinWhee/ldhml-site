# Live engine (`site/js/3-live.js`)

Runs in the visitor's browser. It reads public NBHPA pages and updates the page. It is the most delicate file:
most past bugs were here. Read `gotchas.md` first. Tests: `site/test-live.mjs`.

## Design rules
- Cache first. The page starts from `D` (built-in snapshot). Live data fills in or replaces it.
- One request at a time (`enqueue`, a promise chain) with a pause (`gap` 1200 ms; `gapSmall` 400 ms for the 350-byte clock).
- Nothing runs while `document.hidden`. A `visibilitychange` to visible triggers a tick.
- A 429 sets `LIVE.pauseUntil` (5 minutes). Errors back off.
- A bad answer never replaces good data. Schedule: rejected if it has no rows, fewer than 80 % of the known games, or a row without id/away/home/date. Equivalent checks exist for standings, players, goalies.
- It never requests staff paths. The official page is only linked (`feedLink`).

## Constants (`POLL`)
| Name | Value | Meaning |
|---|---|---|
| `tickMs` | 5000 | The scheduler wakes every 5 s. It decides what is due. It does not mean a request every 5 s. |
| `live` | 30000 | Re-read the clock of a live game every 30 s |
| `pre` | 90000 | Re-read a game that has not started (inside the window) |
| `none` | 120000 | Re-read after "no live record" (grows with failures, max 180 s) |
| `recap` | 120000 | Box score of a live game, only while somebody looks at it |
| `timeout` | 12000 | Abort a request after 12 s |
| `ttl` | standings 10 min (5 on game night), schedule 15 (5), players 15 (10), goalies 15 (10) | Age before a page-level refresh |

The owner wants low rates. Change these only on request.

## What is read, when
`NEED[route]` lists which datasets the visible page needs; `staleKinds()` returns those older than their TTL:

| Route | Datasets |
|---|---|
| home | standings, schedule |
| standings | standings, schedule |
| schedule | schedule |
| players / goalies | players / goalies |
| leaders | players, goalies |
| team | standings, schedule, players, goalies |
| player | players, goalies, schedule |
| game | schedule |
| live | schedule, standings |

Request shapes live in `FETCH` (`standings`, `schedule`, `players`, `goalies`) and `fetchRecap(g)`. They copy the scraper's requests. Keep them equal.

## Game clocks
`inWindow(g)`: today's games, from 30 min before the start until 110 min after (up to 4 h while the game is live). Only these games are polled (`/livegame_json/<id>`).
`pollLive` sets `LIVE.games[id] = { state, lv, next, fail, recapAt }` with `state` in `none | pre | live | over`.
A game with no live record answers 404 without CORS headers: the browser sees a network error. That is normal before a game.
When a game turns `over`: `LIVE.settleAt = now + 20 s`. After that, standings/schedule/players/goalies are forced to refresh once, and the box score is fetched. `settleCheck` retries (every 2 min, up to 6 times) until the schedule shows the final score.

## FINAL vs LIVE (the bug that happened)
The league schedule lists the **running score** of a game in progress. `played(g)` (both scores set) would then say FINAL.
Rule: **the live clock decides.** `eff(g)` (1-core.js): if `LIVE.games[id].state === 'live'`, the game is live with the clock's score, whatever the schedule says.
`fetchRecap` marks a recap as final only if `played(game) && !liveOf(id)`. `boxMissing` and `BX.fresh` skip live games.
Test: `site/test-live.mjs` step "1b". Never use `played(g)` alone to decide "final" in a view; use `eff()`/`liveOf()`.

## Cache-first box scores
Box scores of finished games never change (except corrections in the first days). The build seeds `D.box.games`. The page computes the difference with the live schedule:

- `boxNeeds(route)`: which played games this page needs. `SCOPE='main'` (default) or `route=standings`: all played games. `SCOPE='all'`: game page: that game; team: that team's games; player: games of the player's teams; home/live: games of the last game day and today. Tonight's games are always added.
- `boxMissing(g)`: true if the game is played, not cancelled, not live, not in `BX.fresh`, and either has no box, or has a goal row shorter than 6 items (old format), or its date is on/after `meta.fetchedAt - 3 days` (corrections).
- Per tick: at most 3 recap fetches (`todo.slice(0,3)`). A failure sets `BX.fail[id] = now + 2 min`.
- `BX.total` feeds the pill `#boxload` ("Loading N game(s)..."). It hides when offline.
- After a fetch: `D.box.games[id] = game` (final) or `LIVE.recap[id]` (live), `modelDirty` triggers `buildModel()`.

## Rendering
`flush()`: if data changed, rebuild the model and search index, re-render the chrome when the set of live games changes (nav dot), and re-render the view unless the user is typing in an input (`typing()`, except the global search box). `render(true)` keeps scroll.
`updateFresh()`: the footer line `#fresh` says something only when live data is not available.

## Test hook
`window.LDHML_TEST = { tick, state: LIVE, data: D }`. `tick()` waits for `liveBusy` (so two cycles never run at once). `window.LDHML_NOW` can fake the clock; `window.LDHML_LIVE === false` turns the engine off (the other tests use it).

## Not allowed / do not add
- Polling when hidden, parallel requests, shorter intervals, new endpoints, WebSocket, or the staff live page.
- Server-side proxies (they are blocked by Cloudflare anyway).
- Any API call that needs a login.
