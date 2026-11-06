/**
 * Weekly ad placements — the thing the pricing page actually sells.
 *
 * Two slots and they are not the same product:
 *
 *  * `board`   — one row inside the weekly leaderboard, after third place;
 *  * `sidebar` — a card at the top of the right rail.
 *
 * Both are rented by the week, so every row carries `start`/`end` and liveness
 * is a property of the *data*, not of a rebuild: tomorrow's page stops showing
 * an ad whose window ended today, whether or not anyone ran anything.
 *
 * `active` is the operator's kill switch and is deliberately separate from the
 * dates — pulling a campaign early must not rewrite the window the invoice was
 * written from.
 *
 * Ported from the old file store (`ads.py`), including the rules that cost
 * something to learn: dates are validated as real dates (a 2026-02-31 that only
 * string-compares would sit in the table forever), `end` cannot precede `start`
 * (an inverted window is never live and looks like a bug), and only http(s)
 * URLs are accepted (a `javascript:` click target on the homepage is an XSS
 * payload with a budget).
 */

import type { Db } from './db'

export const AD_SLOTS = ['board', 'sidebar'] as const
export type AdSlot = (typeof AD_SLOTS)[number]

export const isAdSlot = (value: string): value is AdSlot =>
  (AD_SLOTS as readonly string[]).includes(value)

export type AdRow = {
  id: string
  slot: string
  name: string
  headline: string
  url: string
  logo: string
  start: string
  end: string
  active: number
  note: string
  created_at: number
  stopped_at: number | null
}

export class AdError extends Error {
  constructor(
    public code: string,
    public field?: string,
  ) {
    super(code)
  }
}

/* -------------------------------------------------------------------------
   dates
   ------------------------------------------------------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` and a day that exists, or null. */
function parseDay(value: string): Date | null {
  if (!DATE_RE.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // 2026-02-31 rolls over to March; a date that does not round-trip is a typo.
  return d.toISOString().slice(0, 10) === value ? d : null
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Inside its window and not switched off. Both ends are inclusive. */
export function isLive(row: AdRow, day = today()): boolean {
  if (!row.active) return false
  if (row.start && row.start > day) return false
  if (row.end && row.end < day) return false
  return true
}

/** What the page needs — no operator fields. */
export function publicAd(row: AdRow) {
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    headline: row.headline,
    url: row.url,
    logo: row.logo,
    start: row.start,
    end: row.end,
    note: row.note,
  }
}

/* -------------------------------------------------------------------------
   validation
   ------------------------------------------------------------------------- */

const NAME_MIN = 2
const NAME_MAX = 60
const HEAD_MIN = 4
const HEAD_MAX = 90
const URL_RE = /^https?:\/\/[^\s<>"]+$/i

function cleanText(raw: unknown, field: string, lo: number, hi: number): string {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < lo) throw new AdError('too_short', field)
  if (text.length > hi) throw new AdError('too_long', field)
  return text
}

function cleanUrl(raw: unknown, field: string): string {
  const url = String(raw ?? '').trim()
  if (!URL_RE.test(url)) throw new AdError('bad_url', field)
  return url
}

export type CleanAd = {
  slot: AdSlot
  name: string
  headline: string
  url: string
  logo: string
  start: string
  end: string
  active: boolean
  note: string
}

export function validate(payload: Record<string, unknown>, day = today()): CleanAd {
  const slot = String(payload.slot ?? '').trim().toLowerCase()
  if (!isAdSlot(slot)) throw new AdError('bad_slot', 'slot')

  const start = String(payload.start ?? '').trim() || day
  if (!parseDay(start)) throw new AdError('bad_date', 'start')

  const end = String(payload.end ?? '').trim()
  if (!parseDay(end)) throw new AdError('bad_date', 'end')
  if (end < start) throw new AdError('end_before_start', 'end')

  let logo = String(payload.logo ?? '').trim()
  if (logo && !URL_RE.test(logo)) logo = ''

  return {
    slot,
    name: cleanText(payload.name, 'name', NAME_MIN, NAME_MAX),
    headline: cleanText(payload.headline, 'headline', HEAD_MIN, HEAD_MAX),
    url: cleanUrl(payload.url, 'url'),
    logo,
    start,
    end,
    active: payload.active === undefined ? true : Boolean(payload.active),
    note: String(payload.note ?? '').trim().slice(0, 200),
  }
}

/* -------------------------------------------------------------------------
   storage
   ------------------------------------------------------------------------- */

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const tail = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `ad-${today().replace(/-/g, '')}-${tail}`
}

/**
 * Live placements, oldest booking first.
 *
 * Oldest first is deliberate: when two campaigns overlap, the one that was
 * booked earlier wins the slot. Sorting by date would let a late booking
 * displace one that is already running.
 */
export async function activeAds(db: Db, slot?: AdSlot, day = today()): Promise<AdRow[]> {
  const sql = slot
    ? `SELECT * FROM ads WHERE active = 1 AND slot = ? ORDER BY created_at ASC, id ASC`
    : `SELECT * FROM ads WHERE active = 1 ORDER BY created_at ASC, id ASC`
  const stmt = slot ? db.prepare(sql).bind(slot) : db.prepare(sql)
  const { results } = await stmt.all<AdRow>()
  return results.filter((row) => isLive(row, day))
}

/** The one ad a slot renders, or null. */
export async function currentAd(db: Db, slot: AdSlot, day = today()): Promise<AdRow | null> {
  const rows = await activeAds(db, slot, day)
  return rows[0] ?? null
}

export async function listAds(db: Db, limit = 200): Promise<AdRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM ads ORDER BY created_at DESC LIMIT ?')
    .bind(Math.max(1, Math.min(500, limit)))
    .all<AdRow>()
  return results
}

export async function getAd(db: Db, id: string): Promise<AdRow | null> {
  if (!id) return null
  return db.prepare('SELECT * FROM ads WHERE id = ?').bind(id).first<AdRow>()
}

export async function createAd(db: Db, payload: Record<string, unknown>): Promise<AdRow> {
  const body = validate(payload)
  const now = Math.floor(Date.now() / 1000)
  const id = randomId()
  await db
    .prepare(
      `INSERT INTO ads (id, slot, name, headline, url, logo, start, end, active, note, created_at, stopped_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`,
    )
    .bind(
      id,
      body.slot,
      body.name,
      body.headline,
      body.url,
      body.logo,
      body.start,
      body.end,
      body.active ? 1 : 0,
      body.note,
      now,
    )
    .run()
  return (await getAd(db, id))!
}

/** Edit in place. The window can be extended without losing `created_at`. */
export async function updateAd(
  db: Db,
  id: string,
  payload: Record<string, unknown>,
): Promise<AdRow> {
  const row = await getAd(db, id)
  if (!row) throw new AdError('not_found')
  const merged = { ...row, ...payload }
  const body = validate(merged as Record<string, unknown>)
  await db
    .prepare(
      `UPDATE ads SET slot=?, name=?, headline=?, url=?, logo=?, start=?, end=?, active=?, note=?
        WHERE id = ?`,
    )
    .bind(
      body.slot,
      body.name,
      body.headline,
      body.url,
      body.logo,
      body.start,
      body.end,
      body.active ? 1 : 0,
      body.note,
      id,
    )
    .run()
  return (await getAd(db, id))!
}

/** Take a placement down now, keeping the record for the invoice. */
export async function stopAd(db: Db, id: string): Promise<AdRow> {
  const row = await getAd(db, id)
  if (!row) throw new AdError('not_found')
  await db
    .prepare('UPDATE ads SET active = 0, stopped_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run()
  return (await getAd(db, id))!
}

export async function adStats(db: Db, day = today()) {
  const rows = await listAds(db, 500)
  const live = rows.filter((row) => isLive(row, day))
  return {
    total: rows.length,
    live: live.length,
    board_live: live.filter((row) => row.slot === 'board').length,
    sidebar_live: live.filter((row) => row.slot === 'sidebar').length,
  }
}
