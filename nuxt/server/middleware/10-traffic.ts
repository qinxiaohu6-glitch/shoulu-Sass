/**
 * Count a page view, once per request that deserves one.
 *
 * Runs before the route, so it cannot see the status code; what it filters on
 * is the request itself — method, path, user agent, prefetch hint. A 404 on a
 * made-up URL still counts, which is the same thing a traffic tool does and the
 * same thing the page's own visitor did.
 *
 * The write goes to `waitUntil` so the page is not waiting on a counter. If the
 * table has not been migrated yet the promise rejects and is logged; the page
 * still renders, because a missing statistic must never take the site down.
 */

import {
  hourBucket,
  isBotUserAgent,
  isCountablePath,
  isPrefetch,
} from '../../shared/utils/traffic.ts'
import { useDb } from '../utils/db'
import { clientIp, hashIp } from '../utils/http'
import { addPageView } from '../utils/traffic'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  // Build-time rendering is not traffic.
  if ((import.meta as { prerender?: boolean }).prerender) return
  if (!isCountablePath(event.path)) return

  const userAgent = getRequestHeader(event, 'user-agent') ?? ''
  if (isBotUserAgent(userAgent)) return
  if (isPrefetch(getRequestHeader(event, 'sec-purpose') ?? getRequestHeader(event, 'purpose'))) return

  try {
    const db = await useDb(event)
    const now = new Date()
    const bucket = hourBucket(now)
    // Salted, day-scoped, and built from the same salt the submission quota
    // uses — never the address itself.
    const vid = await hashIp(
      `${bucket.slice(0, 10)}|${clientIp(event)}|${userAgent}`,
      event,
    )
    const pending = addPageView(db, now, vid).catch((err: unknown) => {
      console.error('[traffic] count failed', err)
    })
    const waitUntil = (event as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil
    if (typeof waitUntil === 'function') waitUntil.call(event, pending)
  } catch (err) {
    console.error('[traffic]', err)
  }
})
