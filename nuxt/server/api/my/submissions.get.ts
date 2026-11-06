/**
 * GET /api/my/submissions — everything this account has submitted.
 *
 * Answers an empty list rather than 401 when nobody is signed in. The dashboard
 * page already redirects signed-out visitors, so a 401 here would only ever be
 * seen by that redirect racing a slow cookie — and an empty list is the honest
 * answer to "what did I submit" when the answer is "you are not anyone yet".
 *
 * Ordering is `created_at DESC` so the newest submission is the first row; the
 * old build sorted in Python after reading every file, which does not scale to
 * a table that keeps growing.
 */

import { useDb } from '../../utils/db'
import { readSession } from '../../utils/session'
import { listByOwner, ownerRecord } from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const me = await readSession(event)
  if (!me?.sub) return { ok: true, items: [] }

  const db = await useDb(event)
  const rows = await listByOwner(db, me.sub)
  return { ok: true, items: rows.map(ownerRecord) }
})
