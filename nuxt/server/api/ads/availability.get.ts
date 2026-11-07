/**
 * GET /api/ads/availability — which upcoming Mondays are still open.
 *
 * Public and unauthenticated: the booking page needs it before anyone has
 * typed an email. `slot` and `weeks` are validated against the same whitelist
 * the checkout uses, so an answer for "3 weeks" cannot suggest a price the
 * site does not sell.
 *
 * This is a *hint*, not a lock. Two buyers can still pay for the same week a
 * few seconds apart; `activateAdBooking()` repeats the check when the money
 * arrives and flags the loser as `conflict` for an operator.
 */

import { useDb } from '../../utils/db'
import { isAdSlot } from '../../utils/ads'
import { upcomingMondays, weekAvailability } from '../../utils/ad-bookings'
import { AD_WEEK_OPTIONS } from '~~/shared/content/pricing'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const query = getQuery(event)
  const slot = String(query.slot ?? '').trim().toLowerCase()
  const weeks = Number(query.weeks ?? 1)
  if (!isAdSlot(slot) || !(AD_WEEK_OPTIONS as readonly number[]).includes(weeks)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  try {
    const db = await useDb(event)
    const starts = upcomingMondays(6)
    return {
      ok: true,
      slot,
      weeks,
      starts,
      available: await weekAvailability(db, slot, weeks, starts),
    }
  } catch (err) {
    console.error('[ads] availability', err)
    return { ok: false, starts: [], available: {} }
  }
})
