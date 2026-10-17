-- A captain can hide a refused request from their page (owner: noise). It stays in the admin history (a league decision).
ALTER TABLE replacements ADD COLUMN captain_hidden_at INTEGER;
