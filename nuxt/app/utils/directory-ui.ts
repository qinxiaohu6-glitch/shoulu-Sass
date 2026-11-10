import type { LocalizedTool } from '~~/shared/types/catalog'
import type { DirectoryCopyKey } from '~/utils/directory-copy'

/**
 * The constants the ported directory pages share.
 *
 * Everything here is a transcription of a source file, kept in one place because
 * five pages need the same numbers and the same tier table:
 *
 *   DIRECTORY_PAGE_SIZE   `routes/tools/index.tsx` → `pageSize: 24`
 *   SORT_VALUES           the `z.enum` in the same file
 *   SUBMIT_TIERS          `lib/directory/submit-sponsor-config.ts`
 *   SUBMIT_STEP_KEYS      same file
 *   SUBMIT_FAQ_ITEMS      same file, including the `{price}` / `{days}` / `{max}`
 *                         params each answer interpolates
 *
 * Sorting lives here too, because the four orders are the source's and each page
 * only chooses one — `getDirectoryToolsFn({ sort })` on the server side, inlined
 * here since this build assembles its list in the page.
 */

/**
 * `pageSize: 24` in the source's tools loader.
 *
 * Named with the `DIRECTORY_` prefix because `tickets-ui.ts` already exports a
 * `PAGE_SIZE` (20) and Nuxt's auto-import resolver silently keeps one of them —
 * the tickets one won, which would have paged these listings at 20.
 */
export const DIRECTORY_PAGE_SIZE = 24

/** One tab in the detail page's sticky section nav (`SectionTabItem`). */
export interface SectionTabItem {
  id: string
  label: string
}

/** `pricing-table.tsx` — one card. */
export interface PricingPlan {
  id: string
  name: string
  description?: string
  price: string
  originalPrice?: string
  interval?: string
  featured?: boolean
  badge?: string
  /** Small promo line above the price, e.g. a campaign label. */
  kicker?: string
  features: string[]
  buttonText?: string
}

/** `pricing-table.tsx` — a row of plans behind one tab. */
export interface PricingGroup {
  key: string
  label: string
  plans: PricingPlan[]
}

export type DirectorySortValue = 'recommended' | 'popular' | 'latest' | 'name'

export const SORT_VALUES: DirectorySortValue[] = ['recommended', 'popular', 'latest', 'name']

/** `?sort=` is only meaningful when it is one of the four, and not the default. */
export function parseSort(raw: unknown): DirectorySortValue {
  const value = String(raw ?? '')
  return (SORT_VALUES as string[]).includes(value) && value !== 'recommended'
    ? (value as DirectorySortValue)
    : 'recommended'
}

/** `?page=` — anything below 2 is the default and stays out of the URL. */
export function parsePage(raw: unknown): number {
  const value = Number(raw)
  return Number.isInteger(value) && value > 1 ? value : 1
}

/**
 * The source's four orders.
 *
 * `recommended` is whatever the caller passed in — on this build that is
 * `orderedTools()`, i.e. paid → featured → catalogue order, which is what the
 * source's service returns for `sort: 'recommended'`.
 */
export function sortTools(
  list: LocalizedTool[],
  sort: DirectorySortValue,
  locale: 'en' | 'zh',
): LocalizedTool[] {
  if (sort === 'recommended') return list
  const copy = [...list]
  if (sort === 'popular') return copy.sort((a, b) => b.votes_week - a.votes_week)
  if (sort === 'latest') return copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return copy.sort((a, b) => a.name.localeCompare(b.name, locale === 'zh' ? 'zh' : 'en'))
}

/** `slice` for the current page, 1-based. */
export function pageSlice<T>(list: T[], page: number): T[] {
  const start = (Math.max(1, page) - 1) * DIRECTORY_PAGE_SIZE
  return list.slice(start, start + DIRECTORY_PAGE_SIZE)
}

export interface SubmitTier {
  id: string
  nameKey: DirectoryCopyKey
  price: string
  priceInCents: number
  featuredDays: number
  featureKeys: DirectoryCopyKey[]
  recommended?: boolean
}

/** Source-shaped tiers. Checkout does not read this table; `/submit` uses `tiers`. */
export const SUBMIT_TIERS: SubmitTier[] = [
  {
    id: 'free',
    nameKey: 'dir.submit.plan_standard',
    price: 'Free',
    priceInCents: 0,
    featuredDays: 0,
    featureKeys: ['dir.submit.plan_free_f1', 'dir.submit.plan_free_f2'],
  },
  {
    id: 'premium',
    nameKey: 'dir.submit.plan_premium',
    price: '$19',
    priceInCents: 1900,
    featuredDays: 30,
    featureKeys: [
      'dir.submit.plan_premium_f1',
      'dir.submit.plan_premium_f2',
      'dir.submit.plan_premium_f3',
    ],
    recommended: true,
  },
]

export const SUBMIT_STEP_KEYS: DirectoryCopyKey[] = [
  'dir.submit.step_1',
  'dir.submit.step_2',
  'dir.submit.step_3',
]

export interface SubmitFaqItem {
  questionKey: DirectoryCopyKey
  answerKey: DirectoryCopyKey
  params?: Record<string, string | number>
}

export const SUBMIT_FAQ_ITEMS: SubmitFaqItem[] = [
  { questionKey: 'dir.submit.faq_q1', answerKey: 'dir.submit.faq_a1' },
  {
    questionKey: 'dir.submit.faq_q2',
    answerKey: 'dir.submit.faq_a2',
    params: { price: '$19', days: 30 },
  },
  { questionKey: 'dir.submit.faq_q3', answerKey: 'dir.submit.faq_a3' },
  { questionKey: 'dir.submit.faq_q4', answerKey: 'dir.submit.faq_a4' },
  { questionKey: 'dir.submit.faq_q5', answerKey: 'dir.submit.faq_a5' },
  { questionKey: 'dir.submit.faq_q6', answerKey: 'dir.submit.faq_a6' },
  {
    questionKey: 'dir.submit.faq_q7',
    answerKey: 'dir.submit.faq_a7',
    params: { max: 10 },
  },
]

/** `payment-provider-modal.tsx` — the seven the source knows about. */
export type PaymentProvider =
  | 'stripe'
  | 'creem'
  | 'waffo'
  | 'dodo'
  | 'paypal'
  | 'alipay'
  | 'wechat'

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo Pancake',
  dodo: 'Dodo Payments',
  paypal: 'PayPal',
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
}

/**
 * The source's `withDirectoryUtm()` from `lib/directory/structured-data.ts`.
 *
 * Every "Visit website" link leaves with a referral tag, which is what the
 * submit FAQ promises the submitter ("you can see the traffic we send in your
 * analytics"). The source hardcodes `utm_source=shipany-dir`; this build uses the
 * site's own name, `dirtool`, which is the same relationship the source has
 * between its project slug and its brand.
 *
 * A URL that will not parse is returned untouched — the source's `catch` branch,
 * and the only safe answer for a stored string.
 */
export function withDirectoryUtm(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'dirtool')
      parsed.searchParams.set('utm_medium', 'referral')
      parsed.searchParams.set('utm_campaign', 'directory')
    }
    return parsed.toString()
  } catch {
    return url
  }
}
