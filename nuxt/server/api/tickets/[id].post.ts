/**
 * POST /api/tickets/[id] — the reporter replies.
 *
 * A reply re-opens the ticket (`addMessage` sets `open`), which is the whole
 * point: without it a thread we answered once would sit in "replied" forever
 * and the console's queue would be a list of things nobody is waiting on.
 *
 * Closed tickets refuse. Re-opening one would mean the close button did
 * nothing, and the alternative — a closed ticket that silently accepts
 * messages — is the same bug with a worse interface.
 */

import { sendSubmitError } from '../../utils/http'
import { readSession } from '../../utils/session'
import { useDb } from '../../utils/db'
import {
  TICKET_LIMITS,
  TicketError,
  addMessage,
  getOwnedTicket,
  messageView,
  sanitizeAttachments,
} from '../../utils/tickets'

export default defineEventHandler(async (event) => {
  const me = await readSession(event)
  if (!me?.sub) return sendSubmitError(event, new TicketError('signin_required'))

  const id = String(getRouterParam(event, 'id') ?? '')
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new TicketError('bad_payload'))
  }

  const input = body as Record<string, unknown>
  const content = String(input.content ?? '').trim()
  if (!content) return sendSubmitError(event, new TicketError('required'))
  if (content.length > TICKET_LIMITS.content) {
    return sendSubmitError(event, new TicketError('too_long', 'content'))
  }

  const attachments = sanitizeAttachments(input.attachments)
  if (attachments === null) {
    return sendSubmitError(event, new TicketError('bad_attachments', 'attachments'))
  }

  try {
    const db = await useDb(event)
    const ticket = await getOwnedTicket(db, id, me.sub)
    if (!ticket) return sendSubmitError(event, new TicketError('ticket_not_found'))
    if (ticket.status === 'closed') {
      return sendSubmitError(event, new TicketError('ticket_closed'))
    }

    const row = await addMessage(db, {
      ticketId: id,
      role: 'user',
      author: me.name ?? '',
      content,
      attachments,
    })

    return { ok: true, message: messageView(row) }
  } catch (err) {
    console.error('[tickets] reply failed', err)
    return sendSubmitError(event, new TicketError('internal_error'))
  }
})
