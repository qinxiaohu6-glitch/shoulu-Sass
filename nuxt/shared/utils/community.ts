/**
 * Batch 3 community routes and profile rules.
 *
 * v1 is profiles only. These helpers do not build a feed, a follow graph,
 * or a place to post. Counts are whatever the caller counted; nothing here
 * invents a headcount.
 */
import { englishCount } from './english-count.ts'

/** Future avatar uploads stop here. This batch does not add a media store. */
export const MAKER_AVATAR_MAX_BYTES = 512 * 1024

const MAKER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * `/makers` and `/makers/{slug}` moved under `/community`.
 * `.html` and a trailing slash are the same address. `/zh` is kept.
 * Returns null when the path is not an old maker URL.
 */
export function makerLegacyRedirect(pathname: string): string | null {
  const bare = pathname.replace(/\.html$/i, '').replace(/\/+$/, '') || '/'
  const zh = bare === '/zh' || bare.startsWith('/zh/')
  const rest = zh ? bare.slice(3) || '/' : bare
  const prefix = zh ? '/zh' : ''
  if (rest === '/makers') return `${prefix}/community/makers`
  const match = /^\/makers\/([^/]+)$/.exec(rest)
  if (!match) return null
  let slug = match[1] ?? ''
  try {
    slug = decodeURIComponent(slug)
  } catch {
    return null
  }
  if (!MAKER_SLUG.test(slug)) return null
  return `${prefix}/community/makers/${slug}`
}

/** Unique live products, and makers who have at least one of them. */
export function liveDirectoryCounts(
  rows: readonly { slug: string; makerSlug: string }[],
  hidden: readonly string[] = [],
): { makers: number; products: number } {
  const hiddenSet = new Set(hidden)
  const bySlug = new Map<string, string>()
  for (const row of rows) {
    if (!row.slug || hiddenSet.has(row.slug)) continue
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, row.makerSlug)
  }
  const makers = new Set([...bySlug.values()].filter((slug) => slug.length > 0))
  return { makers: makers.size, products: bySlug.size }
}

export function communityCountLine(makers: number, products: number): string {
  return `${makers} ${englishCount(makers, 'maker')} · ${products} ${englishCount(products, 'product')}`
}

export function communityCountLineZh(makers: number, products: number): string {
  return `${makers} 位创客 · ${products} 款产品`
}

export function makersDirectoryMeta(makers: number, products: number): string {
  return `${makers} ${englishCount(makers, 'maker')} behind ${products} ${englishCount(products, 'product')} in the dirtool directory.`
}

export function makersDirectoryMetaZh(makers: number, products: number): string {
  return `dirtool 目录里有 ${makers} 位创客，共 ${products} 款产品。`
}

/** `{Name} has {n} live product(s) on dirtool.` */
export function makerLiveIntro(name: string, count: number): string {
  return `${name} has ${count} live ${englishCount(count, 'product')} on dirtool.`
}

export function makerLiveIntroZh(name: string, count: number): string {
  return `${name} 在 dirtool 有 ${count} 款在架产品。`
}

/** `YYYY-MM-DD` from a catalogue date. Anything else is not a listing date. */
export function listingDate(value: string): string | null {
  const day = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/** Earliest live listing day. Callers must say what the date means. */
export function earliestListingDate(values: readonly string[]): string | null {
  const days = values.map(listingDate).filter((day): day is string => Boolean(day))
  days.sort()
  return days[0] ?? null
}

/** Empty and the placeholder "N/A" stay off the profile. */
export function visibleBio(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.toLowerCase() === 'n/a') return null
  return text
}

export function optionalHttpUrl(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim()
  if (!text || text.startsWith('data:')) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** An X or Twitter profile URL, or nothing. A product site is not an X account. */
export function optionalXUrl(value: string | null | undefined): string | null {
  const url = optionalHttpUrl(value)
  if (!url) return null
  const parsed = new URL(url)
  const host = parsed.hostname.replace(/^www\./, '')
  if (host !== 'x.com' && host !== 'twitter.com') return null
  const handle = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null
  return `https://x.com/${handle}`
}

/**
 * Use a real image URL when one exists. Data URLs are rejected so a profile
 * cannot embed a file larger than `MAKER_AVATAR_MAX_BYTES` by skipping upload.
 */
export function makerAvatarSrc(value: string | null | undefined): string | null {
  return optionalHttpUrl(value)
}

export type MakerPublicProfile = {
  name: string
  bio: string | null
  avatarUrl: string | null
  siteUrl: string | null
  xUrl: string | null
}

export function makerPublicProfile(input: {
  name: string
  bio?: string | null
  avatarUrl?: string | null
  siteUrl?: string | null
  xUrl?: string | null
}): MakerPublicProfile {
  return {
    name: input.name.trim(),
    bio: visibleBio(input.bio),
    avatarUrl: makerAvatarSrc(input.avatarUrl),
    siteUrl: optionalHttpUrl(input.siteUrl),
    xUrl: optionalXUrl(input.xUrl),
  }
}
