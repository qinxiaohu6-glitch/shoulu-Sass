/**
 * Closed weeks.
 *
 * A week's tally only exists while its rows are in `votes`. The Monday cron
 * copies a closed week into `week_archive` so history survives. The first
 * freeze wins: an archived week, including W45, is not rewritten. A closed
 * week that has no archive yet is ranked from `votes` with the tie-break in
 * `weekly-board.ts` and then frozen. Display does not wait for the cron.
 */

import type { Week } from '../../shared/types/catalog.ts'
import { previousIsoWeekId, rankOpenWeek, weekPresentation } from '../../shared/utils/weekly-board.ts'
import type { Db } from './db'

export type ArchiveRow = {
  week: string
  slug: string
  votes: number
  rank: number
  created_at: number
}

export type EligibleListedAt = ReadonlyMap<string, number>

/** The ISO week that just closed. */
export function previousWeekId(now = new Date()): string {
  return previousIsoWeekId(now)
}

/**
 * A `Week` built from archived rows, in stored rank order.
 * Labels are presentation and are rebuilt from the week id.
 */
export function archiveToWeek(weekId: string, rows: ArchiveRow[]): Week {
  const presentation = weekPresentation(weekId)
  const ranking = [...rows]
    .sort((a, b) => a.rank - b.rank || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((row) => ({ slug: row.slug, votes: Number(row.votes), rank: Number(row.rank) }))
  if (!presentation) {
    return { id: weekId, start: '', end: '', label_en: weekId, label_zh: weekId, ranking }
  }
  return { ...presentation, ranking }
}

export async function readArchive(db: Db, week: string): Promise<ArchiveRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM week_archive WHERE week = ? ORDER BY rank ASC, slug ASC')
    .bind(week)
    .all<ArchiveRow>()
  return results
}

/** Archived week ids, newest first. */
export async function listArchivedIds(db: Db): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT week FROM week_archive ORDER BY week DESC')
    .all<{ week: string }>()
  return results.map((row) => row.week)
}

/** Vote rows for one week, oldest first. The last stamp is when the count was reached. */
export async function readWeekVotes(
  db: Db,
  week: string,
): Promise<{ slug: string; createdAt: number }[]> {
  const { results } = await db
    .prepare(
      'SELECT slug, created_at FROM votes WHERE week = ? ORDER BY created_at ASC, slug ASC, voter ASC',
    )
    .bind(week)
    .all<{ slug: string; created_at: number }>()
  return results.map((row) => ({ slug: row.slug, createdAt: Number(row.created_at) }))
}

/**
 * Freeze one week from `votes`.
 *
 * If the week already has archive rows, they are returned untouched.
 * A week with no eligible votes is not written: there is nothing to lock,
 * and a later read still rebuilds the same empty board from `votes`.
 */
export async function archiveWeek(
  db: Db,
  week: string,
  eligible: EligibleListedAt,
): Promise<{ week: string; rows: number; skipped: boolean }> {
  const existing = await readArchive(db, week)
  if (existing.length) return { week, rows: existing.length, skipped: true }

  const tally = rankOpenWeek(await readWeekVotes(db, week), eligible).filter((row) => row.votes > 0)
  if (!tally.length) return { week, rows: 0, skipped: false }

  const now = Math.floor(Date.now() / 1000)
  for (let i = 0; i < tally.length; i++) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO week_archive (week, slug, votes, rank, created_at) VALUES (?,?,?,?,?)',
      )
      .bind(week, tally[i]!.slug, tally[i]!.votes, i + 1, now)
      .run()
  }

  return { week, rows: tally.length, skipped: false }
}

/** Newest archived week id, or '' when the table is still empty. */
export async function latestArchivedId(db: Db): Promise<string> {
  const ids = await listArchivedIds(db)
  return ids[0] || ''
}

/** The newest archived week, ready to hand to `boardRows()`. */
export async function latestArchive(db: Db): Promise<Week | null> {
  const id = await latestArchivedId(db)
  if (!id) return null
  const rows = await readArchive(db, id)
  if (!rows.length) return null
  return archiveToWeek(id, rows)
}
