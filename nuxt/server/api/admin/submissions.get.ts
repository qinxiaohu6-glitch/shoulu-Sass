/**
 * GET /api/admin/submissions?status=pending
 *
 * The review queue. This payload is deliberately richer than the public one —
 * it carries the submitter's address so a rejection can be explained to them —
 * which is why the whole endpoint answers 404 to anyone without the token.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { adminRecord, listSubmissions, submissionStats } from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const status = String(getQuery(event).status ?? '').trim() || null
  const db = await useDb(event)
  const rows = await listSubmissions(db, status)

  return {
    ok: true,
    items: rows.map(adminRecord),
    stats: await submissionStats(db),
  }
})
