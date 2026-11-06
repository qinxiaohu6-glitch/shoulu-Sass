/**
 * GET /api/board — the newest week the cron has closed.
 *
 * The build-time catalogue carries the weeks that existed when the site was
 * built. This is the part that keeps growing: once a week closes, the cron
 * writes it here and the board can show it without a redeploy.
 *
 * `null` is the ordinary answer on a fresh install, and the pages fall back to
 * the catalogue — which is why an empty archive renders byte-identically to the
 * pre-cron build.
 */

import { latestArchive } from '../utils/archive'
import { useDb } from '../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb(event)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, week: await latestArchive(db) }
  } catch (err) {
    // The board is one section of one page; a database hiccup must not take the
    // page down with it.
    console.error('[board]', err)
    return { ok: false, week: null }
  }
})
