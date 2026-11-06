/**
 * POST /api/tickets — open a ticket.
 *
 * Validation happens here, not in the page: the form's `maxlength` is a
 * convenience, and the limits are the server's to enforce. The shape of the
 * refusal is the same `{ reason, message_zh, message_en }` the submit form
 * already renders, so the settings page needs no second error vocabulary.
 *
 * Two people can be told "too many" by this endpoint and mean different things:
 * not signed in (`signin_required`) and too soon after the last one
 * (`ticket_rate_limited`). Both are 4xx and neither is retryable by refreshing.
 */

import { sendSubmitError } from '../../utils/http'
import { ownerInbox, sendMail, siteUrl, ticketOpenedMail } from '../../utils/mail'
import { readSession } from '../../utils/session'
import { useDb } from '../../utils/db'
import {
  TICKET_LIMITS,
  TicketError,
  createTicket,
  lastTicketAt,
  sanitizeAttachments,
  ticketView,
} from '../../utils/tickets'

const nowSec = () => Math.floor(Date.now() / 1000)

export default defineEventHandler(async (event) => {
  const me = await readSession(event)
  if (!me?.sub) return sendSubmitError(event, new TicketError('signin_required'))

  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new TicketError('bad_payload'))
  }

  const input = body as Record<string, unknown>
  const title = String(input.title ?? '').trim()
  const content = String(input.content ?? '').trim()

  if (!title || !content) return sendSubmitError(event, new TicketError('required'))
  if (title.length > TICKET_LIMITS.title) {
    return sendSubmitError(event, new TicketError('too_long', 'title'))
  }
  if (content.length > TICKET_LIMITS.content) {
    return sendSubmitError(event, new TicketError('too_long', 'content'))
  }

  const attachments = sanitizeAttachments(input.attachments)
  if (attachments === null) {
    return sendSubmitError(event, new TicketError('bad_attachments', 'attachments'))
  }

  try {
    const db = await useDb(event)

    // Spam interval. Counted from the newest ticket rather than a token bucket
    // because the store has no counter table and one indexed read is cheaper
    // than adding one for a limit nobody legitimately hits.
    const last = await lastTicketAt(db, me.sub)
    if (last !== null && nowSec() - last < TICKET_LIMITS.createInterval) {
      return sendSubmitError(event, new TicketError('ticket_rate_limited'))
    }

    const row = await createTicket(db, {
      sub: me.sub,
      email: me.email,
      name: me.name ?? '',
      title,
      content,
      attachments,
    })

    // Fire and forget: an unconfigured mailer is a no-op, and a slow one must
    // not delay the confirmation the reporter is waiting for.
    const inbox = ownerInbox(event)
    if (inbox) sendMail(event, ticketOpenedMail(inbox, row, siteUrl(event)))

    setResponseStatus(event, 201)
    return { ok: true, ticket: ticketView({ ...row, latest_reply: null }) }
  } catch (err) {
    console.error('[tickets] create failed', err)
    return sendSubmitError(event, new TicketError('internal_error'))
  }
})
