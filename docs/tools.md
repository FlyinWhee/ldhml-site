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
2. **Age data is sensitive personal data** (Law 25). Store the least that works: a birth year, or only "meets the age rule" per season, set by an admin. Which cut-off date (season start? January 1)?
3. **Salary per season** (it can change) and per section or league. Public on the stats site (data nerds) or private to admins and captains?
4. **Cap per team:** one number per league and season? Does the replacement's salary replace the absent player's salary in the sum?

## Roster layer (built 2026-10-16, admin only)
Tables (`migrations/0002_people_rosters.sql`); everything per season except people:
- `people`: one person across seasons. `id` is a database number; `site_id` (`L0137`) links to the stats site; `nid` to NBHPA. Birth **month and year** only.
- `section_players`: the league player list per section and season, with a **salary per position** (`salary_s`, `salary_g`): a player who changes position is checked at that position's salary.
- `teams`: **our own teams** per season and league. `nbhpa_team_id` is an optional link (a team can exist before NBHPA has it; NBHPA ids change each season). Captain access points to our team (`captain_access.team_ref`).
- `rosters`: one active team per person per league and season. Removing keeps the row (`removed_at`): a transaction history.
- `league_rules`: **one row per league and season**: salary cap, minimum ages (men, women, goalies), the rule in words. **No rule engine**: rules change between seasons (last season Retro used "replacements at or below the absent players' salary, plus 1 for the game"); each check is coded when the league confirms it.
- Admin tabs: **Équipes** (default; the chosen league: each team card with its **captains** and roster, payroll against the cap; "+ Ajouter un capitaine" picks an existing captain or creates one and gives the access in one step; captain accounts in a folded panel), Joueurs (list per section with a league filter), **Configuration** (set once a season and then left alone: seasons; for the chosen season, one card per league with its rules row and its team setup: name, code, NBHPA team id, new team, import from NBHPA per league), Journal.
- **Teams:** our own table per season and league; created from the NBHPA data (import) or by hand; the NBHPA team id is an optional link. Changes may later be handled by an AI agent working on the same table; the manual tools stay as the fallback.
- **Scope bar** on every working tab: season, section, league (badges). **Modals** for every add and edit form (2026-10-16, owner request: a work context that matches how leagues are managed).
- Local tests: `npm run tools:seed` fills the local database from the stats data (each player on their main team, main position, no salaries or births).

## Next
- Import tool for the league file (Excel or Google Sheet) when the owner has it.
- Replacement requests by captains, with the automatic checks (cap, age) and an admin approval queue, once the Retro rules are confirmed.
- Captain area (`/captain/`, `/api/captain/...`): sign-in with the captain kind, "my teams this season".
- First captain tool: substitute request with pre-validation (needs the sub rules from the owner) and an admin approval queue.
- Manage admins from the admin area (today: the `add-admin` script).
