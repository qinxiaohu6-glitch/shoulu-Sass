/**
 * Who may appear on the weekly board: currently public listings.
 *
 * Catalogue seeds with status `approved`, plus submissions that pass the
 * same public gate as the directory (approved, and a paid plan only after
 * payment). Hidden and tombstoned slugs are out. The value is the list time
 * used as a tie-break, in milliseconds. Earlier wins.
 */

import { tools } from '~~/shared/utils/catalog'
import type { Db } from './db'
import { loadOverrides } from './overrides'
import { PAID_PLANS } from './submissions'

export function listedAtMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY
  const raw = value.trim()
  if (!raw) return Number.POSITIVE_INFINITY
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw)
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
}

export async function loadEligibleListedAt(db: Db): Promise<Map<string, number>> {
  const overrides = await loadOverrides(db).catch(() => ({ hidden: [] as string[] }))
  const hidden = new Set(overrides.hidden)
  const out = new Map<string, number>()

  for (const tool of tools) {
    if (tool.status !== 'approved') continue
    if (hidden.has(tool.slug)) continue
    out.set(tool.slug, listedAtMs(tool.created_at))
  }

  const placeholders = PAID_PLANS.map(() => '?').join(',')
  try {
    const { results } = await db
      .prepare(
        `SELECT slug, created_at FROM submissions
         WHERE status = 'approved'
           AND (paid_at IS NOT NULL OR plan NOT IN (${placeholders}))`,
      )
      .bind(...PAID_PLANS)
      .all<{ slug: string; created_at: number }>()
    for (const row of results) {
      if (!row.slug || hidden.has(row.slug)) continue
      const ms = listedAtMs(row.created_at)
      const prev = out.get(row.slug)
      if (prev == null || ms < prev) out.set(row.slug, ms)
    }
  } catch (err) {
    console.error('[board] public listings', err)
  }

  return out
}
