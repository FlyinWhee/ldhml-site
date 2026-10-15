# Front end

Read `presentation.md` first: it says how every league, team, person and number must look and link.

No framework. Plain ES5-style JavaScript (`var`, `function`) in one shared scope, HTML built as strings, `innerHTML` render.
Keep this style: do not add `import`, `class`, a bundler or a library. Files are concatenated by `build.mjs`.

## Files and roles
- `1-core.js`: `D`, helpers (`esc`, `norm`, date formatters), `STR` (fr/en texts) and `COLS` (table column labels), `lang`/`t()`/`L()`, `buildModel()`, team colors, `LIVE` state and `eff/boxOf/liveOf/startMs/todayStr`, small components (`BALL`, `GLYPH`, link helpers `pLink(id, fallback, cls)` for people, `abbLinks` for team abbreviations, `crest(abb)` for team badges (built by `LDLook.crest` in `shared/look.js`; a logo that fails to load is removed)), sortable table engine (`ui`, `numCol`, `idxCol`).
- `2-views.js`: view functions, header (`renderChrome`, `renderPicker`, `renderTabbar`, `fitNav`), `VIEWS` map, `parseRoute`, `render`, global search, tooltips, event delegation (bottom of file).
- `3-live.js`: see `live-engine.md`.

## Views (`VIEWS` in 2-views.js)
`home, standings, schedule, players, goalies, leaders, live, teams, team, player, game`. A view returns an HTML string, or `{ band, html }` (`band` goes in `#band` above `main`, used by the league banner).
`render(keepScroll)` writes `#band` and `#main`, sets `aria-current` on nav items, sets `document.title`, resets scroll unless `keepScroll`.
Mobile: bottom tab bar (`TAB_MAIN = live, standings, teams, schedule, leaders`; `TAB_MORE = players, goalies` in the "More" sheet `#more`).

## Rules for editing views
- Escape everything with `esc()`. Data comes from a third party.
- Names and teams: always through the link helpers so they stay links.
- People: `p.id` is our id (`L0001`). A box row holds an NBHPA `player_id`: use `pLink(row[0])` or `U(row[0])`. Never build `#player-` from a box row directly.
- Texts: add a key to **both** `fr` and `en` in `STR` (and `COLS` for table headers). The UI test visits every page in French; check English by hand (`localStorage ldhml-lang=en` or the EN button).
- Numbers that line up: `font-variant-numeric: tabular-nums` (already on `.num`).
- A game's state in a view: use `eff(g)`, `liveOf(g.id)`, `boxOf(g.id)`. Never test `played(g)` alone for "final".
- Do not call `render()` from inside a view. Event handlers at the end of 2-views.js use delegation on `document` (`click`, `input`, `change`, `keydown`, `toggle`, tooltips); new interactive elements use `data-*` attributes and a branch in that handler. Setting `ui.*` then calling `render(true)` is the pattern.
- Use class `lnk` for in-content links. `more` is reserved (fixed mobile menu).

## Live UI pieces
- `liveCard(g)` (live page) and `sbCard(g)` (scoreboard cards): the whole top is an `<a>` to the game page (`.lv-head`, `.sbc-head`). Footer link text is `liveBox` when live, else `openGame`; second link is the official feed (`feedLink`, external, `rel` safe).
- `viewLive()` splits games into `open` (live/upcoming tonight) and `done` (finished tonight) with `<details class="lv-done" id="lvdone">` below. Its `toggle` event writes `LIVE.doneOpen`.
- `liveOnIce(g, lv)`: goalies and penalty box; returns `''` when there is nothing to show (no empty "penalty box" heading).
- Live badge `.livebadge`, red border `.lv.is-live`, `.gboard:has(.livebadge)`, nav dot `.navdot`.
- `#boxload` pill: "Loading N game(s)" while box scores are fetched.

## Styles (`site/style.css`)
One file for hub and leagues. Tokens are CSS variables on `:root`. Theme blocks come from `site/themes.mjs` and are appended after the file by the build (`:root[data-league="<theme>"]`), in three blocks (light, dark by system setting, dark by toggle).
The default theme is the first block of `style.css` (used by the hub and by "theme off").
Dark mode: automatic by `prefers-color-scheme`; manual toggle is `data-theme` on `<html>`. Every color must come from a token.
Appended sections at the end of the file hold the live UI rules; keep related rules together there.

### Themes (`site/themes.mjs`)
Each theme: `mark` (ball icon colors), `brand` (gradient of the league name), optional `brandFont`, `light`/`dark` token overrides (without `--`), optional `decor` CSS (`{T}` = theme selector).
`themeCss()` builds the three blocks per theme. `cardCss()` builds the hub card styles per theme.
Team colors: `shared/look.js` (`LDLook`), the same on every page. Retro uses a fixed table (`COLORS` there, from the artwork); other leagues use a stable colour made from the code.

## Entry page and section pages (`site/hub/`)
Separate, small: `hub.html` (shell), `hub.css`, `hub.js` (own `STR` fr/en, same storage keys `ldhml-lang`, `ldhml-theme` as league pages so the choice is shared).
One app, two kinds (`H.kind`): `root` (cards per section, no API request) and `section` (cards per league, `#players`, `#player-<id>`; reads the standings of its leagues on load, in sequence, stops after failures). The section header reuses the league header classes (`.top-in.sec-top`, `.brand`, `.nav`); on phones its menu stays visible (`.sec-top .nav`) because there is no tab bar. `LDHML_NOW` (string, test only) fakes the date.

## Sections in league pages
The picker lists the section page and the leagues of this section only. The footer links to the section page (`D.base`) and the entry page (`D.root`). The player page ends its hero with `crossLinks(pp)`: the section profile, the other leagues of the section, the profile in the other section (`.pxl`). Ratings: `pp.rank.s` / `pp.rank.g`; both are shown with labels when both exist.

## Search
Global search (`#gs`): index of teams and people (`buildSearch`, rebuilt when the model changes). Accent-insensitive (`norm`). Arrow keys and Enter work; Escape clears and closes it.

## Accessibility
`#main` has `tabindex=-1`, `aria-current` on nav, focus styles through `--focus`, `aria-pressed` on toggles. Keep them when you change markup.
