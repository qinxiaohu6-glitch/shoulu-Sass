/**
 * GET /api/admin/ads — every placement ever booked, newest first, plus the
 * counts the console header shows.
 *
 * 404 without the cookie, like the rest of `/api/admin/*`: an unauthorised
 * caller learns nothing about whether the route exists.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { adStats, listAds } from '../../utils/ads'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = await useDb(event)
  return { ok: true, items: await listAds(db), stats: await adStats(db) }
})
