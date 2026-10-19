# Presentation guide

## The principle
**This site is for data nerds.** Nobody else reads the stats site of a recreational ball hockey league. So:
- Show the data in full. Give the context a stats reader needs: denominators ("12 of 30 games"), thresholds ("min. 2 GP"), the date of the data, and what the source does not record.
- **Every piece of data links to the page that has more detail about it.** A team goes to its team page, a person to their page in that league, a date or a score to the game page, and a league to its home page.
- **A league, a team or a person looks the same on every page.** The same logo, colors, badge and name, everywhere on the platform (league pages, section pages, entry page, and the tools to come).
- A summary page (section, entry, a future captain tool) always links to the page where the full data is. Example: on a section profile, the league badge opens the person's page in that league.

## What a click opens (the badge rule)
- **A team badge, team name or team chip always opens the team page** (in that team's league). Its meaning never changes with the page.
- **A league badge opens the league in the current context.** On a person (a person's row, a person's profile): that person's page in the league.
  Elsewhere (cards, night lists, the entry page): the league home (or its live or schedule page for a game night).
- The league badge is a **container**: the league part is the context link, the team chips inside are team links. One unit shows "this person, in this league, with these teams" without text labels.
- Every badge has a `title` that says where it goes ("Marco Normandin : statistiques dans LDHML Retro", the team's full name). Touch screens have no hover: keep the targets at least 26 px high.
- Already inside the league (a league page)? The person's own teams link to the team pages; the other leagues of the person are league badges.

## Identity pieces (use these; do not draw them again)

| Thing | How it looks | Code (league pages) | Code (entry and section pages) |
|---|---|---|---|
| League | Logo (`assets/logos/<key>.webp`, `.mk-logo`) + "LDHML" + short name in the theme's brand gradient (`--brand`, `--f-brand`). Theme tokens: `data-league` on the page, `data-t` on a card or block. Dot in `--ball` on chips (`.lcard-mini`). Three-stripe bar (`--stripe-a/b/c`). | `renderChrome()` brand | `logoImg()`, `.lcard-head`, `.pl-lg-name` |
| Team colour | `LDLook.teamColor(slug, abb)`: Retro uses its artwork table, other leagues a stable colour from the code. Set with `style="--tc:" + colorVar` (sets `--tc` and the ink `--tx`). | `colorOf(abb)` | `LDLook.colorVar(l.slug, abb)` |
| Team badge (crest) | Team colour with the code; the NBHPA team logo on top once it loads. Sizes `sm`, default, `lg`. | `crest(abb, size)` | `crestOf(l, abb)` |
| Team, full | Badge + full name, a link to the team page (`.tcell`, `a.tl.strong`). | `teamCell(id)` | `crestOf` + `teamName(l, tm)` |
| Team, compact | Code chip in the team colour (`.tchip`), a link where there is a page to open; the full name is in `title`. **With or without a link it looks the same** (owner, 2026-10-19). For dense table cells. | `abbLinks([abb])` | `teamChips(l, [abb])` |
| League badge | `LDLook.leagueBadge(league, o)`: a container in the league theme (`data-t`): logo (or a dot) + short name in the brand gradient, then the team chips of this context. Size `lg` for a block heading. `extra` adds text (game night). | `crossLinks(pp)` | `badgeOf(l, o)`, `personBadge(p, l)` |
| Person | Name, a link (`a.tl`, `strong` in tables). In a league: their page in the league. Across leagues: the section profile. Box rows hold an NBHPA `player_id`: go through `pLink` / `U()`. | `pLink(id)` | `<a class="tl strong" href="<league>/#player-<id>">` |
| A person's teams | **Main team first, in a frame** (`.is-main`, title "Main team"), then `SUB:` (`.also`) and the teams the person subbed for, by games. In a per-team table: the main team row first, a `SUB` tag (`.subtag`) on the other rows. Games per team where known. The order comes from `people[id].teams` (league pages) and `m.teams` (section pages): never re-sort it in a view. | `viewPlayer`, `byTeamHtml`, `teamsHtml` | `.pl-teams` |
| Player hero | Jersey in the main team colour with the most used number (`jersey()`), name, team links, ranks per position, LED readout. | `viewPlayer` | `.pl-hero` |
| Numbers | Tabular figures (`.num`). Column labels are short with the long name in `title` (`COLS` fr/en `[short, long]`). Sortable tables use `dataTable`. Big numbers in heroes use LED digits (`led()`). | `COLS`, `dataTable`, `readout` | `.tbl` |
| Game, date, score | A link to the game page (`#game-<id>`). Result chips V/D/N link to the opponent (`chip`). | `gameBlock`, `chipFor` | - |

All team visuals come from `shared/look.js` (`LDLook`). It is inlined into every page (and loaded by the tools pages). A new page type uses it; it does not make its own colours or badges. **When a badge or chip looks wrong on one page, fix the component, not the page** (owner, 2026-10-19: the same fix was made page by page several times; one fix in `LDLook` fixes every page). The same goes for the other shared pieces: filters use the `.fbar` / `.fpanel` component of site.css on every page.

## Choosing the form
- A row or a block about one team: badge + full name.
- A dense table cell (many columns, several teams): code chips. The full name is in the tooltip.
- A team in a hero: large badge (`crest-lg`).
- A person: always the name as a link, never only a code or an id.
- A league outside its own pages: a league badge, never plain text only.
- A person in several leagues: one league badge per league, with the person's teams inside.

## Context for the numbers
- Say what a number covers: main team or all teams (`scopeBar`), the snapshot date on pages without live data ("Numbers of 15 October"), the season.
- Say what the source does not record: team goals without a scorer, goals worth 2, missing goalies (see `ambNote`, `unscored`, `logGap`). Never hide a gap; add a note.
- Show thresholds next to the list ("min. 2 GP").

## Checklist for a new view
1. Every team, person, league, game and date is a link to its most detailed page.
2. Teams use `LDLook` (through the helpers above): colour, badge, full name or chip.
3. Leagues show their logo and themed name.
4. Numbers are tabular, the labels have a long form in `title`, both in `fr` and `en`.
5. A summary links to the full data.
6. Look at it at desktop width and at 400 px (see `testing.md`), in light and dark mode.
