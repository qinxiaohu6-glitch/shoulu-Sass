/**
 * Weekly board ranking.
 *
 * One vote has one value. Paid placement, Billboard, and sidebar ads are not
 * inputs: a product is on the ranked board only when it is eligible and has
 * at least one vote in that ISO week.
 *
 * Tie-break, for weeks that are not already archived:
 *   1. more votes
 *   2. earlier `created_at` of the vote that reached the current count
 *   3. earlier public / list time
 *   4. slug ascending
 * Ranks are consecutive (1, 2, 3…). Callers assign the number from the index.
 */

import { isoWeekId, isoWeekStart, previousIsoWeekId } from './iso-week.ts'

export { isoWeekId, isoWeekStart, previousIsoWeekId }

const WEEK_RE = /^\d{4}-W\d{2}$/
const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function isIsoWeekId(week: string): boolean {
  return WEEK_RE.test(week)
}

/**
 * Read a week id from a URL query, supporting both this site's ISO form
 * (`?week=2026-W46`) and the form used by the competitor
 * (`?year=2026&week=46`). Returns '' for anything else so callers fall back
 * to the current week. Kept here so the page, the board API and the data
 * composable all agree on the same week.
 */
export function weekFromQuery(query: Record<string, unknown>): string {
  const raw = String(query.week ?? '').trim()
  if (isIsoWeekId(raw)) return raw
  const year = String(query.year ?? '').trim()
  if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(raw)) {
    const n = Number(raw)
    if (n >= 1 && n <= 53) return `${year}-W${String(n).padStart(2, '0')}`
  }
  return ''
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export type WeekPresentation = {
  id: string
  start: string
  end: string
  label_en: string
  label_zh: string
}

/** UTC Monday–Sunday labels. W46 is Nov 9 – Nov 15, 2026. */
export function weekPresentation(weekId: string): WeekPresentation | null {
  const start = isoWeekStart(weekId)
  if (!start) return null
  const end = new Date(start.getTime() + 6 * DAY_MS)
  return {
    id: weekId,
    start: isoDate(start),
    end: isoDate(end),
    label_en: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`,
    label_zh: `${start.getUTCMonth() + 1} 月 ${start.getUTCDate()} 日 – ${end.getUTCMonth() + 1} 月 ${end.getUTCDate()} 日`,
  }
}

/** Negative when `a` is an earlier ISO week than `b`. Padded ids compare as strings. */
export function compareIsoWeek(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export type WeekVote = { slug: string; createdAt: number }

/**
 * Rank an open (or not-yet-archived) week.
 *
 * `eligible` maps a public slug to its list time. Smaller is earlier.
 * Slugs missing from the map are not on the board, even if they have votes.
 * Products with zero votes are absent, so they do not receive a contest rank.
 */
export function rankOpenWeek(
  votes: readonly WeekVote[],
  eligible: ReadonlyMap<string, number>,
): { slug: string; votes: number }[] {
  const times = new Map<string, number[]>()
  for (const vote of votes) {
    if (!eligible.has(vote.slug)) continue
    const list = times.get(vote.slug)
    if (list) list.push(vote.createdAt)
    else times.set(vote.slug, [vote.createdAt])
  }

  const rows: { slug: string; votes: number; reachedAt: number; listedAt: number }[] = []
  for (const [slug, stamps] of times) {
    if (!stamps.length) continue
    let reachedAt = stamps[0]!
    for (const stamp of stamps) {
      if (stamp > reachedAt) reachedAt = stamp
    }
    rows.push({
      slug,
      votes: stamps.length,
      reachedAt,
      listedAt: eligible.get(slug) ?? Number.POSITIVE_INFINITY,
    })
  }

  rows.sort((a, b) => {
    if (a.votes !== b.votes) return b.votes - a.votes
    if (a.reachedAt !== b.reachedAt) return a.reachedAt - b.reachedAt
    if (a.listedAt !== b.listedAt) return a.listedAt - b.listedAt
    if (a.slug < b.slug) return -1
    if (a.slug > b.slug) return 1
    return 0
  })

  return rows.map(({ slug, votes }) => ({ slug, votes }))
}
