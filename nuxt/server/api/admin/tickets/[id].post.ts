/**
 * POST /api/admin/tickets/[id] — the owner answers.
 *
 * Refuses on a closed ticket, same as the reporter's endpoint. The console has
 * an explicit "重新打开" button, so there is exactly one rule to remember:
 * nothing is written into a closed thread until somebody reopens it.
 *
 * The author is stored empty rather than as "Admin": the console is one shared
 * token, and a name that nobody chose reads as a person who does not exist.
 * The page renders the role, not the field.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { sendMail, siteUrl, ticketRepliedMail } from '../../../utils/mail'
import {
  TICKET_LIMITS,
  addMessage,
  getTicket,
  messageView,
  sanitizeAttachments,
} from '../../../utils/tickets'

export default defineEventHandler(async (event) => {
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = String(getRouterParam(event, 'id') ?? '')
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const input = body as Record<string, unknown>
  const content = String(input.content ?? '').trim()
  if (!content) throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  if (content.length > TICKET_LIMITS.content) {
    throw createError({ statusCode: 400, statusMessage: 'Content is too long' })
  }

  const attachments = sanitizeAttachments(input.attachments)
  if (attachments === null) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid attachments' })
  }

  const db = await useDb(event)
  const ticket = id ? await getTicket(db, id) : null
  if (!ticket) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (ticket.status === 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Ticket is closed' })
  }

  const row = await addMessage(db, {
    ticketId: id,
    role: 'admin',
    author: '',
    content,
    attachments,
  })

  // Only now, after the message is committed: a mail that announces a reply
  // which failed to save sends the reporter to a thread that does not have it.
  if (ticket.user_email) {
    sendMail(event, ticketRepliedMail(ticket, siteUrl(event)))
  }

  return { ok: true, message: messageView(row) }
})
