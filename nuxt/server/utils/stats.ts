/**
 * The numbers the public site is allowed to repeat.
 * Pages, FAQ, llms.txt and JSON-LD should read this shape rather than
 * hard-coding a count.
 */

import { categories, isoWeekId, tools } from '~~/shared/utils/catalog'
import { isoWeekStart } from '~~/shared/utils/iso-week'
import { queueStats, type ReviewSpan } from '~~/shared/utils/queue'
import { upcomingMondays, weekAvailability } from './ad-bookings'
import { listLiveBillboard } from './billboard'
import type { Db } from './db'
import { loadOverrides } from './overrides'
import { listPublishedTools } from './submissions'
import { readTraffic } from './traffic'
import { countWeekVotes } from './votes'

const DAY = 86400

export type PublicListing = { slug: string; name: string; short: string }

/**
 * The same slug set `publicStats().products` counts: the static catalogue
 * plus published submissions, minus hidden rows. Callers that print a
 * product list must use this, not a hard-coded length.
 */
export async function publicListingIndex(db: Db): Promise<PublicListing[]> {
  const [overrides, published] = await Promise.all([loadOverrides(db), listPublishedTools(db)])
  const hidden = new Set(overrides.hidden)
  const bySlug = new Map<string, PublicListing>()
  for (const tool of tools) {
    if (hidden.has(tool.slug)) continue
    bySlug.set(tool.slug, { slug: tool.slug, name: tool.name_en, short: tool.short_en })
  }
  for (const tool of published) {
    if (hidden.has(tool.slug)) continue
    bySlug.set(tool.slug, { slug: tool.slug, name: tool.name_en, short: tool.short_en })
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
}

/**
 * Every figure the site prints about itself.
 *
 * The traffic block is measured, not derived: `traffic` is the page-view
 * counter, and `weekStart` is only used to bound its "this week" figure.
 */
export async function publicStats(db: Db, now = new Date()) {
  const unix = Math.floor(now.getTime() / 1000)
  const since = unix - 30 * DAY
  const weekStart = isoWeekStart(isoWeekId(now)) ?? now
  const [index, live, pending, reviewed, samples, votes, traffic] = await Promise.all([
    publicListingIndex(db),
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
    countWeekVotes(db, isoWeekId(now)),
    readTraffic(db, now, weekStart),
  ])

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
    products: index.length,
    categories: categories.filter((category) => category.slug).length,
    free_pending: queue.free_pending,
    reviewed_last_30d: queue.reviewed_last_30d,
    median_review_days: queue.median_review_days,
    billboard_confirmed: live.length,
    bookable_weeks: bookableWeeks,
    week_votes: Number(votes ?? 0),
    paid_publish: queue.paid_publish,
    /** Measured: page views and visitors, from the counter in `./traffic`. */
    traffic,
  }
}
