/**
 * Self-serve weekly ad bookings — scheduling, payment fulfilment, sold-out
 * checks.
 *
 * An ad is rented, not listed. Its `payment_order` row has `submission_id = ''`
 * and `plan = 'ad'` so the webhook can reuse the listing path's signature
 * check, amount check and exactly-once settle. Everything that makes it an ad
 * lives in `ad_booking`, keyed by that order id.
 *
 * Three rules matter more than the rest:
 *
 * 1. **Windows are Monday-aligned and inclusive.** `start` is always a Monday
 *    and `end` is `start + 7 * weeks - 1`. That makes "two bookings overlap"
 *    a plain string comparison on two dates, which works identically in D1
 *    and local SQLite.
 * 2. **The charge and the delivery are separate states.** Money can arrive for
 *    a week that somebody else booked in the meantime. That booking is marked
 *    `conflict` and the order keeps its `paid` status with a note asking an
 *    operator to refund or reschedule — it is never quietly called "live".
 * 3. **Liveness is a property of the data.** `currentAd()` filters `ads` by
 *    today's date, so a placement disappears on its own the morning after
 *    `end`. No cron is needed to take it down.
 */

import type { Db } from './db'
import { createAd, stopAd, today } from './ads'

/** An unstarted checkout holds its week for this long, then frees it. */
const RESERVATION_SECONDS = 30 * 60

export type AdBookingStatus = 'pending' | 'live' | 'conflict' | 'cancelled' | 'refunded'

export interface AdBooking {
  order_id: string
  slot: string
  weeks: number
  start: string
  end: string
  name: string
  headline: string
  url: string
  logo: string
  email: string
  amount_cents: number
  status: AdBookingStatus
  ad_id: string
  created_at: number
  updated_at: number
}

const now = () => Math.floor(Date.now() / 1000)

/* -------------------------------------------------------------------------
   dates
   ------------------------------------------------------------------------- */

function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

/**
 * The next `count` Mondays, strictly after `day`.
 *
 * Strictly after is deliberate: buying a week that already started would
 * charge for seven days while delivering fewer. A buyer on Monday therefore
 * books the *following* Monday, which is what "starting Monday" on the
 * pricing page promises.
 */
export function upcomingMondays(count = 6, day = today()): string[] {
  const date = new Date(`${day}T00:00:00Z`)
  const weekday = date.getUTCDay() // 0 = Sunday, 1 = Monday
  let delta = (8 - weekday) % 7
  if (delta === 0) delta = 7
  const first = addDays(day, delta)
  return Array.from({ length: count }, (_, index) => addDays(first, index * 7))
}

/** Both ends inclusive: one week is Monday → Sunday, four weeks is 28 days. */
export function bookingWindow(start: string, weeks: number): { start: string; end: string } {
  return { start, end: addDays(start, 7 * weeks - 1) }
}

/** A client may only name one of the Mondays this server just offered. */
export function isBookableMonday(start: string, day = today()): boolean {
  return upcomingMondays(6, day).includes(start)
}

/* -------------------------------------------------------------------------
   storage
   ------------------------------------------------------------------------- */

export interface NewAdBooking {
  orderId: string
  slot: string
  weeks: number
  start: string
  end: string
  name: string
  headline: string
  url: string
  logo: string
  email: string
  amountCents: number
}

export async function createAdBooking(db: Db, input: NewAdBooking): Promise<AdBooking> {
  const ts = now()
  await db
    .prepare(
      `INSERT INTO ad_booking (
         order_id, slot, weeks, start, end, name, headline, url, logo, email,
         amount_cents, status, ad_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`,
    )
    .bind(
      input.orderId,
      input.slot,
      input.weeks,
      input.start,
      input.end,
      input.name,
      input.headline,
      input.url,
      input.logo,
      input.email,
      input.amountCents,
      ts,
      ts,
    )
    .run()
  return (await getAdBooking(db, input.orderId))!
}

export async function getAdBooking(db: Db, orderId: string): Promise<AdBooking | null> {
  if (!orderId) return null
  return db
    .prepare('SELECT * FROM ad_booking WHERE order_id = ?')
    .bind(orderId)
    .first<AdBooking>()
}

export async function setAdBookingStatus(
  db: Db,
  orderId: string,
  status: AdBookingStatus,
  adId?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ad_booking
          SET status = ?, ad_id = COALESCE(?, ad_id), updated_at = ?
        WHERE order_id = ?`,
    )
    .bind(status, adId ?? null, now(), orderId)
    .run()
}

/**
 * Is any part of `[start, end]` already sold for this slot?
 *
 * Two sources of truth, both checked:
 *   - `ads` rows that are switched on — these are delivered placements;
 *   - `ad_booking` rows that are `live`, or still `pending` inside the
 *     reservation window — these are paid or in-flight checkouts.
 *
 * `excludeOrderId` is for the webhook settling its own booking; without it a
 * booking would see itself and refuse to publish. `email` lets a buyer retry
 * their own abandoned checkout without their old reservation blocking them.
 */
export async function slotConflict(
  db: Db,
  slot: string,
  start: string,
  end: string,
  opts: { excludeOrderId?: string; email?: string } = {},
): Promise<boolean> {
  const booked = await db
    .prepare(
      `SELECT 1 FROM ads
        WHERE slot = ? AND active = 1 AND start <= ? AND end >= ?
        LIMIT 1`,
    )
    .bind(slot, end, start)
    .first()
  if (booked) return true

  const cutoff = now() - RESERVATION_SECONDS
  const held = await db
    .prepare(
      `SELECT 1 FROM ad_booking
        WHERE slot = ? AND start <= ? AND end >= ?
          AND order_id <> ?
          AND (
            status = 'live'
            OR (status = 'pending' AND created_at >= ? AND email <> ?)
          )
        LIMIT 1`,
    )
    .bind(slot, end, start, opts.excludeOrderId ?? '', cutoff, opts.email ?? '')
    .first()
  return Boolean(held)
}

/** Which of the offered Mondays can still be bought for `weeks` weeks. */
export async function weekAvailability(
  db: Db,
  slot: string,
  weeks: number,
  starts: string[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  for (const start of starts) {
    const { end } = bookingWindow(start, weeks)
    out[start] = !(await slotConflict(db, slot, start, end))
  }
  return out
}

/* -------------------------------------------------------------------------
   fulfilment
   ------------------------------------------------------------------------- */

export type ActivationResult =
  | { ok: true; adId: string; duplicate: boolean }
  | { ok: false; reason: 'missing_booking' | 'slot_conflict' }

/**
 * Money arrived → publish the placement.
 *
 * Idempotent by design: a retried webhook finds `status = 'live'` and does
 * nothing. The conflict check is repeated here rather than trusting the one
 * done at checkout, because two buyers can pay for the same week minutes
 * apart. Whoever settles first gets the slot; the other is flagged for an
 * operator instead of silently overwriting them.
 */
export async function activateAdBooking(db: Db, orderId: string): Promise<ActivationResult> {
  const booking = await getAdBooking(db, orderId)
  if (!booking) return { ok: false, reason: 'missing_booking' }
  if (booking.status === 'live') {
    return { ok: true, adId: booking.ad_id, duplicate: true }
  }

  const conflict = await slotConflict(db, booking.slot, booking.start, booking.end, {
    excludeOrderId: orderId,
    email: booking.email,
  })
  if (conflict) {
    await setAdBookingStatus(db, orderId, 'conflict')
    return { ok: false, reason: 'slot_conflict' }
  }

  const ad = await createAd(db, {
    slot: booking.slot,
    name: booking.name,
    headline: booking.headline,
    url: booking.url,
    logo: booking.logo,
    start: booking.start,
    end: booking.end,
    active: true,
    note: `self-serve order ${orderId} (${booking.weeks}w)`,
  })
  await setAdBookingStatus(db, orderId, 'live', ad.id)
  return { ok: true, adId: ad.id, duplicate: false }
}

/** A refund takes the placement down but keeps the invoice history. */
export async function stopAdBooking(db: Db, orderId: string): Promise<void> {
  const booking = await getAdBooking(db, orderId)
  if (!booking) return
  if (booking.ad_id) {
    await stopAd(db, booking.ad_id).catch(() => null)
  }
  await setAdBookingStatus(db, orderId, 'refunded')
}

export async function listAdBookings(db: Db, limit = 200): Promise<AdBooking[]> {
  const { results } = await db
    .prepare('SELECT * FROM ad_booking ORDER BY created_at DESC LIMIT ?')
    .bind(Math.max(1, Math.min(500, limit)))
    .all<AdBooking>()
  return results
}
