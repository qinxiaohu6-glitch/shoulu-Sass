/**
 * GET /api/tickets — the signed-in account's own tickets.
 *
 * Answers an empty list rather than 401 when nobody is signed in, matching
 * `/api/my/submissions`: the settings layout already redirects signed-out
 * visitors, so a 401 here would only ever be seen by that redirect racing a
 * slow cookie.
 *
 * `updated_at DESC` rather than `created_at`: the list is "what needs my
 * attention", and a two-week-old ticket that got an answer this morning belongs
 * at the top.
 */

import { useDb } from '../../utils/db'
import { readSession } from '../../utils/session'
import { TICKET_STATUSES, listUserTickets, ticketView, type TicketStatus } from '../../utils/tickets'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const me = await readSession(event)
  if (!me?.sub) return { ok: true, items: [], total: 0 }

  const query = getQuery(event)
  const wanted = String(query.status ?? '')
  const status = TICKET_STATUSES.includes(wanted as TicketStatus)
    ? (wanted as TicketStatus)
    : undefined

  const db = await useDb(event)
  const { items, total } = await listUserTickets(db, me.sub, {
    status,
    search: typeof query.keyword === 'string' ? query.keyword : undefined,
    limit: Number(query.limit) || 20,
    offset: Number(query.offset) || 0,
  })

  return { ok: true, items: items.map(ticketView), total }
})
