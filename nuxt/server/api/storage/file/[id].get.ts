/**
 * GET /api/storage/file/<id> — the read half of `upload-image.post.ts`.
 *
 * The id is matched against the exact shape `newAssetId()` produces before it
 * reaches SQL. That is not belt-and-braces: the value arrives from the URL, and
 * a lookup key that can be anything is how a storage route turns into a way to
 * read rows it was never meant to expose.
 *
 * `immutable` is honest here — an id is minted once and never rewritten, so a
 * changed image is a new URL. That is what keeps an icon off the database on
 * every page view after the first.
 */

import { useDb } from '../../../utils/db'
import { isAssetId } from '~~/shared/utils/upload-asset'

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isAssetId(id)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const db = await useDb(event)
  const row = await db
    .prepare('SELECT mime, bytes_b64 FROM upload_asset WHERE id = ?')
    .bind(id)
    .first<{ mime: string; bytes_b64: string }>()

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  setResponseHeaders(event, {
    'content-type': String(row.mime || 'application/octet-stream'),
    'cache-control': 'public, max-age=31536000, immutable',
    // The MIME type is already restricted to raster formats on the way in;
    // this stops a browser from re-guessing it on the way out.
    'x-content-type-options': 'nosniff',
  })

  return Buffer.from(String(row.bytes_b64 || ''), 'base64')
})
