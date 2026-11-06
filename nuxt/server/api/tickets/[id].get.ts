/**
 * GET /api/tickets/[id] — one ticket and its thread.
 *
 * 404 for both "no such ticket" and "not yours", and 401 only when nobody is
 * signed in — the page is behind the settings layout, so a signed-out visitor
 * reaching here means the redirect lost a race, not that they tried to peek.
 */

import { sendSubmitError } from '../../utils/http'
import { readSession } from '../../utils/session'
import { useDb } from '../../utils/db'
import {
  TicketError,
  getMessages,
  getOwnedTicket,
  messageView,
  ticketView,
} from '../../utils/tickets'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const me = await readSession(event)
  if (!me?.sub) return sendSubmitError(event, new TicketError('signin_required'))

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!id) return sendSubmitError(event, new TicketError('ticket_not_found'))

  const db = await useDb(event)
  const row = await getOwnedTicket(db, id, me.sub)
  if (!row) return sendSubmitError(event, new TicketError('ticket_not_found'))

  const messages = await getMessages(db, id)
  return {
    ok: true,
    ticket: ticketView({ ...row, latest_reply: null }),
    messages: messages.map(messageView),
  }
})
