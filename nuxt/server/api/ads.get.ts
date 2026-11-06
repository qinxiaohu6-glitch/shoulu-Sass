/**
 * GET /api/ads — the placement each slot is showing right now.
 *
 * Public and unauthenticated: it is what the homepage renders. One ad per slot
 * (the oldest booking wins), and `null` when nothing is booked — the page then
 * renders no frame at all, which is what the live site does.
 *
 * A database hiccup returns an empty payload rather than an error: a missing ad
 * is a missing ad, while a 500 here would take the whole homepage down with it.
 */

import { useDb } from '../utils/db'
import { currentAd, publicAd } from '../utils/ads'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb(event)
    const [board, sidebar] = await Promise.all([
      currentAd(db, 'board'),
      currentAd(db, 'sidebar'),
    ])
    // A window can close at midnight, so a cached copy is wrong by morning.
    setResponseHeader(event, 'cache-control', 'no-store')
    return {
      ok: true,
      board: board ? publicAd(board) : null,
      sidebar: sidebar ? publicAd(sidebar) : null,
    }
  } catch (err) {
    console.error('[ads]', err)
    return { ok: false, board: null, sidebar: null }
  }
})
