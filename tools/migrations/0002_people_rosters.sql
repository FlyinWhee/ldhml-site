-- People, league player lists, our own teams, rosters, league rules. Read tools/CLAUDE.md.
-- All per season, except people (one person across seasons: history).

-- One row per person, kept across seasons. id: database number. site_id: our id on the stats site ("L0137"), when known.
-- nid: the NBHPA person id, when known (a registered player who has not played yet has none).
-- Birth: month and year only (age rules). Personal data: never in git.
CREATE TABLE people (
  id          INTEGER PRIMARY KEY,
  site_id     TEXT UNIQUE,
  nid         TEXT UNIQUE,
  name        TEXT    NOT NULL,
  sex         TEXT    CHECK (sex IN ('m', 'f')),
  birth_year  INTEGER CHECK (birth_year BETWEEN 1900 AND 2100),
  birth_month INTEGER CHECK (birth_month BETWEEN 1 AND 12),
  created_at  INTEGER NOT NULL,
  created_by  INTEGER REFERENCES admins(id)
);

-- The league player list: who is registered in a section for a season, with the draft "salary" per position (skater s, goalie g).
CREATE TABLE section_players (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),
  section    TEXT    NOT NULL,                          -- "draft", "teams" (leagues.json sections)
  person_id  INTEGER NOT NULL REFERENCES people(id),
  salary_s   REAL,
  salary_g   REAL,
  created_at INTEGER NOT NULL,
  created_by INTEGER REFERENCES admins(id),
  UNIQUE (season_id, section, person_id)
);

-- Our own teams, per season and league. nbhpa_team_id links to the stats data when the team exists there.
CREATE TABLE teams (
  id            INTEGER PRIMARY KEY,
  season_id     INTEGER NOT NULL REFERENCES seasons(id),
  league        TEXT    NOT NULL,                       -- league slug ("retro")
  name          TEXT    NOT NULL,
  abb           TEXT    NOT NULL,
  nbhpa_team_id TEXT,
  created_at    INTEGER NOT NULL,
  created_by    INTEGER REFERENCES admins(id)
);
CREATE UNIQUE INDEX teams_nbhpa ON teams (season_id, league, nbhpa_team_id) WHERE nbhpa_team_id IS NOT NULL;

-- Rosters: a person on a team for a season, at a position. Removing keeps the row (removed_at): a transaction history.
-- One active team per person per league and season.
CREATE TABLE rosters (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),
  league     TEXT    NOT NULL,
  team_id    INTEGER NOT NULL REFERENCES teams(id),
  person_id  INTEGER NOT NULL REFERENCES people(id),
  pos        TEXT    NOT NULL CHECK (pos IN ('s', 'g')),
  added_at   INTEGER NOT NULL,
  added_by   INTEGER REFERENCES admins(id),
  removed_at INTEGER,
  removed_by INTEGER REFERENCES admins(id)
);
CREATE UNIQUE INDEX rosters_open ON rosters (season_id, league, person_id) WHERE removed_at IS NULL;
CREATE INDEX rosters_team ON rosters (team_id);

-- League rules: one row per league and season. No rule engine: each check is coded when the league confirms it.
CREATE TABLE league_rules (
  season_id   INTEGER NOT NULL REFERENCES seasons(id),
  league      TEXT    NOT NULL,
  salary_cap  REAL,                                     -- per team; NULL = no cap
  min_age_m   INTEGER,                                  -- replacement age rules; NULL = none
  min_age_f   INTEGER,
  min_age_g   INTEGER,                                  -- goalies (any sex)
  notes       TEXT,                                     -- the rule in words, for people
  updated_at  INTEGER NOT NULL,
  updated_by  INTEGER REFERENCES admins(id),
  PRIMARY KEY (season_id, league)
);

-- Captain access now points to OUR team. Existing rows: a team is created for each, from the copied names.
ALTER TABLE captain_access ADD COLUMN team_ref INTEGER REFERENCES teams(id);
INSERT INTO teams (season_id, league, name, abb, nbhpa_team_id, created_at, created_by)
  SELECT season_id, league, MAX(team_name), MAX(team_abb), team_id, MIN(created_at), NULL
  FROM captain_access GROUP BY season_id, league, team_id;
UPDATE captain_access SET team_ref = (SELECT t.id FROM teams t WHERE t.season_id = captain_access.season_id AND t.league = captain_access.league AND t.nbhpa_team_id = captain_access.team_id);
