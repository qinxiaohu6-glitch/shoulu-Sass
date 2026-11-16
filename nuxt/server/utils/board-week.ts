/**
 * One ISO week's board.
 *
 * The open week is ranked live from `votes`. A closed week returns its
 * archive. If that archive has not been written, it is ranked from `votes`
 * and frozen. An already archived week is not recalculated.
 */

import type { Week } from '../../shared/types/catalog.ts'
import {
  compareIsoWeek,
  isoWeekId,
  previousIsoWeekId,
  rankOpenWeek,
  weekPresentation,
} from '../../shared/utils/weekly-board.ts'
import { archiveToWeek, archiveWeek, listArchivedIds, readArchive, readWeekVotes, type EligibleListedAt } from './archive.ts'
import type { Db } from './db'

export type BoardSource = 'live' | 'archive' | 'backfill' | 'future'

export type BoardPayload = {
  week: Week
  source: BoardSource
  current: Week
  history: Week[]
  archived: string[]
}

function emptyWeek(weekId: string): Week {
  const presentation = weekPresentation(weekId)
  if (!presentation) {
    return { id: weekId, start: '', end: '', label_en: weekId, label_zh: weekId, ranking: [] }
  }
  return { ...presentation, ranking: [] }
}

async function liveWeek(db: Db, weekId: string, eligible: EligibleListedAt): Promise<Week> {
  const base = emptyWeek(weekId)
  const ranking = rankOpenWeek(await readWeekVotes(db, weekId), eligible)
    .filter((row) => row.votes > 0)
    .map((row, index) => ({ slug: row.slug, votes: row.votes, rank: index + 1 }))
  return { ...base, ranking }
}

async function historyWeeks(db: Db, currentId: string): Promise<Week[]> {
  const ids = await listArchivedIds(db)
  const weeks: Week[] = []
  for (const id of ids) {
    if (id === currentId) continue
    const rows = await readArchive(db, id)
    if (!rows.length) continue
    weeks.push(archiveToWeek(id, rows))
  }
  return weeks
}

/**
 * `requested` is a validated ISO week id. `eligible` is the public list:
 * slug → list time. Hidden and unpublished products are already omitted.
 */
export async function loadBoardPayload(
  db: Db,
  requested: string,
  now: Date,
  eligible: EligibleListedAt,
): Promise<BoardPayload> {
  const currentId = isoWeekId(now)
  const previousId = previousIsoWeekId(now)

  // The cron is Monday 03:00 UTC. Freeze the week that just closed as soon
  // as anyone reads the board, so W46 is not stuck behind that job.
  // `skipped` means the rows were already there — do not call that a backfill.
  let requestedFreeze: { skipped: boolean } | null = null
  if (compareIsoWeek(previousId, currentId) < 0) {
    const frozen = await archiveWeek(db, previousId, eligible)
    if (requested === previousId) requestedFreeze = frozen
  }
  if (requested !== currentId && requested !== previousId && compareIsoWeek(requested, currentId) < 0) {
    requestedFreeze = await archiveWeek(db, requested, eligible)
  }

  const current = await liveWeek(db, currentId, eligible)

  let week: Week
  let source: BoardSource
  if (requested === currentId) {
    week = current
    source = 'live'
  } else if (compareIsoWeek(requested, currentId) > 0) {
    week = emptyWeek(requested)
    source = 'future'
  } else {
    const rows = await readArchive(db, requested)
    if (rows.length) {
      week = archiveToWeek(requested, rows)
      source = requestedFreeze && !requestedFreeze.skipped ? 'backfill' : 'archive'
    } else {
      week = emptyWeek(requested)
      source = 'backfill'
    }
  }

  const history = await historyWeeks(db, currentId)
  return {
    week,
    source,
    current,
    history,
    archived: history.map((item) => item.id),
  }
}
