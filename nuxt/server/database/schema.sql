-- Schema for the directory's write path.
--
-- One file, applied to both stores: Cloudflare D1 in production, a local
-- SQLite file under `nuxt dev`. D1 *is* SQLite, so the only thing that has to
-- stay portable is the SQL itself — no `AUTOINCREMENT`, no `STRICT`, no
-- dialect-specific defaults. Everything below runs verbatim on both.
--
-- Timestamps are integer Unix seconds, matching the old file store, so
-- existing records port over without a format decision.

CREATE TABLE IF NOT EXISTS submissions (
  -- `website` preserves every existing directory entry; `app` carries store metadata.
  listing_type      TEXT    NOT NULL DEFAULT 'website',
  app_stores        TEXT    NOT NULL DEFAULT '[]',
  -- Public id, e.g. `s_3f9a2c1b`. Never reused, never sequential: a queue
  -- number in a URL tells the world how many submissions the site has had.
  id                TEXT    PRIMARY KEY,
  slug              TEXT    NOT NULL UNIQUE,
  url               TEXT    NOT NULL,
  domain            TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  short             TEXT    NOT NULL,
  long_desc         TEXT    NOT NULL DEFAULT '',
  category          TEXT    NOT NULL,
  -- JSON array of tag slugs. Tags are at most 4 and always come from the
  -- catalogue, so this never needs to be queried relationally.
  tags              TEXT    NOT NULL DEFAULT '[]',
  email             TEXT    NOT NULL DEFAULT '',
  logo              TEXT    NOT NULL DEFAULT '',
  maker             TEXT    NOT NULL DEFAULT '',
  -- free | standard | featured | pro | ad
  plan              TEXT    NOT NULL DEFAULT 'free',
  -- board | sidebar, only when plan = 'ad'
  slot              TEXT    NOT NULL DEFAULT '',
  -- pending | approved | rejected
  status            TEXT    NOT NULL DEFAULT 'pending',
  -- Non-null only after an operator confirms the money arrived. A paid plan
  -- with a null paid_at must not render a public page — see `publiclyListed`.
  paid_at           INTEGER,
  payment_ref       TEXT    NOT NULL DEFAULT '',
  awaiting_payment  INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  reviewed_at       INTEGER,
  reviewer          TEXT    NOT NULL DEFAULT '',
  notes             TEXT    NOT NULL DEFAULT '',
  -- Salted hash, never the address: the quota check needs to tell two
  -- submitters apart, not to know who they are.
  ip_hash           TEXT    NOT NULL DEFAULT '',
  owner_sub         TEXT    NOT NULL DEFAULT '',
  owner_email       TEXT    NOT NULL DEFAULT '',
  -- Editorial long-form sections, written by the operator in the review queue
  -- rather than by the submitter. One JSON `DetailBlock` per locale and one
  -- JSON array of screenshots (bare filenames or absolute image URLs).
  -- Keeping them on the row means every SELECT * — detail page, listings,
  -- admin queue, "my submissions" — sees them without a join. A row created
  -- before this migration carries '' and renders exactly as it did before.
  detail_en         TEXT    NOT NULL DEFAULT '',
  detail_zh         TEXT    NOT NULL DEFAULT '',
  shots             TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_submissions_status   ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_domain   ON submissions (domain);
CREATE INDEX IF NOT EXISTS idx_submissions_owner    ON submissions (owner_sub);
CREATE INDEX IF NOT EXISTS idx_submissions_owner_em ON submissions (owner_email);
-- Quota lookups are "how many from this hash since T", so the pair is the key.
CREATE INDEX IF NOT EXISTS idx_submissions_quota    ON submissions (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS votes (
  -- ISO week, e.g. '2026-W45'. It is part of the primary key, which is what
  -- makes "resets every Monday" a property of the schema rather than a cron
  -- job: last week's rows stay as history and this week starts empty.
  week       TEXT    NOT NULL,
  slug       TEXT    NOT NULL,
  -- 'sub:<google sub>' or 'email:<address>'. Never the raw address.
  voter      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  -- One vote per voter per product per week, enforced here so a double-click
  -- or a retried request cannot inflate the count.
  PRIMARY KEY (week, slug, voter)
);

CREATE INDEX IF NOT EXISTS idx_votes_week ON votes (week);

-- ---------------------------------------------------------------------------
-- Weekly ad placements — the thing the pricing page sells.
--
-- Two slots, two different products: `board` is one row inside the weekly
-- leaderboard, `sidebar` is a card at the top of the right rail. Both are
-- rented by the week, so every row carries start/end and liveness is a property
-- of the data rather than of a rebuild: tomorrow's page stops showing an ad
-- whose window ended today, whether or not anyone ran anything.
--
-- `active` is the operator's kill switch, separate from the window: taking a
-- campaign down early must not rewrite the dates the invoice was written from.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ads (
  id          TEXT    PRIMARY KEY,
  slot        TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  headline    TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  logo        TEXT    NOT NULL DEFAULT '',
  -- YYYY-MM-DD, inclusive on both ends.
  start       TEXT    NOT NULL,
  end         TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  note        TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  stopped_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ads_slot ON ads (slot, active);

-- ---------------------------------------------------------------------------
-- Billboard placements — one-time pay-what-you-want, not the weekly `ads` table.
--
-- Public rank is the sum of `amount_cents` on live rows that share a URL
-- (a later payment stacks; being outbid does not delete the row). `tier` is
-- only a storage label (entry / standard / prime) derived from the amount.
-- `requested` is an invoice that is not public. `pending` is an unpaid
-- checkout. `live` requires `paid_at`. `removed` is the takedown switch.
-- Homepage Top 10 and /billboard read the same live rows.
-- No new column: stacking uses `amount_cents` (see migrations/2026-11-09).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billboard_placement (
  id           TEXT    PRIMARY KEY,
  -- entry | standard | prime — label only, not the sort key
  tier         TEXT    NOT NULL,
  name         TEXT    NOT NULL DEFAULT '',
  tagline      TEXT    NOT NULL DEFAULT '',
  url          TEXT    NOT NULL,
  logo         TEXT    NOT NULL DEFAULT '',
  screenshot   TEXT    NOT NULL DEFAULT '',
  email        TEXT    NOT NULL DEFAULT '',
  -- requested | pending | live | removed
  status       TEXT    NOT NULL DEFAULT 'requested',
  paid_at      INTEGER,
  created_at   INTEGER NOT NULL,
  note         TEXT    NOT NULL DEFAULT '',
  -- payment_order.id. Empty on a hand-entered invoice backfill.
  order_id     TEXT    NOT NULL DEFAULT '',
  -- Charged cents, copied from the order. Never taken from the browser.
  amount_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_billboard_status ON billboard_placement (status, paid_at);
CREATE INDEX IF NOT EXISTS idx_billboard_order ON billboard_placement (order_id);

-- ---------------------------------------------------------------------------
-- Operator overrides for the curated catalogue.
--
-- `pin` extends a placement without editing the build-time catalogue; `hidden`
-- takes a listing out of every list and answers 410 on its own page. Keyed by
-- slug because that is what the catalogue and the URLs agree on.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_overrides (
  slug        TEXT    PRIMARY KEY,
  pin         INTEGER NOT NULL DEFAULT 0,
  -- Last day the pin applies, YYYY-MM-DD. Empty means "until switched off".
  pin_until   TEXT    NOT NULL DEFAULT '',
  hidden      INTEGER NOT NULL DEFAULT 0,
  -- Recommend weight. Higher ranks earlier inside the same paid/featured band.
  -- Zero means "no opinion" and an all-zero row is deleted rather than stored.
  -- Existing databases gain the column from ensureOverrideColumns, not from
  -- this CREATE, which does not alter a table that is already there.
  sort        INTEGER NOT NULL DEFAULT 0,
  -- 1 when the tools desk deleted a catalogue preset. Unlike `hidden`, this
  -- is not cleared by relist. Readers fold it into the public hidden set.
  -- Existing databases gain the column from ensureOverrideColumns.
  removed     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Closed weeks, written by the Monday cron.
--
-- The static catalogue carries the weeks that existed when the site was built;
-- this table is where weeks that close *after* that go. `votes` is the final
-- tally, `rank` the order it settled in, so a later recount cannot rewrite
-- history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS week_archive (
  week        TEXT    NOT NULL,
  slug        TEXT    NOT NULL,
  votes       INTEGER NOT NULL,
  rank        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (week, slug)
);

-- ---------------------------------------------------------------------------
-- Directory content.
--
-- The catalogue used to be a build-time JSON import: editing a tool's copy
-- meant editing a file and redeploying. These tables move the *editable* half
-- into the database while keeping the same shapes, so a page can read either
-- source without knowing which one answered.
--
-- Split into head + translation, the same way the source template does it:
-- `dir_tool` holds facts that do not translate (url, logo, votes, dates) and
-- `dir_tool_tr` holds one row per language. Adding a third language is a row,
-- not a schema change.
--
-- Long-form editorial content (features, pros/cons, FAQ) is stored as a JSON
-- document in `detail` rather than six child tables. It is read and written
-- whole, never queried by field, and a JSON column keeps the admin form and the
-- page reading the same object.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dir_tool (
  -- Same slug the URL uses. Stable: renaming it breaks links and rankings.
  slug           TEXT    PRIMARY KEY,
  url            TEXT    NOT NULL DEFAULT '',
  logo           TEXT    NOT NULL DEFAULT '',
  category       TEXT    NOT NULL DEFAULT '',
  -- JSON array of tag labels, matching the catalogue's own format.
  tags           TEXT    NOT NULL DEFAULT '[]',
  status         TEXT    NOT NULL DEFAULT 'approved',
  is_featured    INTEGER NOT NULL DEFAULT 0,
  is_paid        INTEGER NOT NULL DEFAULT 0,
  -- Last day a paid placement stays pinned, YYYY-MM-DD. Empty means none.
  featured_until TEXT    NOT NULL DEFAULT '',
  votes_total    INTEGER NOT NULL DEFAULT 0,
  votes_week     INTEGER NOT NULL DEFAULT 0,
  -- YYYY-MM-DD, the date shown as "listed on".
  created_at     TEXT    NOT NULL DEFAULT '',
  maker          TEXT    NOT NULL DEFAULT '',
  -- JSON array of screenshot filenames.
  shots          TEXT    NOT NULL DEFAULT '[]',
  -- 1 when the row exists only to override catalogue copy, 0 when it is the
  -- listing itself. Lets the seeder re-run without resurrecting deleted rows.
  updated_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dir_tool_category ON dir_tool (category);
CREATE INDEX IF NOT EXISTS idx_dir_tool_status   ON dir_tool (status);

CREATE TABLE IF NOT EXISTS dir_tool_tr (
  slug       TEXT    NOT NULL,
  locale     TEXT    NOT NULL,
  name       TEXT    NOT NULL DEFAULT '',
  short      TEXT    NOT NULL DEFAULT '',
  long_desc  TEXT    NOT NULL DEFAULT '',
  -- JSON DetailBlock: how_to_use / features / use_cases / pros / cons / faqs.
  detail     TEXT    NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (slug, locale)
);

CREATE TABLE IF NOT EXISTS dir_category (
  slug       TEXT    PRIMARY KEY,
  icon       TEXT    NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'published',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dir_category_tr (
  slug        TEXT    NOT NULL,
  locale      TEXT    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (slug, locale)
);

CREATE TABLE IF NOT EXISTS dir_tag (
  slug       TEXT    PRIMARY KEY,
  sort       INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dir_tag_tr (
  slug   TEXT NOT NULL,
  locale TEXT NOT NULL,
  name   TEXT NOT NULL DEFAULT '',
  -- The console edits a per-language blurb (source `directory_tag_translation`
  -- has one); the public tag page shows it under the heading. Added after the
  -- first release, so `server/utils/admin-directory.ts` also issues an
  -- idempotent `ALTER TABLE` for databases created before this line existed.
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (slug, locale)
);

CREATE TABLE IF NOT EXISTS dir_collection (
  slug       TEXT    PRIMARY KEY,
  icon       TEXT    NOT NULL DEFAULT '',
  cover      TEXT    NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'published',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dir_collection_tr (
  slug        TEXT    NOT NULL,
  locale      TEXT    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (slug, locale)
);

-- Ordered membership. `sort` is explicit rather than derived from insertion
-- order, because the point of a collection is the sequence the editor chose.
CREATE TABLE IF NOT EXISTS dir_collection_tool (
  collection_slug TEXT    NOT NULL,
  tool_slug       TEXT    NOT NULL,
  sort            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_slug, tool_slug)
);

-- ---------------------------------------------------------------------------
-- payment orders
--
-- One row per attempt to pay for one submission. A submission can have several
-- — a card is declined and the buyer tries again — and the listing goes live
-- from whichever attempt succeeds. Keeping the attempts instead of a single
-- `paid` flag is what makes "the money arrived twice" answerable.
--
-- `id` is ours, not the provider's: it is what the success URL carries, what
-- the admin list shows, and what survives a change of payment provider. The
-- provider's own identifier lives in `provider_ref`.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_order (
  id              TEXT    PRIMARY KEY,
  submission_id   TEXT    NOT NULL,
  plan            TEXT    NOT NULL,
  -- Minor units, read from the pricing table on the server. Never from the
  -- request body: a client that can name its own price is not a price.
  amount_cents    INTEGER NOT NULL,
  currency        TEXT    NOT NULL DEFAULT 'usd',
  provider        TEXT    NOT NULL DEFAULT 'manual',
  provider_ref    TEXT    NOT NULL DEFAULT '',
  -- pending | paid | failed | cancelled | refunded
  status          TEXT    NOT NULL DEFAULT 'pending',
  checkout_url    TEXT    NOT NULL DEFAULT '',
  buyer_email     TEXT    NOT NULL DEFAULT '',
  note            TEXT    NOT NULL DEFAULT '',
  -- The provider's payload, kept verbatim so a disputed charge can be checked
  -- against what actually arrived rather than against our own summary of it.
  raw_event       TEXT    NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  paid_at         INTEGER
);

CREATE INDEX IF NOT EXISTS idx_payment_order_submission ON payment_order (submission_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_status     ON payment_order (status);

-- A provider session may only ever be recorded once. Without this a webhook
-- delivered twice (which is normal, not exceptional) would settle the same
-- charge twice; the empty-ref rows are excluded so unstarted attempts coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_order_ref
  ON payment_order (provider, provider_ref) WHERE provider_ref <> '';

-- ---------------------------------------------------------------------------
-- self-serve weekly ad bookings
--
-- An ad is *rented*, not a listing: there is no submission behind it. Its
-- `payment_order` row therefore carries `submission_id = ''` and `plan = 'ad'`,
-- which lets the webhook reuse the same signature check, amount check and
-- idempotent settle as a listing order. Everything that makes it an ad — which
-- slot, which weeks, what creative, when it goes up — lives here, keyed by the
-- order id.
--
-- `start` is always a Monday and `end` is `start + 7 * weeks - 1`, both
-- inclusive, so two bookings overlap exactly when their date ranges do.
-- `status` is the fulfilment state, separate from the order's payment state:
-- a charge can be paid while the placement cannot be delivered (`conflict`).
-- Keeping that distinction is what stops a double-booked week from being
-- quietly marked "done".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_booking (
  order_id     TEXT    PRIMARY KEY,
  slot         TEXT    NOT NULL,
  weeks        INTEGER NOT NULL,
  start        TEXT    NOT NULL,
  end          TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  headline     TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  logo         TEXT    NOT NULL DEFAULT '',
  email        TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL,
  -- pending | live | conflict | cancelled | refunded
  status       TEXT    NOT NULL DEFAULT 'pending',
  -- The row in `ads` this booking published, once it has been paid for.
  ad_id        TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_booking_window ON ad_booking (slot, start, end);
CREATE INDEX IF NOT EXISTS idx_ad_booking_status ON ad_booking (status);

-- ---------------------------------------------------------------------------
-- support tickets
--
-- One row per conversation between one signed-in account and the owner.
--
-- There is no `users` table in this build: the session cookie carries `sub`,
-- email and name, and Google is the identity provider. So the author's
-- identity is *copied* onto the ticket when it is opened. That copy is a
-- snapshot on purpose — someone who later renames their Google account must
-- not rewrite the history of a conversation that was filed under the old name,
-- and a deleted Google account must not make old tickets unreadable.
--
-- `status` is not a workflow the operator drives. Two of its three values are
-- derived from who spoke last: a user message sets `open` (the ball is with
-- us), an owner reply sets `replied` (the ball is with them). `closed` is the
-- only one a human sets. That is also why there is no `assignee`, no priority
-- and no SLA column — exactly one person answers these, and a priority field
-- that nobody can change is a lie told in a schema.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ticket (
  id          TEXT    PRIMARY KEY,
  -- Google `sub`, stable across email changes. This is the ownership key; the
  -- email below is display only and must never be used to grant access.
  user_sub    TEXT    NOT NULL,
  user_email  TEXT    NOT NULL DEFAULT '',
  user_name   TEXT    NOT NULL DEFAULT '',
  title       TEXT    NOT NULL,
  -- open | replied | closed
  status      TEXT    NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Both lists sort by `updated_at DESC` — "my tickets" and "the queue" are the
-- same query with a different WHERE, so both indexes lead with the filter.
CREATE INDEX IF NOT EXISTS idx_ticket_user   ON ticket (user_sub, updated_at);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON ticket (status, updated_at);

CREATE TABLE IF NOT EXISTS ticket_message (
  id          TEXT    PRIMARY KEY,
  ticket_id   TEXT    NOT NULL,
  -- user | admin
  role        TEXT    NOT NULL DEFAULT 'user',
  -- Display name as it was when this message was written. Empty for owner
  -- messages: the console is one shared token, not an account, so there is no
  -- name to copy and inventing one ("Admin") would age badly.
  author      TEXT    NOT NULL DEFAULT '',
  content     TEXT    NOT NULL,
  -- JSON array of image URLs, same shape as `submissions.tags`: nothing ever
  -- queries into it, so a JSON string beats a third table.
  attachments TEXT    NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_message_ticket
  ON ticket_message (ticket_id, created_at);

-- Product Spotlights: the long-form article sold with a Featured or Pro
-- listing. Written by the maker from a fixed template, reviewed here, then
-- published at /spotlights/<slug>.
--
-- `listing_slug` is required rather than optional: an article whose product is
-- not on the site is a page that links to nothing, and the whole point is the
-- internal link between the article and the listing.
--
-- `status` is the editorial decision only. `published_at` is set on approval and
-- cleared on unpublish, so "is it live" is one nullable column rather than a
-- second boolean that can disagree with the status.
CREATE TABLE IF NOT EXISTS spotlight (
  id              TEXT    PRIMARY KEY,
  slug            TEXT    NOT NULL UNIQUE,
  listing_slug    TEXT    NOT NULL,
  product_name    TEXT    NOT NULL,
  product_url     TEXT    NOT NULL,
  tagline         TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  author          TEXT    NOT NULL DEFAULT '',
  author_bio      TEXT    NOT NULL DEFAULT '',
  best_for        TEXT    NOT NULL DEFAULT '',
  pricing_summary TEXT    NOT NULL DEFAULT '',
  -- Submitter's address. Display only; nothing grants access by it.
  email           TEXT    NOT NULL DEFAULT '',
  -- Salted IP hash, never the address. Quota and abuse review only — the same
  -- deal `submissions.ip_hash` gets. An address-only limit is trivial to walk
  -- around with a plus-address, so the quota is counted per source as well.
  ip_hash         TEXT    NOT NULL DEFAULT '',
  -- pending | approved | rejected
  status          TEXT    NOT NULL DEFAULT 'pending',
  -- Why a draft was turned down. Shown to the owner, never on the public page.
  review_notes    TEXT    NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  reviewed_at     INTEGER,
  published_at    INTEGER
);

-- The queue sorts by status then recency; the public list filters on
-- `published_at IS NOT NULL` and sorts by it.
CREATE INDEX IF NOT EXISTS idx_spotlight_status  ON spotlight (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_spotlight_live    ON spotlight (published_at);
CREATE INDEX IF NOT EXISTS idx_spotlight_listing ON spotlight (listing_slug);
CREATE INDEX IF NOT EXISTS idx_spotlight_ip      ON spotlight (ip_hash, created_at);

-- Uploaded images (product icons, ticket attachments).
--
-- The bytes live in the row on purpose. This build binds no object storage and
-- has no filesystem on Workers; an icon is a few tens of kilobytes after the
-- browser downscales it, and `MAX_STORED_BYTES` caps the rest. If an R2 bucket
-- is ever bound, only the two storage handlers change — nothing that reads a
-- URL has to know the difference.
--
-- base64 rather than BLOB: D1 hands BLOBs back as ArrayBuffer and local SQLite
-- hands them back as Uint8Array, and the encoding difference is a bug that only
-- shows up in one of the two runtimes. Text is the same everywhere.
CREATE TABLE IF NOT EXISTS upload_asset (
  id         TEXT    PRIMARY KEY,
  mime       TEXT    NOT NULL,
  bytes_b64  TEXT    NOT NULL,
  size       INTEGER NOT NULL,
  owner_sub  TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_asset_created ON upload_asset (created_at);

-- The slug a domain had the last time its listing was deleted.
--
-- A listing's URL is part of what the buyer paid for: the sitemap, the
-- Spotlight and anything a search engine indexed all point at it. Deleting and
-- re-adding a product used to mint a new slug from the new name, silently
-- retiring every one of those links. `uniqueSlug()` now reads this table first,
-- so the address belongs to the product rather than to the last form
-- submission. See `deleteAdminTool()` for the write side.
CREATE TABLE IF NOT EXISTS product_slug_alias (
  slug       TEXT    PRIMARY KEY,
  domain     TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_slug_alias_domain ON product_slug_alias (domain, created_at);

-- ---------------------------------------------------------------------------
-- Traffic counters
--
-- The board's stats strip sells placements, so it has to show whether anyone
-- is actually here. That number has to be measured, and these two tables are
-- the whole of it: an hourly counter and a per-day visitor set.
--
-- `bucket` is `YYYY-MM-DDTHH` in UTC — fixed width, so "the last 24 hours" is a
-- text range and a week is `>= '2026-11-16T00' AND < '2026-11-23T00'`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traffic_hour (
  bucket TEXT    PRIMARY KEY,
  views  INTEGER NOT NULL DEFAULT 0
);

-- One row per visitor per UTC day. `vid` is a salted hash of the request that
-- includes the day, so rows from different days cannot be joined and the
-- address itself is never stored. Counting is a `COUNT(*)`, not a profile.
--
-- `seen_at` is the last request's unix second, which is the only way to answer
-- "how many people are on the site right now" — the strip prints that next to
-- the traffic figure. It is an overwrite, not a history: the row remembers one
-- moment per visitor per day and nothing else.
CREATE TABLE IF NOT EXISTS traffic_visitor (
  day     TEXT    NOT NULL,
  vid     TEXT    NOT NULL,
  seen_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vid)
);

CREATE INDEX IF NOT EXISTS idx_traffic_visitor_seen ON traffic_visitor (seen_at);
