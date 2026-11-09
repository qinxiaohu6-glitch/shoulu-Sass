/**
 * Operator overrides for the curated catalogue.
 *
 * Two switches, and both used to be fake: the pin toggle wrote to localStorage
 * and "unpublish" only greyed out a table row, so the site never changed. This
 * is the server-side store behind them.
 *
 *  * `pin`    — promote a listing to the featured block until a date, without
 *               editing the build-time catalogue. An operator can extend a
 *               placement that was already sold.
 *  * `hidden` — take a listing out of every list and answer 410 on its own
 *               page. The catalogue entry stays, and clearing the flag puts
 *               it back. Relist on the tools desk is this flag turning off.
 *  * `removed` — irreversible tombstone for a catalogue preset. Reported to
 *               every reader inside `hidden`, so a deleted preset cannot be
 *               revived by unhide or by the next catalogue merge.
 *  * `sort`   — recommend weight inside that band. The directory lists read it
 *               from the same payload as the two switches above.
 *
 * A hidden page answers 410 rather than 404 on purpose. 404 says "never
 * existed", which invites a crawler to keep probing; 410 says "it was here and
 * it is not coming back", which is what an operator means when they pull a
 * listing.
 */

import { applyTombstone } from '../../shared/utils/listing-desk'
import { applyOverrideChange, type OverrideFlags } from '../../shared/utils/listing-order'
import type { Db } from './db'

export type OverrideRow = {
  slug: string
  pin: number
  pin_until: string
  hidden: number
  /** Recommend weight. Absent on a database that has not been altered yet. */
  sort?: number
  /** Catalogue tombstone. Absent until `ensureOverrideColumns` adds it. */
  removed?: number
  updated_at: number
}

export type OverrideState = {
  /** slug → last day the pin applies; `''` means "until switched off". */
  pinned: Record<string, string>
  /** Hidden or tombstoned. Public lists, the board, the sitemap and 410 all read this. */
  hidden: string[]
  /** Tombstoned slugs. The tools desk omits these; they also sit in `hidden`. */
  removed: string[]
  /** slug → recommend weight. Only non-zero weights are listed. */
  sort: Record<string, number>
}

export const EMPTY_OVERRIDES: OverrideState = { pinned: {}, hidden: [], removed: [], sort: {} }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class OverrideError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** The public shape: no timestamps, no operator identity. */
export function toState(rows: OverrideRow[]): OverrideState {
  const pinned: Record<string, string> = {}
  const hidden: string[] = []
  const removed: string[] = []
  const sort: Record<string, number> = {}
  for (const row of rows) {
    // A tombstone is hidden for every public reader, including ones that only
    // learned the `hidden` array. Unhide does not clear `removed`.
    if (row.hidden || row.removed) hidden.push(row.slug)
    if (row.removed) removed.push(row.slug)
    if (row.pin) pinned[row.slug] = row.pin_until || ''
    if (row.sort) sort[row.slug] = row.sort
  }
  return { pinned, hidden, removed, sort }
}

/**
 * `sort` arrived after the first deploy. `CREATE TABLE IF NOT EXISTS` does not
 * add a column to a database that already has the table, so the first read or
 * write brings an existing D1 forward. Memoised: one pragma per isolate.
 */
let overrideColumnsReady = false

export async function ensureOverrideColumns(db: Db): Promise<void> {
  if (overrideColumnsReady) return
  const cols = await db.prepare('PRAGMA table_info(tool_overrides)').all<{ name: string }>()
  const names = new Set(cols.results.map((col) => col.name))
  if (!names.has('sort')) {
    await db.prepare('ALTER TABLE tool_overrides ADD COLUMN sort INTEGER NOT NULL DEFAULT 0').run()
  }
  if (!names.has('removed')) {
    await db.prepare('ALTER TABLE tool_overrides ADD COLUMN removed INTEGER NOT NULL DEFAULT 0').run()
  }
  overrideColumnsReady = true
}

export async function listOverrides(db: Db): Promise<OverrideRow[]> {
  await ensureOverrideColumns(db)
  const { results } = await db
    .prepare('SELECT * FROM tool_overrides ORDER BY updated_at DESC')
    .all<OverrideRow>()
  return results
}

export async function loadOverrides(db: Db): Promise<OverrideState> {
  return toState(await listOverrides(db))
}

/**
 * Set one flag on one listing.
 *
 * Writing a row of all-false flags would leave `{}` behind and make "unpin"
 * look like it had not worked when you read the table, so an empty record is
 * deleted instead.
 */
function flagsOf(row: OverrideRow | null): OverrideFlags | null {
  if (!row) return null
  return {
    slug: row.slug,
    pin: row.pin ? 1 : 0,
    pin_until: row.pin_until || '',
    hidden: row.hidden ? 1 : 0,
    sort: Number(row.sort) || 0,
    removed: row.removed ? 1 : 0,
    updated_at: row.updated_at || 0,
  }
}

async function readOverride(db: Db, slug: string): Promise<OverrideRow | null> {
  return db.prepare('SELECT * FROM tool_overrides WHERE slug = ?').bind(slug).first<OverrideRow>()
}

async function persistOverride(db: Db, slug: string, next: OverrideFlags | null): Promise<OverrideRow | null> {
  if (!next) {
    await db.prepare('DELETE FROM tool_overrides WHERE slug = ?').bind(slug).run()
    return null
  }
  await db
    .prepare(
      `INSERT INTO tool_overrides (slug, pin, pin_until, hidden, sort, removed, updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(slug) DO UPDATE SET
         pin = excluded.pin, pin_until = excluded.pin_until,
         hidden = excluded.hidden, sort = excluded.sort,
         removed = excluded.removed, updated_at = excluded.updated_at`,
    )
    .bind(next.slug, next.pin, next.pin_until, next.hidden, next.sort, next.removed ? 1 : 0, next.updated_at)
    .run()
  return next
}

export async function setOverride(
  db: Db,
  slug: string,
  key: 'pin' | 'hidden',
  value: boolean,
  until = '',
): Promise<OverrideRow | null> {
  const clean = String(slug || '').trim()
  if (!SLUG_RE.test(clean)) throw new OverrideError('bad_slug')
  if (key !== 'pin' && key !== 'hidden') throw new OverrideError('bad_key')

  const untilDate = String(until || '').trim()
  if (untilDate && !DATE_RE.test(untilDate)) throw new OverrideError('bad_date')

  await ensureOverrideColumns(db)
  const existing = await readOverride(db, clean)
  const next = applyOverrideChange(
    flagsOf(existing),
    clean,
    key,
    value,
    untilDate,
    Math.floor(Date.now() / 1000),
  )
  return persistOverride(db, clean, next)
}

/**
 * Recommend weight for one listing.
 *
 * The public lists read this from the same override payload as pin and hide.
 * Zero with no other switch deletes the row, same as unpinning a bare pin.
 */
export async function setListingWeight(db: Db, slug: string, sort: number): Promise<OverrideRow | null> {
  const clean = String(slug || '').trim()
  if (!SLUG_RE.test(clean)) throw new OverrideError('bad_slug')

  await ensureOverrideColumns(db)
  const existing = await readOverride(db, clean)
  const next = applyOverrideChange(
    flagsOf(existing),
    clean,
    'sort',
    sort,
    '',
    Math.floor(Date.now() / 1000),
  )
  return persistOverride(db, clean, next)
}

export async function isRemoved(db: Db, slug: string): Promise<boolean> {
  await ensureOverrideColumns(db)
  const row = await db
    .prepare('SELECT removed FROM tool_overrides WHERE slug = ?')
    .bind(slug)
    .first<{ removed: number }>()
  return Boolean(row?.removed)
}

export async function isHidden(db: Db, slug: string): Promise<boolean> {
  await ensureOverrideColumns(db)
  const row = await db
    .prepare('SELECT hidden, removed FROM tool_overrides WHERE slug = ?')
    .bind(slug)
    .first<{ hidden: number; removed: number }>()
  return Boolean(row?.hidden || row?.removed)
}

/**
 * Mark a catalogue preset deleted.
 *
 * The row stays, with `removed` set, so a later relist (which only clears
 * `hidden`) still reports the slug as hidden. Callers also write
 * `dir_tool.status = 'deleted'` so the merged list does not copy the preset
 * back out of `catalog.json`.
 */
export async function tombstoneOverride(db: Db, slug: string): Promise<OverrideRow> {
  const clean = String(slug || '').trim()
  if (!SLUG_RE.test(clean)) throw new OverrideError('bad_slug')
  await ensureOverrideColumns(db)
  const existing = await readOverride(db, clean)
  const next = applyTombstone(flagsOf(existing), clean, Math.floor(Date.now() / 1000))
  const saved = await persistOverride(db, clean, next)
  if (!saved) throw new OverrideError('bad_slug')
  return saved
}
