/**
 * GET /api/billboard — the only public ranking.
 *
 * Homepage Top 10 and /billboard both read this. Invoice requests are not
 * in the result: the SQL requires status = live and a confirmed timestamp.
 */

import { listLiveBillboard } from '../utils/billboard'
import { useDb } from '../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const db = await useDb(event)
    const placements = await listLiveBillboard(db)
    const activity = [...placements]
      .sort((a, b) => b.paidAt - a.paidAt || (a.id < b.id ? -1 : 1))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        name: row.name,
        tier: row.tier,
        paidAt: row.paidAt,
        amountCents: row.amountCents ?? 0,
      }))
    return {
      ok: true as const,
      placements,
      confirmed: placements.length,
      activity,
    }
  } catch (err) {
    console.error('[billboard] read failed', err)
    throw createError({ statusCode: 503, statusMessage: 'Billboard unavailable' })
  }
})
