/**
 * The numbers the public site is allowed to repeat.
 * Pages, FAQ, llms.txt and JSON-LD should read this shape rather than
 * hard-coding a count.
 */

import { categories, isoWeekId, tools } from '~~/shared/utils/catalog'
import { queueStats, type ReviewSpan } from '~~/shared/utils/queue'
import { upcomingMondays, weekAvailability } from './ad-bookings'
import { listLiveBillboard } from './billboard'
import type { Db } from './db'
import { loadOverrides } from './overrides'
import { listPublishedTools } from './submissions'

const DAY = 86400

export async function publicStats(db: Db, now = new Date()) {
  const unix = Math.floor(now.getTime() / 1000)
  const since = unix - 30 * DAY
  const [overrides, published, live, pending, reviewed, samples, votes] = await Promise.all([
    loadOverrides(db),
    listPublishedTools(db),
    listLiveBillboard(db),
    db.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending' AND plan = 'free'`).first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM submissions WHERE reviewed_at IS NOT NULL AND reviewed_at >= ?`)
      .bind(since)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT created_at, reviewed_at FROM submissions WHERE reviewed_at IS NOT NULL AND created_at IS NOT NULL`,
      )
      .all<{ created_at: number; reviewed_at: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM votes WHERE week = ?`).bind(isoWeekId(now)).first<{ n: number }>(),
  ])

  const hidden = new Set(overrides.hidden)
  const slugs = new Set<string>()
  for (const tool of tools) {
    if (!hidden.has(tool.slug)) slugs.add(tool.slug)
  }
  for (const tool of published) {
    if (!hidden.has(tool.slug)) slugs.add(tool.slug)
  }

  const starts = upcomingMondays(6)
  const open = await weekAvailability(db, 'sidebar', 1, starts)
  const bookableWeeks = starts.filter((start) => open[start]).length

  const spans: ReviewSpan[] = samples.results.map((row) => ({
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }))
  const queue = queueStats({
    freePending: Number(pending?.n ?? 0),
    reviewedLast30d: Number(reviewed?.n ?? 0),
    samples: spans,
  })

  return {
    products: slugs.size,
    categories: categories.filter((category) => category.slug).length,
    free_pending: queue.free_pending,
    reviewed_last_30d: queue.reviewed_last_30d,
    median_review_days: queue.median_review_days,
    billboard_confirmed: live.length,
    bookable_weeks: bookableWeeks,
    week_votes: Number(votes?.n ?? 0),
    paid_publish: queue.paid_publish,
  }
}
