/**
 * Billboard rows. Public reads and invoice writes share this table.
 * A `requested` row is never returned by `listLiveBillboard`.
 */

import type { BillboardTierId } from '~~/shared/content/billboard'
import { isBillboardTier } from '~~/shared/content/billboard'
import { publicBillboardRows, rankBillboard, type BillboardRow } from '~~/shared/utils/billboard'
import type { Db } from './db'

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
}

export async function listLiveBillboard(db: Db): Promise<BillboardRow[]> {
  const res = await db
    .prepare(
      `SELECT id, tier, name, tagline, url, logo, screenshot, paid_at, status
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
    })
  }
  return rankBillboard(publicBillboardRows(rows))
}

export async function insertBillboardRequest(
  db: Db,
  input: { id: string; tier: BillboardTierId; name: string; url: string; email: string; now: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO billboard_placement
        (id, tier, name, tagline, url, logo, screenshot, email, status, paid_at, created_at, note)
       VALUES (?, ?, ?, '', ?, '', '', ?, 'requested', NULL, ?, '')`,
    )
    .bind(input.id, input.tier, input.name, input.url, input.email, input.now)
    .run()
}
