/**
 * The numbers the public site is allowed to repeat.
 * Pages, FAQ, llms.txt and JSON-LD should read this shape rather than
 * hard-coding a count.
 */

import { categories, isoWeekId, tools } from '~~/shared/utils/catalog'
import { recentIsoWeeks } from '~~/shared/utils/iso-week'
import { queueStats, type ReviewSpan } from '~~/shared/utils/queue'
import { upcomingMondays, weekAvailability } from './ad-bookings'
import { listLiveBillboard } from './billboard'
import type { Db } from './db'
import { loadEligibleListedAt } from './eligible-listings'
import { loadOverrides } from './overrides'
import { listPublishedTools } from './submissions'
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

export async function publicStats(db: Db, now = new Date()) {
  const unix = Math.floor(now.getTime() / 1000)
  const since = unix - 30 * DAY
  const [index, live, pending, reviewed, samples, votes, listedAt] = await Promise.all([
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
    // Same source the board uses to place a listing in a week, so the counter
    // and the board can never disagree about which week a product belongs to.
    loadEligibleListedAt(db),
  ])

  const launchWeeks = recentIsoWeeks(now, 6).map((range) => {
    let listed = 0
    for (const at of listedAt.values()) {
      if (Number.isFinite(at) && at >= range.start && at < range.end) listed++
    }
    return { id: range.id, listed }
  })

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
    /** Oldest → newest, six ISO weeks; the last entry is the open week. */
    launch_weeks: launchWeeks,
  }
}
