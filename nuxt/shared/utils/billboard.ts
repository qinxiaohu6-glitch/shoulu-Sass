/**
 * Billboard ranking. Homepage Top 10 and /billboard both call these functions
 * on the same rows. A request that has not been paid is not a row.
 */

import { billboardTier, isBillboardTier, type BillboardTierId } from '../content/billboard.ts'

export type BillboardStatus = 'requested' | 'pending' | 'live' | 'removed'

export type BillboardRow = {
  id: string
  tier: BillboardTierId
  name: string
  tagline: string
  url: string
  logo: string
  screenshot: string
  /**
   * Unix seconds of the earliest confirmed payment for this website.
   * Same total: earlier payment ranks higher.
   */
  paidAt: number
  /** Most recent confirmed payment. Used for "just landed", not for ties. */
  latestPaidAt?: number
  status: BillboardStatus
  /** Total backed cents for this website. 0 when an older row has no amount stored. */
  amountCents?: number
}

export type BillboardCell<T> =
  | { kind: 'live'; rank: number; placement: T }
  | { kind: 'empty'; rank: number }

/** Stored cents, or the legacy tier list price when a live row never recorded an amount. */
export function backingCents(row: { amountCents?: number; tier: string }): number {
  const stored = row.amountCents
  if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) return stored
  return billboardTier(row.tier)?.amountCents ?? 0
}

function looksLikeThumbnail(value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 500) return false
  if (/^https?:\/\//i.test(v)) return true
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(v)
}

/**
 * One spot per website. Extra payments for the same URL add to `amountCents`.
 * The spot stays after it is outbid — nothing here deletes a live row.
 */
export function stackBillboard<T extends BillboardRow>(rows: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = samePlacementUrl(row.url) || row.id
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  const stacked: T[] = []
  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => a.paidAt - b.paidAt || (a.id < b.id ? -1 : 1))
    const earliest = ordered[0]!
    const latest = ordered[ordered.length - 1]!
    const withShot = [...ordered].reverse().find((row) => looksLikeThumbnail(row.screenshot))
    const withLogo = [...ordered].reverse().find((row) => row.logo.trim())
    stacked.push({
      ...latest,
      id: earliest.id,
      name: latest.name || earliest.name,
      tagline: latest.tagline || earliest.tagline,
      logo: withLogo?.logo ?? '',
      screenshot: withShot?.screenshot ?? '',
      url: earliest.url || latest.url,
      paidAt: earliest.paidAt,
      latestPaidAt: latest.paidAt,
      amountCents: ordered.reduce((sum, row) => sum + backingCents(row), 0),
      status: 'live',
    })
  }
  return stacked
}

/** Live rows only. Invoice requests and unpaid rows stay off the board. */
export function publicBillboardRows<T extends { status?: string; paidAt?: number | null; tier: string }>(
  rows: readonly T[],
): T[] {
  return rows.filter(
    (row): row is T =>
      row.status === 'live' &&
      typeof row.paidAt === 'number' &&
      Number.isFinite(row.paidAt) &&
      isBillboardTier(row.tier),
  )
}

/**
 * Highest total backed first. The same total keeps the earlier payment ahead.
 * Rows that share a URL are one spot: their amounts add.
 */
export function rankBillboard<T extends BillboardRow>(rows: readonly T[]): T[] {
  return stackBillboard(rows).sort((a, b) => {
    const byAmount = backingCents(b) - backingCents(a)
    if (byAmount) return byAmount
    if (a.paidAt !== b.paidAt) return a.paidAt - b.paidAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** Top `limit` live rows, then dashed claim slots so the grid stays 2×5. */
export function padBillboard<T>(ranked: readonly T[], limit: number): BillboardCell<T>[] {
  const cells: BillboardCell<T>[] = ranked.slice(0, limit).map((placement, index) => ({
    kind: 'live',
    rank: index + 1,
    placement,
  }))
  for (let rank = cells.length + 1; rank <= limit; rank += 1) {
    cells.push({ kind: 'empty', rank })
  }
  return cells
}

/** Host + path, so a homepage listing and a Billboard URL can be matched. */
export function samePlacementUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const path = url.pathname.replace(/\/$/, '').toLowerCase()
    return `${host}${path}`
  } catch {
    return raw.toLowerCase()
  }
}

export type InvoiceDraft = {
  tier: BillboardTierId
  url: string
  email: string
  name: string
  status: 'requested'
  paidAt: null
  published: false
}

/**
 * What an invoice request is allowed to become. `published` is a constant
 * false — confirming payment is a separate step, and this object cannot
 * express it.
 */
export function billboardInvoiceDraft(input: {
  tier: string
  url: string
  email: string
  name?: string
}): InvoiceDraft | null {
  if (!isBillboardTier(input.tier)) return null
  const url = publicHttpUrl(input.url)
  const email = normalizeEmail(input.email)
  if (!url || !email) return null
  const name = String(input.name ?? '').trim().slice(0, 80)
  return {
    tier: input.tier,
    url,
    email,
    name,
    status: 'requested',
    paidAt: null,
    published: false,
  }
}

export function publicHttpUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw || raw.length > 500) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname || url.hostname.length > 253) return null
  return url.toString()
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return null
  return email
}

/** List price of a tier. Callers render this, not a client-supplied amount. */
export function tierPriceLabel(id: string): string {
  return billboardTier(id)?.price ?? ''
}
