/**
 * POST /api/storage/upload-image — source `routes/api/storage/upload-image.ts`.
 *
 * Same path, same `{ code, message, data }` envelope, same validation order, so
 * the browser-side uploader (`components/ImageUploader.vue`) is a straight port
 * and nothing changes the day a bucket exists.
 *
 * The one real difference is the last step. The source asks its storage module
 * for a provider and, with none configured, either writes to `public/uploads`
 * (dev) or answers `common.upload.storage_not_configured` (Workers). This build
 * has no R2 binding and no filesystem on the Workers runtime, so it always
 * takes the second branch — with the source's own wording for it.
 *
 * To turn uploads on:
 *   1. add an `r2_buckets` binding to `wrangler.jsonc`
 *   2. replace the `storage_not_configured` return below with the upload, and
 *      return `{ urls: [publicUrl], results: [...] }` from `respData`
 * Nothing in the browser code needs to change.
 */

import { readSession } from '../../utils/session'

/** Raster formats only — SVG can carry script, so it is not accepted. */
const EXT_FROM_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

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
    const type = String(file.type ?? '')
    if (!EXT_FROM_MIME[type]) {
      return uploadErr('common.upload.unsupported_type', { name: file.filename })
    }
    if (file.data.length > MAX_UPLOAD_BYTES) {
      return uploadErr('common.upload.file_too_large_server', {
        name: file.filename,
        max: 10,
      })
    }
  }

  // No object storage is bound in this build. See the header for what to add.
  return uploadErr('common.upload.storage_not_configured')
})
