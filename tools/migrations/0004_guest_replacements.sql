-- A replacement by a player who is not on the list ("joueur hors-ligue"): the line names a guest (name and sex required;
-- age and NBHPA no. optional)
-- instead of a person. Such a request never passes the checks (a note is required; the admins decide).
-- The guest stays on the line only: no people row is made from a captain's input; it goes with the request.
-- SQLite cannot drop a NOT NULL in place: the table is rebuilt (no other table points to it).
CREATE TABLE replacement_lines_new (
  id             INTEGER PRIMARY KEY,
  replacement_id INTEGER NOT NULL REFERENCES replacements(id),
  absent_id      INTEGER NOT NULL REFERENCES people(id),
  absent_pos     TEXT    NOT NULL CHECK (absent_pos IN ('s', 'g')),
  absent_salary  REAL,
  sub_id         INTEGER REFERENCES people(id),           -- NULL for a guest
  sub_pos        TEXT    NOT NULL CHECK (sub_pos IN ('s', 'g')),
  sub_salary     REAL,
  guest_name     TEXT,
  guest_sex      TEXT    CHECK (guest_sex IN ('m', 'f')),
  guest_age      INTEGER CHECK (guest_age BETWEEN 10 AND 120),
  guest_nid      TEXT,
  CHECK ((sub_id IS NOT NULL) <> (guest_name IS NOT NULL)),
  CHECK (guest_name IS NULL OR guest_sex IS NOT NULL)
);
INSERT INTO replacement_lines_new (id, replacement_id, absent_id, absent_pos, absent_salary, sub_id, sub_pos, sub_salary)
  SELECT id, replacement_id, absent_id, absent_pos, absent_salary, sub_id, sub_pos, sub_salary FROM replacement_lines;
DROP TABLE replacement_lines;
ALTER TABLE replacement_lines_new RENAME TO replacement_lines;
CREATE INDEX replacement_lines_req ON replacement_lines (replacement_id);
CREATE INDEX replacement_lines_sub ON replacement_lines (sub_id);
