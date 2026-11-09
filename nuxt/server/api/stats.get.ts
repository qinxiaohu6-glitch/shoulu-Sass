/**
 * GET /api/stats — the single public number source.
 */

import { useDb } from '../utils/db'
import { publicStats } from '../utils/stats'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const db = await useDb(event)
    return { ok: true as const, ...(await publicStats(db)) }
  } catch (err) {
    console.error('[stats] read failed', err)
    throw createError({ statusCode: 503, statusMessage: 'Stats unavailable' })
  }
})
