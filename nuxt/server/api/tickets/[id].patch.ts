/**
 * PATCH /api/tickets/[id] — the reporter closes their own ticket.
 *
 * Only `closed` is accepted. Re-opening is not offered here because the act of
 * replying already does it: a user who wants the thread back just says
 * something. A second way to express the same intent is a second thing to get
 * wrong.
 */

import { sendSubmitError } from '../../utils/http'
import { readSession } from '../../utils/session'
import { useDb } from '../../utils/db'
import { TicketError, getOwnedTicket, setTicketStatus } from '../../utils/tickets'

export default defineEventHandler(async (event) => {
  const me = await readSession(event)
  if (!me?.sub) return sendSubmitError(event, new TicketError('signin_required'))

  const id = String(getRouterParam(event, 'id') ?? '')
  const body = await readBody(event).catch(() => null)
  const status = String((body as Record<string, unknown> | null)?.status ?? '')
  if (status !== 'closed') return sendSubmitError(event, new TicketError('bad_action'))

  try {
    const db = await useDb(event)
    const ticket = await getOwnedTicket(db, id, me.sub)
    if (!ticket) return sendSubmitError(event, new TicketError('ticket_not_found'))

    await setTicketStatus(db, id, 'closed')
    return { ok: true }
  } catch (err) {
    console.error('[tickets] close failed', err)
    return sendSubmitError(event, new TicketError('internal_error'))
  }
})
