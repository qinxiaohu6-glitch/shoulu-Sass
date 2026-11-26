-- `detail_en` / `detail_zh` / `shots` exist in schema.sql but were never added to
-- databases created before those columns landed: `CREATE TABLE IF NOT EXISTS`
-- leaves an existing table untouched, so production was still on the old shape.
-- Without them the admin "Edit details" save fails with `no such column:
-- detail_en`, and the public detail page has no editorial copy to read.
ALTER TABLE submissions ADD COLUMN detail_en TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN detail_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN shots TEXT NOT NULL DEFAULT '';
