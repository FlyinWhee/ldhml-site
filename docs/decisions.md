# Decisions and dead ends

## Why a static site with no backend
Goal: lean, cheap, nothing to keep alive. GitHub Pages hosts it. The browser does the work. Live data is read directly from public NBHPA endpoints (CORS is open). The JSON in `data/` is only a cache for speed and as a fallback.

## Why one HTML file per page
No asset paths, works from a file, easy to host anywhere, easy to preview as an Artifact. Cost: duplicated CSS/JS per page. Accepted.

## Why hash routes
GitHub Pages has no server rewrites. Hash routes work on any static host and from a file.

## Why plain JS, no framework
The site is small; the owner is not a developer; fewer tools to break. Files are concatenated into one scope. If a framework is ever used, the usual reason would be one real URL per team/player for search engines (not needed now).

## Why the scraper runs at home
Cloudflare challenges data-center IPs. Confirmed for GitHub Actions runners, a Cloudflare Worker, and a Worker cron. Only residential browsers and a local script pass. So: Windows `refresh.bat` and a planned Unraid script.

## The Cloudflare Worker (dead end)
Plan: a Worker caches NBHPA answers for 10-60 s so 200 visitors cost 1 request. Result: the Worker itself is blocked by the challenge. Code kept in `worker/` and the toml files; safe to delete. The `LDHML_API` env and `ldhml-api` meta are leftovers.

## Standings history (dropped)
A history of standings over time was considered and not built. Per-game data in box scores covers the need.

## Cache-first box scores
Problem: per-team splits need box scores of all played games; if the daily refresh is late the stats would be wrong. Decision: the build seeds box scores; the page diffs them against the live schedule and fetches only the gap (max 3 per tick). "Hope for the cache, work with live data." See `live-engine.md`.

## Default scope "main team"
A substitute's stats were combined across teams in the source. The owner prefers to see the person on the main team, with a `SUB:` list. Scope toggle `all` shows the combined line.

## Live status handling
`/livegame_json` gives status `playing`/`over` (seen on real games). Anything not `over` is live. The schedule's running score must not make a game final (see gotchas).

## Poll rates
The owner asked to keep live rates low: 30 s clock, 120 s recap, 5-15 min page data. A 5 s scheduler tick only decides what is due.

## Photos: no
Player photos exist on the official site. Not used: permission risk. Team logos are used (loaded from NBHPA at runtime, not copied).

## No cphjoliette.com
The site must not point to or mention one team's website.

## Official live feed link
Each live game links to `https://admin.nbhpa.com/livegame/<id>` (opens NBHPA's page). The site never fetches it.

## Live UI choices
- Whole top of a live card is a link (the owner found the small link invisible on mobile).
- Finished games of the night collapse in a section **below** live ones.
- Full-screen red live frame on the game page: tried, rejected. Only the scoreboard keeps the red border.
- Mobile: no floating button for the live box score. Same pattern as desktop.

## PWA
Chosen over a native app for phase one: no account, no store. Names "LDHML - <league>". A Capacitor APK is possible later (local notifications possible without a server; live push needs a server, for example on Unraid).

## Language
French default, English toggle, saved in `localStorage`. Replies to the owner are in Simplified Technical English; this is a chat rule, not a site rule.

## Alphabetical team list
The Teams page is sorted by name (not by standings) at the owner's request. Standings stay on the Standings page.
