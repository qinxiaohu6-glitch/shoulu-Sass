/**
 * Upload plumbing for `ImageUploader`, lifted from the source's
 * `components/image-uploader-types.ts`.
 *
 * Two deliberate differences, both because this build has no R2 binding:
 *
 *  · the endpoint is `/api/storage/upload-image` — the same path the source
 *    posts to, so the day a bucket exists nothing here changes;
 *  · `describeUploadError` takes the translator as an argument instead of
 *    reaching for paraglide's `m[]`. Same table of codes, same copy — the keys
 *    live in `shared/content/settings-i18n.ts` under `common.upload.*`.
 *
 * With no bucket configured the server answers `common.upload.storage_not_
 * configured`, which is the source's own wording for exactly this situation
 * ("Storage is not configured. Set up R2 in Admin → Settings → Storage."). The
 * tile goes to `Failed` and the toast says why, so the gap is visible rather
 * than silent.
 */

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error'

export interface ImageUploaderValue {
  id: string
  preview: string
  url?: string
  status: UploadStatus
  size?: number
}

export interface UploadItem extends ImageUploaderValue {
  file?: File
  uploadKey?: string
}

type Params = Record<string, string | number>

export const formatBytes = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(2)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}

/** `lib/upload-errors.ts`, with the message lookup injected. */
export function describeUploadError(
  t: (key: string, params?: Params) => string,
  codeOrMessage?: string | null,
  data?: Record<string, unknown> | null,
): string {
  const code = (codeOrMessage || '').trim()
  const p = {
    name: String(data?.name ?? ''),
    max: String(data?.max ?? data?.maxMB ?? ''),
    count: String(data?.count ?? ''),
    size: String(data?.size ?? ''),
    limit: String(data?.limit ?? ''),
    status: String(data?.status ?? ''),
    detail: String(data?.detail ?? code),
  }

  switch (code) {
    case 'common.upload.unauthorized':
    case 'unauthorized':
      return t('common.upload.unauthorized')
    case 'common.upload.payload_too_large':
      return t('common.upload.payload_too_large')
    case 'common.upload.no_files':
      return t('common.upload.no_files')
    case 'common.upload.too_many_files':
      return t('common.upload.too_many_files', { max: p.max || '10' })
    case 'common.upload.unsupported_type':
      return t('common.upload.unsupported_type', { name: p.name })
    case 'common.upload.file_too_large_server':
      return t('common.upload.file_too_large_server', { name: p.name, max: p.max || '10' })
    case 'common.upload.storage_not_configured':
      return t('common.upload.storage_not_configured')
    case 'common.upload.inline_too_large':
      return t('common.upload.inline_too_large', { size: p.size, limit: p.limit })
    case 'common.upload.failed':
      return p.detail && p.detail !== 'common.upload.failed'
        ? t('common.upload.failed_detail', { detail: p.detail })
        : t('common.upload.failed')
    case 'common.upload.http_failed':
      return t('common.upload.http_failed', { status: p.status || '?' })
    default:
      return code || t('common.upload.failed')
  }
}

/**
 * Downscale before upload.
 *
 * A phone screenshot is 3–8 MB and a logo pulled off a marketing page is often
 * 400 KB at 2000 px wide; neither needs to be. Nothing here is ever displayed
 * larger than a card, so the browser resizes first: smaller request, smaller
 * row, faster page. `MAX_STORED_BYTES` on the server is the backstop, not the
 * plan.
 *
 * Every branch falls back to the original file. A canvas that refuses to decode
 * HEIC, or a Safari without WebP encoding, must not turn a working upload into
 * an error — the worst case is the image arrives at its original size.
 */
const SHRINK_MAX_EDGE = 1000
const SHRINK_QUALITY = 0.85
/** Below this, re-encoding usually makes the file bigger rather than smaller. */
const SHRINK_SKIP_BYTES = 300 * 1024

function renamed(name: string, ext: string): string {
  return `${String(name || 'image').replace(/\.[^.]+$/, '')}.${ext}`
}

export async function shrinkImage(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file
  // Re-encoding a GIF loses the animation, which is the only reason to send one.
  if (file.type === 'image/gif') return file
  if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) return file
  if (file.size <= SHRINK_SKIP_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = longest > SHRINK_MAX_EDGE ? SHRINK_MAX_EDGE / longest : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, SHRINK_QUALITY))

    const blob = (await encode('image/webp')) ?? (await encode('image/jpeg'))
    // A "smaller" file that is not smaller is not an improvement.
    if (!blob || blob.size >= file.size) return file

    const type = blob.type || 'image/jpeg'
    return new File([blob], renamed(file.name, type === 'image/webp' ? 'webp' : 'jpg'), { type })
  } catch {
    return file
  }
}

/**
 * POST one file, return its public URL.
 *
 * The source's response envelope is `{ code, message, data }` with HTTP 200 even
 * for refusals, so `code !== 0` is the failure signal — not `response.ok`.
 */
export async function uploadImageFile(
  file: File,
  t: (key: string, params?: Params) => string,
): Promise<string> {
  const body = await shrinkImage(file)
  const formData = new FormData()
  formData.append('files', body)

  const response = await fetch('/api/storage/upload-image', { method: 'POST', body: formData })

  let result: any = null
  try {
    result = await response.json()
  } catch {
    result = null
  }

  if (!response.ok) {
    throw new Error(
      describeUploadError(t, result?.message || 'common.upload.http_failed', {
        status: response.status,
      }),
    )
  }

  if (result?.code !== 0 || !result?.data?.urls?.length) {
    throw new Error(describeUploadError(t, result?.message || 'common.upload.failed', result?.data))
  }

  return result.data.urls[0] as string
}
