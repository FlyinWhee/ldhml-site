-- Payments (owner, 2026-11-21). Admins record them; admins and captains see what each player owes.
--   league_prices  one row per league (NOT per season: the admins change it when the price changes; an inscription keeps its own
--                  amount and number of seasons, so a later change never rewrites the past. Reason in docs/decisions.md).
--   inscriptions   what a player owes in a league: from a first season, for N seasons (1, or a multi-season plan), an amount.
--                  Made by the tools when a player is added to a league (roster or sign-up); deleted when removed, unless paid.
--   payments       money received against an inscription (partial payments are common); the date is the entry time.
-- Money is in cents (INTEGER).
CREATE TABLE league_prices (
  league       TEXT    PRIMARY KEY,
  season_price INTEGER,                                   -- one season (cents); NULL: not set
  plan_on      INTEGER NOT NULL DEFAULT 0,                -- the multi-season plan is offered
  plan_price   INTEGER,                                   -- the plan (cents)
  plan_seasons INTEGER NOT NULL DEFAULT 3 CHECK (plan_seasons BETWEEN 2 AND 12),
  updated_at   INTEGER NOT NULL,
  updated_by   INTEGER REFERENCES admins(id)
);

CREATE TABLE inscriptions (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),    -- the first season it covers
  league     TEXT    NOT NULL,
  person_id  INTEGER NOT NULL REFERENCES people(id),
  seasons    INTEGER NOT NULL DEFAULT 1 CHECK (seasons BETWEEN 1 AND 12),
  amount     INTEGER,                                   -- cents; NULL: the league price was not set yet
  note       TEXT,
  created_at INTEGER NOT NULL,
  created_by INTEGER REFERENCES admins(id),
  updated_at INTEGER,
  updated_by INTEGER REFERENCES admins(id)
);
CREATE INDEX inscriptions_person ON inscriptions (person_id, league);
CREATE INDEX inscriptions_season ON inscriptions (season_id, league);

CREATE TABLE payments (
  id             INTEGER PRIMARY KEY,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id),
  amount         INTEGER NOT NULL,                      -- cents
  method         TEXT,                                  -- optional: "Interac", "comptant"…
  note           TEXT,
  created_at     INTEGER NOT NULL,                      -- the payment date shown (when it was entered)
  created_by     INTEGER REFERENCES admins(id)
);
CREATE INDEX payments_inscription ON payments (inscription_id);

-- The players already in a league get their inscription (one season, no amount yet: it is filled when the league price is set).
INSERT INTO inscriptions (season_id, league, person_id, seasons, amount, created_at)
  SELECT season_id, league, person_id, 1, NULL, created_at FROM league_players;
