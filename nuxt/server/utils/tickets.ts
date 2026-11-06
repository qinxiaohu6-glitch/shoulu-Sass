/**
 * Support tickets: the whole read/write layer.
 *
 * A ticket is one thread, not a form submission. Two tables, no joins: the
 * author's identity is copied onto `ticket` when it is opened, because this
 * build has no user table to join against (the session cookie is the identity).
 * See the comment in `schema.sql` for why that copy is a snapshot.
 *
 * Three statuses, and only one of them is a decision:
 *
 *   open     — the user spoke last; the ball is with us
 *   replied  — we spoke last; the ball is with them
 *   closed   — somebody ended it
 *
 * `addMessage` derives the first two from the role of the writer, so a status
 * can never disagree with the last message in the thread.
 */

import type { Db } from './db'

export type TicketStatus = 'open' | 'replied' | 'closed'
export type TicketRole = 'user' | 'admin'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'replied', 'closed']

/**
 * Limits, in one place.
 *
 * The client mirrors these for `maxlength` and for disabling the submit button,
 * but the server is the only place that enforces them — a `maxlength` is a
 * convenience, never a check.
 */
export const TICKET_LIMITS = {
  title: 200,
  content: 5000,
  attachments: 9,
  attachmentUrl: 2048,
  /** Seconds between two tickets from the same account. */
  createInterval: 30,
} as const

export interface TicketRow {
  id: string
  user_sub: string
  user_email: string
  user_name: string
  title: string
  status: TicketStatus
  created_at: number
  updated_at: number
}

export interface TicketMessageRow {
  id: string
  ticket_id: string
  role: TicketRole
  author: string
  content: string
  attachments: string
  created_at: number
}

/** A ticket plus the one extra field a list needs: the last thing we said. */
export interface TicketListItem extends TicketRow {
  latest_reply: string | null
}

const now = () => Math.floor(Date.now() / 1000)

/**
 * A refusal the browser can render.
 *
 * `code` indexes `SUBMIT_ERRORS` in `utils/http.ts`, which is where the
 * bilingual copy lives — the same table the submit form uses, so the two pages
 * cannot drift into two vocabularies for "that is too long".
 */
export class TicketError extends Error {
  constructor(
    public code: string,
    public field?: string,
  ) {
    super(code)
  }
}

function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `${prefix}${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export const newTicketId = () => randomId('t_')
export const newMessageId = () => randomId('tm_')

/* -------------------------------------------------------------------------
   attachments
   ------------------------------------------------------------------------- */

/** Tolerant parse: a corrupt column must render as "no images", never 500. */
export function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : []
  } catch {
    return []
  }
}

/**
 * Validate a client-supplied list of image URLs.
 *
 * There is no upload endpoint in this build (no object storage binding), so a
 * screenshot arrives as a link the reporter already hosts. That makes two rules
 * load-bearing rather than cosmetic:
 *
 *   - only `/path` or `http(s)://host` — never `javascript:` or `data:`
 *   - at most nine, each under 2 KB, because this string is copied into every
 *     row it is attached to
 *
 * Returns `null` for "invalid" and `[]` for "none given". Those are different
 * answers and the caller has to tell them apart.
 */
export function sanitizeAttachments(input: unknown): string[] | null {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input)) return null
  if (input.length > TICKET_LIMITS.attachments) return null

  const urls: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') return null
    const url = item.trim()
    if (!url || url.length > TICKET_LIMITS.attachmentUrl) return null
    if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) return null
    urls.push(url)
  }
  return urls
}

/* -------------------------------------------------------------------------
   reads
   ------------------------------------------------------------------------- */

export async function getTicket(db: Db, id: string): Promise<TicketRow | null> {
  return db
    .prepare(
      `SELECT id, user_sub, user_email, user_name, title, status, created_at, updated_at
         FROM ticket WHERE id = ?`,
    )
    .bind(id)
    .first<TicketRow>()
}

/**
 * A ticket, but only if this account owns it.
 *
 * Returns `null` for "no such ticket" *and* for "someone else's ticket" on
 * purpose: a distinct 403 would confirm that an id exists, which is a free
 * enumeration oracle for anyone who can guess 24 hex characters.
 */
export async function getOwnedTicket(
  db: Db,
  id: string,
  sub: string,
): Promise<TicketRow | null> {
  const row = await getTicket(db, id)
  return row && row.user_sub === sub ? row : null
}

export async function getMessages(db: Db, ticketId: string): Promise<TicketMessageRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, ticket_id, role, author, content, attachments, created_at
         FROM ticket_message WHERE ticket_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .bind(ticketId)
    .all<TicketMessageRow>()
  return results
}

/**
 * Escape a user-typed search string for `LIKE`.
 *
 * Without this a query of `%` matches every row, and `_` silently matches any
 * single character — the search box would appear to work while ignoring what
 * was typed. Paired with `ESCAPE '\'` at the call site.
 */
function likePattern(search: string | undefined): string | null {
  const q = String(search ?? '').trim()
  if (!q) return null
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}

/**
 * Latest owner reply per ticket, for the list preview.
 *
 * One query for the whole page rather than one per row: a 20-row list would
 * otherwise cost 21 round trips, which on D1 is the difference between a fast
 * page and a visibly slow one.
 */
async function latestAdminReplies(db: Db, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map

  const holes = ids.map(() => '?').join(', ')
  const { results } = await db
    .prepare(
      `SELECT ticket_id, content FROM ticket_message
        WHERE role = 'admin' AND ticket_id IN (${holes})
        ORDER BY created_at DESC`,
    )
    .bind(...ids)
    .all<{ ticket_id: string; content: string }>()

  // Newest-first scan, first hit per ticket wins.
  for (const row of results) {
    if (!map.has(row.ticket_id)) map.set(row.ticket_id, row.content)
  }
  return map
}

export interface ListOptions {
  status?: TicketStatus
  search?: string
  limit?: number
  offset?: number
}

function pageOf(opts: ListOptions): { limit: number; offset: number } {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20))
  const offset = Math.max(0, opts.offset ?? 0)
  return { limit, offset }
}

export async function listUserTickets(
  db: Db,
  sub: string,
  opts: ListOptions = {},
): Promise<{ items: TicketListItem[]; total: number }> {
  const where = ['user_sub = ?']
  const params: unknown[] = [sub]

  if (opts.status) {
    where.push('status = ?')
    params.push(opts.status)
  }
  const pattern = likePattern(opts.search)
  if (pattern) {
    where.push("title LIKE ? ESCAPE '\\'")
    params.push(pattern)
  }

  const clause = `WHERE ${where.join(' AND ')}`
  const { limit, offset } = pageOf(opts)

  const counted = await db
    .prepare(`SELECT COUNT(*) AS n FROM ticket ${clause}`)
    .bind(...params)
    .first<{ n: number }>()

  const { results } = await db
    .prepare(
      `SELECT id, user_sub, user_email, user_name, title, status, created_at, updated_at
         FROM ticket ${clause} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<TicketRow>()

  const replies = await latestAdminReplies(db, results.map((r) => r.id))
  return {
    items: results.map((r) => ({ ...r, latest_reply: replies.get(r.id) ?? null })),
    total: Number(counted?.n ?? 0),
  }
}

/**
 * Every ticket, for the console.
 *
 * The search also matches the submitter's email and the ticket id, because
 * "the person who wrote in about the broken logo" is often remembered by
 * address rather than by subject line.
 */
export async function listAllTickets(
  db: Db,
  opts: ListOptions = {},
): Promise<{ items: TicketListItem[]; total: number }> {
  const where: string[] = []
  const params: unknown[] = []

  if (opts.status) {
    where.push('status = ?')
    params.push(opts.status)
  }
  const pattern = likePattern(opts.search)
  if (pattern) {
    where.push("(title LIKE ? ESCAPE '\\' OR user_email LIKE ? ESCAPE '\\' OR user_name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')")
    params.push(pattern, pattern, pattern, pattern)
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const { limit, offset } = pageOf(opts)

  const counted = await db
    .prepare(`SELECT COUNT(*) AS n FROM ticket ${clause}`)
    .bind(...params)
    .first<{ n: number }>()

  const { results } = await db
    .prepare(
      `SELECT id, user_sub, user_email, user_name, title, status, created_at, updated_at
         FROM ticket ${clause} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<TicketRow>()

  const replies = await latestAdminReplies(db, results.map((r) => r.id))
  return {
    items: results.map((r) => ({ ...r, latest_reply: replies.get(r.id) ?? null })),
    total: Number(counted?.n ?? 0),
  }
}

export async function ticketStats(
  db: Db,
): Promise<{ total: number; open: number; replied: number; closed: number }> {
  const { results } = await db
    .prepare('SELECT status, COUNT(*) AS n FROM ticket GROUP BY status')
    .all<{ status: string; n: number }>()

  const stats = { total: 0, open: 0, replied: 0, closed: 0 }
  for (const row of results) {
    const n = Number(row.n ?? 0)
    stats.total += n
    if (row.status === 'open') stats.open = n
    else if (row.status === 'replied') stats.replied = n
    else if (row.status === 'closed') stats.closed = n
  }
  return stats
}

/** When this account last opened a ticket, for the spam interval. */
export async function lastTicketAt(db: Db, sub: string): Promise<number | null> {
  const row = await db
    .prepare('SELECT created_at FROM ticket WHERE user_sub = ? ORDER BY created_at DESC LIMIT 1')
    .bind(sub)
    .first<{ created_at: number }>()
  return row ? Number(row.created_at) : null
}

/* -------------------------------------------------------------------------
   writes
   ------------------------------------------------------------------------- */

export interface CreateTicketInput {
  sub: string
  email: string
  name: string
  title: string
  content: string
  attachments?: string[]
}

/**
 * Open a ticket and write its first message.
 *
 * Not a transaction: `Db` is D1's statement API and has no `BEGIN`, so the two
 * inserts are ordered and the ticket is deleted if the message fails. An orphan
 * ticket would render as an empty thread — reachable, closable, and impossible
 * to reply to — which is worse than a failed request the user can retry.
 */
export async function createTicket(db: Db, input: CreateTicketInput): Promise<TicketRow> {
  const ts = now()
  const id = newTicketId()

  await db
    .prepare(
      `INSERT INTO ticket (id, user_sub, user_email, user_name, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(id, input.sub, input.email, input.name, input.title, ts, ts)
    .run()

  try {
    await db
      .prepare(
        `INSERT INTO ticket_message (id, ticket_id, role, author, content, attachments, created_at)
         VALUES (?, ?, 'user', ?, ?, ?, ?)`,
      )
      .bind(
        newMessageId(),
        id,
        input.name,
        input.content,
        JSON.stringify(input.attachments ?? []),
        ts,
      )
      .run()
  } catch (err) {
    await db
      .prepare('DELETE FROM ticket WHERE id = ?')
      .bind(id)
      .run()
      .catch(() => {})
    throw err
  }

  return (await getTicket(db, id))!
}

export interface AddMessageInput {
  ticketId: string
  role: TicketRole
  author: string
  content: string
  attachments?: string[]
}

/**
 * Append to a thread and move the ball.
 *
 * Callers must have already checked that the ticket is not closed — this
 * function does not re-read it, so that a route can decide *why* it is
 * refusing (user: "this ticket is closed"; admin: reopen instead).
 */
export async function addMessage(
  db: Db,
  input: AddMessageInput,
): Promise<TicketMessageRow> {
  const ts = now()
  const id = newMessageId()

  await db
    .prepare(
      `INSERT INTO ticket_message (id, ticket_id, role, author, content, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.ticketId,
      input.role,
      input.author,
      input.content,
      JSON.stringify(input.attachments ?? []),
      ts,
    )
    .run()

  await db
    .prepare('UPDATE ticket SET status = ?, updated_at = ? WHERE id = ?')
    .bind(input.role === 'admin' ? 'replied' : 'open', ts, input.ticketId)
    .run()

  return {
    id,
    ticket_id: input.ticketId,
    role: input.role,
    author: input.author,
    content: input.content,
    attachments: JSON.stringify(input.attachments ?? []),
    created_at: ts,
  }
}

export async function setTicketStatus(db: Db, id: string, status: TicketStatus): Promise<void> {
  await db
    .prepare('UPDATE ticket SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, now(), id)
    .run()
}

/* -------------------------------------------------------------------------
   views
   ------------------------------------------------------------------------- */

/**
 * What the ticket's own author may see.
 *
 * `user_sub` is the ownership key and never leaves the server; the email is
 * dropped too, because the page already knows who is signed in and echoing an
 * address back into markup is one more place for it to end up in a cache.
 */
export function ticketView(row: TicketListItem) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    latest_reply: row.latest_reply,
  }
}

/** What the console sees: the same, plus who wrote in. */
export function ticketAdminView(row: TicketListItem) {
  return {
    ...ticketView(row),
    user_email: row.user_email,
    user_name: row.user_name,
  }
}

/** Shape a row for the browser: attachments parsed, no internal fields lost. */
export function messageView(row: TicketMessageRow) {
  return {
    id: row.id,
    role: row.role,
    author: row.author,
    content: row.content,
    attachments: parseAttachments(row.attachments),
    created_at: row.created_at,
  }
}
