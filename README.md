# LDHML Retro Stats (proof of concept)

A fast, cross-linked stats site for the LDHML Retro league.
Every team name and every player name is a link. Standings, schedule, scores, players, goalies and leaders are one click apart.

## How it works

1. `scraper/fetch.mjs` reads the data from the public NBHPA league pages. It makes about 5 requests per run, plus one for each new finished game (box scores are saved in `data/box.json` and only new games, or games from the last 3 days, are requested again) and saves JSON files in `data/`.
2. `build.mjs` puts the JSON inside `site/template.html`. The result is one static file: `dist/index.html`.
3. Any static host can serve that file. No server and no database are needed.

## Commands

```
npm install
npm run fetch        # refresh data (skips if the data is less than 15 minutes old)
npm run fetch:force  # refresh data now
npm run build        # build dist/index.html
npm test             # parser tests, build, and a click-through test of every page
```

Open `dist/index.html` in a browser to see the site.

## Data source

The official site shows its tables inside frames from `admin.nbhpa.com`. Those frames load data from public endpoints that need no sign-in:

| Data | Endpoint |
| --- | --- |
| Standings | `GET /table_data.php?class=Standings&season_id=...&category_id=...` (JSON) |
| Skaters | `POST /sites/site_stats_players.php` (data is embedded in the page as `stats_player`) |
| Goalies | `POST /sites/site_stats_goalies.php` (same format) |
| Schedule and scores | `POST /sites/site_schedule_include.php` (HTML rows) |
| Box score of one game | `GET /sites/site_game_recap.php?game_id=...&league_id=10` (HTML: lines per player, goals with scorer and assists, penalties, shots) |

The IDs for this league are `league_id=10`, `season_id=4307` (LDHML AUTOMNE 2026) and `category_id=6796` (LDHML RETRO). Change them with the `SEASON_ID` and `CATEGORY_ID` environment variables when a new season starts.

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

`.github/workflows/refresh.yml` refreshes the data every 20 minutes on Wednesday nights and once a day otherwise. It then publishes the site to GitHub Pages. This workflow has not been run yet.

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
