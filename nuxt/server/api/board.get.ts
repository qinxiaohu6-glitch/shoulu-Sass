/**
 * GET /api/board?week=2026-W46 — one ISO week's ranked board.
 *
 * The default week is the current UTC ISO week. An open week is ranked live
 * from `votes` (the same rows as `/api/votes`). A closed week returns its
 * archive, or is built from `votes` and frozen when the archive is missing.
 * `week.id` is always the requested week. A missing archive is never replaced
 * with whatever week was frozen last.
 */

import { isoWeekId } from '~~/shared/utils/catalog'
import { isIsoWeekId, weekFromQuery } from '~~/shared/utils/weekly-board'
import { loadBoardPayload } from '../utils/board-week'
import { useDb } from '../utils/db'
import { loadEligibleListedAt } from '../utils/eligible-listings'

export default defineEventHandler(async (event) => {
  const week = weekFromQuery(getQuery(event) as Record<string, unknown>) || isoWeekId()
  if (!isIsoWeekId(week)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_week', week: null, current: null, history: [], archived: [] }
  }

  try {
    const db = await useDb(event)
    const eligible = await loadEligibleListedAt(db)
    const payload = await loadBoardPayload(db, week, new Date(), eligible)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, ...payload }
  } catch (err) {
    console.error('[board]', err)
    return { ok: false, week: null, current: null, history: [], archived: [] }
  }
})
