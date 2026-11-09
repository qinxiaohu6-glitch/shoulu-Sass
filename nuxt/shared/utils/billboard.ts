/**
 * Billboard ranking. Homepage Top 10 and /billboard both call these functions
 * on the same rows. A request that has not been paid is not a row.
 */

import {
  BILLBOARD_TIERS,
  billboardTier,
  isBillboardTier,
  type BillboardTierId,
} from '../content/billboard.ts'

export type BillboardStatus = 'requested' | 'pending' | 'live' | 'removed'

export type BillboardRow = {
  id: string
  tier: BillboardTierId
  name: string
  tagline: string
  url: string
  logo: string
  screenshot: string
  /** Unix seconds. Required before a row can be public. */
  paidAt: number
  status: BillboardStatus
  /** Charged cents. 0 when an older row has no amount stored. */
  amountCents?: number
}

export type BillboardCell<T> =
  | { kind: 'live'; rank: number; placement: T }
  | { kind: 'empty'; rank: number }

const TIER_RANK = new Map(BILLBOARD_TIERS.map((tier) => [tier.id, tier.rank]))

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
 * Prime, then Standard, then Entry. Inside a tier, the earlier confirmed
 * payment is higher. This is not a bid.
 */
export function rankBillboard<T extends { id: string; tier: BillboardTierId; paidAt: number }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byTier = (TIER_RANK.get(b.tier) ?? 0) - (TIER_RANK.get(a.tier) ?? 0)
    if (byTier) return byTier
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
