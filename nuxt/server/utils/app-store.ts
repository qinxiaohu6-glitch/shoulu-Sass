import type { AppPlatform, AppStoreInfo } from '../../shared/types/app-store.ts'

const APPLE_HOSTS = new Set(['apps.apple.com', 'itunes.apple.com'])
const GOOGLE_HOST = 'play.google.com'
const MAX_DESCRIPTION = 18_000
const MAX_STORES = 3
const MAX_JSON_BYTES = 80_000
const PLATFORM_SET = new Set<AppPlatform>(['ios', 'android', 'macos'])

export class AppStoreError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(code: string, statusCode = 400) {
    super(code)
    this.code = code
    this.statusCode = statusCode
  }
}

export type ParsedStoreUrl = {
  platform: AppPlatform
  appId: string
  storeUrl: string
  country: string
}

const cleanText = (value: unknown, max: number) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const URL_IN_TEXT = /https?:\/\/[^\s<>"'）)】\]]+/gi
/**
 * Store descriptions routinely end with the developer's own legal links
 * ("Privacy Policy: … Terms of Use: …"). The directory copy must not carry
 * links, so both the URL and the label it leaves behind are dropped here —
 * otherwise the submitter sees a description they cannot submit.
 */
const POLICY_LABEL =
  /(?:^|[\s·|•])(?:privacy\s+policy|privacy|terms\s+of\s+(?:use|service)|eula|end\s+user\s+license\s+agreement|隐私政策|隐私权政策|服务条款|用户协议|使用条款)\s*[:：]/gi

export function cleanStoreDescription(raw: unknown): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(URL_IN_TEXT, ' ')
    .replace(POLICY_LABEL, ' ')
}

function httpsUrl(value: unknown, base?: string): string {
  const raw = String(value ?? '').trim()
  if (!raw || raw.length > 1200 || /[\s<>]/.test(raw)) return ''
  try {
    const url = new URL(raw, base)
    return url.protocol === 'https:' ? url.toString().slice(0, 1200) : ''
  } catch {
    return ''
  }
}

export function parseAppStoreUrl(raw: unknown, requested?: unknown): ParsedStoreUrl {
  const text = String(raw ?? '').trim()
  if (!text || text.length > 1200 || /\s/.test(text)) throw new AppStoreError('invalid_store_url')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new AppStoreError('invalid_store_url')
  }
  if (url.protocol !== 'https:') throw new AppStoreError('invalid_store_url')
  const platformHint = String(requested ?? '').trim().toLowerCase()
  if (platformHint && !PLATFORM_SET.has(platformHint as AppPlatform)) throw new AppStoreError('invalid_platform')

  const host = url.hostname.toLowerCase()
  if (APPLE_HOSTS.has(host)) {
    const id = url.pathname.match(/(?:^|\/)id(\d+)(?:\/|$)/i)?.[1]
    if (!id) throw new AppStoreError('unsupported_store_url')
    if (platformHint === 'android') throw new AppStoreError('platform_mismatch')
    const country = url.pathname.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase() || 'us'
    const hinted = platformHint as AppPlatform | ''
    const platform = hinted === 'macos'
      ? 'macos'
      : /\/(?:mac|macos)(?:\/|$)/i.test(url.pathname)
        ? 'macos'
        : 'ios'
    const canonical = `https://apps.apple.com/${country}/app/id${id}`
    return { platform, appId: id, storeUrl: canonical, country }
  }

  if (host === GOOGLE_HOST && url.pathname === '/store/apps/details') {
    const appId = String(url.searchParams.get('id') ?? '').trim()
    if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(appId)) throw new AppStoreError('unsupported_store_url')
    if (platformHint && platformHint !== 'android') throw new AppStoreError('platform_mismatch')
    const canonical = new URL('https://play.google.com/store/apps/details')
    canonical.searchParams.set('id', appId)
    const hl = url.searchParams.get('hl')
    if (hl && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(hl)) canonical.searchParams.set('hl', hl)
    return { platform: 'android', appId, storeUrl: canonical.toString(), country: '' }
  }

  throw new AppStoreError('unsupported_store_url')
}

function blankInfo(parsed: ParsedStoreUrl): AppStoreInfo {
  return {
    platform: parsed.platform,
    appId: parsed.appId,
    storeUrl: parsed.storeUrl,
    name: '',
    developer: '',
    description: '',
    icon: '',
    screenshots: [],
    category: '',
    genres: [],
    version: '',
    updatedAt: '',
    releasedAt: '',
    priceLabel: '',
    rating: null,
    ratingCount: null,
    size: '',
    minimumOsVersion: '',
    ageRating: '',
  }
}

function listOfStrings(raw: unknown, maxItems = 16, maxLength = 240): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const out: string[] = []
  for (const value of values) {
    const text = cleanText(value, maxLength)
    if (text && !out.includes(text)) out.push(text)
    if (out.length >= maxItems) break
  }
  return out
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

function formatBytes(value: unknown): string {
  const bytes = numberOrNull(value)
  if (bytes === null || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = bytes
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit++
  }
  const precision = amount >= 100 || unit === 0 ? 0 : 1
  return `${amount.toFixed(precision)} ${units[unit]}`
}

function appleInfo(raw: Record<string, unknown>, parsed: ParsedStoreUrl): AppStoreInfo {
  const info = blankInfo(parsed)
  info.platform = parsed.platform
  info.name = cleanText(raw.trackName, 180)
  info.developer = cleanText(raw.artistName, 120)
  info.description = cleanText(cleanStoreDescription(raw.description), MAX_DESCRIPTION)
  info.icon = httpsUrl(raw.artworkUrl512 || raw.artworkUrl100 || raw.artworkUrl60)
  info.screenshots = listOfStrings(
    [...(Array.isArray(raw.screenshotUrls) ? raw.screenshotUrls : []), ...(Array.isArray(raw.ipadScreenshotUrls) ? raw.ipadScreenshotUrls : [])]
      .map((value) => httpsUrl(value))
      .filter(Boolean),
    12,
    1200,
  )
  info.category = cleanText(raw.primaryGenreName, 100)
  info.genres = listOfStrings(raw.genres, 12, 100)
  info.version = cleanText(raw.version, 80)
  info.updatedAt = cleanText(raw.currentVersionReleaseDate, 80)
  info.releasedAt = cleanText(raw.releaseDate, 80)
  const formatted = cleanText(raw.formattedPrice, 80)
  info.priceLabel = formatted || (numberOrNull(raw.price) === 0 ? 'Free' : '')
  info.rating = numberOrNull(raw.averageUserRating)
  info.ratingCount = numberOrNull(raw.userRatingCount)
  info.size = formatBytes(raw.fileSizeBytes)
  info.minimumOsVersion = cleanText(raw.minimumOsVersion, 80)
  info.ageRating = cleanText(raw.contentAdvisoryRating, 80)
  info.storeUrl = httpsUrl(raw.trackViewUrl) || parsed.storeUrl
  info.appId = String(raw.trackId ?? parsed.appId)
  return info
}

function extractMeta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const hit = html.match(pattern)
    if (hit?.[1]) return cleanText(hit[1], 20_000)
  }
  return ''
}

function jsonLdEntries(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>
      out.push(object)
      if (object['@graph']) visit(object['@graph'])
      if (object.mainEntity) visit(object.mainEntity)
    }
  }
  for (const match of scripts) {
    try {
      visit(JSON.parse(match[1] ?? ''))
    } catch {
      // A malformed JSON-LD block does not prevent metadata tag fallback.
    }
  }
  return out
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && cleanText(value, 20_000)) return cleanText(value, 20_000)
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>
      const text = cleanText(nested.name || nested.value || nested.price, 20_000)
      if (text) return text
    }
  }
  return ''
}

const GOOGLE_IMAGE_HOST = 'https://play-lh.googleusercontent.com/'

/**
 * Google Play renders its screenshot strip as `<div role="listitem">` cards
 * whose `<img src>` points at `play-lh.googleusercontent.com`. The page's
 * JSON-LD block carries no `screenshot` field at all, which is why the generic
 * reader returned zero images for every Android app. The app icon and the
 * reviewer avatars live outside that strip (and use `=s…` or very small
 * `=wN-hM` sizes), so requiring the list wrapper plus a screenshot-sized
 * `=wN-hM` suffix keeps them out. The suffix is then widened to `=w720` so the
 * gallery is not blurry on a retina screen.
 */
export function googleScreenshots(html: string, icon: string): string[] {
  const iconBase = icon.split('=')[0] ?? ''
  const out: string[] = []
  const add = (raw: string) => {
    const url = httpsUrl(raw, 'https://play.google.com/')
    if (!url) return
    const [base = '', suffix = ''] = url.split('=')
    if (!base.startsWith(GOOGLE_IMAGE_HOST) || !suffix) return
    const size = /^w(\d+)-h(\d+)$/.exec(suffix)
    if (!size) return
    if (Math.max(Number(size[1]), Number(size[2])) < 300) return
    if (base === iconBase) return
    const widened = `${base}=w720`
    if (!out.includes(widened)) out.push(widened)
  }
  for (const block of html.matchAll(/role="listitem"[\s\S]{0,600}?<img\b[^>]*\bsrc="([^"]+)"/g)) {
    add(block[1] ?? '')
  }
  if (out.length) return out.slice(0, 12)
  // Some markets ship the strip without the list wrapper, so fall back to the
  // alt text every screenshot card carries in the page language.
  const altFirst = /<img\b[^>]*\balt="(?:Screenshot|屏幕截图|スクリーンショット|스크린샷)[^"]*"[^>]*\bsrc="([^"]+)"/g
  for (const block of html.matchAll(altFirst)) add(block[1] ?? '')
  const srcFirst = /<img\b[^>]*\bsrc="([^"]+)"[^>]*\balt="(?:Screenshot|屏幕截图|スクリーンショット|스크린샷)[^"]*"/g
  for (const block of html.matchAll(srcFirst)) add(block[1] ?? '')
  return out.slice(0, 12)
}

function googleInfo(html: string, parsed: ParsedStoreUrl): AppStoreInfo {
  const info = blankInfo(parsed)
  const entries = jsonLdEntries(html)
  const app = entries.find((item) => {
    const type = item['@type']
    const types = Array.isArray(type) ? type : [type]
    return types.some((value) => /softwareapplication|mobileapplication/i.test(String(value)))
  }) || entries.find((item) => item.name && item.description) || {}
  const author = app.author && typeof app.author === 'object' ? app.author as Record<string, unknown> : {}
  const aggregate = app.aggregateRating && typeof app.aggregateRating === 'object'
    ? app.aggregateRating as Record<string, unknown>
    : {}
  const offer = app.offers && typeof app.offers === 'object' ? app.offers as Record<string, unknown> : {}

  info.name = firstText(app.name, extractMeta(html, 'og:title'), extractMeta(html, 'twitter:title'))
  info.developer = firstText(author.name, app.authorName)
  info.description = cleanText(
    cleanStoreDescription(
      firstText(app.description, extractMeta(html, 'og:description'), extractMeta(html, 'description')),
    ),
    MAX_DESCRIPTION,
  )
  info.icon = httpsUrl(firstText(app.image, extractMeta(html, 'og:image')), parsed.storeUrl)
  const playShots = googleScreenshots(html, info.icon)
  info.screenshots = playShots.length
    ? playShots
    : listOfStrings(
        [...listOfStrings(app.screenshot, 12, 1200), ...listOfStrings(app.image, 12, 1200)]
          .map((value) => httpsUrl(value, parsed.storeUrl))
          .filter(Boolean),
        12,
        1200,
      ).filter((value) => value !== info.icon)
  info.category = firstText(app.applicationCategory, app.applicationSubCategory)
  info.genres = listOfStrings(app.genre, 12, 100)
  info.version = firstText(app.softwareVersion)
  info.updatedAt = firstText(app.dateModified)
  info.releasedAt = firstText(app.datePublished)
  const price = firstText(offer.price)
  const currency = firstText(offer.priceCurrency)
  info.priceLabel = price ? `${currency ? `${currency} ` : ''}${price}` : ''
  info.rating = numberOrNull(aggregate.ratingValue)
  info.ratingCount = numberOrNull(aggregate.ratingCount ?? aggregate.reviewCount)
  info.size = firstText(app.fileSize)
  info.minimumOsVersion = firstText(app.operatingSystem)
  info.ageRating = firstText(app.contentRating)

  if (!info.name) info.name = extractMeta(html, 'og:title')
  if (!info.description) info.description = extractMeta(html, 'og:description')
  if (!info.icon) info.icon = httpsUrl(extractMeta(html, 'og:image'), parsed.storeUrl)
  return info
}

async function readLimited(response: Response, limit: number): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let bytes = 0
  while (bytes < limit) {
    const { done, value } = await reader.read()
    if (done || !value) break
    const remaining = limit - bytes
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value
    result += decoder.decode(chunk, { stream: value.byteLength <= remaining })
    bytes += chunk.byteLength
    if (value.byteLength > remaining) break
  }
  result += decoder.decode()
  void reader.cancel().catch(() => {})
  return result
}

/**
 * One attempt at a store URL: manual redirects, host allowlist, byte cap.
 * Kept separate so the retry below can wrap it without duplicating the rules.
 */
async function fetchStoreTextOnce(
  rawUrl: string,
  init: RequestInit,
  allowedHost: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<{ response: Response; text: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let current = new URL(rawUrl)
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (current.protocol !== 'https:' || current.hostname.toLowerCase() !== allowedHost) {
        throw new AppStoreError('store_unavailable', 502)
      }
      const response = await fetch(current.toString(), {
        ...init,
        signal: controller.signal,
        redirect: 'manual',
      })
      if (!response.ok) {
        // Kept as a log line because these are the failures a submitter reports
        // as "cannot reach the store" and the status is the only evidence.
        console.warn('[app-store] store answered', response.status, current.toString())
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel().catch(() => {})
        if (!location || redirects === 4) throw new AppStoreError('store_unavailable', 502)
        current = new URL(location, current)
        continue
      }
      const text = await readLimited(response, maxBytes)
      return { response, text }
    }
    throw new AppStoreError('store_unavailable', 502)
  } catch (error) {
    if (error instanceof AppStoreError) throw error
    console.warn('[app-store] fetch failed', current.toString(), String((error as Error)?.message ?? error))
    throw new AppStoreError(controller.signal.aborted ? 'store_timeout' : 'store_unavailable', 502)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * The stores drop connections and answer 403/429 from shared edge IPs often
 * enough that a single attempt turns into "cannot reach the store" for a
 * perfectly valid link — which is what submitters reported on 2026-11-26, twice
 * on links that worked seconds later. A fresh Worker isolate also pays for the
 * first TLS handshake to the store, and that first attempt is the one that
 * fails. Two retries (300ms, then 700ms) cover both cases while still failing
 * fast for a genuinely dead host. Timeouts and 404s are not retried: they would
 * only double the wait.
 */
async function fetchStoreText(
  rawUrl: string,
  init: RequestInit,
  allowedHost: string,
  maxBytes: number,
  timeoutMs = 7000,
): Promise<{ response: Response; text: string }> {
  const backoff = [300, 700]
  let lastResult: { response: Response; text: string } | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      const result = await fetchStoreTextOnce(rawUrl, init, allowedHost, maxBytes, timeoutMs)
      if (result.response.ok) return result
      lastResult = result
      const status = result.response.status
      const retryable = status >= 500 || status === 403 || status === 408 || status === 429
      if (!retryable) return result
    } catch (error) {
      lastError = error
      if (error instanceof AppStoreError && error.code === 'store_timeout') throw error
    }
    const wait = backoff[attempt]
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
  }
  if (lastResult) return lastResult
  throw lastError ?? new AppStoreError('store_unavailable', 502)
}

export async function lookupAppStore(rawUrl: unknown, requestedPlatform?: unknown): Promise<AppStoreInfo> {
  const parsed = parseAppStoreUrl(rawUrl, requestedPlatform)
  if (APPLE_HOSTS.has(new URL(parsed.storeUrl).hostname)) {
    const lookup = new URL('https://itunes.apple.com/lookup')
    lookup.searchParams.set('id', parsed.appId)
    lookup.searchParams.set('country', parsed.country)
    const { response, text } = await fetchStoreText(
      lookup.toString(),
      { headers: { accept: 'application/json', 'user-agent': 'ProductAtlasAppDirectory/1.0' } },
      'itunes.apple.com',
      1_500_000,
    )
    if (!response.ok) throw new AppStoreError('store_unavailable', 502)
    let data: { results?: Record<string, unknown>[] }
    try {
      data = JSON.parse(text) as { results?: Record<string, unknown>[] }
    } catch {
      throw new AppStoreError('metadata_unavailable', 502)
    }
    const result = data.results?.find((item) => String(item.trackId) === parsed.appId)
    if (!result) throw new AppStoreError('app_not_found', 404)
    const info = appleInfo(result, parsed)
    if (!info.name) throw new AppStoreError('metadata_unavailable', 502)
    return info
  }

  const { response, text: html } = await fetchStoreText(
    parsed.storeUrl,
    {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'user-agent': 'Mozilla/5.0 (compatible; ProductAtlasBot/1.0; +https://dirtool.com)',
      },
    },
    GOOGLE_HOST,
    1_500_000,
  )
  if (!response.ok) throw new AppStoreError('store_unavailable', 502)
  const info = googleInfo(html, parsed)
  if (!info.name) throw new AppStoreError('metadata_unavailable', 502)
  return info
}

function safeJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string' || raw.length > MAX_JSON_BYTES) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Revalidate imported metadata before it crosses the public database boundary. */
export function cleanAppStores(raw: unknown): AppStoreInfo[] {
  const entries = safeJsonArray(raw)
  if (!entries.length || entries.length > MAX_STORES) throw new AppStoreError('app_store_required')
  const out: AppStoreInfo[] = []
  const platforms = new Set<AppPlatform>()
  for (const value of entries) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    const parsed = parseAppStoreUrl(row.storeUrl, row.platform)
    if (parsed.platform !== row.platform || parsed.appId !== String(row.appId ?? parsed.appId)) {
      throw new AppStoreError('invalid_app_store_data')
    }
    if (platforms.has(parsed.platform)) throw new AppStoreError('duplicate_app_platform')
    platforms.add(parsed.platform)
    const rating = numberOrNull(row.rating)
    const ratingCount = numberOrNull(row.ratingCount)
    const info: AppStoreInfo = {
      platform: parsed.platform,
      appId: parsed.appId,
      storeUrl: parsed.storeUrl,
      name: cleanText(row.name, 180),
      developer: cleanText(row.developer, 120),
      description: cleanText(row.description, MAX_DESCRIPTION),
      icon: httpsUrl(row.icon),
      screenshots: listOfStrings(row.screenshots, 12, 1200).map((url) => httpsUrl(url)).filter(Boolean),
      category: cleanText(row.category, 100),
      genres: listOfStrings(row.genres, 12, 100),
      version: cleanText(row.version, 80),
      updatedAt: cleanText(row.updatedAt, 80),
      releasedAt: cleanText(row.releasedAt, 80),
      priceLabel: cleanText(row.priceLabel, 80),
      rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
      ratingCount: ratingCount !== null && ratingCount >= 0 ? Math.floor(ratingCount) : null,
      size: cleanText(row.size, 80),
      minimumOsVersion: cleanText(row.minimumOsVersion, 120),
      ageRating: cleanText(row.ageRating, 80),
    }
    if (!info.name) throw new AppStoreError('invalid_app_store_data')
    out.push(info)
  }
  if (!out.length) throw new AppStoreError('app_store_required')
  const bytes = new TextEncoder().encode(JSON.stringify(out)).byteLength
  if (bytes > MAX_JSON_BYTES) throw new AppStoreError('app_store_data_too_large')
  return out
}
