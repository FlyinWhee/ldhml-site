-- Game-night lineups (owner, 2026-11-20; docs/tools.md "Game-night lineups"). A replacement request becomes the record of
-- the changes to ONE team's lineup for ONE game: who is absent, who replaces them, the number they wear. One open record
-- per team and game (the app merges); easy to change up to the last minute; approved automatically when every check passes.

-- The regular number of a player on a team, for the season. Editable at any time; games keep their own copy (game_rosters).
ALTER TABLE rosters ADD COLUMN jersey TEXT;

-- The lineup record: who changed it last, and whether it was approved automatically (every check passed).
ALTER TABLE replacements ADD COLUMN updated_at INTEGER;
ALTER TABLE replacements ADD COLUMN updated_kind TEXT CHECK (updated_kind IN ('captain', 'admin'));
ALTER TABLE replacements ADD COLUMN updated_by INTEGER;
ALTER TABLE replacements ADD COLUMN auto INTEGER NOT NULL DEFAULT 0 CHECK (auto IN (0, 1));

-- A line can now be an absent player with NO replacement (the team plays short), and carries the replacement's number
-- for the night (often a spare jersey). SQLite cannot change a CHECK in place: the table is rebuilt (nothing points to it).
CREATE TABLE replacement_lines_new (
  id             INTEGER PRIMARY KEY,
  replacement_id INTEGER NOT NULL REFERENCES replacements(id),
  absent_id      INTEGER NOT NULL REFERENCES people(id),
  absent_pos     TEXT    NOT NULL CHECK (absent_pos IN ('s', 'g')),
  absent_salary  REAL,
  sub_id         INTEGER REFERENCES people(id),           -- NULL: a guest, or nobody (absent, not replaced)
  sub_pos        TEXT    NOT NULL CHECK (sub_pos IN ('s', 'g')),
  sub_salary     REAL,
  sub_jersey     TEXT,                                    -- the number the replacement wears that night
  guest_name     TEXT,
  guest_sex      TEXT    CHECK (guest_sex IN ('m', 'f')),
  guest_age      INTEGER CHECK (guest_age BETWEEN 10 AND 120),
  guest_nid      TEXT,
  CHECK (sub_id IS NULL OR guest_name IS NULL),
  CHECK (guest_name IS NULL OR guest_sex IS NOT NULL)
);
INSERT INTO replacement_lines_new (id, replacement_id, absent_id, absent_pos, absent_salary, sub_id, sub_pos, sub_salary, guest_name, guest_sex, guest_age, guest_nid)
  SELECT id, replacement_id, absent_id, absent_pos, absent_salary, sub_id, sub_pos, sub_salary, guest_name, guest_sex, guest_age, guest_nid FROM replacement_lines;
DROP TABLE replacement_lines;
ALTER TABLE replacement_lines_new RENAME TO replacement_lines;
CREATE INDEX replacement_lines_req ON replacement_lines (replacement_id);
CREATE INDEX replacement_lines_sub ON replacement_lines (sub_id);

-- The roster of a team as it was for a past game (players, positions, numbers). Written just before a roster change
-- touches a team (add, remove, number), for its games already played that have no copy yet: a later change never
-- rewrites a past game. A game with no copy uses the current roster (nothing changed since).
CREATE TABLE game_rosters (
  game_ref  INTEGER NOT NULL REFERENCES games(id),
  team_id   INTEGER NOT NULL REFERENCES teams(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  pos       TEXT    NOT NULL CHECK (pos IN ('s', 'g')),
  jersey    TEXT,
  PRIMARY KEY (game_ref, team_id, person_id)
);
CREATE INDEX game_rosters_team ON game_rosters (team_id, game_ref);
