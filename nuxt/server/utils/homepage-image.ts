/**
 * Read a product homepage's social image.
 *
 * Billboard checkout never asked for a screenshot, so a paid row can be live
 * with `screenshot = ''` even when the site publishes `og:image`. This fetch
 * is the backfill. It is bounded: public http(s) only, a few seconds, and
 * only the first 256 KB — enough for `<head>`.
 */

import { ogImageFromHtml } from '~~/shared/utils/screenshot'

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain)$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function isPrivateHost(host: string): boolean {
  if (PRIVATE_HOST.test(host)) return true
  const v4 = host.match(IPV4)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (bare === '::1' || bare === '::' || bare.startsWith('fe80:') || bare.startsWith('fc') || bare.startsWith('fd')) {
    return true
  }
  return false
}

export async function discoverHomepageImage(pageUrl: string, timeoutMs = 4000): Promise<string> {
  let target: URL
  try {
    target = new URL(pageUrl)
  } catch {
    return ''
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return ''
  if (isPrivateHost(target.hostname)) return ''

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ProductAtlasBot/1.0; +https://dirtool.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return ''
    let finalHost = ''
    try {
      finalHost = new URL(res.url || target.toString()).hostname
    } catch {
      finalHost = target.hostname
    }
    if (isPrivateHost(finalHost)) return ''

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
        if (html.includes('</head>')) break
      }
      html += decoder.decode()
      void reader.cancel().catch(() => {})
    }
    return ogImageFromHtml(html, res.url || target.toString())
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}
