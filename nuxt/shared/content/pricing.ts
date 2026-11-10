import { centsLabel } from './campaign.ts'
import { billboardStandardCents } from './billboard.ts'
import { BILLBOARD_FLOOR_CENTS } from '../utils/billboard-bid.ts'

const billboardFloorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)

/**
 * Pricing copy, ported verbatim from the site that is live today
 * (dist/pricing.html and dist/zh/pricing.html) so the rebuild does not
 * silently reword an offer.
 *
 * Every user-visible string is a `{ en, zh }` pair. When you change a price
 * here, change it in `comparison` too — the table is rendered from the same
 * tier order, and a stale row is the easiest way to mislead a buyer.
 */

export type Pair = { en: string; zh: string }
export type PairList = { en: string[]; zh: string[] }

export interface PriceTier {
  id: string
  name: Pair
  tagline: Pair
  price: string
  /** The same number as `price`, in minor units — see `planAmountCents`. */
  amountCents: number
  /**
   * Previous list price, struck through while launch pricing is on.
   * Checkout ignores this. It is not a percentage off the live price.
   */
  anchorCents?: number
  unit: Pair
  features: PairList
  cta: Pair
  badge?: Pair
}

export const tiers: PriceTier[] = [
  {
    id: 'free',
    name: { en: 'Free', zh: '免费' },
    tagline: {
      en: 'Get listed. Keep the page.',
      zh: '先上线。页面留下。',
    },
    price: '$0',
    amountCents: 0,
    unit: { en: 'forever', zh: '永远' },
    features: {
      en: [
        'Manual review, usually 7–14 days',
        'Permanent page',
        'Nofollow link',
        'Weekly board eligible',
      ],
      zh: [
        '人工审核，通常 7–14 天',
        '永久产品页',
        'nofollow 链接',
        '可参与每周榜',
      ],
    },
    cta: { en: 'Submit free', zh: '免费提交' },
  },
  {
    id: 'standard',
    name: { en: 'Standard', zh: '标准' },
    tagline: {
      en: 'Skip the wait. Get a dofollow link.',
      zh: '跳过等待。获得 dofollow 链接。',
    },
    price: '$9',
    amountCents: 900,
    anchorCents: 1900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: ['Live on payment', 'Permanent dofollow', 'Listed above free', 'Weekly board eligible'],
      zh: ['付款即上线', '永久 dofollow', '排在免费收录之前', '可参与每周榜'],
    },
    cta: { en: 'Request invoice · Standard', zh: '索取发票 · 标准' },
  },
  {
    id: 'featured',
    name: { en: 'Featured', zh: '精选' },
    tagline: {
      en: 'Skip the queue — and take the pin.',
      zh: '跳过排队，并拿到置顶。',
    },
    price: '$19',
    amountCents: 1900,
    anchorCents: 3900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Standard',
        'Directory + category pin, 7 days',
        'Homepage card slot',
        'Then returns to Standard order',
      ],
      zh: ['包含标准档全部权益', '目录与分类置顶 7 天', '首页卡片位', '之后回到标准档排序'],
    },
    cta: { en: 'Request invoice · Featured', zh: '索取发票 · 精选' },
    badge: { en: 'Most picked', zh: '最多人选' },
  },
  {
    id: 'pro',
    name: { en: 'Pro', zh: '专业' },
    tagline: {
      en: 'Hold the category pin longer.',
      zh: '分类置顶留得更久。',
    },
    price: '$29',
    amountCents: 2900,
    anchorCents: 6900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Featured',
        'Category pin, 90 days',
        '4 copy edits / year',
        'Priority replies when email is on',
      ],
      zh: ['包含精选档全部权益', '分类置顶 90 天', '全年 4 次文案修改', '邮件开通后优先回复'],
    },
    cta: { en: 'Request invoice · Pro', zh: '索取发票 · 专业' },
  },
]

export interface AdPlan {
  id: 'sidebar'
  name: Pair
  price: string
  unit: Pair
  where: Pair
  pitch: Pair
  bullets: PairList
  bundle: Pair
  /**
   * The same numbers as `price` / `bundle`, in minor units. Checkout reads
   * these on the server; the strings above are for rendering only. Keeping
   * both on the same object is what stops a copy edit from quietly changing
   * the price without changing the charge.
   */
  weeklyCents: number
  /** Previous weekly list price. Struck through in the UI only. */
  anchorWeeklyCents?: number
  bundleWeeks: number
  bundleCents: number
}

/** The only two purchase lengths the pricing page advertises. */
export const AD_WEEK_OPTIONS = [1, 4] as const

export const adPlans: AdPlan[] = [
  {
    id: 'sidebar',
    name: { en: 'Sidebar slot', zh: '右栏位' },
    price: '$9',
    weeklyCents: 900,
    anchorWeeklyCents: 1900,
    bundleWeeks: 4,
    bundleCents: 3200,
    unit: { en: '/ week', zh: '/ 周' },
    where: {
      en: 'The rail on the homepage and the just-added feed',
      zh: '首页与「最新收录」页的右栏',
    },
    pitch: {
      en: 'The rail does not scroll away — it stays in view for the whole visit on both pages.',
      zh: '右栏不随页面滚走 —— 访客在这两页停留的整段时间里一直看到它。',
    },
    bullets: {
      en: [
        'Top of the rail on the homepage and the just-added feed',
        'A card with your logo and one line',
        'Seven days, starting Monday',
      ],
      zh: ['首页 + 最新收录页的右栏顶部', '卡片形态，含 logo 与一句话', '展示 7 天，周一起算'],
    },
    bundle: { en: '4 weeks $32 — save $4', zh: '连投 4 周 $32 · 省 $4' },
  },
]

/**
 * Rows are aligned to `tiers` order: free, standard, featured, pro.
 * The price row is rendered from `effectiveQuote` on /pricing so the table
 * shows the amount charged, not a second list of numbers.
 */
export const comparison: { label: Pair; values: Pair[] }[] = [
  {
    label: { en: 'Go live', zh: '上线' },
    values: [
      { en: 'Usually 7–14 days', zh: '通常 7–14 天' },
      { en: 'On payment', zh: '付款即上线' },
      { en: 'On payment', zh: '付款即上线' },
      { en: 'On payment', zh: '付款即上线' },
    ],
  },
  {
    label: { en: 'Link', zh: '链接' },
    values: [
      { en: 'Nofollow', zh: 'nofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
    ],
  },
  {
    label: { en: 'Pin', zh: '置顶' },
    values: [
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: '7 days', zh: '7 天' },
      { en: '90 days', zh: '90 天' },
    ],
  },
  {
    label: { en: 'Homepage', zh: '首页' },
    values: [
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: 'Card slot', zh: '卡片位' },
      { en: 'Card slot', zh: '卡片位' },
    ],
  },
]

/**
 * Billboard lines for /pricing only. The Billboard page and `billboard.ts`
 * keep their own copy until that page is revised separately.
 */
export const pricingBillboardBlurb: Record<string, Pair> = {
  entry: {
    en: 'One-time payment. Live the second you pay — including homepage Top 10.',
    zh: '一次付清。付款即上线；含首页 Top 10 展示。',
  },
  standard: {
    en: 'One-time payment. Ranks above Entry. Live the second you pay.',
    zh: '一次付清。排序高于入门档；付款即上线。',
  },
  prime: {
    en: 'One-time payment. Top priority on the paid board. Live the second you pay.',
    zh: '一次付清。付费板最高优先级；付款即上线。',
  },
}

export const pricingBillboardChecks: Pair[] = [
  { en: `Name your price, from ${billboardFloorLabel}`, zh: `自己出价，从 ${billboardFloorLabel} 起` },
  { en: 'Top 10 on the homepage', zh: '前 10 名出现在首页' },
  { en: 'One-time payment', zh: '一次付清' },
  { en: 'Pay again and the amount stacks', zh: '再付一次，金额累加' },
  { en: 'Outbid drops rank only', zh: '被超过只掉名次' },
]

export const pricingFaq: { q: Pair; a: Pair }[] = [
  {
    q: { en: 'Is anything a subscription?', zh: '有订阅吗？' },
    a: {
      en: 'No. Listings and Billboard are one-time. Sidebar is weekly rental only.',
      zh: '没有。收录与 Billboard 都是一次付清。右栏只按周租。',
    },
  },
  {
    q: { en: 'Free vs paid — what changes?', zh: '免费和付费差在哪？' },
    a: {
      en: 'Wait time, the link attribute (nofollow or permanent dofollow), and optional pins.',
      zh: '等待时间、链接属性（nofollow 或永久 dofollow），以及可选置顶。',
    },
  },
  {
    q: { en: 'How fast do I go live?', zh: '多久上线？' },
    a: {
      en: 'Paid listings go live on payment, or when an invoice is confirmed. Free listings are usually reviewed in 7–14 days.',
      zh: '付费收录在付款成功或发票确认后上线。免费收录通常 7–14 天完成审核。',
    },
  },
  {
    q: { en: 'Do you guarantee rankings or DR?', zh: '承诺排名或 DR 吗？' },
    a: {
      en: 'No. We sell on-site placement and the stated link attribute — not search results.',
      zh: '不承诺。出售的是站内展示和写明的链接属性，不是搜索结果。',
    },
  },
  {
    q: { en: 'Billboard vs the weekly board?', zh: 'Billboard 和每周榜有何不同？' },
    a: {
      en: 'Billboard is paid placement. The weekly board is vote-ranked. They are separate.',
      zh: 'Billboard 是付费展示。每周榜按投票排名。两者分开。',
    },
  },
  {
    q: { en: 'Can I get a refund?', zh: '可以退款吗？' },
    a: {
      en: 'Full refund before go-live. After it is live, no refund — the backlink is already public.',
      zh: '上线前可全额退款。上线后不退，因为反链已经公开。',
    },
  },
]

/**
 * The four lines that used to sit on the homepage under "What you get when
 * you list". They describe the listing; they are not a placement for sale,
 * so they live on the pricing page instead of the homepage grid.
 */
export const listingBenefits: { title: Pair; body: Pair }[] = [
  {
    title: { en: 'A dofollow link when you pay', zh: '付费即得 dofollow 反链' },
    body: {
      en: 'Dofollow on paid listings, nofollow on free ones — either way the page stays online.',
      zh: '付费收录给 dofollow 外链，免费收录是 nofollow —— 页面照样永久保留。',
    },
  },
  {
    title: { en: 'Readable by AI search', zh: 'AI 搜索读得懂' },
    body: {
      en: 'Every listing ships structured data and a plain-markdown copy, so ChatGPT and Perplexity can cite you.',
      zh: '每个收录都带结构化数据和纯文本版本，ChatGPT、Perplexity 这类 AI 搜索可以直接引用你。',
    },
  },
  {
    title: { en: 'A weekly shot at the top', zh: '每周一次冲榜机会' },
    body: {
      en: 'The board resets every Monday. The top three are highlighted on the home board and sit at the top of the weekly page — everyone starts level again each week.',
      zh: '榜单每周一重置。前三名在首页榜单里高亮，也排在周榜页最前 —— 每周重新开始，谁都有机会。',
    },
  },
  {
    title: { en: 'Submitted in 30 seconds', zh: '30 秒完成提交' },
    body: {
      en: 'Paste your URL, we prefill the listing, you confirm. No blank form to fill from scratch.',
      zh: '粘贴产品链接，我们自动填好资料，你只需确认。不用从空白表单开始。',
    },
  },
]

/* -------------------------------------------------------------------------
   what a plan costs, in minor units

   Two spellings reach this function and both have to land on the same number:
   the submit form posts `paid` (the pricing page's word for that column) while
   the catalogue calls the same tier `featured`. A legacy `plan: 'ad'` is the
   old board charge, now Billboard Standard — same $29, one-time, not a week.

   Checkout reads the amount from here, never from the request body — a client
   that can name its own price is not a price.
------------------------------------------------------------------------- */

const PLAN_ALIASES: Record<string, string> = { paid: 'featured' }

export function planAmountCents(plan: string): number {
  const slug = PLAN_ALIASES[plan] ?? plan
  // Legacy `ad` had no slot. It was one week of the board at $29. That product
  // is now Billboard Standard, still $29, and no longer a weekly rental.
  // Self-serve sidebar bookings do not go through this function.
  if (slug === 'ad') return billboardStandardCents()
  const tier = tiers.find((t) => t.id === slug)
  return tier ? tier.amountCents : 0
}

/**
 * What a weekly placement costs, in minor units.
 *
 * Returns 0 for anything the pricing page does not sell — an unknown slot,
 * three weeks, a negative number. `0` means "nothing to pay", and the checkout
 * route turns that into a 409 instead of opening a session. The client sends
 * `slot` and `weeks`, never an amount; this is the only place that decides it.
 */
export function adPriceCents(slot: string, weeks: number): number {
  // The weekly board slot is retired. A zero price makes checkout refuse the
  // charge instead of opening a session for a product we no longer sell.
  if (slot === 'board') return 0
  if (!Number.isInteger(weeks) || !(AD_WEEK_OPTIONS as readonly number[]).includes(weeks)) return 0
  const plan = adPlans.find((a) => a.id === slot)
  if (!plan) return 0
  return weeks === plan.bundleWeeks ? plan.bundleCents : plan.weeklyCents * weeks
}

/** Display string for a computed charge, e.g. 9900 → "$99.00". */
export function formatAdPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
