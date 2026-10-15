# Operations

## Normal flow
1. Data refresh (cache) runs on a residential connection: `npm run fetch:force`, or `scripts/refresh.bat` (Windows), or `scripts/unraid-refresh.sh` (home server).
2. The refresh gives our id to new people (`registry/people.json`), commits `data/` and `registry/`, and pushes to `main`.
3. GitHub Actions (`.github/workflows/refresh.yml`, name "Refresh and publish") installs, runs `node build.mjs`, uploads `dist/` and deploys to Pages. It does not fetch data. It also runs by hand (`workflow_dispatch`).
4. Visitors read live data themselves; a stale cache costs only a few extra requests in their browser.

If the refresh stops, nothing breaks. The page compares its cache with the live schedule and fills the gap (see `live-engine.md`).

## Scraper
- `node scraper/fetch.mjs [slug ...] [--force]`. Without `--force` a league is skipped if its snapshot is younger than `MIN_AGE_MIN` (15, env override).
- About 4 requests per league + 1 recap per game that has a score and is new or from the last 3 days. Pause `DELAY_MS` (1500) between requests. Retries up to 3 times on 5xx/429 with growing waits.
- User-Agent: `ldhml-stats-poc/0.2 (community stats viewer; low-volume; ...)`.
- It refuses to overwrite a league when `assemble()` reports problems (fewer than 2 teams, no games, incomplete rows, no players). Other leagues continue; exit code 1 at the end.
- `scraper/import-raw.mjs <file>`: build snapshots from a raw JSON saved from a browser session (`{ slug: { standings, players, goalies, schedule, recaps } }`). A fallback if the scraper cannot reach NBHPA.

## Windows (`scripts/refresh.bat`)
Pulls `main`, runs `node scraper/fetch.mjs --force`, commits and pushes `data/` and `registry/`. Needs git and Node. Line endings CRLF (see `.gitattributes`).

## Unraid (`scripts/unraid-refresh.sh`)
Pulls the repo, runs `node scraper/fetch.mjs` in a `node:22-alpine` container, pushes `data/` and `registry/` if they changed. Setup (owner is new to Unraid, go step by step when he asks):
1. Clone the repo on the server (for example `/mnt/user/appdata/ldhml-site`) with a **deploy key with write access** (GitHub: repo > Settings > Deploy keys > Allow write access).
2. Install the "User Scripts" plugin. Add the script. Cron such as `45 23 * * *` (after the evening games). A second run in the afternoon is optional.
3. Run once by hand. Read the log. Check that a commit appears on `main` and Pages deploys.
Status: **not set up yet**. The owner runs `npm run fetch:force` by hand for now.

## New season
Edit `leagues.json`: `seasonId`, `seasonName`, and check each `categoryId` against the official standings page (they can change). Run `npm run fetch:force`, `npm test`, push. Old `data/<slug>/box.json` entries of the previous season would stay in the file: delete `data/` first when the season changes, otherwise stale box scores keep growing the pages.

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
Commit message style: short, imperative. The session tooling appends co-author trailers; keep them.

## Retired
The Cloudflare Worker proxy and its `LDHML_API` hook were removed (2026-10-15). See `decisions.md`. The Cloudflare Worker and the GitHub variable `LDHML_API` may still exist in the owner's accounts; they are unused.

## Permission (open question)
There is no contract with NBHPA about use of their public endpoints and team logos. The owner will contact them. Until then: keep rates low, send no more than the current polling, no photos, say on the site that it is unofficial (the hub footer does).
