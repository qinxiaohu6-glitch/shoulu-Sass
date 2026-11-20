/**
 * POST /api/storage/upload-image — source `routes/api/storage/upload-image.ts`.
 *
 * Same path, same `{ code, message, data }` envelope, same validation order, so
 * the browser-side uploader (`components/ImageUploader.vue`) is a straight port.
 *
 * The one real difference is the last step. The source asks its storage module
 * for a provider; this build has no R2 binding and no filesystem on the Workers
 * runtime, so the bytes go into D1 (`upload_asset`) and are served back from
 * `/api/storage/file/<id>`. Everything above that line — auth, size caps, the
 * MIME allow-list — is unchanged, so swapping in a bucket later touches only
 * the insert below and the GET handler beside it.
 *
 * Refusals are HTTP 200 with a non-zero `code`, which is what the uploader
 * reads. Only an unexpected throw produces a non-200.
 */

import { readSession } from '../../utils/session'
import { useDb } from '../../utils/db'
import { assetExtFor, assetUrl, MAX_STORED_BYTES, newAssetId } from '~~/shared/utils/upload-asset'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 10
const MAX_REQUEST_BYTES = 20 * 1024 * 1024

/** The source's envelope: HTTP 200 with a non-zero `code` for a refusal. */
function respJson(code: number, message: string, data?: unknown) {
  return { code, message, ...(data === undefined ? {} : { data }) }
}

const uploadErr = (code: string, data?: Record<string, unknown>) => respJson(-1, code, data)

export default defineEventHandler(async (event) => {
  const me = await readSession(event)
  if (!me?.sub) return uploadErr('common.upload.unauthorized')

  // Refuse an oversized body before buffering it, when the size is declared.
  const declared = Number(getHeader(event, 'content-length') ?? 0)
  if (declared > MAX_REQUEST_BYTES + 64 * 1024) {
    return uploadErr('common.upload.payload_too_large')
  }

  const form = await readMultipartFormData(event).catch(() => null)
  const files = (form ?? []).filter((part) => part.name === 'files' && part.data?.length)

  if (!files.length) return uploadErr('common.upload.no_files')
  if (files.length > MAX_FILES_PER_REQUEST) {
    return uploadErr('common.upload.too_many_files', { max: MAX_FILES_PER_REQUEST })
  }
  if (files.reduce((sum, f) => sum + f.data.length, 0) > MAX_REQUEST_BYTES) {
    return uploadErr('common.upload.payload_too_large')
  }

  for (const file of files) {
    // The extension — and so how the file would be served — comes only from
    // this allow-list, never from the client-supplied file name.
    if (!assetExtFor(String(file.type ?? ''))) {
      return uploadErr('common.upload.unsupported_type', { name: file.filename })
    }
    if (file.data.length > MAX_UPLOAD_BYTES) {
      return uploadErr('common.upload.file_too_large_server', {
        name: file.filename,
        max: 10,
      })
    }
    // The browser downscales before it posts, so this only fires for a client
    // that skipped the resize — a direct API call, or a format the canvas
    // refused to decode.
    if (file.data.length > MAX_STORED_BYTES) {
      return uploadErr('common.upload.inline_too_large', {
        name: file.filename,
        size: `${(file.data.length / 1024).toFixed(0)}KB`,
        limit: `${Math.round(MAX_STORED_BYTES / 1024)}KB`,
      })
    }
  }

  const db = await useDb(event)
  const origin = getRequestURL(event).origin
  const now = Math.floor(Date.now() / 1000)
  const urls: string[] = []
  const results: Array<Record<string, unknown>> = []

  for (const file of files) {
    const type = String(file.type ?? '').trim().toLowerCase()
    const id = newAssetId(assetExtFor(type) as string)
    const bytes = new Uint8Array(file.data)

    await db
      .prepare(
        `INSERT INTO upload_asset (id, mime, bytes_b64, size, owner_sub, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, type, Buffer.from(bytes).toString('base64'), bytes.length, me.sub, now)
      .run()

    const url = assetUrl(origin, id)
    urls.push(url)
    results.push({ name: file.filename, url, size: bytes.length, type })
  }

  return respJson(0, 'ok', { urls, results })
})
