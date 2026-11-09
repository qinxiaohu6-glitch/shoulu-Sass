-- Billboard path A — pay what you want, from $15.
--
-- No new columns. `amount_cents` (added 2026-11-09) is one payment.
-- The public board sums live rows that share a URL, so a later payment
-- stacks and an outbid only changes rank. New money is clamped to at
-- least 1500 cents on the server. Black Friday does not lower that floor.
-- `tier` remains entry | standard | prime as a storage label only.

SELECT 1;
