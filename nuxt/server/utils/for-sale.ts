/**
 * For-sale rows. Public functions return cards with no email address.
 * The seller address is read only when emailing them about a buyer message
 * or a review outcome.
 */

import type { H3Event } from 'h3'
import { FOR_SALE_KIND, forSaleProductConfigured } from '~~/shared/content/for-sale'
import {
  canChangeAskingPrice,
  canStartCheckout,
  isForSaleStatus,
  isPublicForSale,
  listingSpamReasons,
  markPaid,
  markReviewed,
  ownsSubmission,
  parseAskingDollars,
  refundForSale,
  relistForSale,
  resubmitForSale,
  toPublicForSaleCard,
  unlistForSale,
  type ForSaleCycle,
  type ForSaleStatus,
  type PublicForSaleCard,
} from '~~/shared/utils/for-sale-state'
import type { Db } from './db'
import { waffoProductIds } from './payments'
import { getPublicBySlug, publiclyListed, type SubmissionRow } from './submissions'
import { readSession, type Session } from './session'

export interface ForSaleRow {
  id: string
  product_slug: string
  product_name: string
  owner_sub: string
  owner_email: string
  asking_cents: number
  revenue: string
  profit: string
  team: string
  stack: string
  status: string
  paid_at: number | null
  reviewed_at: number | null
  reviewer: string
  review_note: string
  created_at: number
  updated_at: number
}

const now = () => Math.floor(Date.now() / 1000)

export function forSaleSkuReady(event: H3Event): boolean {
  return forSaleProductConfigured(waffoProductIds(event))
}

export function missingForSaleTable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /no such table:\s*for_sale_/i.test(message)
}

function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function cycleOf(row: ForSaleRow): ForSaleCycle {
  const status: ForSaleStatus = isForSaleStatus(row.status) ? row.status : 'draft'
  return { status, paidAt: row.paid_at, reviewedAt: row.reviewed_at }
}

function cardOf(row: ForSaleRow, interested: number): PublicForSaleCard | null {
  return toPublicForSaleCard({
    id: row.id,
    product_slug: row.product_slug,
    product_name: row.product_name,
    asking_cents: row.asking_cents,
    revenue: row.revenue,
    profit: row.profit,
    team: row.team,
    stack: row.stack,
    status: cycleOf(row).status,
    paidAt: row.paid_at,
    reviewedAt: row.reviewed_at,
    interested,
    owner_email: row.owner_email,
    owner_sub: row.owner_sub,
  })
}

async function interestCounts(db: Db, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!ids.length) return counts
  const marks = ids.map(() => '?').join(', ')
  const { results } = await db
    .prepare(
      `SELECT listing_id, COUNT(*) AS n FROM for_sale_interest WHERE listing_id IN (${marks}) GROUP BY listing_id`,
    )
    .bind(...ids)
    .all<{ listing_id: string; n: number }>()
  for (const row of results) counts.set(row.listing_id, Number(row.n))
  return counts
}

export async function getForSale(db: Db, id: string): Promise<ForSaleRow | null> {
  if (!id) return null
  return db.prepare('SELECT * FROM for_sale_listing WHERE id = ?').bind(id).first<ForSaleRow>()
}

export async function getForSaleBySlug(db: Db, slug: string): Promise<ForSaleRow | null> {
  if (!slug) return null
  return db.prepare('SELECT * FROM for_sale_listing WHERE product_slug = ?').bind(slug).first<ForSaleRow>()
}

export async function listPublicForSale(db: Db): Promise<PublicForSaleCard[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM for_sale_listing
        WHERE status = 'active' AND paid_at IS NOT NULL AND reviewed_at IS NOT NULL
        ORDER BY reviewed_at DESC
        LIMIT 200`,
    )
    .all<ForSaleRow>()
  const counts = await interestCounts(db, results.map((row) => row.id))
  const cards: PublicForSaleCard[] = []
  for (const row of results) {
    const card = cardOf(row, counts.get(row.id) ?? 0)
    if (card) cards.push(card)
  }
  return cards
}

export interface OwnedProduct {
  slug: string
  name: string
}

export async function ownedLiveProducts(db: Db, session: Session): Promise<SubmissionRow[]> {
  const email = session.email.trim().toLowerCase()
  const { results } = await db
    .prepare(
      `SELECT * FROM submissions
        WHERE owner_sub = ?
           OR (owner_sub = '' AND owner_email <> '' AND lower(owner_email) = ?)
        ORDER BY created_at DESC
        LIMIT 200`,
    )
    .bind(session.sub, email)
    .all<SubmissionRow>()
  return results.filter((row) => publiclyListed(row) && ownsSubmission(row, session))
}

export interface ListingFields {
  askingCents: number
  revenue: string
  profit: string
  team: string
  stack: string
}

export function cleanFields(input: {
  asking: unknown
  revenue: unknown
  profit: unknown
  team: unknown
  stack: unknown
}): { ok: true; fields: ListingFields } | { ok: false; reason: string } {
  const askingCents = parseAskingDollars(input.asking)
  if (askingCents == null) return { ok: false, reason: 'asking_price' }
  const clip = (value: unknown) => String(value ?? '').trim().slice(0, 200)
  const fields = {
    askingCents,
    revenue: clip(input.revenue),
    profit: clip(input.profit),
    team: clip(input.team),
    stack: clip(input.stack),
  }
  const spam = listingSpamReasons(fields)
  if (spam.length) return { ok: false, reason: spam[0] || 'spam' }
  return { ok: true, fields }
}

export async function saveForSaleListing(
  db: Db,
  session: Session,
  slug: string,
  fields: ListingFields,
): Promise<ForSaleRow> {
  const product = await getPublicBySlug(db, slug)
  if (!product || !ownsSubmission(product, session)) {
    throw Object.assign(new Error('not_owner'), { code: 'not_owner' })
  }
  const existing = await getForSaleBySlug(db, slug)
  const ts = now()
  if (!existing) {
    const id = newId('fs')
    await db
      .prepare(
        `INSERT INTO for_sale_listing (
           id, product_slug, product_name, owner_sub, owner_email, asking_cents,
           revenue, profit, team, stack, status, paid_at, reviewed_at, reviewer,
           review_note, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, '', '', ?, ?)`,
      )
      .bind(
        id,
        slug,
        product.name,
        session.sub,
        session.email,
        fields.askingCents,
        fields.revenue,
        fields.profit,
        fields.team,
        fields.stack,
        ts,
        ts,
      )
      .run()
    return (await getForSale(db, id))!
  }
  if (!ownsSubmission({ owner_sub: existing.owner_sub, owner_email: existing.owner_email }, session)) {
    throw Object.assign(new Error('not_owner'), { code: 'not_owner' })
  }
  const cycle = cycleOf(existing)
  if (cycle.status === 'sold' || cycle.status === 'withdrawn') {
    throw Object.assign(new Error('relist_first'), { code: 'relist_first' })
  }
  await db
    .prepare(
      `UPDATE for_sale_listing
          SET product_name = ?, asking_cents = ?, revenue = ?, profit = ?, team = ?, stack = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      product.name,
      fields.askingCents,
      fields.revenue,
      fields.profit,
      fields.team,
      fields.stack,
      ts,
      existing.id,
    )
    .run()
  return (await getForSale(db, existing.id))!
}

export async function applyForSaleCycle(db: Db, id: string, cycle: ForSaleCycle, reviewer = ''): Promise<void> {
  await db
    .prepare(
      `UPDATE for_sale_listing
          SET status = ?, paid_at = ?, reviewed_at = ?, reviewer = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(cycle.status, cycle.paidAt, cycle.reviewedAt, reviewer, now(), id)
    .run()
}

export async function markForSalePaid(db: Db, listingId: string): Promise<
  | { ok: true; status: ForSaleStatus; public: false }
  | { ok: false; reason: 'missing' | 'already_in_cycle' }
> {
  const row = await getForSale(db, listingId)
  if (!row) return { ok: false, reason: 'missing' }
  const next = markPaid(cycleOf(row), now())
  if (!next) return { ok: false, reason: 'already_in_cycle' }
  await applyForSaleCycle(db, row.id, next)
  return { ok: true, status: next.status, public: false }
}

export async function refundForSaleListing(db: Db, listingId: string): Promise<void> {
  const row = await getForSale(db, listingId)
  if (!row) return
  await applyForSaleCycle(db, row.id, refundForSale(cycleOf(row)))
}

export async function setAskingPrice(db: Db, row: ForSaleRow, askingCents: number): Promise<ForSaleRow | null> {
  if (!canChangeAskingPrice(cycleOf(row))) return null
  await db
    .prepare('UPDATE for_sale_listing SET asking_cents = ?, updated_at = ? WHERE id = ?')
    .bind(askingCents, now(), row.id)
    .run()
  return getForSale(db, row.id)
}

export async function unlistListing(db: Db, row: ForSaleRow, reason: 'sold' | 'withdrawn'): Promise<ForSaleRow | null> {
  const next = unlistForSale(cycleOf(row), reason)
  if (!next) return null
  await applyForSaleCycle(db, row.id, next)
  return getForSale(db, row.id)
}

export async function relistListing(db: Db, row: ForSaleRow): Promise<ForSaleRow | null> {
  const next = relistForSale(cycleOf(row))
  if (!next) return null
  await applyForSaleCycle(db, row.id, next)
  return getForSale(db, row.id)
}

export async function resubmitListing(db: Db, row: ForSaleRow): Promise<ForSaleRow | null> {
  const next = resubmitForSale(cycleOf(row))
  if (!next) return null
  await applyForSaleCycle(db, row.id, next)
  return getForSale(db, row.id)
}

export async function reviewListing(
  db: Db,
  row: ForSaleRow,
  approved: boolean,
  reviewer: string,
): Promise<ForSaleRow | null> {
  const next = markReviewed(cycleOf(row), approved, now())
  if (!next) return null
  await applyForSaleCycle(db, row.id, next, reviewer)
  return getForSale(db, row.id)
}

export function sellerMayPay(row: ForSaleRow): boolean {
  return canStartCheckout(cycleOf(row))
}

export async function recordInterest(
  db: Db,
  listingId: string,
  buyerSub: string,
  message: string,
): Promise<number> {
  const ts = now()
  await db
    .prepare(
      `INSERT INTO for_sale_interest (id, listing_id, buyer_sub, message, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(listing_id, buyer_sub) DO UPDATE SET message = excluded.message`,
    )
    .bind(newId('fi'), listingId, buyerSub, message, ts)
    .run()
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM for_sale_interest WHERE listing_id = ?')
    .bind(listingId)
    .first<{ n: number }>()
  return Number(count?.n ?? 0)
}

export async function listForSaleAdmin(db: Db): Promise<ForSaleRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM for_sale_listing ORDER BY updated_at DESC LIMIT 200')
    .all<ForSaleRow>()
  return results
}

export function ownerView(row: ForSaleRow, interested: number) {
  const cycle = cycleOf(row)
  return {
    id: row.id,
    product_slug: row.product_slug,
    product_name: row.product_name,
    asking_cents: row.asking_cents,
    revenue: row.revenue,
    profit: row.profit,
    team: row.team,
    stack: row.stack,
    status: cycle.status,
    paid: row.paid_at != null,
    reviewed: row.reviewed_at != null,
    public: isPublicForSale(cycle),
    can_pay: canStartCheckout(cycle),
    can_reprice: canChangeAskingPrice(cycle),
    can_unlist: cycle.status === 'active' || cycle.status === 'paid_pending_review',
    can_relist: cycle.status === 'sold' || cycle.status === 'withdrawn',
    can_resubmit: cycle.status === 'rejected' && row.paid_at != null,
    interested,
  }
}

export async function requireSeller(event: H3Event): Promise<Session> {
  const session = await readSession(event)
  if (!session?.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: {
        reason: 'sign_in',
        message_en: 'Sign in to list a product for sale.',
        message_zh: '请先登录再上架待售。',
      },
    })
  }
  return session
}

export { FOR_SALE_KIND }
