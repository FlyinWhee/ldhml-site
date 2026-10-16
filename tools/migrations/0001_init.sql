-- LDHML tools database (Cloudflare D1, SQLite). Read tools/CLAUDE.md first.
-- Rules: every feature table links to a season. Personal data (emails) lives ONLY here, never in the git repo.
-- Times are Unix seconds (UTC).

-- A season of the leagues (for example "Automne 2026", NBHPA season_id 4307). Every feature belongs to a season.
CREATE TABLE seasons (
  id              INTEGER PRIMARY KEY,
  key             TEXT    NOT NULL UNIQUE,              -- "automne-2026"
  name            TEXT    NOT NULL,                     -- "Automne 2026"
  nbhpa_season_id INTEGER,                              -- 4307 (links to the stats data)
  status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'archived')),
  created_at      INTEGER NOT NULL,
  created_by      INTEGER REFERENCES admins(id)
);

-- Admins. Separate from captains: separate table, sign-in, cookie and session kind.
CREATE TABLE admins (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,                -- lower case
  name          TEXT    NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER,
  disabled_at   INTEGER
);

-- Captain accounts, created by an admin. person_id = our player id (registry/people.json, "L0001") when the captain also plays.
CREATE TABLE captains (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,                -- lower case
  name          TEXT    NOT NULL,
  person_id     TEXT,
  created_at    INTEGER NOT NULL,
  created_by    INTEGER REFERENCES admins(id),
  last_login_at INTEGER,
  disabled_at   INTEGER
);

-- What a captain may manage: one team of one league, for one season. Revoked rows stay (history).
-- Team names are copied at grant time, so the history reads well when the stats data changes.
CREATE TABLE captain_access (
  id          INTEGER PRIMARY KEY,
  captain_id  INTEGER NOT NULL REFERENCES captains(id),
  season_id   INTEGER NOT NULL REFERENCES seasons(id),
  league      TEXT    NOT NULL,                         -- league slug ("retro")
  team_id     TEXT    NOT NULL,                         -- NBHPA team id
  team_abb    TEXT    NOT NULL,
  team_name   TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  created_by  INTEGER REFERENCES admins(id),
  revoked_at  INTEGER,
  revoked_by  INTEGER REFERENCES admins(id)
);
CREATE UNIQUE INDEX captain_access_open ON captain_access (captain_id, season_id, team_id) WHERE revoked_at IS NULL;
CREATE INDEX captain_access_season ON captain_access (season_id);

-- One-time sign-in codes. No raw email or IP: only keyed hashes (HMAC with the CODE_PEPPER secret).
CREATE TABLE login_codes (
  id         INTEGER PRIMARY KEY,
  kind       TEXT    NOT NULL CHECK (kind IN ('admin', 'captain')),
  email_h    TEXT    NOT NULL,
  user_id    INTEGER,                                   -- NULL when the email is not an account (kept for rate limits only)
  code_h     TEXT    NOT NULL,
  ip_h       TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX login_codes_email ON login_codes (kind, email_h, created_at);
CREATE INDEX login_codes_ip ON login_codes (ip_h, created_at);

-- Sessions. The cookie holds a random token; the database holds only its hash.
CREATE TABLE sessions (
  token_h    TEXT    PRIMARY KEY,
  kind       TEXT    NOT NULL CHECK (kind IN ('admin', 'captain')),
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Every change made by a person: who, when, what.
CREATE TABLE audit (
  id         INTEGER PRIMARY KEY,
  at         INTEGER NOT NULL,
  actor_kind TEXT    NOT NULL,                          -- "admin", "captain", "system"
  actor_id   INTEGER,
  action     TEXT    NOT NULL,                          -- "season.create", "captain.create", "access.grant", ...
  target     TEXT,                                      -- "captain:3"
  detail     TEXT                                       -- JSON
);
CREATE INDEX audit_at ON audit (at);
