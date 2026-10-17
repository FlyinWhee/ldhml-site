-- The tools' own schedule (owner, 2026-10-17: the tools work without NBHPA). One row per game of a league and season,
-- between two of OUR teams. NBHPA is an optional source: the import adds and updates games by their NBHPA no.,
-- and never touches a game an admin changed by hand (edited = 1). Admins can add, change and cancel games.
CREATE TABLE games (
  id            INTEGER PRIMARY KEY,
  season_id     INTEGER NOT NULL REFERENCES seasons(id),
  league        TEXT    NOT NULL,
  date          TEXT    NOT NULL,                      -- YYYY-MM-DD, Toronto
  time          TEXT,                                  -- HH:MM
  venue         TEXT,
  court         TEXT,
  away_team     INTEGER REFERENCES teams(id),
  home_team     INTEGER REFERENCES teams(id),
  cancelled     INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1)),
  nbhpa_game_id TEXT,                                  -- the link to NBHPA, when the game came from there
  edited        INTEGER NOT NULL DEFAULT 0 CHECK (edited IN (0, 1)),
  created_at    INTEGER NOT NULL,
  created_by    INTEGER REFERENCES admins(id),
  updated_at    INTEGER,
  updated_by    INTEGER REFERENCES admins(id)
);
CREATE UNIQUE INDEX games_nbhpa ON games (season_id, league, nbhpa_game_id) WHERE nbhpa_game_id IS NOT NULL;
CREATE INDEX games_day ON games (season_id, date, time);
CREATE INDEX games_teams ON games (away_team, home_team);

-- A replacement points to OUR game (game_id stays: the NBHPA no., kept for history).
ALTER TABLE replacements ADD COLUMN game_ref INTEGER REFERENCES games(id);
-- Team logos live on our teams (the import copies NBHPA's; the colored badge stays the fallback).
ALTER TABLE teams ADD COLUMN logo TEXT;
