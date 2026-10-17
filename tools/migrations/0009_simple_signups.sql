-- Sign-ups stay simple (owner, 2026-10-17): no places per team, no waiting list, no status. A person is signed up in a
-- league or not; admins manage the rest. The draft pool exists only for a draft run by the tools (later); without it,
-- admins create teams and put players on them, as before.
DELETE FROM league_players WHERE status <> 'in';
ALTER TABLE league_players DROP COLUMN status;
ALTER TABLE season_leagues DROP COLUMN places_m;
ALTER TABLE season_leagues DROP COLUMN places_f;
ALTER TABLE season_leagues DROP COLUMN places_g;
