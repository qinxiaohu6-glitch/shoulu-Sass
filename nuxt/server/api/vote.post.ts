/**
 * POST /api/vote — one vote per signed-in user per product per ISO week.
 *
 * 401 without a session on purpose: the leaderboard says "ranked by votes from
 * signed-in users", and an anonymous endpoint would make that sentence false
 * the first time someone holds down F5.
 */

import { useDb } from '../utils/db'
import { castVote, denyAnonymousVote, isValidWeek, isValidSlug } from '../utils/votes'
import { isoWeekId } from '~~/shared/utils/catalog'
import { voterKey } from '../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_payload' }
  }

  const voter = await voterKey(event)
  if (!voter) {
    const denied = denyAnonymousVote(voter)!
    setResponseStatus(event, denied.status)
    return {
      ok: false,
      reason: denied.reason,
      message_zh: denied.message_zh,
      message_en: denied.message_en,
    }
  }

  const payload = body as Record<string, unknown>
  const slug = String(payload.slug ?? '').trim()
  if (!isValidSlug(slug)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_slug' }
  }

  let week = String(payload.week ?? '').trim()
  if (!isValidWeek(week)) week = isoWeekId()

  try {
    const db = await useDb(event)
    const result = await castVote(db, week, slug, voter)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, week, slug, ...result }
  } catch (err) {
    console.error('[vote]', err)
    setResponseStatus(event, 503)
    return { ok: false, reason: 'service_unavailable' }
  }
})
