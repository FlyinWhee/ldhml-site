-- Replacement requests: a team asks for replacement players for one game. Read tools/CLAUDE.md and docs/tools.md.
-- A captain builds the request (or an admin builds it for them); the checks run before it is sent; an admin decides.

-- One request = one game of one team. The game is the NBHPA game when it is in the stats data (game_id), or a date
-- (and time) typed by hand. game_label is copied so the history reads well when the stats data moves on.
CREATE TABLE replacements (
  id            INTEGER PRIMARY KEY,
  season_id     INTEGER NOT NULL REFERENCES seasons(id),
  league        TEXT    NOT NULL,
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  game_id       TEXT,
  game_date     TEXT    NOT NULL,                       -- YYYY-MM-DD, Toronto
  game_time     TEXT,                                   -- HH:MM, when known
  game_label    TEXT,                                   -- "FLI @ GHO · Surface X 1"
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
  result        TEXT    NOT NULL CHECK (result IN ('ok', 'warn', 'fail')),   -- summary of the checks
  checks        TEXT    NOT NULL,                       -- JSON: every check and the payroll numbers (at submit, again at the decision)
  note          TEXT,                                   -- from the requester; required when a check fails
  created_at    INTEGER NOT NULL,
  created_kind  TEXT    NOT NULL CHECK (created_kind IN ('captain', 'admin')),
  created_by    INTEGER,                                -- captain or admin id (two tables: no foreign key). NULL once the account is deleted.
  decided_at    INTEGER,
  decided_by    INTEGER REFERENCES admins(id),
  decision_note TEXT,
  cancelled_at  INTEGER                                 -- who cancelled: the audit row
);
CREATE INDEX replacements_season ON replacements (season_id, league, status);
CREATE INDEX replacements_team ON replacements (team_id, game_date);

-- One line per absent player: who is absent (from the team's roster) and who replaces them, at which position.
-- Salaries are copied when the request is saved (the cap check of that day).
CREATE TABLE replacement_lines (
  id             INTEGER PRIMARY KEY,
  replacement_id INTEGER NOT NULL REFERENCES replacements(id),
  absent_id      INTEGER NOT NULL REFERENCES people(id),
  absent_pos     TEXT    NOT NULL CHECK (absent_pos IN ('s', 'g')),
  absent_salary  REAL,
  sub_id         INTEGER NOT NULL REFERENCES people(id),
  sub_pos        TEXT    NOT NULL CHECK (sub_pos IN ('s', 'g')),
  sub_salary     REAL
);
CREATE INDEX replacement_lines_req ON replacement_lines (replacement_id);
CREATE INDEX replacement_lines_sub ON replacement_lines (sub_id);

-- The age rule counts on the game date ('game', the default when NULL) or in the calendar year of the game ('year').
ALTER TABLE league_rules ADD COLUMN age_on TEXT CHECK (age_on IN ('game', 'year'));
