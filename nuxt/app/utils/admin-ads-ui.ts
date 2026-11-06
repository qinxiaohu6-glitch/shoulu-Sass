/**
 * Source `routes/admin/directory/-ads-form.tsx` — the value shape, the four
 * tabs, the payload builders and the two row-action predicates.
 *
 * One difference from the source, forced by the data: this build's `ads` table
 * has no `tier` column. The console shows the *slot* (`board` / `sidebar`) in
 * the tier column and in the form's read-only tier select, because that is the
 * inventory the ad actually occupies here — see the ads section of
 * `server/utils/admin-directory.ts` for the full mapping.
 */

/** Source `TABS`. `all` means "no status filter". */
export const AD_TABS = ['all', 'active', 'pending_payment', 'expired'] as const
export type AdTab = (typeof AD_TABS)[number]

export const PAGE_SIZE = 20

/** The slots this build sells. The source's three tiers map onto these two. */
export const AD_TIERS = ['board', 'sidebar'] as const

/** One row of `GET /api/admin/directory/ads` — the source's `DirAd`. */
export interface DirAd {
  id: string
  name: string
  tagline: string
  url: string
  iconUrl: string
  tier: string
  status: string
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

export interface AdFormValues {
  name: string
  tagline: string
  url: string
  iconUrl: string
  tier: string
  status: string
  startsAt: string
  endsAt: string
}

/**
 * ISO / `YYYY-MM-DD` → the value a `datetime-local` input expects.
 *
 * The source stores datetimes and this build stores days, so a date lands at
 * local midnight. The field is read-only in the form, so the value is only ever
 * displayed, never written back.
 */
export function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function valuesFromAd(row: DirAd): AdFormValues {
  return {
    name: row.name || '',
    tagline: row.tagline || '',
    url: row.url || '',
    // Empty when the row has no icon: the list falls back to the site favicon,
    // but seeding that URL here would persist a Google hotlink on save.
    iconUrl: row.iconUrl || '',
    tier: row.tier || 'board',
    status: row.status || 'active',
    startsAt: toDatetimeLocal(row.startsAt),
    endsAt: toDatetimeLocal(row.endsAt),
  }
}

/** Source `canDeleteAd` — a live placement has to be taken down first. */
export function canDeleteAd(status: string) {
  return status === 'pending_payment' || status === 'expired'
}

export function canForceExpireAd(status: string) {
  return status === 'active'
}
