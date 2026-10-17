# Tools (admin and captain areas)

Phase 2 of the project: tools that cut admin work. Captains act on their own within limits; admins validate in one step with all the information in front of them. Roles: **admin** and **captain** only. Status (2026-10-16): admin area built and tested locally, not deployed.

## Stack
| Part | Service | Cost |
|---|---|---|
| Stats site | GitHub Pages (unchanged) | $0 |
| Tool pages + API | Cloudflare **Workers** (one Worker, `tools/`) | $0 (Free) or $5 a month (Paid) |
| Database | Cloudflare **D1** (SQLite) | $0 at our size |
| Sign-in emails | **Resend** (separate company, free: 100 a day) or Cloudflare Email Service (needs Workers Paid) | $0 |
| Domains | Cloudflare Registrar | about $10–20 a year each |
Budget set by the owner: under $100 a year.

## Addresses (decide at deploy)
The tools are a small **web app**: one Worker serves the pages (admin now, captain later) **and** their API (`/api/...`) on the same address. Same address = simple and safe cookies, no cross-site setup.
- Tools: **`app.<domain>` (decided 2026-10-16)**, both areas: `app.<domain>/admin/`, `app.<domain>/captain/`.
- `api.<domain>`: keep it for the planned **public, read-only data** (the season export and later stats queries, the "MCP-like" layer).
- Stats site: the root or `www.<domain>` later (today GitHub Pages).

## Account
Cloudflare account owner: **Mathieu (personal account), for now** (2026-10-16). Turn on two-factor sign-in. Later: move to a league-owned account, or add a second member, so the league keeps access.

## Design
```
browser ── /admin/ (pages, static assets: dist-tools/) ── /api/admin/... ──> Worker ──> D1
                                                                 └── reads /data/season.json (our snapshot; never NBHPA)
```
- `build.mjs` writes `dist-tools/`: `tools/public/*`, `assets/site.css` (the site CSS with themes, badges, league logos), `assets/look.js`, `assets/ranks.js`, `data/season.json`. It also writes the same JSON at `dist/api/season.json` on the stats site (public data: leagues, teams, players and our ids).
- **Seasons** are a table. Every feature row links to a season. A captain's access is: one team, one league, one season (`captain_access`). Team names are copied at grant time. Revoked rows stay for history.
- A team can be granted only when the season's NBHPA id matches the season in the data (`no_season_data` otherwise).

## Security model
- **Passwordless:** an admin types their email; an existing, active admin gets a 6-digit code by email; the answer is the same for any email (no account discovery). Code: 10 minutes, single use, 5 tries. Limits: 5 codes per email and 20 per IP per hour.
- **Nothing readable is stored for sign-in:** codes, emails (in `login_codes`), IPs and session tokens are HMAC-SHA-256 hashes with the `CODE_PEPPER` secret.
- **Account emails are stored readable** in `admins` and `captains`: the Worker must send codes to them and admins must see them. A hash cannot be emailed. Option (not built): encrypt the `email` column with a Worker secret (AES-GCM) and keep a keyed hash for look-ups; it protects a stolen database export, not a stolen Worker secret.
- **Sessions:** a random 256-bit token in a cookie `__Host-ldhml_admin` (`HttpOnly; Secure; SameSite=Strict`, 7 days). Captains will get `__Host-ldhml_captain` (60 days). A session of one kind never opens the other area. Disabling an account ends its sessions at once.
- **CSRF:** a write must carry our own `Origin`.
- **Headers** (`tools/public/_headers`): strict Content-Security-Policy, no framing, no indexing.
- **Audit:** every admin change (and sign-in) is a row in `audit`.
- **Delete vs disable:** disable is reversible (sessions end at once). Delete is permanent: account, access of every season, sessions, codes; audit rows about it stay as actions without details (no names). Admins: `npm run tools:remove-admin` (no admin screen yet).
- **Personal data** (Quebec Law 25): emails and names of admins and captains only. Never in git. Before going live: a short privacy note, a named person in charge, and a way to delete an account.

## Try it on this computer (owner)
1. Double-click `scripts\tools-dev.bat` (or run it in a terminal).
2. The first time, it asks for an email: type yours. It becomes a **local** admin (only on this PC; nothing is sent). Press Enter to skip on later runs.
3. The browser opens http://localhost:8787/admin/ after a few seconds (reload if it was too early).
4. Type the same email, click "Recevoir un code". No email is sent locally: the code shows in a dashed box on the page and in the black window. Type it.
5. Try it: create the season (the name and NBHPA number are filled in), create a captain, give access to a team, look at the Log tab.
6. Stop with Ctrl+C in the black window (answer O/Y if asked). The data stays in `tools\.wrangler\` on this PC (git-ignored); delete that folder to start from zero.
If it says "address in use", another copy is still running: close that window first.

## Local development and tests
- `npm test` includes `tools/test/test-tools.mjs`: the real Worker on an in-memory SQLite that behaves like D1 (`node:sqlite`, Node 22.5+), plus the admin page in jsdom wired to the Worker.
- `npm run tools:dev` runs the Worker in Cloudflare's real runtime (`workerd`, via `wrangler dev`) with a local D1. Create `tools/.dev.vars` first (see `tools/CLAUDE.md`), then `npm run tools:add-admin -- you@example.com "Name"`. The code appears in the terminal and, on localhost only, on the page.
- Checked on 2026-10-16 in `wrangler dev`: schema, headers, sign-in, session cookie, writes, cross-site write refused (403).

## Deploy (first time, by the owner, with help)
1. Cloudflare account: decide the owner (personal or league). Install nothing: `npx wrangler login` opens the browser.
2. `npx wrangler d1 create ldhml-tools` → copy the `database_id` into `tools/wrangler.jsonc`.
3. `npx wrangler d1 migrations apply ldhml-tools --remote -c tools/wrangler.jsonc`
4. Secrets: `npx wrangler secret put CODE_PEPPER -c tools/wrangler.jsonc` (a long random string; keep a copy in a password manager), and the email key (`RESEND_API_KEY` for Resend).
5. Email: verify the sending domain at the provider (DNS records in Cloudflare). Set `EMAIL_MODE` to `"resend"` and `EMAIL_FROM` (for example `LDHML <no-reply@your-domain>`) in `tools/wrangler.jsonc`.
6. `npm run build && npx wrangler deploy -c tools/wrangler.jsonc`. Then attach a custom domain to the Worker (for example `outils.your-domain`) in the Cloudflare dashboard.
7. `npm run tools:add-admin -- you@example.com "Name" --remote`
8. Later: deploy from GitHub Actions on push to `main` (a Cloudflare API token as a GitHub secret). Deploying to Cloudflare is fine; only fetching NBHPA from the cloud is blocked.

## Workers Paid ($5 a month): what it adds for us
**Decided (2026-10-16): we will use Workers Paid and Cloudflare Email Service (no Resend), set up later.** Until then everything is built and tested locally.
- Email Service: 3,000 outbound emails a month included (one vendor instead of Resend).
- No daily request cap (10 million a month included), CPU up to 30 s per request (Free: 10 ms) and longer Cron Triggers: room for heavier checks (sub pre-validation, imports).
- D1: 10 GB per database (Free: 500 MB), 25 billion rows read and 50 million written a month, 30 days of Time Travel (point-in-time restore; Free: 7).
- Queues (1 million operations a month) and Durable Objects: background jobs and notifications later.
See the pricing pages before relying on numbers; they change.

## Requirements from the owner: league player lists, rosters, salary, replacements (2026-10-16)
Source: the owner. Items marked *to validate* are not confirmed by the league yet.
- **The league keeps the truth:** a player list and the team rosters, today in an Excel file. The site today only knows who played (NBHPA game sheets); a registered player who has not played is invisible.
- **Goal:** the league maintains its player lists and rosters **in the app**, with an **import tool** (Excel first; maybe a public Google Sheet). The owner does not have the file yet; the import format waits for it.
- **Player list per section and per season**, with **persistence across seasons** (one person, many seasons: history for data nerds).
- **Rosters:** per season, per team. **Admins only** edit them. Captains **submit replacements** (subs) for admin approval.
- **Draft "salary"** = our internal rating of a player, the big item. *Retro today (to validate):* a **salary cap per team**; a replacement must **fit under the cap**; and the replacement must meet an **age rule**: men 40+, women 35+, goalies 30+ (*goalie age to validate*). Other leagues may use age, salary, both or neither.
- **Game-night lineups:** come from NBHPA data once NBHPA accounts are required (next season). This season: optional, from the league data.
- **Next season:** an NBHPA account is required for every player (official launch). API access is under discussion with NBHPA.
- **Later: a draft platform:** captains (or admins on their behalf) see ratings, stats, availability, picks and draft order, and make picks. For now only the resulting teams matter.

### Open design questions
1. **Who gives person ids** once admins can add people the NBHPA data has not seen (registered, not played)? Today `scraper/registry.mjs` assigns them into a public git file. Proposal: D1 becomes the source of truth for people when the tools go live; `registry/people.json` becomes an export for the static site.
2. **Age data is sensitive personal data** (Law 25). Stored: birth month and year only, never shown to captains. Cut-off: a league setting (`age_on`: the game date, default, or the game's year); *to confirm with the league.*
3. **Salary per season** (it can change) and per section or league. Public on the stats site (data nerds) or private to admins and captains?
4. **Cap per team:** one number per league and season? Does the replacement's salary replace the absent player's salary in the sum?

## Roster layer (built 2026-10-16, admin only)
Tables (`migrations/0002_people_rosters.sql`); everything per season except people:
- `people`: one person across seasons. `id` is a database number; `site_id` (`L0137`) links to the stats site; `nid` to NBHPA. Birth **month and year** only.
- `section_players`: the league player list per section and season, with a **salary per position** (`salary_s`, `salary_g`): a player who changes position is checked at that position's salary.
- `teams`: **our own teams** per season and league. `nbhpa_team_id` is an optional link (a team can exist before NBHPA has it; NBHPA ids change each season). Captain access points to our team (`captain_access.team_ref`).
- `rosters`: one active team per person per league and season. Removing keeps the row (`removed_at`): a transaction history.
- `league_rules`: **one row per league and season**: salary cap, minimum ages (men, women, goalies), the rule in words. **No rule engine**: rules change between seasons (last season Retro used "replacements at or below the absent players' salary, plus 1 for the game"); each check is coded when the league confirms it.
- **Salaries are shown in millions** everywhere ("2M", cap "41M"); the database keeps the plain number. Joueurs tab: separate **J$ / G$** columns (full label on hover), an **NBHPA** column (the NBHPA player no. becomes required in 2027; optional in the forms for now), sortable columns, filters: name, league, position (skaters, goalies: a goalie on a roster of the section or in the stats), sex, missing data (salary, birth date, NBHPA no.), and a salary range that follows the position (G$ for goalies, J$ for skaters; with both, each person's salary at their own position).
- Admin tabs: **Équipes** (default; the chosen league: each team card with its **captains** and roster, payroll against the cap; "+ Ajouter un capitaine" picks an existing captain or creates one and gives the access in one step; captain accounts in a folded panel), Joueurs (list per section with a league filter), **Configuration** (set once a season and then left alone: seasons; for the chosen season, one card per league with its rules row and its team setup: name, code, NBHPA team id, new team, import from NBHPA per league), Journal.
- **Teams:** our own table per season and league; created from the NBHPA data (import) or by hand; the NBHPA team id is an optional link. Changes may later be handled by an AI agent working on the same table; the manual tools stay as the fallback.
- **Scope bar** on every working tab: season, section, league (badges). **Modals** for every add and edit form (2026-10-16, owner request: a work context that matches how leagues are managed).
- Local tests: `npm run tools:seed` fills the local database from the stats data (each player on their main team, main position, no salaries or births).

## Replacements and the captain area (built 2026-10-16)
The main captain tool. **The same builder in both areas** (`tools/public/shared/builder.js`): captains use it at `/captain/#remplacement`, and admins use it for captains who are less at ease with tech (`#subs/new` from the Remplacements tab, or `#subs/new/<team>` from "Remplacement…" on a team card).
- **A guided page, not a modal** (owner, 2026-10-16: a modal is too cramped, a big form is too much): a stepper, one question per step. 1 the game (the next games as cards; any other game or a typed date in a fold); 2 who is absent (tap the players); 3 a replacement for each (six suggestions: eligible, best salary first; more on request; "to check" in a fold; a search finds anyone else, with the reason they do not fit); 4 the summary, the problems in words, the note, send.
- **A request = one game of one team** (`replacements`), with **one line per absent player** (`replacement_lines`: absent, replacement, position played, both salaries copied). The game is one of **our games** of the team (`game_ref`; the NBHPA game no. is kept beside it when the game came from NBHPA) or a date typed by hand.
- **Joueur hors-ligue** (a player who is not on the list; owner, 2026-10-16): in step 3, "Joueur hors-ligue…" asks the **name and sex** (required; the sex starts as the absent player's) and the **age and NBHPA no.** (optional: age matters only in leagues with an age rule). The request is **non-conforming at once** (check `guest` fails), so a note is required and the admins decide; the age is checked from the age given, the salary is unknown (cap "to check"). The guest stays **on the request line only** (`replacement_lines.guest_*`, migration 0004): never a people row from a captain's input, and it goes with the request. Later option: on approval, add the guest to the section list.
- **Same sex, always** (owner rule for every league, not a setting): a replacement is the same sex as the absent player. The builder never offers the other sex; the server check fails it; an unknown sex is "to check".
- **Checks** (`tools/src/replacements.js`, no rule engine, numbers from `league_rules`): absent is on the roster; same sex; replacement is on the section list, not on this team, not playing at that time (own team's game or another open request); **age** (men, women, goalies; on the game date, or in the game's year: `age_on`; a goalie without a goalie rule follows the rule of their sex); **cap** (payroll − absent salaries + replacement salaries at the position played); duplicate requests. Missing data (salary, birth date, sex, a birthday in the game's month) gives **"to check"**, never a silent pass.
- The checks run **while building** (the replacement list is grouped eligible / to check / not eligible, with the reason), **when saving**, **again on every pending request** in the queue, and **at the decision** (kept with it). A request with a failing check can still be sent, **with a note** (the admin decides; confirmed by the owner, 2026-10-16: keep it so).
- **League rules:** a link at the top of the builder ("Règles de la ligue") opens them in a small window; they are not shown as a block (most people know them).
- **Cancel = delete** (owner: a cancelled request serves no purpose): the request and its lines are deleted; the audit row stays without details. Refused requests stay (history).
- **Request cards are compact:** header (team, game, status, result), one line per replacement, only the problems in words, every check in a fold.
- **Admin:** a league's Remplacements tab ( pending / approved / refused; pending counts on the tab and on the league buttons), approve or refuse with a note for the captain. An admin's own request can be approved at once ("approve now", ticked by default).
- **Captain area** (owner rule: streamline): sign-in lands **straight on the captain's team**; no sections, no setup. A team switcher shows only for a captain with several teams (remembered in the browser). The page: the team, "Déclarer un remplacement" (the builder page), the team's requests (cancel while open and before the game), the roster with salaries and the cap.
- **Privacy:** birth dates never leave the server; captains see only whether the age minimum is met. Salaries are shown to captains (the cap needs them; public or not on the stats site is still open).
- Local tests: `node tools/scripts/seed-local.mjs --demo` adds **fake** salaries derived from the stats (skaters 2 to 6 by points per game, goalies 4, every Retro team under the 41 cap) and fake birth dates, only where empty, plus Retro demo rules if none, to try the checks. Never real data.

## Actual lineups and the schedule (built 2026-10-16)
The lineup of a team for a game = its roster, minus the absent players, plus their replacements from the requests on file (approved ✓ or pending !; an approved request wins over a pending one for the same absent player; refused ones do not count). With the night's counts (skaters, goalies) and payroll against the cap. Code: `tools/src/lineups.js` (server), `lineupHtml` / `gameHtml` in `tools/public/shared/builder.js` (display).
- **Only what changes is shown** (owner: the full roster per game is noise): the replacements and the absent players; "Aucun remplacement" otherwise.
- **Admin: a league's Calendrier tab**: the game nights as date chips (the next one chosen), each game with both teams side by side; "Remplacement…" per team opens the builder with that team and game (step 2). API: `GET /api/admin/lineups?season&league&date`.
- **Captain dashboard** (owner: a dashboard, not a list of items): the team and "Déclarer un remplacement" on top; the key numbers; then two columns: **the timeline** (one line per upcoming game with its status chips and **"Déclarer…"**, which opens the builder on that game at step 2; **its replacements fold under it** (every game starts folded, showing one line per replacement: absent → replacement with a status dot; opened on demand); the night's counts and payroll when something changes; a typed date gets its own line; past games only with requests, folded) | the roster. One column on a phone. **Two key numbers** on every screen (owner, 2026-10-17): the next game (with what is declared and still to validate for it) and the payroll; the pending and roster counts were noise.
- **Hide (captain):** a refused request can be hidden from the captain's page (`captain_hidden_at`, migration 0005); it stays in the admin history. Open requests are cancelled (deleted) instead.
- **Player links in a league context** (rosters, lineups, request cards, the builder) open the player's page **in that league**; the section page only when they have not played in it yet. The Joueurs tab (section-wide) links to the section page. The captain sees their own team only, not the other team's absences. API: `GET /api/captain/lineups?team`.
- The roster is the current one (a past game shows today's roster). Game-night lineups from NBHPA come later (NBHPA accounts, next season).

## Sign-ups: who plays in a league (built 2026-10-17, simplified the same day)
`league_players` (migrations 0008, 0009): one row per person, league and season, with the position. Nothing more: no places, no waiting list, no status (owner: limits are a problem waiting to happen; admins manage). Code: `tools/src/roster-api.js` (`signupsOf`), `signupPanel` in `tools/public/admin/admin.js`.
- **Team leagues:** a team joins with its players. Putting a person on a roster signs them up; taking them off removes the sign-up.
- **Draft leagues** (section `draft`): Équipes → the league → **Inscriptions** (folded; counts of men, women, goalies and "sans équipe" on the fold). In edit mode, "Inscrire" adds a person; × removes a sign-up with no team. **No team yet = the draft pool**, only useful for a draft run by the tools (later). Off a team in a draft league = back in the pool.
- **Without the tools' draft, nothing changes:** create teams, put players on them. The sign-up follows.
- **Replacement players do not sign up**: they are on the section list with their salary and can replace in every league of the section. Joueurs → "Remplaçants" lists them.
- API: `GET /api/admin/league-players?season&league` (signups, counts, pool), `POST /api/admin/league-players`, `POST /api/admin/league-players/:id/delete`. Audit: `signup.add`, `signup.delete`.

## Our schedule (built 2026-10-17)
The tools have **their own schedule** (`games`, migration 0007; code `tools/src/games.js`), so they work without NBHPA (owner: "it should work without it, should we even drop it"). One row per game: season, league, date, time, venue, court, away and home (our teams), cancelled, and the NBHPA game no. when it came from there. Teams have their own `logo` too.
- **Import (optional):** the Calendrier, in edit mode, has **"Importer le calendrier NBHPA"**: it reads our build snapshot (`/data/season.json`; the Worker never fetches NBHPA), **adds and updates, never deletes**, and **never touches a game changed by hand** (`edited = 1`). Import the teams first: a game whose teams are not in the tools is skipped. The home to-do says when the snapshot has new games or changes, and when a season has no game at all. API: `GET /api/admin/games/import?season[&league]` (a preview, writes nothing), `POST /api/admin/games/import`.
- **By hand:** Calendrier → Modifier: "Ajouter un match", and per game "Modifier" / "Supprimer". A game changed or added by hand is marked `edited`. A game that replacements point to cannot be deleted (`game_in_use`): mark it cancelled instead. API: `POST /api/admin/games`, `POST /api/admin/games/:id`, `POST /api/admin/games/:id/delete`, `GET /api/admin/games?season&league`.
- Everything that needs a schedule reads this table: the builder's game cards, the schedule-conflict check (`busy`), the Calendrier, the captain's timeline, the home's next nights. The local seed (`npm run tools:seed`) fills it from the snapshot.

## Admin home, edit mode, default order (2026-10-16)
- **Home = a dashboard** (opens first; season choice): four key numbers (to validate, per league; next game night and the replacements on file; teams without a captain; players with missing data), then **À valider** (soonest game first, Valider / Refuser in place, league badge on each card) | **Prochaines soirées** (the next night per league, a click opens it in the Calendrier) and **À compléter** (teams without a captain, leagues without rules, missing salaries / birth dates / NBHPA nos. per section, captains who never signed in; each item opens the place to fix it, in the right scope or filter). API: `GET /api/admin/dashboard?season`.
- **The action log** is a link at the bottom of the home page (`#audit`), not a menu item.
- **Edit mode** (owner: the team page was always editable, easy to make a mistake): Équipes and Joueurs open in **read mode**; "✎ Modifier" shows the controls that change things (class `ad-ed`), marked "Mode modification"; it switches off on a tab change or a reload. "Remplacement…" stays in read mode (daily work). Configuration is the setup page and stays editable.
- **Sex in every player list**, and one **default order** everywhere (owner): men, then women, then goalies; salary at the position, high to low (`LDBuilder.rosterOrder`): team cards, the Joueurs tab (default sort; "Tri par défaut" brings it back after a column sort), the captain roster, the builder's step 2.

## Seasons and leagues per season (2026-10-16)
- **One season is "en cours" (active) at a time** (`tools/src/seasons.js`). It is the reference: the admin pages open on it, captains work in it (they see the active and upcoming seasons, never an archived one), and the public site should show it. Making a season active archives the active one (after a confirmation). A new season is "à venir" by default once a season is active, so preparing the next season never archives the current one. Seasons are edited in Configuration (name, NBHPA no., status), and every change is logged.
- **An archived season is read only**, enforced by the server (`409 season_archived`): player lists, teams, rosters, captain access, league settings and replacements of that season cannot change. The pages say so and hide the editing buttons. The status can always be changed back.
- **A league in a season** (`season_leagues`, migration 0006; it was `league_rules`): one row per league and season, **active or not** (`enabled`) and **its rules** (cap, ages, age date, notes). No row = active, no rules. A league switched off for a season disappears from that season in the tools (scope bars, Calendrier, home, captain pages) and takes no replacement (`409 league_off`); its data stays. Configuration: "Active cette saison" on each league card. New leagues are still added in `leagues.json` (look, logo, NBHPA category).
- **The public site and the live season:** the stats site builds the season of `leagues.json`; it cannot follow the tools by itself (a switch needs new NBHPA nos., clearing `data/`, a fetch from home). So: `GET /api/public/season` (public, no personal data: name, NBHPA no., leagues switched off) and `npm run season:check [tools address]` compares it with `leagues.json` and prints the steps; the admin home warns when the live season is not the one the public site shows, or when no season is live.

## Next
- Import tool for the league file (Excel or Google Sheet) when the owner has it (salaries, birth dates, rosters).
- Confirm the Retro rules with the league (cap sum, ages, goalie age, age date) and whether other leagues use them.
- Emails on decisions ("your request was approved") with the Cloudflare email mode at deploy.
- Later: auto-approve per league when every check passes (once the league trusts the checks).
- Manage admins from the admin area (today: the `add-admin` script).
