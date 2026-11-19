/**
 * GET /api/spotlights/<slug> — one published article.
 *
 * A draft that is still pending, a rejected draft, and a slug that never
 * existed all answer the same 404. Distinguishing them would let anyone probe
 * the review queue by URL.
 */

import { useDb } from '../../utils/db'
import { getPublished } from '../../utils/spotlights'

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') ?? '')
  const db = await useDb(event)
  const item = await getPublished(db, slug)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  setResponseHeader(event, 'cache-control', 'public, max-age=0, s-maxage=60')
  return { ok: true, item }
})
