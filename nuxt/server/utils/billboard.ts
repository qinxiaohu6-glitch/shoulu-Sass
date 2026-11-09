/**
 * Billboard rows. Public reads and invoice writes share this table.
 * A `requested` row is never returned by `listLiveBillboard`.
 */

import type { BillboardTierId } from '~~/shared/content/billboard'
import { isBillboardTier } from '~~/shared/content/billboard'
import { publicBillboardRows, rankBillboard, type BillboardRow } from '~~/shared/utils/billboard'
import { screenshotSrc } from '~~/shared/utils/screenshot'
import { legalLogoUrl } from '~~/shared/utils/logo'
import type { Db } from './db'
import { fillBillboardScreenshots } from './billboard-media'

type BillboardSqlRow = {
  id: string
  tier: string
  name: string
  tagline: string
  url: string
  logo: string
  screenshot: string
  paid_at: number | null
  status: string
  email?: string
  order_id?: string
  amount_cents?: number
  created_at?: number
  note?: string
}

export async function listLiveBillboard(db: Db): Promise<BillboardRow[]> {
  const res = await db
    .prepare(
      `SELECT id, tier, name, tagline, url, logo, screenshot, paid_at, status, amount_cents
       FROM billboard_placement
       WHERE status = 'live' AND paid_at IS NOT NULL`,
    )
    .all<BillboardSqlRow>()

  const rows: BillboardRow[] = []
  for (const row of res.results) {
    if (!isBillboardTier(row.tier) || typeof row.paid_at !== 'number') continue
    rows.push({
      id: row.id,
      tier: row.tier,
      name: row.name,
      tagline: row.tagline,
      url: row.url,
      logo: row.logo,
      screenshot: row.screenshot,
      paidAt: row.paid_at,
      status: 'live',
      amountCents: Number(row.amount_cents ?? 0),
    })
  }
  const ranked = rankBillboard(publicBillboardRows(rows))
  try {
    await fillBillboardScreenshots(db, ranked)
  } catch (err) {
    console.error('[billboard] screenshot fill failed', err)
  }
  return ranked
}

export type BillboardAdminRow = {
  id: string
  tier: string
  name: string
  tagline: string
  url: string
  logo: string
  screenshot: string
  email: string
  status: string
  paidAt: number | null
  createdAt: number
  orderId: string
  amountCents: number
  note: string
}

/** Operator list. Includes unpaid rows. Not a public read. */
export async function listAllBillboard(db: Db): Promise<BillboardAdminRow[]> {
  const res = await db
    .prepare(
      `SELECT id, tier, name, tagline, url, logo, screenshot, email, status, paid_at, created_at,
              order_id, amount_cents, note
         FROM billboard_placement
        ORDER BY created_at DESC`,
    )
    .all<BillboardSqlRow & { email: string; created_at: number; order_id: string; note: string }>()
  return res.results.map((row) => ({
    id: row.id,
    tier: row.tier,
    name: row.name,
    tagline: row.tagline,
    url: row.url,
    logo: row.logo,
    screenshot: row.screenshot ?? '',
    email: row.email,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    orderId: row.order_id,
    amountCents: Number(row.amount_cents ?? 0),
    note: row.note,
  }))
}

export async function insertBillboardCheckout(
  db: Db,
  input: {
    id: string
    orderId: string
    tier: BillboardTierId
    name: string
    tagline: string
    url: string
    email: string
    amountCents: number
    now: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO billboard_placement
        (id, tier, name, tagline, url, logo, screenshot, email, status, paid_at, created_at, note, order_id, amount_cents)
       VALUES (?, ?, ?, ?, ?, '', '', ?, 'pending', NULL, ?, '', ?, ?)`,
    )
    .bind(
      input.id,
      input.tier,
      input.name,
      input.tagline,
      input.url,
      input.email,
      input.now,
      input.orderId,
      input.amountCents,
    )
    .run()
}

export async function insertBillboardRequest(
  db: Db,
  input: {
    id: string
    tier: BillboardTierId
    name: string
    tagline?: string
    url: string
    email: string
    amountCents: number
    now: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO billboard_placement
        (id, tier, name, tagline, url, logo, screenshot, email, status, paid_at, created_at, note, amount_cents)
       VALUES (?, ?, ?, ?, ?, '', '', ?, 'requested', NULL, ?, '', ?)`,
    )
    .bind(
      input.id,
      input.tier,
      input.name,
      (input.tagline ?? '').slice(0, 140),
      input.url,
      input.email,
      input.now,
      input.amountCents,
    )
    .run()
}

/** Operator edit. Empty strings clear the field. Invalid values are refused. */
export function billboardMediaPatch(screenshot: unknown, logo: unknown): { screenshot: string; logo: string } | null {
  const shotRaw = String(screenshot ?? '').trim()
  const logoRaw = String(logo ?? '').trim()
  const shot = shotRaw ? screenshotSrc(shotRaw) : ''
  const mark = logoRaw ? legalLogoUrl(logoRaw) : ''
  if (shotRaw && !shot) return null
  if (logoRaw && !mark) return null
  return { screenshot: shot, logo: mark }
}

export async function setBillboardMedia(
  db: Db,
  id: string,
  media: { screenshot: string; logo: string },
): Promise<void> {
  await db
    .prepare(`UPDATE billboard_placement SET screenshot = ?, logo = ? WHERE id = ?`)
    .bind(media.screenshot, media.logo, id)
    .run()
}
