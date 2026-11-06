/**
 * Source `routes/admin/-users-dialogs.tsx` — the `User` interface the list and
 * the three dialogs share, plus the source filter's option shape.
 *
 * `credits`, `utmSource`, `ip` and `roles` have no backing column in this build
 * and always arrive empty; see `server/utils/admin-users.ts`.
 */

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

export interface SourceOption {
  value: string
  count: number
}

export const PAGE_SIZE = 20

/** Select values cannot be `''` — sentinels for "no filter" and "untagged". */
export const ANY = '__any__'
export const NONE = '__none__'
