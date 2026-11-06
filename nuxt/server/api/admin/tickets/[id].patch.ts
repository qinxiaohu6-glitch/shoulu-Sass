/**
 * PATCH /api/admin/tickets/[id] — close, or reopen.
 *
 * `replied` is accepted because it is a real state ("we answered, they have not
 * come back"), but the page never sets it by hand: answering does. The two
 * values the page does use are `closed` and `open`.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { TICKET_STATUSES, getTicket, setTicketStatus, type TicketStatus } from '../../../utils/tickets'

export default defineEventHandler(async (event) => {
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = String(getRouterParam(event, 'id') ?? '')
  const body = await readBody(event).catch(() => null)
  const status = String((body as Record<string, unknown> | null)?.status ?? '')
  if (!TICKET_STATUSES.includes(status as TicketStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  const db = await useDb(event)
  const ticket = id ? await getTicket(db, id) : null
  if (!ticket) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  await setTicketStatus(db, id, status as TicketStatus)
  return { ok: true, status }
})
