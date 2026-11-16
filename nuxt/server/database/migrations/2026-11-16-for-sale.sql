-- For-sale listings. Apply on D1 before these pages are served in production.
-- This file does not create a Waffo product, does not change directory prices,
-- and does not put the $9.90 fee into the campaign.

CREATE TABLE IF NOT EXISTS for_sale_listing (
  id            TEXT    PRIMARY KEY,
  product_slug  TEXT    NOT NULL,
  product_name  TEXT    NOT NULL DEFAULT '',
  owner_sub     TEXT    NOT NULL,
  -- Used only to email the seller. Public responses must not select it.
  owner_email   TEXT    NOT NULL DEFAULT '',
  asking_cents  INTEGER NOT NULL DEFAULT 0,
  revenue       TEXT    NOT NULL DEFAULT '',
  profit        TEXT    NOT NULL DEFAULT '',
  team          TEXT    NOT NULL DEFAULT '',
  stack         TEXT    NOT NULL DEFAULT '',
  -- draft | paid_pending_review | active | sold | withdrawn | rejected
  status        TEXT    NOT NULL DEFAULT 'draft',
  paid_at       INTEGER,
  reviewed_at   INTEGER,
  reviewer      TEXT    NOT NULL DEFAULT '',
  review_note   TEXT    NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_for_sale_product ON for_sale_listing (product_slug);
CREATE INDEX IF NOT EXISTS idx_for_sale_status ON for_sale_listing (status);
CREATE INDEX IF NOT EXISTS idx_for_sale_owner ON for_sale_listing (owner_sub);

CREATE TABLE IF NOT EXISTS for_sale_interest (
  id          TEXT    PRIMARY KEY,
  listing_id  TEXT    NOT NULL,
  buyer_sub   TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (listing_id, buyer_sub)
);

CREATE INDEX IF NOT EXISTS idx_for_sale_interest_listing ON for_sale_interest (listing_id);
