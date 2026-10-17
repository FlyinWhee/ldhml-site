-- A league in a season: its settings for that season (owner, 2026-10-16). The league rules row becomes this row:
-- active or not that season (enabled), and its rules (cap, ages, age date, notes). No row = active, no rules.
-- A league switched off for a season is hidden from that season in the tools and takes no replacement; its data stays.
ALTER TABLE league_rules RENAME TO season_leagues;
ALTER TABLE season_leagues ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1));
