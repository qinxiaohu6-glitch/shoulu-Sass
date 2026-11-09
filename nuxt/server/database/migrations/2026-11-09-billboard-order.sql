-- Billboard checkout columns.
--
-- Apply to D1 before any deploy that reads these columns. This file is not
-- executed by the app, by `npm test`, or by this change set.
-- Safe to re-run only if the columns are still absent: SQLite has no
-- ADD COLUMN IF NOT EXISTS.

ALTER TABLE billboard_placement ADD COLUMN order_id TEXT NOT NULL DEFAULT '';
ALTER TABLE billboard_placement ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_billboard_order ON billboard_placement (order_id);
