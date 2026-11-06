/**
 * Weekly votes — the thing the leaderboard claims to be ranked by.
 *
 * One vote per voter per product per ISO week. The week is part of the primary
 * key, which is what makes "resets every Monday" true instead of decorative:
 * last week's rows stay as history, this week starts empty, and no cron job has
 * to run at midnight on Sunday.
 *
 * Voter keys are `sub:<google sub>` (falling back to `email:<address>`). The
 * address itself is never stored in this table.
 */

import type { Db } from './db'
// Reuse the catalogue's implementation rather than defining a second one:
// two auto-imported `isoWeekId` symbols collide, and Nuxt silently picks one.
import { isoWeekId } from '~~/shared/utils/catalog'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const WEEK_RE = /^\d{4}-W\d{2}$/

export const isValidWeek = (w: string) => WEEK_RE.test(w)
export const isValidSlug = (s: string) => SLUG_RE.test(s)

/** slug → number of votes this week. */
export async function voteCounts(db: Db, week: string): Promise<Record<string, number>> {
  const { results } = await db
    .prepare('SELECT slug, COUNT(*) AS n FROM votes WHERE week = ? GROUP BY slug')
    .bind(week)
    .all<{ slug: string; n: number }>()
  const out: Record<string, number> = {}
  for (const row of results) out[row.slug] = Number(row.n)
  return out
}

export async function hasVoted(db: Db, week: string, slug: string, voter: string): Promise<boolean> {
  if (!voter) return false
  const hit = await db
    .prepare('SELECT 1 AS x FROM votes WHERE week = ? AND slug = ? AND voter = ?')
    .bind(week, slug, voter)
    .first()
  return Boolean(hit)
}

export type CastResult = {
  counts: Record<string, number>
  accepted: boolean
  votes: number
}

/**
 * Record one vote.
 *
 * `INSERT OR IGNORE` on the composite key is the whole concurrency story: two
 * requests racing on the same (week, slug, voter) produce one row, and the
 * second one reports `accepted: false` instead of inflating the count.
 */
export async function castVote(
  db: Db,
  week: string,
  slug: string,
  voter: string,
): Promise<CastResult> {
  if (!voter || !isValidSlug(slug)) {
    return { counts: await voteCounts(db, week), accepted: false, votes: 0 }
  }

  const res = await db
    .prepare('INSERT OR IGNORE INTO votes (week, slug, voter, created_at) VALUES (?,?,?,?)')
    .bind(week, slug, voter, Math.floor(Date.now() / 1000))
    .run()

  const counts = await voteCounts(db, week)
  return { counts, accepted: res.changes > 0, votes: counts[slug] ?? 0 }
}
