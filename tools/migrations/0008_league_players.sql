-- Who plays in a league for a season: one row per person, league and season (owner, 2026-10-17).
-- Team leagues: written when a player is put on a team. Draft leagues: an admin signs the person up (status 'in', or
-- 'wait' when the league is full); the draft then puts them on a team (rosters). A replacement player has no row:
-- the section list (section_players, with the salary) is enough. Active in a season = a row with status 'in'.
CREATE TABLE league_players (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),
  league     TEXT    NOT NULL,
  person_id  INTEGER NOT NULL REFERENCES people(id),
  pos        TEXT    NOT NULL CHECK (pos IN ('s', 'g')),
  status     TEXT    NOT NULL DEFAULT 'in' CHECK (status IN ('in', 'wait', 'out')),   -- signed up, waiting list, withdrew
  created_at INTEGER NOT NULL,                                                        -- the sign-up (waiting list order)
  created_by INTEGER REFERENCES admins(id),
  updated_at INTEGER,
  updated_by INTEGER REFERENCES admins(id),
  UNIQUE (season_id, league, person_id)
);
CREATE INDEX league_players_person ON league_players (person_id);

-- Places per team, captain included (4v4: 4 men, 4 women, 1 goalie). NULL = not set (no limit).
ALTER TABLE season_leagues ADD COLUMN places_m INTEGER;
ALTER TABLE season_leagues ADD COLUMN places_f INTEGER;
ALTER TABLE season_leagues ADD COLUMN places_g INTEGER;

-- Everyone on a team today plays in that league.
INSERT OR IGNORE INTO league_players (season_id, league, person_id, pos, status, created_at, created_by)
  SELECT season_id, league, person_id, pos, 'in', added_at, added_by FROM rosters WHERE removed_at IS NULL;
