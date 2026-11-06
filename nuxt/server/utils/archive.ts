/**
 * Closed weeks.
 *
 * A week's tally only exists while its rows are in `votes`, and those rows are
 * keyed by week — which is what makes "the board resets on Monday" true without
 * anyone deleting anything. The consequence is that history would otherwise
 * live only in the build-time catalogue: a week that closes after the site was
 * built would be gone the moment it stops being "this week".
 *
 * So a Monday cron copies the closing week into `week_archive`: final tally,
 * final order, frozen. `rank` is stored rather than recomputed because a later
 * recount must not rewrite what the board said on the day.
 *
 * The write is idempotent — it rewrites the week it is given — so a retried or
 * manually re-run job cannot produce duplicates.
 */

import type { Week } from '~~/shared/types/catalog'
import { isoWeekId } from '~~/shared/utils/catalog'
import type { Db } from './db'

export type ArchiveRow = {
  week: string
  slug: string
  votes: number
  rank: number
  created_at: number
}

const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The ISO week that just closed: "last Monday to Sunday". */
export function previousWeekId(now = new Date()): string {
  return isoWeekId(new Date(now.getTime() - 7 * DAY_MS))
}

/** Monday 00:00 UTC of an ISO week id, e.g. '2026-W45' → 2026-11-02. */
function weekStart(weekId: string): Date {
  const [yearPart, weekPart] = String(weekId).split('-W')
  const year = Number(yearPart)
  const week = Number(weekPart)
  // ISO 8601: week 1 is the week containing January 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekday = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (weekday - 1) + (week - 1) * 7)
  return monday
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * A `Week` built from archived rows, in the same shape the static catalogue
 * uses — so `boardRows()` and `weekLabel()` cannot tell the two apart.
 *
 * The labels are rebuilt rather than stored: they are presentation, and a
 * stored label would go stale the first time the copy changed.
 */
export function archiveToWeek(weekId: string, rows: ArchiveRow[]): Week {
  const start = weekStart(weekId)
  const end = new Date(start.getTime() + 6 * DAY_MS)
  return {
    id: weekId,
    start: isoDate(start),
    end: isoDate(end),
    label_en: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`,
    label_zh: `${start.getUTCMonth() + 1} 月 ${start.getUTCDate()} 日 – ${end.getUTCMonth() + 1} 月 ${end.getUTCDate()} 日`,
    ranking: [...rows]
      .sort((a, b) => a.rank - b.rank)
      .map((row) => ({ slug: row.slug, votes: Number(row.votes) })),
  } as Week
}

/**
 * Freeze one week.
 *
 * Ties are broken by slug so the stored order is deterministic — two tools on
 * the same count must not swap places between a re-run and the original.
 * A week with no votes at all is still recorded (zero rows): "nothing happened
 * that week" is a fact worth having, and it stops the job from looking like it
 * silently failed.
 */
export async function archiveWeek(db: Db, week: string): Promise<{ week: string; rows: number }> {
  const { results } = await db
    .prepare('SELECT slug, COUNT(*) AS n FROM votes WHERE week = ? GROUP BY slug')
    .bind(week)
    .all<{ slug: string; n: number }>()

  const tally = results
    .map((row) => ({ slug: row.slug, votes: Number(row.n) || 0 }))
    .filter((row) => row.votes > 0)
    .sort((a, b) => b.votes - a.votes || (a.slug < b.slug ? -1 : 1))

  const now = Math.floor(Date.now() / 1000)

  // Rewrite rather than append: the job is safe to re-run, and a corrected
  // tally (a vote removed by hand) replaces the old one instead of doubling it.
  await db.prepare('DELETE FROM week_archive WHERE week = ?').bind(week).run()

  for (let i = 0; i < tally.length; i++) {
    await db
      .prepare(
        'INSERT INTO week_archive (week, slug, votes, rank, created_at) VALUES (?,?,?,?,?)',
      )
      .bind(week, tally[i]!.slug, tally[i]!.votes, i + 1, now)
      .run()
  }

  return { week, rows: tally.length }
}

export async function readArchive(db: Db, week: string): Promise<ArchiveRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM week_archive WHERE week = ? ORDER BY rank ASC')
    .bind(week)
    .all<ArchiveRow>()
  return results
}

/** Newest archived week id, or '' when the table is still empty. */
export async function latestArchivedId(db: Db): Promise<string> {
  const row = await db
    .prepare('SELECT week FROM week_archive ORDER BY week DESC LIMIT 1')
    .first<{ week: string }>()
  return row?.week || ''
}

/** The newest archived week, ready to hand to `boardRows()`. */
export async function latestArchive(db: Db): Promise<Week | null> {
  const id = await latestArchivedId(db)
  if (!id) return null
  const rows = await readArchive(db, id)
  if (!rows.length) return null
  return archiveToWeek(id, rows)
}
