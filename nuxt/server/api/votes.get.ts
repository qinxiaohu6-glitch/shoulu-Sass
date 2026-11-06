/**
 * GET /api/votes?week=2026-W45 — this week's tallies.
 *
 * Anonymous and cacheable-free: the numbers move all day and a stale count is
 * worse than a slow one.
 */

import { useDb } from '../utils/db'
import { isValidWeek, voteCounts } from '../utils/votes'
import { isoWeekId } from '~~/shared/utils/catalog'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const raw = String(q.week ?? '').trim()
  const week = raw || isoWeekId()

  if (!isValidWeek(week)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_week' }
  }

  try {
    const db = await useDb(event)
    const counts = await voteCounts(db, week)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, week, counts }
  } catch (err) {
    console.error('[votes]', err)
    setResponseStatus(event, 503)
    return { ok: false, reason: 'service_unavailable' }
  }
})
