-- The playoffs (owner, 2026-11-25): NBHPA keeps them in their own season (new team records, same categories).
-- A tools season links to it: the stats site shows the playoffs with that season. The stats site refresh
-- (Configuration > Données du site public) writes it into leagues.json ("playoffs").
ALTER TABLE seasons ADD COLUMN nbhpa_playoff_season_id INTEGER;
