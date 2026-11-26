-- Separate community app listings from website/tool submissions while keeping
-- the existing review/payment workflow. Existing rows remain websites.
ALTER TABLE submissions ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'website';
ALTER TABLE submissions ADD COLUMN app_stores TEXT NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_submissions_type_status_created
  ON submissions (listing_type, status, created_at);
