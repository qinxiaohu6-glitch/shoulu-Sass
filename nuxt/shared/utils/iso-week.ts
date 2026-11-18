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

/** Monday 00:00 UTC of an ISO week id, e.g. 2026-W46 → 2026-11-09. */
export function isoWeekStart(weekId: string): Date | null {
  if (!/^\d{4}-W\d{2}$/.test(weekId)) return null
  const [yearPart, weekPart] = weekId.split('-W')
  const year = Number(yearPart)
  const week = Number(weekPart)
  if (!(week >= 1 && week <= 53)) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekday = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (weekday - 1) + (week - 1) * 7)
  return monday
}

/**
 * The last `count` ISO weeks ending with the one that contains `now`, oldest
 * first, as UTC `[start, end)` millisecond ranges. `end` is exclusive so a
 * timestamp belongs to exactly one week.
 */
export function recentIsoWeeks(
  now = new Date(),
  count = 6,
): { id: string; start: number; end: number }[] {
  const out: { id: string; start: number; end: number }[] = []
  let cursor = new Date(now.getTime())
  for (let i = 0; i < count; i++) {
    const id = isoWeekId(cursor)
    const start = isoWeekStart(id)
    if (!start) break
    const startMs = start.getTime()
    out.push({ id, start: startMs, end: startMs + 7 * DAY_MS })
    cursor = new Date(startMs - DAY_MS)
  }
  return out.reverse()
}
