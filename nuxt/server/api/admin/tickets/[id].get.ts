/**
 * GET /api/admin/tickets/[id] — one thread, in the source's shape.
 *
 * Source `server/admin/handlers/tickets-id.ts` answers `{ ticket, messages }`.
 * The rows are this build's, mapped: `user_sub` is the account, unix seconds
 * become ISO strings, and an owner-written message carries the display name it
 * was written with (the column is `author`; admin messages store it empty, so
 * the page shows the role label instead of a name nobody chose).
 *
 * Answers 404 only for "no such ticket" — there is no ownership check because
 * the caller already proved they hold the console token.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { getMessages, getTicket } from '../../../utils/tickets'

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = String(getRouterParam(event, 'id') ?? '')
  const db = await useDb(event)
  const row = id ? await getTicket(db, id) : null
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const messages = await getMessages(db, id)

  return {
    ok: true,
    ticket: {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      userId: row.user_sub,
      userName: row.user_name || null,
      userEmail: row.user_email || null,
      userAvatar: null,
      latestReply: null,
    },
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      attachments: JSON.parse(msg.attachments || '[]') as string[],
      createdAt: iso(msg.created_at),
      userName: msg.role === 'admin' ? null : msg.author || null,
      userAvatar: null,
    })),
  }
})
