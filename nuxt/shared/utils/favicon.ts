/**
 * The parts of the favicon proxy that are worth testing on their own.
 *
 * The host arrives from a URL and is then fetched, so two questions decide
 * whether a request is allowed at all: is this a real public hostname, and are
 * the bytes that came back actually an image. Both are answered here rather
 * than inside the route so a test can ask them without a running server.
 */

/** A dotted hostname, lowercase, no port, no scheme, no trailing dot. */
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/** Suffixes that only ever resolve inside a private network. */
const BLOCKED_TLDS = new Set(['local', 'localhost', 'internal', 'intranet', 'arpa', 'test', 'invalid', 'example'])

export function isFetchableHost(host: string): boolean {
  const value = String(host ?? '').trim().toLowerCase()
  if (!HOST_RE.test(value)) return false
  // An IPv4 literal passes the shape test but is not a site.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false
  const tld = value.slice(value.lastIndexOf('.') + 1)
  return !BLOCKED_TLDS.has(tld)
}

/**
 * `image/webp` is `RIFF....WEBP`, so the four leading bytes alone would also
 * match a WAV file — hence the second check at offset 8.
 */
const MAGIC: ReadonlyArray<{ mime: string; bytes: number[]; alsoAt8?: string }> = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], alsoAt8: 'WEBP' },
  { mime: 'image/x-icon', bytes: [0x00, 0x00, 0x01, 0x00] },
  { mime: 'image/x-icon', bytes: [0x00, 0x00, 0x02, 0x00] },
]

/**
 * The image type the bytes actually are, or '' when they are not an image.
 *
 * A missing favicon is very often answered with a 200 and an HTML error page,
 * so the declared content type cannot be trusted on its own.
 */
export function sniffImageType(bytes: Uint8Array): string {
  for (const entry of MAGIC) {
    if (!entry.bytes.every((byte, index) => bytes[index] === byte)) continue
    if (entry.alsoAt8) {
      const tag = String.fromCharCode(...bytes.slice(8, 12))
      if (tag !== entry.alsoAt8) continue
    }
    return entry.mime
  }
  return ''
}

/** Where to look, best first. */
export function faviconSourcesFor(host: string): string[] {
  return [
    // 128px covers a retina 44px slot and comes back as PNG.
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://${host}/favicon.ico`,
  ]
}

/**
 * The storage id for one host: stable, so the second visitor is a cache hit.
 * The extension is part of an asset id, not of how it is served — the content
 * type always comes from the stored row.
 */
export async function faviconCacheKey(host: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`favicon:v1:${host}`))
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 32)}.png`
}
