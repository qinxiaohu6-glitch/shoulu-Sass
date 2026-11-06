/**
 * GET /api/admin/users/timeline — one user's activity, newest or oldest first.
 *
 * Source `server/admin/handlers/users-timeline.ts` merges sign-up, orders,
 * subscriptions, credit grants/consumption, AI tasks and tickets into a single
 * stream. This build records exactly one of those: a ticket. There is no order
 * table, no credit ledger, no task table and no sign-up row (an account exists
 * only as the Google `sub` on the things it did), so the stream is built from
 * `ticket` alone.
 *
 * The event vocabulary, the detail keys and the cursor format are the source's:
 * kind `ticket_opened`, detail `{ title }`, `ref` pointing at the ticket, and a
 * `<ms>~<kind>:<id>` cursor, so the page's rendering code needs no special case
 * and the day the other tables appear this endpoint only grows a UNION.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

interface TicketRow {
  id: string
  title: string
  created_at: number
}

function parseCursor(raw: unknown): { at: number; id: string } | null {
  if (typeof raw !== 'string' || !raw) return null
  const sep = raw.indexOf('~')
  if (sep < 0) return null
  const at = Number(raw.slice(0, sep))
  const id = raw.slice(sep + 1).split(':').slice(1).join(':')
  if (!Number.isFinite(at) || at <= 0 || !id) return null
  return { at, id }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const userId = typeof query.userId === 'string' ? query.userId : ''
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'userId is required', message_zh: '缺少 userId 参数' },
    })
  }

  const desc = query.order !== 'asc'
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT))
  const cursor = parseCursor(query.cursor)

  const db = await useDb(event)

  // Tuple comparison on (created_at, id): timestamps have second precision, so
  // several tickets can share an instant and the id keeps the page boundary
  // stable instead of repeating or skipping a row.
  const where = cursor
    ? desc
      ? 'user_sub = ? AND (created_at < ? OR (created_at = ? AND id < ?))'
      : 'user_sub = ? AND (created_at > ? OR (created_at = ? AND id > ?))'
    : 'user_sub = ?'
  const params = cursor ? [userId, cursor.at, cursor.at, cursor.id] : [userId]

  const { results } = await db
    .prepare(
      `SELECT id, title, created_at
         FROM ticket
        WHERE ${where}
        ORDER BY created_at ${desc ? 'DESC' : 'ASC'}, id ${desc ? 'DESC' : 'ASC'}
        LIMIT ?`,
    )
    .bind(...params, limit + 1)
    .all<TicketRow>()

  const hasMore = results.length > limit
  const page = hasMore ? results.slice(0, limit) : results
  const last = page[page.length - 1]

  return {
    ok: true,
    items: page.map((row) => ({
      key: `ticket_opened:${row.id}`,
      at: new Date(row.created_at * 1000).toISOString(),
      kind: 'ticket_opened',
      detail: { title: row.title },
      ref: { type: 'ticket', id: row.id },
    })),
    nextCursor: hasMore && last ? `${last.created_at * 1000}~ticket_opened:${last.id}` : null,
  }
})
