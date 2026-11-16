/**
 * UTC ISO weeks. Monday 00:00 UTC starts the week, matching /rules.
 *
 * The calendar date is taken from UTC fields. A host whose local zone is
 * ahead of UTC must not roll the board during Sunday evening UTC.
 */

const DAY_MS = 86_400_000

export function isoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** The ISO week that contains `now` minus seven days. */
export function previousIsoWeekId(now = new Date()): string {
  return isoWeekId(new Date(now.getTime() - 7 * DAY_MS))
}
