/**
 * Admin-side reads for the users console.
 *
 * The source has a `users` table (with `credits`, `utm_source`, `ip` and a
 * roles join). This build has no user table at all — the session cookie carries
 * `sub` / email / name and Google is the identity provider (see
 * `server/utils/session.ts`). So "a user" here is derived: one row per distinct
 * `sub` that has *done* something, which is the same definition the overview
 * card counts, so the two pages never disagree.
 *
 * Two columns therefore have no source:
 *
 *   `credits`   — no credits ledger in this build; always 0
 *   `utmSource` — no `utm_source` column anywhere; always ''
 *   `ip`        — submissions store `ip_hash`, never the address; always ''
 *   `roles`     — no roles table; always []
 *
 * They are returned as the source's empty values rather than omitted, so the
 * page renders the source's own "—" cells instead of crashing on a missing
 * field.
 */

import type { Db } from './db'

export interface AdminUser {
  id: string
  name: string
  email: string
  image: string | null
  createdAt: string
  credits: number
  utmSource: string
  ip: string
  roles: { name: string; title: string }[]
}

interface ActivityRow {
  id: string
  name: string
  email: string
  ts: number
}

/**
 * One row per distinct owner, newest activity first.
 *
 * `UNION ALL` then folded in JS: SQLite has no "last non-empty value" aggregate,
 * and a ticket's `user_name` is a snapshot taken when the ticket was opened, so
 * the newest one is the best display name available.
 */
async function activityRows(db: Db): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare(
      `SELECT user_sub AS id, user_name AS name, user_email AS email, created_at AS ts
         FROM ticket WHERE user_sub <> ''
       UNION ALL
       SELECT owner_sub AS id, '' AS name, owner_email AS email, created_at AS ts
         FROM submissions WHERE owner_sub <> ''`,
    )
    .all<ActivityRow>()
  return results
}

/** Fold raw activity rows into one record per owner: first seen, last seen, latest name/email. */
function foldUsers(rows: ActivityRow[]) {
  const byId = new Map<string, { name: string; email: string; first: number; last: number }>()
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { name: '', email: '', first: row.ts, last: row.ts }
    if (row.ts < entry.first) entry.first = row.ts
    if (row.ts >= entry.last) {
      entry.last = row.ts
      if (row.name) entry.name = row.name
      if (row.email) entry.email = row.email
    }
    if (!entry.name && row.name) entry.name = row.name
    if (!entry.email && row.email) entry.email = row.email
    byId.set(row.id, entry)
  }
  return byId
}

export async function listAdminUsers(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string },
): Promise<{ items: AdminUser[]; total: number }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))

  const byId = foldUsers(await activityRows(db))

  const users: AdminUser[] = [...byId.entries()]
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      email: entry.email,
      image: null,
      createdAt: new Date(entry.first * 1000).toISOString(),
      credits: 0,
      utmSource: '',
      ip: '',
      roles: [],
    }))
    // Newest account first, the way the source's `orderBy(desc(createdAt))` reads.
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  const needle = (params.search ?? '').trim().toLowerCase()
  const filtered = needle
    ? users.filter(
        (user) =>
          user.id.toLowerCase().includes(needle) ||
          user.name.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle),
      )
    : users

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

/**
 * The source's `/api/admin/users/sources` groups `users.utm_source`.
 *
 * Nothing in this build records a campaign source — the only `utm_source` in the
 * repository is the one `app/utils/markdown.ts` *writes* into outbound links — so
 * the answer is an empty list and the filter renders with just its "Any" entry.
 */
export async function listAdminUserSources(): Promise<{ value: string; count: number }[]> {
  return []
}

/** Source `users_.$id.tsx` — `UserDetail`. */
export interface AdminUserDetail {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
    utmSource: string
    utmMedium: string
    utmCampaign: string
    utmTerm: string
    utmContent: string
    referrer: string
    ip: string
    country: string
    locale: string
  }
  roles: { roleId: string; roleName: string; roleTitle: string }[]
  stats: {
    creditBalance: number
    creditsGranted: number
    creditsConsumed: number
    orderCount: number
    lastOrderAt: string | null
    paidOrderCount: number
    paidAmounts: { currency: string; amount: number }[]
  }
}

/**
 * One user's profile, resolved the same way the list resolves a row.
 *
 * `null` when that `sub` has never submitted a listing or opened a ticket — the
 * page then renders the source's own "User not found" line, which is also what
 * the source answers for an id that is not in its `users` table.
 *
 * `emailVerified` is `true` on purpose: the only way into this build is a Google
 * ID token, and Google only hands back an address it has verified. There is no
 * unverified-email path to represent, so the badge should not claim one.
 * Attribution, IP, country and locale have no source at all (see the file
 * header) and come back empty, which is what makes the page show "Direct /
 * unknown" and "—".
 */
export async function getAdminUser(db: Db, id: string): Promise<AdminUserDetail | null> {
  if (!id) return null

  const { results } = await db
    .prepare(
      `SELECT user_sub AS id, user_name AS name, user_email AS email, created_at AS ts
         FROM ticket WHERE user_sub = ?
       UNION ALL
       SELECT owner_sub AS id, '' AS name, owner_email AS email, created_at AS ts
         FROM submissions WHERE owner_sub = ?`,
    )
    .bind(id, id)
    .all<ActivityRow>()

  const entry = foldUsers(results).get(id)
  if (!entry) return null

  return {
    user: {
      id,
      name: entry.name,
      email: entry.email,
      emailVerified: true,
      image: null,
      createdAt: new Date(entry.first * 1000).toISOString(),
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmTerm: '',
      utmContent: '',
      referrer: '',
      ip: '',
      country: '',
      locale: '',
    },
    roles: [],
    stats: {
      creditBalance: 0,
      creditsGranted: 0,
      creditsConsumed: 0,
      orderCount: 0,
      lastOrderAt: null,
      paidOrderCount: 0,
      paidAmounts: [],
    },
  }
}
