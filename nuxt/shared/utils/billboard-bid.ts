/**
 * Billboard pay-what-you-want rules (path A).
 *
 * Rank is total backed for a website, highest first. The same amount keeps
 * the earlier payment ahead. A new bid must beat the occupant by $1, and
 * every new payment is at least $10. That floor is the cold-start minimum.
 * A later payment for the same URL stacks; it does not open a second spot.
 *
 * The $10,000 ceiling is an abuse cap, not a product price.
 */

import type { BillboardTierId } from '../content/billboard.ts'
import { centsLabel } from '../content/campaign.ts'
import { backingCents, normalizeEmail, publicHttpUrl, samePlacementUrl } from './billboard.ts'
import { screenshotSrc } from './screenshot.ts'

export const BILLBOARD_FLOOR_CENTS = 1000
export const BILLBOARD_BID_MAX_CENTS = 1_000_000

const GENERIC_HOST_LABELS = new Set(['www', 'app', 'get', 'try', 'use', 'go'])

export type BidOccupant = {
  url: string
  amountCents: number
  paidAt: number
}

export function backingLabel(row: { amountCents?: number; tier: string }): string {
  return centsLabel(backingCents(row))
}

/** Storage label only. Public order uses `amountCents`, not this tier. */
export function tierForBid(cents: number): BillboardTierId {
  if (cents >= 4900) return 'prime'
  if (cents >= 2900) return 'standard'
  return 'entry'
}

/**
 * Whole-dollar cents, clamped up to the floor and rejected above the cap.
 * `500` ($5) becomes `1000` ($10). A non-integer or a fractional dollar is refused.
 */
export function clampBillboardBid(raw: unknown): number | null {
  if (typeof raw === 'string' && raw.trim() === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < 0 || n > BILLBOARD_BID_MAX_CENTS) return null
  if (n % 100 !== 0) return null
  return Math.max(BILLBOARD_FLOOR_CENTS, n)
}

export function productNameFromUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  let host = ''
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
  const labels = host.split('.').filter(Boolean)
  if (!labels.length) return ''
  let token = labels[0] ?? ''
  if (GENERIC_HOST_LABELS.has(token.toLowerCase()) && labels.length > 2) token = labels[1] ?? token
  const name = token
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  return name.slice(0, 80)
}

export function faviconForUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./i, '')
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) return ''
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return ''
  }
}

export function domainLabel(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function isHomepageThumbnail(value: string): boolean {
  return screenshotSrc(value) !== ''
}

function othersOf(spots: readonly BidOccupant[], selfUrl: string): BidOccupant[] {
  const self = samePlacementUrl(selfUrl)
  return spots
    .filter((spot) => !self || samePlacementUrl(spot.url) !== self)
    .sort((a, b) => b.amountCents - a.amountCents || a.paidAt - b.paidAt || (a.url < b.url ? -1 : 1))
}

export function existingBacking(spots: readonly BidOccupant[], selfUrl: string): number {
  const self = samePlacementUrl(selfUrl)
  if (!self) return 0
  return spots
    .filter((spot) => samePlacementUrl(spot.url) === self)
    .reduce((sum, spot) => sum + spot.amountCents, 0)
}

/** Lowest new payment, in cents, that lands at `rank` (1-based). */
export function amountToTakeRank(rank: number, spots: readonly BidOccupant[], selfUrl = ''): number {
  const others = othersOf(spots, selfUrl)
  const target = Math.min(Math.max(1, rank), others.length + 1)
  const occupant = others[target - 1]
  const already = existingBacking(spots, selfUrl)
  if (!occupant) return BILLBOARD_FLOOR_CENTS
  const neededTotal = occupant.amountCents + 100
  return Math.max(BILLBOARD_FLOOR_CENTS, neededTotal - already)
}

/**
 * Where a new payment lands. Ties lose, because the occupant paid earlier.
 * `paymentCents` below the floor is treated as the floor — that is the CTA clamp.
 */
export function rankForPayment(
  paymentCents: number,
  spots: readonly BidOccupant[],
  selfUrl = '',
): { rank: number; chargeCents: number; totalCents: number } {
  const chargeCents = Math.max(BILLBOARD_FLOOR_CENTS, paymentCents)
  const totalCents = existingBacking(spots, selfUrl) + chargeCents
  const ahead = othersOf(spots, selfUrl).filter(
    (spot) => spot.amountCents > totalCents || spot.amountCents === totalCents,
  ).length
  return { rank: ahead + 1, chargeCents, totalCents }
}

export function aimSpan(spots: readonly BidOccupant[], selfUrl = ''): { min: number; max: number } {
  const others = othersOf(spots, selfUrl)
  const onBoard = existingBacking(spots, selfUrl) > 0
  return { min: 1, max: Math.max(1, others.length + (onBoard ? 0 : 1)) }
}

export type BidDraft = {
  url: string
  email: string
  name: string
  amountCents: number
  tier: BillboardTierId
  status: 'requested'
  paidAt: null
  published: false
}

/** Invoice and checkout may store this. `published` cannot be true. */
export function billboardBidDraft(input: {
  url: string
  email: string
  name?: string
  amountCents: unknown
}): BidDraft | null {
  const url = publicHttpUrl(input.url)
  const email = normalizeEmail(input.email)
  const amountCents = clampBillboardBid(input.amountCents)
  if (!url || !email || amountCents == null) return null
  const typed = String(input.name ?? '').trim().slice(0, 80)
  return {
    url,
    email,
    name: typed || productNameFromUrl(url),
    amountCents,
    tier: tierForBid(amountCents),
    status: 'requested',
    paidAt: null,
    published: false,
  }
}
