-- Every league has a price (owner, 2026-11-22: "a default of 200 for now"; an inscription with no amount should never really
-- happen). A league with no league_prices row uses DEFAULT_PRICE (src/payments.js); the inscriptions with no amount get it now.
UPDATE inscriptions SET amount = 20000 WHERE amount IS NULL;
