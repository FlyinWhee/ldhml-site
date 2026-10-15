# Open items

Status as of 2026-10-15.

## Needs the owner
- **NBHPA permission.** No contract or expectation that outside sites may use their public pages, endpoints or logos. The owner will raise it. Offer to draft the message (what is read, how often, no photos, unofficial label, ask for a read-only API or export).
- **Unraid refresh.** Not set up. The owner is new to Unraid: walk step by step (see `operations.md`).
- **Owner cleanup:** delete the Worker in the Cloudflare account and the GitHub variable `LDHML_API` (the repo no longer uses them). Keep the rest as is.

## Phase 2: tools for captains and admins (planned)
Goal: fewer admin tasks. Captains act on their own, within limits; admins validate in one step with all the information in front of them.
Roles: **admin** and **captain** only. Players get nothing directly; other roles use the NBHPA system. Keep security and permissions lean.
- **Blocker: a backend.** Writes (a captain asks for a sub, an admin approves), sign-in and stored state need one. The static site cannot do it alone.
  Options: a hosted database with sign-in (for example Supabase, free tier; recommended), a Cloudflare Worker with a D1 database (Workers can serve our own data; only fetching NBHPA is blocked), or the Unraid server (home uptime risk). Decide with the owner.
- **Substitute rules:** the owner will send them (who can sub where, rank limits, game limits, per section). They decide what a person's section instance must store.
- **Our own rank systems:** not defined yet (maybe per league). Draft "salary" and a team salary cap are a core part of the draft leagues. Shape is ready (`rankSystems`, registry `ranks`); no system is declared.
- **Easy-to-query data** (an MCP-like layer): the build already makes a clean people index; a JSON export of it is a small step.
- **Names to decide:** the non-draft section ("Équipes" for now) and the URL of the draft league (`/draft/ldhml/` for now). Both are one line in `leagues.json`.
- **NBHPA permission** matters more before phase 2 goes live (the tools depend on their data).

## Possible work
- PWA "Install" button (Android hides "Add to Home screen"). Check offline behavior in a real browser.
- Local clock countdown between polls (smooth game clock without more requests).
- Android app (Capacitor) with local notifications; push notifications would need a server.
- Verify English wording across all views.
- Box scores in `data/` grow every game day; if pages exceed a few MB, split box data into a lazily fetched file.

## Known source limits
See `data-formats.md` (team goals without scorer, penalties without a player, goalie data only when recorded). The source has no birth date or age for players.
