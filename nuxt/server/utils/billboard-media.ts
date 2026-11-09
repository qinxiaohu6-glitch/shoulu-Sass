/**
 * Fill a live Billboard card's screenshot when the placement row is blank.
 *
 * Order: the row's own URL, then a gallery shot on a listing with the same
 * website, then that website's `og:image`. A miss is remembered for a few
 * minutes so the homepage does not refetch a site that has no image.
 * A hit is written back onto the placement so the next read is local.
 */

import { samePlacementUrl, type BillboardRow } from '~~/shared/utils/billboard'
import { pickBillboardShot, screenshotSrc } from '~~/shared/utils/screenshot'
import type { Db } from './db'
import { discoverHomepageImage } from './homepage-image'

const MISS_MS = 10 * 60 * 1000
const misses = new Map<string, number>()

function rememberMiss(url: string) {
  misses.set(samePlacementUrl(url) || url, Date.now())
}

function missedRecently(url: string): boolean {
  const at = misses.get(samePlacementUrl(url) || url)
  return typeof at === 'number' && Date.now() - at < MISS_MS
}

function parseShots(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 8) : []
  } catch {
    return []
  }
}

async function shotLibrary(db: Db): Promise<Map<string, string[]>> {
  const library = new Map<string, string[]>()
  const absorb = (url: string, shots: string[]) => {
    const key = samePlacementUrl(url)
    if (!key || !shots.length) return
    const prev = library.get(key) ?? []
    library.set(key, [...prev, ...shots])
  }
  try {
    const submitted = await db
      .prepare(`SELECT url, shots FROM submissions WHERE shots != '' AND shots != '[]'`)
      .all<{ url: string; shots: string }>()
    for (const row of submitted.results) absorb(row.url, parseShots(row.shots))
  } catch (err) {
    console.error('[billboard] submission shots unavailable', err)
  }
  try {
    const curated = await db
      .prepare(`SELECT url, shots FROM dir_tool WHERE shots != '' AND shots != '[]'`)
      .all<{ url: string; shots: string }>()
    for (const row of curated.results) absorb(row.url, parseShots(row.shots))
  } catch (err) {
    console.error('[billboard] directory shots unavailable', err)
  }
  return library
}

async function persistScreenshot(db: Db, id: string, screenshot: string): Promise<void> {
  await db
    .prepare(
      `UPDATE billboard_placement
          SET screenshot = ?
        WHERE id = ? AND (screenshot = '' OR screenshot IS NULL)`,
    )
    .bind(screenshot, id)
    .run()
}

/**
 * Mutates `rows` so each one carries a renderable screenshot when one exists.
 * Does not invent an image. Failures leave the row unchanged.
 */
export async function fillBillboardScreenshots(db: Db, rows: BillboardRow[]): Promise<void> {
  let library: Map<string, string[]> | null = null
  const needRemote: BillboardRow[] = []

  for (const row of rows) {
    const stored = screenshotSrc(row.screenshot)
    if (stored) {
      row.screenshot = stored
      continue
    }
    if (!library) library = await shotLibrary(db)
    const fromDirectory = pickBillboardShot('', library.get(samePlacementUrl(row.url)) ?? [], '')
    if (fromDirectory) {
      row.screenshot = fromDirectory
      try {
        await persistScreenshot(db, row.id, fromDirectory)
      } catch (err) {
        console.error('[billboard] screenshot save failed', row.id, err)
      }
      continue
    }
    needRemote.push(row)
  }

  for (const row of needRemote.slice(0, 2)) {
    if (missedRecently(row.url)) continue
    const remote = await discoverHomepageImage(row.url)
    const shot = pickBillboardShot('', [], remote)
    if (!shot) {
      rememberMiss(row.url)
      continue
    }
    row.screenshot = shot
    try {
      await persistScreenshot(db, row.id, shot)
    } catch (err) {
      console.error('[billboard] screenshot save failed', row.id, err)
    }
  }
}

/** Best-effort at claim time. A timeout must not fail checkout or the invoice. */
export async function seedBillboardScreenshot(db: Db, id: string, pageUrl: string): Promise<void> {
  try {
    const shot = pickBillboardShot('', [], await discoverHomepageImage(pageUrl))
    if (!shot) return
    await persistScreenshot(db, id, shot)
  } catch (err) {
    console.error('[billboard] homepage image skipped', id, err)
  }
}

/** Operator "抓取首页图". Overwrites the stored screenshot when an image is found. */
export async function captureBillboardScreenshot(db: Db, id: string): Promise<string> {
  const row = await db
    .prepare(`SELECT id, url FROM billboard_placement WHERE id = ?`)
    .bind(id)
    .first<{ id: string; url: string }>()
  if (!row) return ''
  const shot = pickBillboardShot('', [], await discoverHomepageImage(row.url))
  if (!shot) return ''
  await db.prepare(`UPDATE billboard_placement SET screenshot = ? WHERE id = ?`).bind(shot, id).run()
  return shot
}
