/**
 * Desk rules shared by the tools console and the public directory.
 *
 * Kept free of database and Vue imports so the node tests can call the same
 * functions the server uses: when a hidden row may be deleted, how a catalogue
 * preset stays deleted, and how a board renumbers after a hidden slug leaves.
 */

import type { OverrideFlags } from './listing-order.ts'

/** Shown when a live listing is deleted without being unpublished first. */
export const DELETE_STILL_PUBLISHED =
  'Only unpublished tools can be deleted — unpublish first'

/**
 * `tool_overrides.hidden` is unpublished, even when `dir_tool.status` is still
 * approved. A row that was never hidden still has to be pending, rejected, or
 * otherwise not published.
 */
export function canDeleteStoredListing(consoleStatus: string, hidden: boolean): boolean {
  if (hidden) return true
  return consoleStatus !== 'published'
}

/** `null` when the row may be deleted. */
export function deleteListingBlockReason(consoleStatus: string, hidden: boolean): string | null {
  return canDeleteStoredListing(consoleStatus, hidden) ? null : DELETE_STILL_PUBLISHED
}

/**
 * Irreversible catalogue tombstone.
 *
 * `removed` stays on after a later unhide, so clearing `hidden` cannot bring a
 * deleted preset back. `hidden` is also set so readers that only know the old
 * column drop the slug on the same write.
 */
export function applyTombstone(
  existing: OverrideFlags | null,
  slug: string,
  now: number,
): OverrideFlags {
  return {
    slug,
    pin: existing?.pin ? 1 : 0,
    pin_until: existing?.pin ? existing.pin_until || '' : '',
    hidden: 1,
    sort: Number(existing?.sort) || 0,
    removed: 1,
    updated_at: now,
  }
}

/** Slugs the public directory must treat as gone: hidden or tombstoned. */
export function overrideHiddenSlugs(
  rows: readonly { slug: string; hidden?: number; removed?: number }[],
): string[] {
  const out: string[] = []
  for (const row of rows) {
    if (row.hidden || row.removed) out.push(row.slug)
  }
  return out
}

/**
 * Catalogue seeds that are not already stored and not tombstoned.
 *
 * Deleting only the `dir_tool` row would leave the slug out of `seen`, and the
 * next read would copy it back from `catalog.json`. A tombstoned slug is
 * skipped here instead.
 */
export function catalogFallback<T extends { slug: string }>(
  seeds: readonly T[],
  seen: Iterable<string>,
  tombstoned: Iterable<string>,
): T[] {
  const skip = new Set<string>([...seen, ...tombstoned])
  return seeds.filter((seed) => !skip.has(seed.slug))
}

/**
 * Drop hidden slugs, then number whoever is left from 1.
 *
 * Filtering after the rank was assigned left a hole at the old position and
 * kept a clickable card. The limit is applied after the filter so a board of
 * six stays six when a later row can move up.
 */
export function rankedBoard<T extends { slug: string }>(
  rows: readonly T[],
  hidden: readonly string[] = [],
  limit?: number,
): Array<T & { rank: number }> {
  const gone = new Set(hidden)
  const kept = hidden.length ? rows.filter((row) => !gone.has(row.slug)) : rows.slice()
  const sliced = typeof limit === 'number' ? kept.slice(0, Math.max(0, limit)) : kept
  return sliced.map((row, index) => ({ ...row, rank: index + 1 }))
}

/**
 * Who a submission is filed under.
 *
 * No `sub` means there is no session worth recording. Callers must refuse the
 * write; they must not fall through to an anonymous insert.
 */
export function submissionSessionOwner(
  session: { sub?: string; email?: string } | null | undefined,
): { sub: string; email: string } | null {
  const sub = String(session?.sub || '').trim()
  if (!sub) return null
  return { sub, email: String(session?.email || '').trim() }
}
