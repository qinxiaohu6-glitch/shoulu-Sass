/**
 * Page-view storage: two counters and one hash, nothing else.
 *
 * `traffic_hour` holds one row per UTC hour and is the only thing a page view
 * writes to. `traffic_visitor` holds one row per visitor per day, so "N
 * visitors" is a `COUNT` and never a stored profile — the id is a salted hash
 * of the request that rotates with the day, so two days cannot be joined.
 *
 * Reads are deliberately three small queries rather than a rollup table: at
 * this size an index scan over a week of hourly rows is free, and a rollup is
 * one more thing that can silently stop being updated.
 */

import type { Db } from './db'
import {
  dayOfBucket,
  hourBucket,
  recentBuckets,
  summarizeHours,
  weekBucketRange,
} from '../../shared/utils/traffic.ts'

export type TrafficSummary = {
  /** 24 numbers, oldest → newest, ending on the current hour. */
  hourly: number[]
  views_24h: number
  visitors_today: number
  views_week: number
  /** Visitors seen in the last five minutes — the "N live" badge. */
  live_now: number
  /** Busiest hour in the window, so the strip can show a burst as a figure. */
  peak: number
  /**
   * False until the first row exists. The strip prints an em dash instead of a
   * confident 0 while the counter is brand new — "nobody came" and "we started
   * counting ten minutes ago" are different statements.
   */
  has_data: boolean
}

/** How long a visitor row is kept. Long enough for a week view, no longer. */
const RETENTION_DAYS = 35

/** "Online now" — a visitor whose last request is younger than this. */
const LIVE_SECONDS = 300

/**
 * The visitor table is pruned at most once an hour per isolate. A delete on
 * every page view would be a write per view for no benefit; a delete never
 * would let the table grow forever. An in-memory timestamp is enough because
 * the worst case of a missed prune is one more row.
 */
let lastPrune = 0

/**
 * Drop visitor rows older than the retention window.
 *
 * Exported rather than inlined so the rule can be tested without waiting 35
 * days; `addPageView` calls it behind the hourly guard below.
 */
export async function pruneVisitors(db: Db, at: Date): Promise<void> {
  await db
    .prepare('DELETE FROM traffic_visitor WHERE day < ?')
    .bind(dayOfBucket(hourBucket(new Date(at.getTime() - RETENTION_DAYS * 86_400_000))))
    .run()
}

/**
 * Record one page view.
 *
 * Storage only: the caller has already decided the request counts. The hourly
 * counter is idempotent in the right direction — a retried request inflates
 * `views` by one, which is the honest behaviour for a view counter — while the
 * visitor row is keyed by (day, hash), so the same person twice in a day stays
 * one visitor and only their `seen_at` moves.
 */
export async function addPageView(db: Db, at: Date, vid: string): Promise<void> {
  const bucket = hourBucket(at)
  const day = dayOfBucket(bucket)
  const seenAt = Math.floor(at.getTime() / 1000)

  await db
    .prepare(
      `INSERT INTO traffic_hour (bucket, views) VALUES (?, 1)
       ON CONFLICT(bucket) DO UPDATE SET views = views + 1`,
    )
    .bind(bucket)
    .run()
  await db
    .prepare(
      `INSERT INTO traffic_visitor (day, vid, seen_at) VALUES (?, ?, ?)
       ON CONFLICT(day, vid) DO UPDATE SET seen_at = excluded.seen_at`,
    )
    .bind(day, vid, seenAt)
    .run()

  if (seenAt - lastPrune >= 3600) {
    lastPrune = seenAt
    await pruneVisitors(db, at)
  }
}

/** Everything the stats strip needs, for one 24-hour window and one ISO week. */
export async function readTraffic(db: Db, now: Date, weekStart: Date): Promise<TrafficSummary> {
  const buckets = recentBuckets(now, 24)
  const from = buckets[0]!
  const to = buckets[buckets.length - 1]!
  const week = weekBucketRange(weekStart)
  const today = dayOfBucket(hourBucket(now))
  // The live window is minutes wide, so it can only touch today or — just
  // after midnight — yesterday. Bounding it by day keeps the scan on the
  // primary key instead of walking every row the table has ever held.
  const liveSince = Math.floor(now.getTime() / 1000) - LIVE_SECONDS
  const liveFrom = dayOfBucket(hourBucket(new Date(now.getTime() - 86_400_000)))

  const [hours, weekViews, visitors, live, any] = await Promise.all([
    db
      .prepare('SELECT bucket, views FROM traffic_hour WHERE bucket >= ? AND bucket <= ?')
      .bind(from, to)
      .all<{ bucket: string; views: number }>(),
    db
      .prepare('SELECT COALESCE(SUM(views), 0) AS n FROM traffic_hour WHERE bucket >= ? AND bucket < ?')
      .bind(week.from, week.to)
      .first<{ n: number }>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM traffic_visitor WHERE day = ?')
      .bind(today)
      .first<{ n: number }>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM traffic_visitor WHERE day >= ? AND seen_at >= ?')
      .bind(liveFrom, liveSince)
      .first<{ n: number }>(),
    db.prepare('SELECT 1 AS n FROM traffic_hour LIMIT 1').first<{ n: number }>(),
  ])

  const byBucket = new Map(hours.results.map((row) => [row.bucket, Number(row.views) || 0]))
  const hourly = buckets.map((bucket) => byBucket.get(bucket) ?? 0)
  const summary = summarizeHours(hourly)

  return {
    hourly,
    views_24h: summary.views,
    visitors_today: Number(visitors?.n ?? 0),
    views_week: Number(weekViews?.n ?? 0),
    live_now: Number(live?.n ?? 0),
    peak: summary.peak,
    has_data: Boolean(any),
  }
}
