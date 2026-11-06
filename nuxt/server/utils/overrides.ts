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
 *               page. The catalogue entry stays: a deploy that deletes records
 *               is not something this site does, and "gone" is reversible.
 *
 * A hidden page answers 410 rather than 404 on purpose. 404 says "never
 * existed", which invites a crawler to keep probing; 410 says "it was here and
 * it is not coming back", which is what an operator means when they pull a
 * listing.
 */

import type { Db } from './db'

export type OverrideRow = {
  slug: string
  pin: number
  pin_until: string
  hidden: number
  updated_at: number
}

export type OverrideState = {
  /** slug → last day the pin applies; `''` means "until switched off". */
  pinned: Record<string, string>
  hidden: string[]
}

export const EMPTY_OVERRIDES: OverrideState = { pinned: {}, hidden: [] }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class OverrideError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

/** The public shape: no timestamps, no operator identity. */
export function toState(rows: OverrideRow[]): OverrideState {
  const pinned: Record<string, string> = {}
  const hidden: string[] = []
  for (const row of rows) {
    if (row.hidden) hidden.push(row.slug)
    if (row.pin) pinned[row.slug] = row.pin_until || ''
  }
  return { pinned, hidden }
}

export async function listOverrides(db: Db): Promise<OverrideRow[]> {
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

  const existing = await db
    .prepare('SELECT * FROM tool_overrides WHERE slug = ?')
    .bind(clean)
    .first<OverrideRow>()

  const next: OverrideRow = existing ?? {
    slug: clean,
    pin: 0,
    pin_until: '',
    hidden: 0,
    updated_at: 0,
  }

  if (key === 'pin') {
    next.pin = value ? 1 : 0
    next.pin_until = value ? untilDate : ''
  } else {
    next.hidden = value ? 1 : 0
  }
  next.updated_at = Math.floor(Date.now() / 1000)

  if (!next.pin && !next.hidden) {
    await db.prepare('DELETE FROM tool_overrides WHERE slug = ?').bind(clean).run()
    return null
  }

  await db
    .prepare(
      `INSERT INTO tool_overrides (slug, pin, pin_until, hidden, updated_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(slug) DO UPDATE SET
         pin = excluded.pin, pin_until = excluded.pin_until,
         hidden = excluded.hidden, updated_at = excluded.updated_at`,
    )
    .bind(next.slug, next.pin, next.pin_until, next.hidden, next.updated_at)
    .run()

  return next
}

export async function isHidden(db: Db, slug: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT hidden FROM tool_overrides WHERE slug = ?')
    .bind(slug)
    .first<{ hidden: number }>()
  return Boolean(row?.hidden)
}
