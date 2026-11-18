import { billboardStandardCents } from './billboard.ts'

/**
 * Canonical pricing table. One name and one regular price per SKU:
 * Free, Boost, Standard, Featured, Pro, Billboard and the right sidebar.
 * `saleCents` / `saleWeeklyCents` / `saleBundleCents` are the launch prices
 * charged only while the campaign clock is open; after it ends the regular
 * price returns automatically. Checkout reads the server functions below,
 * never a request-body amount.
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
  /** Regular list price, before any campaign discount. */
  price: string
  /** Regular list price in minor units. */
  amountCents: number
  /**
   * Campaign price in minor units. Charged only while the campaign clock is
   * open; after it ends the regular `amountCents` is charged again.
   */
  saleCents?: number
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
        'Reviewed by hand',
        'Permanent page',
        'Nofollow link',
        'Weekly board eligible',
      ],
      zh: [
        '人工审核',
        '永久产品页',
        'nofollow 链接',
        '可参与每周榜',
      ],
    },
    cta: { en: 'Submit free', zh: '免费提交' },
  },
  {
    id: 'boost',
    name: { en: 'Boost', zh: '加速' },
    tagline: {
      en: 'Verified badge and a gold row. No extra steps.',
      zh: '金色认证和高亮行。无需额外步骤。',
    },
    price: '$10',
    amountCents: 1000,
    saleCents: 499,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Free launch',
        'Gold verified badge',
        'Highlighted gold row on the board',
        'Always dofollow backlink',
      ],
      zh: [
        '包含免费收录全部权益',
        '金色认证徽章',
        '榜单金色高亮行',
        '永久 dofollow 反链',
      ],
    },
    cta: { en: 'Boost', zh: '加速' },
    badge: { en: 'Most popular', zh: '最多人选' },
  },
  {
    id: 'standard',
    name: { en: 'Standard', zh: '标准' },
    tagline: {
      en: 'Skip the wait. Get a dofollow link.',
      zh: '跳过等待。获得 dofollow 链接。',
    },
    price: '$19',
    amountCents: 1900,
    saleCents: 900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: ['When payment succeeds', 'Permanent dofollow', 'Listed above free', 'Weekly board eligible'],
      zh: ['付款成功后上线', '永久 dofollow', '排在免费收录之前', '可参与每周榜'],
    },
    cta: { en: 'Standard', zh: '标准' },
  },
  {
    id: 'featured',
    name: { en: 'Featured', zh: '精选' },
    tagline: {
      en: 'Skip the queue — and take the pin.',
      zh: '跳过排队，并拿到置顶。',
    },
    price: '$39',
    amountCents: 3900,
    saleCents: 1900,
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
    cta: { en: 'Featured', zh: '精选' },
    badge: { en: 'Most picked', zh: '最多人选' },
  },
  {
    id: 'pro',
    name: { en: 'Pro', zh: '专业' },
    tagline: {
      en: 'Hold the category pin longer.',
      zh: '分类置顶留得更久。',
    },
    price: '$69',
    amountCents: 6900,
    saleCents: 2900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Featured',
        'Category pin, 90 days',
        '4 copy edits / year',
        'Questions go to the contact address in the footer.',
      ],
      zh: ['包含精选档全部权益', '分类置顶 90 天', '全年 4 次文案修改', '问题发到页脚的联系地址。'],
    },
    cta: { en: 'Pro', zh: '专业' },
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
  /** Campaign price per week. Regular `weeklyCents` returns after the clock. */
  saleWeeklyCents?: number
  bundleWeeks: number
  /** Regular four-week price. */
  bundleCents: number
  /** Campaign four-week price. Regular `bundleCents` returns after the clock. */
  saleBundleCents?: number
}

/** The only two purchase lengths the pricing page advertises. */
export const AD_WEEK_OPTIONS = [1, 4] as const

export const adPlans: AdPlan[] = [
  {
    id: 'sidebar',
    name: { en: 'Right sidebar ad', zh: '右栏广告' },
    price: '$19',
    weeklyCents: 1900,
    saleWeeklyCents: 900,
    bundleWeeks: 4,
    bundleCents: 7600,
    saleBundleCents: 3200,
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
    bundle: { en: 'Four-week bundle available', zh: '可连投 4 周' },
  },
]

/**
 * Rows are aligned to `tiers` order: free, boost, standard, featured, pro.
 * The price row is rendered from `effectiveQuote` on /pricing so the table
 * shows the amount charged, not a second list of numbers.
 */
export const comparison: { label: Pair; values: Pair[] }[] = [
  {
    label: { en: 'Go live', zh: '上线' },
    values: [
      { en: 'Reviewed by hand', zh: '人工审核' },
      { en: 'When payment succeeds', zh: '付款成功后上线' },
      { en: 'When payment succeeds', zh: '付款成功后上线' },
      { en: 'When payment succeeds', zh: '付款成功后上线' },
      { en: 'When payment succeeds', zh: '付款成功后上线' },
    ],
  },
  {
    label: { en: 'Link', zh: '链接' },
    values: [
      { en: 'Nofollow', zh: 'nofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
    ],
  },
  {
    label: { en: 'Verified badge', zh: '认证徽章' },
    values: [
      { en: '—', zh: '—' },
      { en: 'Gold badge', zh: '金色徽章' },
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
    ],
  },
  {
    label: { en: 'Pin', zh: '置顶' },
    values: [
      { en: '—', zh: '—' },
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
      { en: '—', zh: '—' },
      { en: 'Card slot', zh: '卡片位' },
      { en: 'Card slot', zh: '卡片位' },
    ],
  },
]

export const pricingFaq: { q: Pair; a: Pair }[] = [
  {
    q: { en: 'Does Boost buy votes?', zh: '加速会买票吗？' },
    a: {
      en: 'No. The top 3 is decided by upvotes only. Below the top 3, boosted launches are placed above standard launches, with a gold badge and a highlighted row so more people see them.',
      zh: '不会。前三名只由投票决定。前三名以下，加速发布会排在标准收录之前，并带金色认证徽章和高亮行，让更多人看到。',
    },
  },
  {
    q: { en: 'When does my launch go live?', zh: '我的发布什么时候上线？' },
    a: {
      en: 'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
      zh: '付费档在付款成功后自动发布。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。',
    },
  },
  {
    q: { en: 'How do I get a dofollow link?', zh: '怎样获得 dofollow 反链？' },
    a: {
      en: 'Boost, Standard, Featured and Pro all include a permanent dofollow backlink. Free listings are nofollow. You do not need to display a badge to keep the link.',
      zh: '加速、标准、精选和专业档都包含永久 dofollow 反链。免费收录是 nofollow。你不需要展示徽章，也不会因此失去链接。',
    },
  },
  {
    q: { en: 'Can I change the plan after I submit?', zh: '提交后还能改方案吗？' },
    a: {
      en: 'Pick the plan on the submit form before you pay. The server calculates the amount from that plan; the browser cannot change what you are charged.',
      zh: '请在提交表单里先选好方案再付款。金额由服务端按该方案计算，浏览器无法改写实际收费。',
    },
  },
  {
    q: { en: 'How do ad spots work?', zh: '广告位怎么运作？' },
    a: {
      en: 'Billboard is a one-time name-your-price placement: the Top 10 is ranked by the total backed, and you can pay again for the same product to add to it. The sidebar is rented by the week, Monday to Sunday, with four separate slots.',
      zh: 'Billboard 是一次性出价展示：Top 10 按累计金额排名，同一产品可再次付款累加。右栏按周租用，周一起算 7 天，共 4 个独立位置。',
    },
  },
  {
    q: { en: 'Is anything a subscription?', zh: '有订阅吗？' },
    a: {
      en: 'No. Listings and Billboard are one-time. Only the sidebar is a weekly rental, and nothing renews automatically.',
      zh: '没有。收录与 Billboard 都是一次付清。只有右栏按周租用，且不会自动续费。',
    },
  },
  {
    q: { en: 'Can I get a refund?', zh: '可以退款吗？' },
    a: {
      en: 'If we do not deliver the placement, or we charge you in error, we refund it. After the listing or placement is live, we do not refund a change of mind or weak results. Full terms are in the billing section.',
      zh: '若我们没有交付展示位，或错误扣款，我们退款。收录或展示位上线后，不因改主意或效果不好退款。完整条款在计费章节。',
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
    title: { en: 'Paste the URL first', zh: '先粘贴网址' },
    body: {
      en: 'Paste the URL first. We draft the listing. Sign in only to save or pay.',
      zh: '先粘贴网址。我们起草收录。只在保存或付款时登录。',
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

/** Campaign price for a listing tier, or the regular price when it has none. */
export function planSaleAmountCents(plan: string): number {
  const slug = PLAN_ALIASES[plan] ?? plan
  if (slug === 'ad') return billboardStandardCents()
  const tier = tiers.find((t) => t.id === slug)
  return tier ? (tier.saleCents ?? tier.amountCents) : 0
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

/** Campaign price for a weekly ad slot, or the regular price when it has none. */
export function adSalePriceCents(slot: string, weeks: number): number {
  if (slot === 'board') return 0
  if (!Number.isInteger(weeks) || !(AD_WEEK_OPTIONS as readonly number[]).includes(weeks)) return 0
  const plan = adPlans.find((a) => a.id === slot)
  if (!plan) return 0
  if (weeks === plan.bundleWeeks) return plan.saleBundleCents ?? plan.bundleCents
  return (plan.saleWeeklyCents ?? plan.weeklyCents) * weeks
}

/** Display string for a computed charge, e.g. 9900 → "$99.00". */
export function formatAdPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
