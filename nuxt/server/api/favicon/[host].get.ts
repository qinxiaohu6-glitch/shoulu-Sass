/**
 * GET /api/favicon/<host> — one product icon, fetched once and kept.
 *
 * A billboard placement carries a URL, not an icon. When the claimed site is
 * also a directory listing we already have its logo; when it is not, the only
 * icon in existence is its favicon. That used to be loaded straight from
 * `google.com/s2/favicons` in the browser, which meant a third-party request on
 * every page view — and an icon slot that stayed empty for every visitor whose
 * network cannot reach that host.
 *
 * So the fetch moves here. The Worker can reach the source, the browser only
 * talks to us, and the bytes are written to `upload_asset` under a deterministic
 * id so the second visitor costs one indexed read and no egress.
 *
 * The host arrives from the URL and is then fetched, so it is treated as
 * hostile — see `isFetchableHost`. The sources are fetched with a hard timeout
 * because a hanging request is exactly the failure this route exists to remove:
 * a miss has to become a fast 404 so the page can draw its monogram instead of
 * leaving a blank square.
 */

import { useDb } from '../../utils/db'
import { faviconCacheKey, faviconSourcesFor, isFetchableHost, sniffImageType } from '~~/shared/utils/favicon'

/** An icon is tens of KB. Anything larger is not a favicon. */
const MAX_ICON_BYTES = 256 * 1024
const MIN_ICON_BYTES = 70

/**
 * Stop caching once the table holds this many icons.
 *
 * The route writes a row per host, and the host is chosen by whoever claimed a
 * placement. The cap keeps a scripted walk over invented domains from turning
 * into unbounded storage; past it the icon is still served, just not kept.
 */
const MAX_CACHED_ICONS = 2000

const FETCH_TIMEOUT_MS = 4000

function iconHeaders(contentType: string, maxAge: number) {
  return {
    'content-type': contentType,
    'cache-control': `public, max-age=${maxAge}`,
    'x-content-type-options': 'nosniff',
  }
}

async function download(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const response = await fetch(url, {
      // Some sites refuse a datacenter request without a browser-shaped agent.
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ProductAtlasBot/1.0; +https://dirtool.com)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!response.ok) return null

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length < MIN_ICON_BYTES || bytes.length > MAX_ICON_BYTES) return null

    const mime = sniffImageType(bytes)
    return mime ? { bytes, mime } : null
  } catch {
    // Timeout, DNS failure, blocked egress — all the same answer here.
    return null
  }
}

export default defineEventHandler(async (event) => {
  const host = String(getRouterParam(event, 'host') ?? '').trim().toLowerCase()
  if (!isFetchableHost(host)) {
    setResponseStatus(event, 404)
    return ''
  }

  const db = await useDb(event)
  const id = await faviconCacheKey(host)

  const cached = await db
    .prepare('SELECT mime, bytes_b64 FROM upload_asset WHERE id = ?')
    .bind(id)
    .first<{ mime: string; bytes_b64: string }>()

  if (cached) {
    setResponseHeaders(event, iconHeaders(String(cached.mime || 'image/png'), 86400))
    return Buffer.from(String(cached.bytes_b64 || ''), 'base64')
  }

  for (const url of faviconSourcesFor(host)) {
    const icon = await download(url)
    if (!icon) continue

    // Best effort: a failed write costs a refetch, not the response.
    const counted = await db
      .prepare("SELECT COUNT(*) AS n FROM upload_asset WHERE owner_sub = 'favicon'")
      .all<{ n: number }>()
    if (Number(counted.results[0]?.n ?? 0) < MAX_CACHED_ICONS) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO upload_asset (id, mime, bytes_b64, size, owner_sub, created_at)
           VALUES (?, ?, ?, ?, 'favicon', ?)`,
        )
        .bind(id, icon.mime, Buffer.from(icon.bytes).toString('base64'), icon.bytes.length, Math.floor(Date.now() / 1000))
        .run()
        .catch(() => {})
    }

    setResponseHeaders(event, iconHeaders(icon.mime, 86400))
    return Buffer.from(icon.bytes)
  }

  // No icon anywhere. 404 is the signal the page needs: it draws the monogram.
  // The short max-age keeps a transient failure from being remembered for long.
  setResponseHeaders(event, { 'cache-control': 'public, max-age=3600' })
  setResponseStatus(event, 404)
  return ''
})
