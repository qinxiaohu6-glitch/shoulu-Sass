/**
 * POST /api/fetch-meta — prefill the submit draft from a product URL.
 *
 * This is the one endpoint that makes an outbound request on a stranger's
 * behalf, so it is treated as an SSRF surface rather than a convenience:
 *
 *  * only http(s), only a public-looking hostname — `http://127.0.0.1/`,
 *    `http://169.254.169.254/` (cloud metadata) and `*.internal` are refused
 *    before a socket is opened;
 *  * a 5s timeout and a 256 KB read cap, because a page can be arbitrarily
 *    large or never finish;
 *  * the response body is parsed as text, never executed.
 *
 * DNS rebinding can still beat a hostname check in principle. On Cloudflare
 * Workers the egress path cannot reach private address space at all, which is
 * where this runs in production; the checks here are the belt to that braces.
 */

/** Hosts that must never be fetched, whatever the URL says. */
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain)$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isPrivateHost(host: string): boolean {
  if (PRIVATE_HOST.test(host)) return true

  const v4 = host.match(IPV4)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10) return true // 10/8
    if (a === 127) return true // loopback
    if (a === 0) return true
    if (a === 169 && b === 254) return true // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
    return false
  }

  // IPv6 literals arrive bracketed from `new URL()`.
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (bare === '::1' || bare === '::' || bare.startsWith('fe80:') || bare.startsWith('fc') || bare.startsWith('fd')) {
    return true
  }
  return false
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

function metaContent(html: string, key: string): string {
  // Both attribute orders appear in the wild; match either.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1])
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const raw = String((body as Record<string, unknown> | null)?.url ?? '').trim()

  if (!raw) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'empty_url' }
  }

  let target: URL
  try {
    target = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_url' }
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_url' }
  }
  if (isPrivateHost(target.hostname)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_url' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites serve a bare 403 to unknown agents.
        'user-agent': 'Mozilla/5.0 (compatible; ProductAtlasBot/1.0; +https://dirtool.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      setResponseStatus(event, 502)
      return { ok: false, error: 'upstream_error' }
    }

    // Read at most 256 KB: enough for <head>, and a bound on what one request
    // can cost us. Decoding as a stream avoids materialising a Blob just to
    // concatenate chunks.
    const reader = res.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let html = ''
    let size = 0
    if (reader) {
      while (size < 262_144) {
        const { done, value } = await reader.read()
        if (done || !value) break
        size += value.byteLength
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
      void reader.cancel().catch(() => {})
    }

    const titleTag = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? ''
    const name = collapse(
      metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || decodeEntities(titleTag),
    ).slice(0, 60)

    const short = collapse(
      metaContent(html, 'og:description') ||
        metaContent(html, 'description') ||
        metaContent(html, 'twitter:description'),
    ).slice(0, 200)

    // Icon: prefer the apple-touch-icon (usually a real 180px PNG), then the
    // first rel=icon, then /favicon.ico.
    const iconHref =
      html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i)?.[1] ||
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
      ''

    let logo = ''
    try {
      logo = iconHref ? new URL(decodeEntities(iconHref), target).toString() : new URL('/favicon.ico', target).toString()
    } catch {
      logo = ''
    }

    return { ok: true, name, short, logo }
  } catch (err) {
    // A timeout and a dead host look the same to the form: it falls back to
    // manual entry either way, so no need to distinguish.
    console.error('[fetch-meta]', target.hostname, err)
    setResponseStatus(event, 502)
    return { ok: false, error: 'fetch_failed' }
  } finally {
    clearTimeout(timer)
  }
})
