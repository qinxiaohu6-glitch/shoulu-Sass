/**
 * GET /api/queue — counts a page may print next to a free/paid choice.
 *
 * `free_pending` is pending free submissions. `median_review_days` is null
 * when no reviewed row exists, so the page hides it instead of showing 0.
 */

import { queueStats, type ReviewSpan } from '~~/shared/utils/queue'
import { useDb } from '../utils/db'

const DAY = 86400

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const db = await useDb(event)
  const now = Math.floor(Date.now() / 1000)
  const since = now - 30 * DAY

  const pending = await db
    .prepare(`SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending' AND plan = 'free'`)
    .first<{ n: number }>()
  const reviewed = await db
    .prepare(`SELECT COUNT(*) AS n FROM submissions WHERE reviewed_at IS NOT NULL AND reviewed_at >= ?`)
    .bind(since)
    .first<{ n: number }>()
  const samples = await db
    .prepare(
      `SELECT created_at, reviewed_at
         FROM submissions
        WHERE reviewed_at IS NOT NULL AND created_at IS NOT NULL`,
    )
    .all<{ created_at: number; reviewed_at: number }>()

  const spans: ReviewSpan[] = samples.results.map((row) => ({
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }))

  return {
    ok: true as const,
    ...queueStats({
      freePending: Number(pending?.n ?? 0),
      reviewedLast30d: Number(reviewed?.n ?? 0),
      samples: spans,
    }),
  }
})
