/**
 * GET /api/admin/tickets — the support queue, in the source's shape.
 *
 * Source `server/admin/handlers/tickets.ts` answers `{ items, total }` of
 * camelCase rows. This build's `ticket` table is real, so the mapping is the
 * only work: `user_sub` is the account (Google `sub`, stable across email
 * changes), `created_at`/`updated_at` are unix seconds.
 *
 * `latestReply` is the newest *admin* reply — that is what the queue column is
 * asking ("has this been answered?"), and `utils/tickets.ts` computes it in the
 * same round trip.
 *
 * `userAvatar` has no column here and comes back null, so the page renders its
 * own fallback initial.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { TICKET_STATUSES, listAllTickets, type TicketStatus } from '../../../utils/tickets'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const str = (key: string) => (typeof query[key] === 'string' ? (query[key] as string).trim() : '')

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE))
  const wanted = str('status')
  const status = TICKET_STATUSES.includes(wanted as TicketStatus)
    ? (wanted as TicketStatus)
    : undefined

  const db = await useDb(event)
  const list = await listAllTickets(db, {
    status,
    search: str('keyword') || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  return {
    ok: true,
    total: list.total,
    items: list.items.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      userId: row.user_sub,
      userName: row.user_name || null,
      userEmail: row.user_email || null,
      userAvatar: null,
      latestReply: row.latest_reply,
    })),
  }
})
