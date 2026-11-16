/**
 * POST /api/admin/archive — run the Monday job now.
 *
 * The cron hook cannot be triggered locally and cannot be re-run on demand in
 * production, which makes it the one piece of the backend that would otherwise
 * be untestable and un-fixable. This is the same function behind the admin
 * cookie: `{ week }` defaults to the week that just closed, and passing an
 * explicit id re-runs an older one.
 *
 * Idempotent by construction — see `archiveWeek`. A week that already has
 * archive rows is not rewritten, so W45 stays as it was frozen.
 */

import { isAdmin } from '../../utils/admin'
import { archiveWeek, previousWeekId } from '../../utils/archive'
import { useDb } from '../../utils/db'
import { loadEligibleListedAt } from '../../utils/eligible-listings'

const WEEK_RE = /^\d{4}-W\d{2}$/

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const requested = String(body?.week ?? '').trim()
  const week = requested || previousWeekId()

  if (!WEEK_RE.test(week)) {
    setResponseStatus(event, 400)
    return {
      ok: false,
      reason: 'bad_week',
      message_zh: '周标识应为 YYYY-Www。',
      message_en: 'Week must look like YYYY-Www.',
    }
  }

  const db = await useDb(event)
  const eligible = await loadEligibleListedAt(db)
  const result = await archiveWeek(db, week, eligible)
  return { ok: true, ...result }
})
