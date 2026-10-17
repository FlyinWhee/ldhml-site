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
Plan: a Worker caches NBHPA answers for 10-60 s so 200 visitors cost 1 request. Result: the Worker itself is blocked by the challenge. The code and its hooks (`worker/`, `wrangler.toml`, `LDHML_API`, the `ldhml-api` meta) were removed on 2026-10-15.

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

## Two sections: draft leagues and the other leagues (2026-10-15)
The owner wants the draft leagues split from the others "as much as possible": an entry page, then a section page each (`/draft/`, `/equipes/`), then the leagues. Each section has its own player page; links across sections exist only to make navigation nicer. The name "Équipes"/"Teams" for the non-draft section is a working name. Breaking the old URLs (`/retro/`) was accepted (the site was not launched).

## Our own person id, NBHPA id as foreign key (2026-10-15)
A platform for captains and admins needs one record per person. NBHPA `player_id` is a registration (one person can have several); `nbhpa_player_id` (`nid`) is the person. We keep our own id (`L0001`) in a committed file (`registry/people.json`) because there is no backend; ids are assigned on the owner's computer during the refresh, never in CI, so they stay stable. Our own data about people (ranks, later captain flags, sub eligibility) hangs off our id.

## Ranks per position, and our own rank systems (2026-10-15)
A rank only exists per position (skater, goalie). The NBHPA rank is one value per person and position (checked across all leagues). Our own rank systems are planned (not defined yet: maybe per league): `rankSystems` in `leagues.json` declares them per section (optionally per league), values live in the registry. First use: a draft "salary" per player, with a salary cap per team.

## Branch previews on the same Pages site (2026-10-15)
Pages holds one site per repo. Options were: a second host with per-branch URLs (Cloudflare Pages, Netlify), or building every branch into `/preview/<branch>/` of the one Pages site. Chosen: the Pages subfolder. No new account or service, everything stays in GitHub. Cost: each deploy builds all branches (a few seconds each), and previews are public.

## The site is for data nerds; one look for every entity (2026-10-15)
The owner's core principle: only people who love data read a recreational league's stats site. So every piece of data links to its most detailed page, and a league, a team or a person looks the same on every page of the platform. The rules are in `presentation.md`. Team colours and badges moved from `1-core.js` to `shared/look.js` (`LDLook`), so the section pages (and the tools to come) draw teams with the same code as the league pages. The section profile now shows the team badges, full names, games per team, the main team (same rule as the league page, computed at build time from the box scores) and a "Full stats" link to each league page.

## League badge as a container (2026-10-15)
Problem: on a person's section profile, the team badges opened the team pages, but in that context a reader wants the person's stats in the league; plain-text league links looked poor. Idea from the owner: a league badge that contains the team chips. Rule: a team chip always opens the team page (its meaning never changes); the league part opens the league in the current context (on a person: the person's page in that league). Tooltips say where each part goes. Rejected: making team badges open different pages on different pages (harder to learn).

## Tools stack: Cloudflare Workers + D1, our own passwordless sign-in (2026-10-16)
Captain tools need writes, sign-in and stored state. Chosen: one Cloudflare Worker (pages + API) and a D1 database; the stats site stays on GitHub Pages. Cloudflare Access (free up to 50 users) was the simplest sign-in, but 43 teams plus admins can pass 50, and paid seats ($7 per user a month) are too expensive; so we built a small passwordless sign-in (emailed code, hashed storage, strict cookies). Supabase was set aside: free projects pause after a week without activity (off-season). Email: Workers Paid ($5 a month) with Cloudflare Email Service, one vendor (decided 2026-10-16; set up later). Admin and captain areas are kept apart (tables, cookies, sessions, URLs). Every feature is per season and audited. Budget: under $100 a year.

## Replacement requests: one game, checked before they reach an admin (2026-10-16)
A request is one game of one team, one line per absent player; the checks (cap, age, list, schedule, duplicates) are coded one by one, no rule engine (rules change between seasons). Failing requests can still be sent with a note: leagues make exceptions, and the admin decides. Every request goes to an admin for now; auto-approval when all checks pass is a later per-league option. The builder is shared by captains and admins (admins act for captains who are less at ease with tech). The captain area goes straight to the captain's team (owner: most captains have one team; no fussing). The builder is a guided page in four steps with a few suggestions, not a modal or a long form (owner: too cramped, too much). Replacements are always the same sex as the absent player, in every league (owner rule, coded, not a setting). A cancelled request is deleted (it serves no purpose); a refused one stays.

## "Déclarer un remplacement", not "demander" (2026-10-16)
The captain does not ask for a replacement: they tell the league. The admins validate it (they make sure no other team is wronged by an invalid player). The words follow: Déclarer un remplacement, Mes remplacements, Remplacement no N, À valider / Validé / Refusé, Valider (admin). In code and in the database the table keeps its name (`replacements`, a "request" in comments).
