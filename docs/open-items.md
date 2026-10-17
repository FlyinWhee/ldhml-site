# Open items

Status as of 2026-10-15.

## Needs the owner
- **NBHPA permission.** No contract or expectation that outside sites may use their public pages, endpoints or logos. The owner will raise it. Offer to draft the message (what is read, how often, no photos, unofficial label, ask for a read-only API or export).
- **Unraid refresh.** Not set up. The owner is new to Unraid: walk step by step (see `operations.md`).
- **Owner cleanup:** delete the Worker in the Cloudflare account and the GitHub variable `LDHML_API` (the repo no longer uses them). Keep the rest as is.

## Phase 2: tools for captains and admins (planned)
Goal: fewer admin tasks. Captains act on their own, within limits; admins validate in one step with all the information in front of them.
Roles: **admin** and **captain** only. Players get nothing directly; other roles use the NBHPA system. Keep security and permissions lean.
- **Backend: decided (2026-10-16):** Cloudflare Worker + D1, our own passwordless sign-in (Access free plan is capped at 50 users; 43 teams). Admin area built on branch `admin`, tested locally; deploy steps in `docs/tools.md`. Email: **Workers Paid + Cloudflare Email Service (decided 2026-10-16), set up later**; until then build and test locally (`scripts/tools-dev.bat`). To do at setup: add the Cloudflare email mode in `tools/src/email.js`.
- **Substitute rules:** replacement requests are built (2026-10-16, `docs/tools.md`): cap, age, list, schedule checks. To confirm with the league: the Retro rules (cap sum, ages, goalie age, the age date), the rules of the other leagues, and whether a replacement may come from another team of the same league. Replacing with a player who is not on the list: built ("Joueur hors-ligue", always non-conforming).
- **Our own rank systems:** not defined yet (maybe per league). Draft "salary" and a team salary cap are a core part of the draft leagues. Shape is ready (`rankSystems`, registry `ranks`); no system is declared.
- **Easy-to-query data** (an MCP-like layer): the build already makes a clean people index; a JSON export of it is a small step.
- **Names to decide:** the non-draft section ("Équipes" for now) and the URL of the draft league (`/draft/ldhml/` for now). Both are one line in `leagues.json`.
- **NBHPA permission** matters more before phase 2 goes live (the tools depend on their data).

## Past seasons on the public site (owner, 2026-10-16: wanted "at some point")
A player's performance in earlier seasons, the results of past years. Ready: our person ids stay the same across seasons (`registry/people.json`), and a season's stats are kept at the switch (`data/archive/<seasonId>/`, docs/operations.md). To decide: how far back (does NBHPA still serve the older seasons?), the URLs (for example `/archives/<season>/draft/retro/`), what a person page shows (one line per season: a career table), and whether past seasons also show tools data (salaries, replacements; public or not). Past seasons are frozen: built once, no live polling.

## Possible work
- PWA "Install" button (Android hides "Add to Home screen"). Check offline behavior in a real browser.
- Local clock countdown between polls (smooth game clock without more requests).
- Android app (Capacitor) with local notifications; push notifications would need a server.
- Verify English wording across all views.
- Box scores in `data/` grow every game day; if pages exceed a few MB, split box data into a lazily fetched file.

## Known source limits
See `data-formats.md` (team goals without scorer, penalties without a player, goalie data only when recorded). The source has no birth date or age for players.
