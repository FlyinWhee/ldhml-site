# Operations

## Normal flow
1. Data refresh (cache) runs on a residential connection: `npm run fetch:force`, or `scripts/refresh.bat` (Windows), or `scripts/unraid-refresh.sh` (home server).
2. The refresh gives our id to new people (`registry/people.json`), commits `data/` and `registry/`, and pushes to `main`.
3. GitHub Actions (`.github/workflows/refresh.yml`, name "Refresh and publish") installs, runs `node build.mjs`, uploads `dist/` and deploys to Pages. It does not fetch data. It also runs by hand (`workflow_dispatch`).
   Or from the tools admin, with no script: Configuration > Données du site public (below).
4. Visitors read live data themselves; a stale cache costs only a few extra requests in their browser.

If the refresh stops, nothing breaks. The page compares its cache with the live schedule and fills the gap (see `live-engine.md`).

## Scraper
- `node scraper/fetch.mjs [slug ...] [--force]`. Without `--force` a league is skipped if its snapshot is younger than `MIN_AGE_MIN` (15, env override).
- About 4 requests per league + 1 recap per game that has a score and is new or from the last 3 days. Pause `DELAY_MS` (1500) between requests. Retries up to 3 times on 5xx/429 with growing waits.
- User-Agent: `ldhml-stats-poc/0.2 (community stats viewer; low-volume; ...)`.
- It refuses to overwrite a league when `assemble()` reports problems (fewer than 2 teams, no games, incomplete rows, no players). Other leagues continue; exit code 1 at the end.
- `scraper/import-raw.mjs <file>`: build snapshots from a raw JSON saved from a browser session (`{ slug: { standings, players, goalies, schedule, recaps } }`). A fallback if the scraper cannot reach NBHPA.

## From the admin (Données du site public)
The tools admin (`#/config/refresh`, super admins) runs the same refresh with no computer setup. The admin's browser reads NBHPA (same requests, 1.5 s apart, one at a time, paused while the tab is hidden, a 429 stops the run) with `shared/refresh.js`, shows a log of every step, then sends the checked files to the Worker. The Worker (`tools/src/publish.js`) checks them again and makes one commit on `main` ("Refresh data cache (<leagues>)") through the GitHub API; the push starts "Refresh and publish". The log follows the build until the site is up to date.
- Setup: a fine-grained GitHub token (repository `ldhml-site` only; Contents: read and write; Actions: read), stored as the Worker secret `GITHUB_TOKEN` (`npx wrangler secret put GITHUB_TOKEN -c tools/wrangler.jsonc --env demo` for the demo). It expires: renew it before the date.
- A league that fails the checks keeps its data; the others are published. If `main` changed during the reading, the publish is refused ("relancez"). At most one publish every 2 minutes.

## Windows (`scripts/refresh.bat`)
Pulls `main`, runs `node scraper/fetch.mjs --force`, commits and pushes `data/` and `registry/`. Needs git and Node. Line endings CRLF (see `.gitattributes`).

## Unraid (`scripts/unraid-refresh.sh`)
Pulls the repo, runs `node scraper/fetch.mjs` in a `node:22-alpine` container, pushes `data/` and `registry/` if they changed. Setup (owner is new to Unraid, go step by step when he asks):
1. Clone the repo on the server (for example `/mnt/user/appdata/ldhml-site`) with a **deploy key with write access** (GitHub: repo > Settings > Deploy keys > Allow write access).
2. Install the "User Scripts" plugin. Add the script. Cron such as `45 23 * * *` (after the evening games). A second run in the afternoon is optional.
3. Run once by hand. Read the log. Check that a commit appears on `main` and Pages deploys.
Status: **not set up yet**. The owner runs `npm run fetch:force` by hand for now.

## New season
The live season is chosen in the tools (admin, Configuration: make the new season "En cours"; switch off the leagues that do not run). Then `npm run season:check` (with the tools address, or the local tools) says what the public site needs. Edit `leagues.json`: `seasonId`, `seasonName`, and check each `categoryId` against the official standings page (they can change). Run `npm run fetch:force`, `npm test`, push. Old `data/<slug>/box.json` entries of the previous season would stay in the file, so the old season must leave `data/` first, otherwise stale box scores keep growing the pages. **Do not delete it: move it.** Before you edit `leagues.json`, move every `data/<slug>/` folder to `data/archive/<old seasonId>/<slug>/` (with a copy of the old `leagues.json` as `data/archive/<old seasonId>/leagues.json`). It is the history of that season (owner, 2026-10-16: the public site will show past seasons); the build does not read `data/archive/`.

## Add a league
1. Add an entry in `leagues.json` (`slug`, `section`, `logo`, `categoryId`, `theme`, `short`, `name`, optional `path`). The URL is `/<section path>/<path or slug>/`. A new section: add it to `sections` (`key`, `path`, `logo`, `theme`, `name.fr`, `name.en`).
2. New theme: add it to `site/themes.mjs`. New logo: add `assets/logos/<key>.webp` and `<key>-icon.png`, and `assets/pwa/<key>-{192,512,maskable}.png`.
3. `node scraper/fetch.mjs <slug> --force`, `npm test`, push.
Check `site/test-hub.mjs` and `test-pwa.mjs` pass (they read `leagues.json`).

## Deploy and check
Push to `main`. Wait about a minute. Open https://flyinwhee.github.io/ldhml-site/. Pages needs "Source: GitHub Actions" in the repo settings.

## Branch previews
Pages holds one site per repo, and each deploy replaces all of it. So the deploy (`refresh.yml`, always run from `main`) builds `main` at the root
and **every other branch** into `dist/preview/<branch>/` (`/` in the name becomes `-`). `preview.yml` runs on a push to any other branch and on a
branch delete; it only starts `refresh.yml` on `main` (`gh workflow run`), because the `github-pages` environment lets only `main` deploy.
Preview URL: https://flyinwhee.github.io/ldhml-site/preview/<branch>/. Previews are public. A branch that fails to build gets a warning and no preview; `main` still deploys.
Each deploy builds every branch: delete merged branches so deploys stay fast.
After a deploy reports success, Pages can serve the previous copy for a few more minutes (pages are cached with `max-age=600`). Check `Last-Modified` with `curl -sI`, or reload hard, before concluding a change is missing.
Commit message style: short, imperative. The session tooling appends co-author trailers; keep them.

## Retired
The Cloudflare Worker proxy and its `LDHML_API` hook were removed (2026-10-15). See `decisions.md`. The Cloudflare Worker and the GitHub variable `LDHML_API` may still exist in the owner's accounts; they are unused.

## Permission (open question)
There is no contract with NBHPA about use of their public endpoints and team logos. The owner will contact them. Until then: keep rates low, send no more than the current polling, no photos, say on the site that it is unofficial (the hub footer does).
