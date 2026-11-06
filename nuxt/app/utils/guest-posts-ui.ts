/**
 * Guest-post vocabulary shared by the admin review page: the source's
 * `hooks/use-guest-posts.ts` (types, display helpers) plus
 * `lib/guest-post-rules.ts` (link and word counting).
 *
 * `countExternalLinks` and `countWords` are copied verbatim — the reviewer's
 * live hints and the server's checks have to agree, so the rules are the same
 * arithmetic, not a re-derivation.
 */
import MarkdownIt from 'markdown-it'

export type GuestPostStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'published'
  | 'rejected'
  | 'unpublished'

export interface GuestPostPackage {
  productId: string
  planName: string
  description: string
  priceInCents: number
  currency: string
  cnyPriceInCents: number | null
  maxLinks: number
}

export interface GuestPostInfo {
  enabled: boolean
  minWords: number
  packages: GuestPostPackage[]
}

export interface GuestPostRow {
  id: string
  postId: string
  productId: string
  status: GuestPostStatus
  reviewNote: string | null
  orderNo: string | null
  submittedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  title: string | null
  slug: string | null
  userId?: string
  userName?: string | null
  userEmail?: string | null
  userAvatar?: string | null
}

/** Source `-guest-posts-review-editor.tsx` — the editable half of a review. */
export interface ReviewDraft {
  title: string
  slug: string
  description: string
  image: string
  content: string
}

export const GUEST_POSTS_PAGE_SIZE = 20

/** "All" leads, like the other admin tabs. */
export const GUEST_POST_TABS = [
  'all',
  'submitted',
  'published',
  'changes_requested',
  'rejected',
  'unpublished',
] as const
export type GuestPostTab = (typeof GUEST_POST_TABS)[number]

const BADGE: Record<GuestPostStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  changes_requested: 'outline',
  published: 'default',
  rejected: 'destructive',
  unpublished: 'outline',
}

export function guestPostStatusVariant(status: string) {
  return BADGE[status as GuestPostStatus] ?? 'outline'
}

/** States where the reviewer's note explains what happened. */
export const NOTE_STATUSES: GuestPostStatus[] = ['changes_requested', 'rejected', 'unpublished']

export function noteExplains(status: string, note: string | null | undefined) {
  return !!note && NOTE_STATUSES.includes(status as GuestPostStatus)
}

const linkParser = new MarkdownIt({ html: false, linkify: true })

/**
 * External (http/https) links in a markdown body, including bare URLs that
 * linkify turns into links. A link whose text is its own URL counts once;
 * images and code don't count.
 */
export function extractExternalLinks(markdown: string): string[] {
  const links: string[] = []
  for (const block of linkParser.parse(markdown || '', {})) {
    for (const token of block.children ?? []) {
      if (token.type !== 'link_open') continue
      // markdown-it v15 types `attrGet` as `string | number | null`.
      const href = String(token.attrGet('href') ?? '')
      if (/^https?:\/\//i.test(href)) links.push(href)
    }
  }
  return links
}

/** Words for Latin text plus one per CJK character. */
export function countWords(markdown: string): number {
  const text = (markdown || '').replace(/[#>*_`~\-[\]()!|]/g, ' ')
  const cjk = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0
  const latin =
    text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  return cjk + latin
}

export function countExternalLinks(markdown: string): number {
  return extractExternalLinks(markdown).length
}

/** The source formats through the active locale; `useLang()` is the same idea. */
export function formatPrice(cents: number, currency: string, locale = 'en') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

/** "Standard · $99.00" for a package id, from the public package list. */
export function packageLabel(productId: string, packages: GuestPostPackage[] | undefined) {
  const pkg = packages?.find((p) => p.productId === productId)
  return pkg ? `${pkg.planName} · ${formatPrice(pkg.priceInCents, pkg.currency)}` : productId
}

/** Same normalization as the server; validation happens there. */
export function tidySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
