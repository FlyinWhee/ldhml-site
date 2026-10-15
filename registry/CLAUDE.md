# registry/

Our own data about people. **This is a source of truth, not a cache.** Unlike `../data/`, it cannot be rebuilt from NBHPA without losing the ids.

## `people.json`
One person per line: `{ id, nid, name, sex, pids, since }`, plus `next` (the next number to give).
- `id` (`L0001`): our id. It is used in every player link (`#player-L0001`) and will be the key for captain tools, sub requests and our own ranks.
- `nid`: the NBHPA person id (`nbhpa_player_id`), the foreign key to the federated player system. One `nid` = one person.
- `pids`: every NBHPA `player_id` seen for this person. NBHPA can give one person several (registrations); box scores use them.
- `name`, `sex`: as NBHPA sends them (the pages clean names with `niceName`).
- `since`: the season when we first saw the person.
- Planned: `ranks: { <rankSystem key>: { s, g } }`, our own ranks per position (see `rankSystems` in `../leagues.json` and `../docs/data-formats.md`).

## Rules
- An id is never changed, never reused, never deleted. `next` only goes up. A person who stops playing keeps the record.
- `scraper/registry.mjs` adds new people after each fetch (`npm run registry` runs it alone). It refuses to save when the data contradicts the registry (a `player_id` that moves to another `nid`, a row without `nid`). Read the message; do not bypass it.
- Hand edits are allowed for fields that are ours (later: ranks). Keep one person per line. Run `npm test` after.
- Commit it with `data/` (the refresh scripts do).
- Phase 2 (captain tools) will likely move this into a database. This file is then the seed.
