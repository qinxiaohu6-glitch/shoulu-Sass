/**
 * One rule for a product screenshot src.
 *
 * Catalogue rows store a bare filename (`shot.png`) that lives under
 * `public/assets/img/screenshots`. Submissions and Billboard rows may store
 * an absolute http(s) URL instead (an operator cannot ship a new asset for
 * every listing). Prefixing the absolute URL with `/` is what made images
 * 404 against our own host. A bare filename prefixed with only `/` 404s too.
 *
 * Anything else — empty, `javascript:`, `data:`, a path that climbs out of
 * the screenshots directory — is not an image. Callers render the name
 * fallback rather than a broken picture.
 */

const BARE = /^[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif)$/i
const LOCAL = /^\/assets\/img\/screenshots\/([a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif))$/i

export function screenshotSrc(value: string): string {
  const v = String(value ?? '').trim()
  if (!v || v.length > 2000 || /\s/.test(v) || v.includes('..')) return ''
  if (/^https?:\/\//i.test(v)) {
    try {
      const url = new URL(v)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
      if (!url.hostname) return ''
      return url.toString()
    } catch {
      return ''
    }
  }
  const local = v.match(LOCAL)
  if (local && BARE.test(local[1] ?? '')) return v
  if (BARE.test(v)) return `/assets/img/screenshots/${v}`
  return ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function metaContent(html: string, key: string): string {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, 'i'),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match?.[1]) return decodeEntities(match[1])
  }
  return ''
}

/** Absolute http(s) image URL, or ''. Relative og:image values resolve against `base`. */
export function absoluteHttpUrl(raw: string, base: string): string {
  const value = raw.trim()
  if (!value || value.length > 2000) return ''
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (!url.hostname) return ''
    return url.toString()
  } catch {
    return ''
  }
}

/**
 * Homepage social image. `og:image` first, then `twitter:image`.
 * This is the picture a Billboard card shows when nobody uploaded a shot.
 */
export function ogImageFromHtml(html: string, base: string): string {
  for (const key of ['og:image', 'twitter:image']) {
    const content = metaContent(html, key)
    if (!content) continue
    const abs = absoluteHttpUrl(content, base)
    if (abs) return abs
  }
  return ''
}

/**
 * Which image a Billboard card may paint.
 *
 * A real stored screenshot wins. Otherwise the first usable gallery shot for
 * the same website. Otherwise the homepage `og:image`. Empty means the card
 * keeps the name fallback — we do not invent a picture.
 */
export function pickBillboardShot(
  stored: string,
  directoryShots: readonly string[],
  remote = '',
): string {
  const own = screenshotSrc(stored)
  if (own) return own
  for (const shot of directoryShots) {
    const src = screenshotSrc(shot)
    if (src) return src
  }
  return screenshotSrc(remote)
}
