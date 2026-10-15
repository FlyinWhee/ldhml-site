# LDHML Stats

> Working on this repo with an AI agent or in an editor? Start with `CLAUDE.md` and the `docs/` folder.

A fast, cross-linked stats site for the LDHML ball hockey leagues.
The site has two sections: the draft leagues and the team leagues ("Équipes", working name). Each league belongs to one section and has its own page, theme and data. Every team name and every player name is a link.

| URL | Page |
| --- | --- |
| `/` | LDHML entry page: one card per section |
| `/draft/`, `/equipes/` | A section: its leagues, next game nights, the list of its players, one profile page per player (`#player-L0001`) |
| `/draft/ldhml/`, `/draft/retro/`, `/equipes/vintage/`, `/equipes/3v3-a/`, `/equipes/3v3-b/`, `/equipes/4v4-b/` | One league: standings, teams, schedule, players, goalies, leaders, live page |
| `/preview/<branch>/` | The same site, built from a branch other than `main` (see "Branch previews") |

Each person has one id of ours (`L0001`), kept in `registry/people.json`. The NBHPA person id is the link to the league system.
A picker in the bottom right corner of every page switches league. Pages work in French (default) and English.

## Branch previews

Push a branch (anything but `main`). About two minutes later its preview is at `https://flyinwhee.github.io/ldhml-site/preview/<branch>/` (a `/` in the branch name becomes `-`). The previews are public, like the site. A deleted branch loses its preview at the next deploy.

## How it works

1. `leagues.json` lists the sections and the leagues (slug, section, NBHPA category id, theme). Add a league there, then run the fetch.
2. `scraper/fetch.mjs` reads the data of each league from the public NBHPA pages. It makes about 4 requests per league, plus one for each new finished game. The snapshot is saved in `data/<slug>/`. Then it gives an id of ours to each new person (`registry/people.json`).
3. `build.mjs` puts each snapshot inside `site/template.html`. Each league becomes one static file, `dist/<section>/<league>/index.html`. The section pages are `dist/<section>/index.html`, the entry page is `dist/index.html`.
4. Any static host can serve `dist/`. No server and no database are needed.

## Themes

`site/themes.mjs` holds one theme per league: CSS tokens (light and dark), the colour of the ball icon, the league name gradient and a small decoration for the top banner.
The home page uses the default theme (the first block of `site/style.css`). To change a look, edit the tokens of one theme. Layout and components are shared.
The "Theme" button next to the league picker switches the theme off for the default look. The choice is saved in the browser and applies to every page.
Only Retro has team colours taken from its artwork. Other leagues get a stable colour made from the team code.

## Names

The league data mixes `TOP GUN`, `Top Gun` and `Groupe BEI`. `niceName()` in `shared/parsers.js` fixes this when the page loads (snapshot and live data alike):
a name written only in capitals becomes normal case (`Top Gun`, `Martin Gagnon`), a name that already has lower case letters is left alone (`Groupe BEI`),
and a letter after a hyphen is capitalised (`Jean-Pierre`). Words of 1 to 2 letters, words without vowels and 3 letter words that are not consonant-vowel-consonant stay in capitals
(`GI`, `TMNT`, `EDB`). If a 3 letter word is wrongly kept in capitals, add it to `WORDS` in that file.

## Commands

```
npm install
npm run fetch                 # refresh every league (skips a league if its data is less than 15 minutes old)
node scraper/fetch.mjs retro  # refresh one league
npm run fetch:force           # refresh now
npm run import-raw -- raw/ldhml-raw.json   # build snapshots from a raw file saved in a browser
npm run registry              # give an id of ours to the new people of data/ (fetch does it too)
npm run build                 # build dist/
npm test                      # parser tests, build, click-through test of every page of every league, home page test, live test
```

Open `dist/index.html` in a browser to see the site.

## Refresh from a home server (Unraid)

`scripts/unraid-refresh.sh` pulls the repo, runs `node scraper/fetch.mjs` in a Node container, and pushes `data/` and `registry/` if they changed. The push triggers the Pages deploy.

1. Clone the repo on the server (for example `/mnt/user/appdata/ldhml-site`) with a deploy key that has write access (GitHub > repo > Settings > Deploy keys > "Allow write access").
2. In the User Scripts plugin, add the script and use a cron schedule such as `45 23 * * *`.
3. Run it once by hand and check the log.

If the server is down, nothing breaks. The site compares its cache with the live schedule and fetches the missing box scores in the visitor's browser.

## Refresh from your own computer

The league server challenges requests from data centers (GitHub's runners, Cloudflare Workers, even a Worker cron), so no server-side job can fetch data. Only browsers on normal connections pass. Visitors still get live data, because their browsers read the API.
To refresh the saved data on Windows, double-click `scripts\refresh.bat` (or run it from a terminal). It pulls `main`, runs `node scraper/fetch.mjs --force`, then commits and pushes `data/` and `registry/`. Needs git and Node. Elsewhere, run `npm run fetch:force`, then commit and push `data/` and `registry/`.

## Data source

The official site shows its tables inside frames from `admin.nbhpa.com`. Those frames load data from public endpoints that need no sign-in:

| Data | Endpoint |
| --- | --- |
| Standings | `GET /table_data.php?class=Standings&season_id=...&category_id=...` (JSON) |
| Skaters | `POST /sites/site_stats_players.php` (data is embedded in the page as `stats_player`) |
| Goalies | `POST /sites/site_stats_goalies.php` (same format) |
| Schedule and scores | `POST /sites/site_schedule_include.php` (HTML rows) |
| Box score of one game | `GET /sites/site_game_recap.php?game_id=...&league_id=10` (HTML: lines per player, goals with scorer and assists, penalties, shots) |

All leagues share `league_id=10` and one season (`season_id=4307`, LDHML AUTOMNE 2026), set in `leagues.json`. Each league has its own `category_id` (Retro 6796, Vintage 3661, Draft 2433, 3v3 A 1896, 3v3 B 1909, 4v4 B 1913). When a new season starts, change `seasonId` and `seasonName`, and check the category ids on the official standings page.

## Live mode

The page reads the public NBHPA league pages, straight from the browser (they allow any origin).
It starts from the saved snapshot, then refreshes what the visitor looks at:

| What | When |
|---|---|
| Game clock, score, shots, penalty box, goalies: `GET /livegame_json/{gameId}` (about 350 bytes) | Every 30 s, only for games of today, from 30 min before the start |
| Box score of a live game (goals, assists, penalties) | Every 2 min, only while the visitor looks at the live page, the home page or that game |
| Standings, schedule, skater and goalie stats | Only for the page on screen, when older than 5-15 min (shorter on game night). Right after a final score, once. |

Rules in the code: one request at a time with a pause, nothing while the tab is hidden, longer waits after errors,
a 5 minute stop after HTTP 429. It never uses the staff tools (`admin.nbhpa.com/livegame/...`, its WebSocket).
A bad answer (empty table, fewer rows) never replaces good data.

Live mode needs a normal web page (GitHub Pages, a file on disk). The sandbox of an Artifact preview blocks it, so the preview shows the snapshot and says so.


## Be polite to the source

- The scraper waits 1.5 seconds between requests and sends a clear User-Agent.
- It keeps the old data if a response looks wrong.
- In the browser the site reads the public NBHPA pages one request at a time, with pauses, never while the tab is hidden, and never the staff pages. Rates are in `POLL` (`site/js/3-live.js`).
- Team logos load from `admin.nbhpa.com` in the browser. There is no agreement with NBHPA yet about this use (open item, see `docs/open-items.md`).

## Automatic refresh

`.github/workflows/refresh.yml` builds the site and publishes it to GitHub Pages on every push to `main` (with a preview of each other branch). It does not fetch data (see above). Refresh `data/` from your own computer with `npm run fetch:force`.

## Known limits

- The league leaves some goals without a scorer ("team goal"). The site shows them as such and counts them in the team score, but not in any player line. The league's own season stats have the same gap.
- Penalties often have no player name in the source. They show as team penalties.
- Shots against and saves exist only when a goalie was recorded for the team in that game.
- A player who played for several teams has one combined stat line in the source. The site rebuilds per-team lines from box scores (scope "main team", default; "all" shows the combined line).
- Power-play, short-handed and overtime columns are hidden because the league does not track them. They appear by themselves if the source starts to send values.
- The page is in French and English. French is the default. The visitor's choice is saved in the browser.

## Next steps if the league likes it

- Ask NBHPA for a read-only API or a data export. That removes the need for scraping.
- Move to a framework with one real URL per team and player (for example Astro) for search engines and sharing.
