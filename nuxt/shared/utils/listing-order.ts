/**
 * Ordering rules the public directory and the console agree on.
 *
 * Paid listings sit first, then featured or operator-pinned ones, then the
 * rest. Inside a band, a higher recommend weight comes first; weight 0 keeps
 * the previous sequence (catalogue order, then newest submissions).
 *
 * This file has no imports on purpose: the pages, the admin API and the node
 * tests all call the same functions.
 */

export interface OverrideFlags {
  slug: string
  pin: number
  pin_until: string
  hidden: number
  sort: number
  updated_at: number
}

/** A pin with no end date stays on; a dated pin lasts through that day. */
export function pinWindowActive(until: string | undefined, today: string): boolean {
  if (until === undefined) return false
  return !until || until >= today
}

/**
 * What the tools console should call a row.
 *
 * `hidden` is `tool_overrides.hidden`. It is not a rejection: the submission
 * stays approved, no rejection mail is sent, and the row is not deleted.
 */
export function placementStatus(stored: string, hidden: boolean): string {
  return hidden ? 'hidden' : stored || 'published'
}

export function listingRank(isPaid: boolean, isFeatured: boolean, pinned: boolean): number {
  if (isPaid) return 0
  if (isFeatured || pinned) return 1
  return 2
}

/** Missing or non-numeric weights sort as 0, which does not reorder anyone. */
export function listingWeight(overrides: { sort?: Record<string, number> }, slug: string): number {
  const value = overrides.sort?.[slug]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Higher weight first, but only after rank. Equal weight keeps `index`, which
 * is the order the list already had.
 */
export function compareListingOrder(
  rankA: number,
  rankB: number,
  sortA: number,
  sortB: number,
  indexA: number,
  indexB: number,
): number {
  return rankA - rankB || sortB - sortA || indexA - indexB
}

const WEIGHT_CAP = 1_000_000

export function clampListingWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  const n = Math.trunc(value)
  if (n > WEIGHT_CAP) return WEIGHT_CAP
  if (n < -WEIGHT_CAP) return -WEIGHT_CAP
  return n
}

/**
 * One public string from the two locale boxes.
 *
 * Submitted listings store a single description. The English box wins when it
 * changed; otherwise a Chinese-only edit is kept. Clearing both leaves the
 * stored text in place so a save cannot blank a live page.
 */
export function pickListingText(en: string, zh: string, stored: string, max: number): string {
  const clean = (value: string) =>
    value.replace(/<[^>]{0,200}>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, Math.max(0, max))
  const enClean = clean(en)
  const zhClean = clean(zh)
  const storedClean = clean(stored)
  if (enClean && enClean !== storedClean) return enClean
  if (zhClean && zhClean !== storedClean) return zhClean
  return enClean || zhClean || storedClean
}

/**
 * The next `tool_overrides` row, or null when every switch is off.
 *
 * Null means delete: a row of zeroes would make "unpin" look like it had not
 * been written. Each call changes one switch and leaves the others alone, so
 * hiding a pinned listing does not drop the pin.
 */
export function applyOverrideChange(
  existing: OverrideFlags | null,
  slug: string,
  key: 'pin' | 'hidden' | 'sort',
  value: boolean | number,
  until: string,
  now: number,
): OverrideFlags | null {
  const next: OverrideFlags = existing
    ? {
        slug,
        pin: existing.pin ? 1 : 0,
        pin_until: existing.pin ? existing.pin_until || '' : '',
        hidden: existing.hidden ? 1 : 0,
        sort: clampListingWeight(Number(existing.sort) || 0),
        updated_at: now,
      }
    : { slug, pin: 0, pin_until: '', hidden: 0, sort: 0, updated_at: now }

  if (key === 'pin') {
    const on = Boolean(value)
    next.pin = on ? 1 : 0
    next.pin_until = on ? until : ''
  } else if (key === 'hidden') {
    next.hidden = value ? 1 : 0
  } else {
    next.sort = clampListingWeight(Number(value))
  }
  next.updated_at = now

  if (!next.pin && !next.hidden && !next.sort) return null
  return next
}
