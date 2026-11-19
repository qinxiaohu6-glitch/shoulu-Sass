/**
 * GET /api/spotlights — published articles, newest first.
 *
 * Only rows with `published_at` set come back, and the projection drops the
 * submitter's address and the owner's review notes: those columns exist for the
 * queue, not for the public.
 *
 * A short shared cache, no browser cache. The list changes when the owner
 * approves something — rarely, but never on a schedule the reader can predict,
 * so a stale minute is fine and a stale hour is not.
 */

import { useDb } from '../utils/db'
import { listPublished } from '../utils/spotlights'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=0, s-maxage=60')
  const db = await useDb(event)
  return { ok: true, items: await listPublished(db) }
})
