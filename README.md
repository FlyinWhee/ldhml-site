# LDHML Stats (proof of concept)

A fast, cross-linked stats site for the LDHML ball hockey leagues.
The home page lists every league. Each league has its own page, theme and data. Every team name and every player name is a link.

| URL | Page |
| --- | --- |
| `/` | LDHML home page: one card per league, next game nights |
| `/retro/`, `/vintage/`, `/draft/`, `/3v3-a/`, `/3v3-b/`, `/4v4-b/` | One league: standings, teams, schedule, players, goalies, leaders, live page |

A picker in the bottom right corner of every page switches league. Pages work in French (default) and English.

## How it works

1. `leagues.json` lists the leagues (URL slug, NBHPA category id, theme). Add a league there, then run the fetch.
2. `scraper/fetch.mjs` reads the data of each league from the public NBHPA pages. It makes about 4 requests per league, plus one for each new finished game. The snapshot is saved in `data/<slug>/`.
3. `build.mjs` puts each snapshot inside `site/template.html`. Each league becomes one static file, `dist/<slug>/index.html`. The home page is `dist/index.html`.
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
npm run build                 # build dist/
npm test                      # parser tests, build, click-through test of every page of every league, home page test, live test
```

Open `dist/index.html` in a browser to see the site.

## Refresh from a home server (Unraid)

`scripts/unraid-refresh.sh` pulls the repo, runs `node scraper/fetch.mjs` in a Node container, and pushes `data/` if it changed. The push triggers the Pages deploy.

1. Clone the repo on the server (for example `/mnt/user/appdata/ldhml-site`) with a deploy key that has write access (GitHub > repo > Settings > Deploy keys > "Allow write access").
2. In the User Scripts plugin, add the script and use a cron schedule such as `45 23 * * *`.
3. Run it once by hand and check the log.

If the server is down, nothing breaks. The site compares its cache with the live schedule and fetches the missing box scores in the visitor's browser.

## Refresh from your own computer

The league server challenges requests from data centers (GitHub's runners, Cloudflare Workers, even a Worker cron), so no server-side job can fetch data. Only browsers on normal connections pass. Visitors still get live data, because their browsers read the API.
To refresh the saved data, run `npm run fetch:force` on your own computer, then commit and push `data/`.

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
| Game clock, score, shots, penalty box, goalies: `GET /livegame_json/{gameId}` (about 350 bytes) | Every 15 s, only for games of today, from 30 min before the start |
| Box score of a live game (goals, assists, penalties) | Every 60 s, only while the visitor looks at the live page, the home page or that game |
| Standings, schedule, skater and goalie stats | Only for the page on screen, when older than 2-10 min (shorter on game night). Right after a final score, once. |

Rules in the code: one request at a time with a pause, nothing while the tab is hidden, longer waits after errors,
a 5 minute stop after HTTP 429. It never uses the staff tools (`admin.nbhpa.com/livegame/...`, its WebSocket).
A bad answer (empty table, fewer rows) never replaces good data.

Live mode needs a normal web page (GitHub Pages, a file on disk). The sandbox of an Artifact preview blocks it, so the preview shows the snapshot and says so.

Optional: `worker/proxy.js` is a Cloudflare Worker that caches those pages for 10-60 s. With it, 200 visitors cause one request per period, not 200.
Set `<meta name="ldhml-api" content="https://your-worker.workers.dev">` to use it.

Unverified until a real game (next one: see the schedule): the `status` text during play (anything but `over` is shown as live), and the box score layout of a game in progress.

## Be polite to the source

- The scraper waits 1.5 seconds between requests and sends a clear User-Agent.
- It keeps the old data if a response looks wrong.
- The site itself never calls the NBHPA servers. Visitors only read the saved snapshot.
- Team logos load from `admin.nbhpa.com` in the browser. Ask the league before you ship this to many users, or copy the logos into the project.

## Automatic refresh

`.github/workflows/refresh.yml` builds the site and publishes it to GitHub Pages on every push. It does not fetch data (see above). Refresh `data/` from your own computer with `npm run fetch:force`.

## Known limits

- The league leaves some goals without a scorer ("team goal"). The site shows them as such and counts them in the team score, but not in any player line. The league's own season stats have the same gap.
- Penalties often have no player name in the source. They show as team penalties.
- Shots against and saves exist only when a goalie was recorded for the team in that game.
- A player who played for several teams has one combined stat line. The source does not split it by team.
- Power-play, short-handed and overtime columns are hidden because the league does not track them. They appear by themselves if the source starts to send values.
- The page is in French and English. French is the default. The visitor's choice is saved in the browser.

## Next steps if the league likes it

- Ask NBHPA for a read-only API or a data export. That removes the need for scraping.
- Move to a framework with one real URL per team and player (for example Astro) for search engines and sharing.
- Add a short-lived cache (for example a Cloudflare Worker) in front of the league endpoints if you want a live mode.
