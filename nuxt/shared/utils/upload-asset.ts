/**
 * Uploaded image assets: which bytes are accepted, how an asset is named, and
 * which ids may be read back.
 *
 * This build has no object-storage binding, so the bytes live in a D1 row
 * (`upload_asset`). An icon is a few tens of kilobytes once the browser has
 * downscaled it, and the cap below is the safety net for everything else.
 *
 * The id shape is the only thing between a URL and a row lookup, so it is
 * checked on the way in *and* on the way out: a request for
 * `/api/storage/file/../session` must not become a way to read something that
 * is not an asset.
 */

/** Raster formats only — SVG can carry script, so it is never accepted. */
export const UPLOAD_EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const UPLOAD_EXTS = ['jpg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif'] as const

/**
 * Bytes kept in one row.
 *
 * D1 caps a single value at 2 MB and base64 inflates by a third, so 700 KB raw
 * leaves room for the encoding — and sits far above what the browser sends once
 * it has downscaled the image.
 */
export const MAX_STORED_BYTES = 700 * 1024

/** The extension for a declared MIME type, or null when the type is refused. */
export function assetExtFor(mime: string): string | null {
  return UPLOAD_EXT_BY_MIME[String(mime || '').trim().toLowerCase()] ?? null
}

/** 32 lowercase hex characters, then one allow-listed extension. */
const ASSET_ID_RE = new RegExp(`^[0-9a-f]{32}\\.(?:${UPLOAD_EXTS.join('|')})$`)

function randomHex(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * `random` is injectable so a test can pin the id without stubbing `crypto`.
 * An unknown extension throws rather than producing an id that `isAssetId`
 * would then refuse to serve — a silent 404 is worse than a loud failure here.
 */
export function newAssetId(ext: string, random: () => string = randomHex): string {
  const clean = String(ext || '').trim().toLowerCase()
  if (!(UPLOAD_EXTS as readonly string[]).includes(clean)) {
    throw new Error(`unsupported asset extension: ${ext}`)
  }
  return `${random()}.${clean}`
}

export function isAssetId(value: unknown): boolean {
  return ASSET_ID_RE.test(String(value ?? ''))
}

/** The URL an uploaded asset is served from, built from the request origin. */
export function assetUrl(origin: string, id: string): string {
  return `${String(origin || '').replace(/\/+$/, '')}/api/storage/file/${id}`
}
