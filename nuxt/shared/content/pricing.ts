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
      en: 'Get listed. The link is nofollow, but the page is yours to keep.',
      zh: '先上站。链接是 nofollow，但页面永久保留，也照常进每周榜单。',
    },
    price: '$0',
    amountCents: 0,
    unit: { en: 'forever', zh: '永远' },
    features: {
      en: [
        'Manual review, usually 7–14 days, not guaranteed; busy periods can take longer',
        'Directory and category listing',
        'Nofollow link — it passes no authority',
        'Stays online, competes on the weekly board',
      ],
      zh: [
        '人工审核，通常 7–14 天，不保证；高峰可能更长',
        '目录页 + 分类页展示',
        '链接是 nofollow，不传递权重',
        '永久保留，可参与每周榜单',
      ],
    },
    cta: { en: 'Submit free', zh: '免费提交' },
  },
  {
    id: 'standard',
    name: { en: 'Standard', zh: '标准' },
    tagline: {
      en: 'The cheapest upgrade that matters: the link turns dofollow.',
      zh: '最便宜的一次升级：链接变成永久 dofollow。',
    },
    price: '$19',
    amountCents: 1900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Live the same day payment is confirmed (we confirm receipt by hand)',
        'Permanent dofollow, no badge, no re-checking',
        'Listed above every free submission',
        'Stays online, competes on the weekly board',
      ],
      zh: [
        '付款确认后当天上线（人工确认收款）',
        '永久 dofollow 反链，不挂 badge、不复查',
        '目录页排在免费收录之前',
        '永久保留，可参与每周榜单',
      ],
    },
    cta: { en: 'Go Standard', zh: '升级到标准' },
  },
  {
    id: 'featured',
    name: { en: 'Featured', zh: '精选' },
    tagline: {
      en: 'If you want the position: top of the directory and category, plus the homepage card.',
      zh: '要位置就选这个：目录和分类页最前面，加首页卡。',
    },
    price: '$39',
    amountCents: 3900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Standard',
        'Pinned on the directory and category for 7 days',
        'A slot in the homepage rotation (one per period)',
        'After 7 days it drops back to Standard — the link stays',
      ],
      zh: [
        '标准档的全部权益',
        '目录页 + 分类页置顶 7 天',
        '首页精选卡排期（每期 1 个）',
        '7 天后自动回到标准档排序，链接不变',
      ],
    },
    cta: { en: 'Go Featured', zh: '选精选' },
    badge: { en: 'Most picked', zh: '最多人选' },
  },
  {
    id: 'pro',
    name: { en: 'Pro', zh: '专业' },
    tagline: {
      en: 'For holding the top of one category page, long term.',
      zh: '长期占住一个分类页第一屏。',
    },
    price: '$69',
    amountCents: 6900,
    unit: { en: 'one-time', zh: '一次性' },
    features: {
      en: [
        'Everything in Featured',
        'Pinned on its category page for 90 days',
        'Four copy edits a year (title, description, shots)',
        'Replies within 24 hours after the site owner turns email on',
      ],
      zh: [
        '精选档的全部权益',
        '分类页置顶 90 天',
        '全年 4 次文案修改（标题、描述、截图）',
        '站长开启邮件后 24h 内回复',
      ],
    },
    cta: { en: 'Choose Pro', zh: '选专业' },
  },
]

export interface AdPlan {
  id: 'board' | 'sidebar'
  name: Pair
  price: string
  unit: Pair
  where: Pair
  pitch: Pair
  bullets: PairList
  bundle: Pair
}

export const adPlans: AdPlan[] = [
  {
    id: 'board',
    name: { en: 'Board slot', zh: '榜单位' },
    price: '$29',
    unit: { en: '/ week', zh: '/ 周' },
    where: { en: 'Between 3rd and 4th on this week’s board', zh: '本周榜单第 3、4 名之间' },
    pitch: {
      en: 'The one row people read properly, at the moment they decide what to upvote.',
      zh: '榜单里唯一会被完整读完的一行 —— 人在决定投谁的时候正好看到你。',
    },
    bullets: {
      en: [
        'A full row: logo, headline, one-line pitch',
        'Links straight to the page you choose, no interstitial',
        'Seven days, starting Monday',
      ],
      zh: ['整行展示：logo、标题、一句话卖点', '直达你指定的落地页，中间没有跳转页', '展示 7 天，周一起算'],
    },
    bundle: { en: '4 weeks $99 — save $17', zh: '连投 4 周 $99 · 省 $17' },
  },
  {
    id: 'sidebar',
    name: { en: 'Sidebar slot', zh: '右栏位' },
    price: '$19',
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
    bundle: { en: '4 weeks $65 — save $11', zh: '连投 4 周 $65 · 省 $11' },
  },
]

/** Rows are aligned to `tiers` order: free, standard, featured, pro. */
export const comparison: { label: Pair; values: Pair[] }[] = [
  {
    label: { en: 'Goes live', zh: '上线时间' },
    values: [
      { en: 'Usually 7–14 days, not guaranteed', zh: '通常 7–14 天，不保证' },
      { en: 'Day payment is confirmed', zh: '确认收款当天' },
      { en: 'Day payment is confirmed', zh: '确认收款当天' },
      { en: 'Day payment is confirmed', zh: '确认收款当天' },
    ],
  },
  {
    label: { en: 'Outbound link', zh: '反链类型' },
    values: [
      { en: 'nofollow', zh: 'nofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
      { en: 'Permanent dofollow', zh: '永久 dofollow' },
    ],
  },
  {
    label: { en: 'Directory order', zh: '目录页排序' },
    values: [
      { en: 'Last', zh: '最后' },
      { en: 'Priority', zh: '优先' },
      { en: 'Top, 7 days', zh: '置顶 7 天' },
      { en: 'Top, 90 days', zh: '置顶 90 天' },
    ],
  },
  {
    label: { en: 'Category pin', zh: '分类页置顶' },
    values: [
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: '7 days', zh: '7 天' },
      { en: '90 days', zh: '90 天' },
    ],
  },
  {
    label: { en: 'Homepage card', zh: '首页精选卡' },
    values: [
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: 'Rotating', zh: '排期' },
      { en: 'Rotating', zh: '排期' },
    ],
  },
  {
    label: { en: 'Copy edits', zh: '文案修改' },
    values: [
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: '—', zh: '—' },
      { en: '4 a year', zh: '全年 4 次' },
    ],
  },
  {
    label: { en: 'Support', zh: '支持' },
    values: [
      { en: 'Standard', zh: '普通' },
      { en: 'Standard', zh: '普通' },
      { en: 'Standard', zh: '普通' },
      { en: '24h after email is on', zh: '开启邮件后 24h' },
    ],
  },
  {
    label: { en: 'Price', zh: '价格' },
    values: [
      { en: '$0', zh: '$0' },
      { en: '$19', zh: '$19' },
      { en: '$39', zh: '$39' },
      { en: '$69', zh: '$69' },
    ],
  },
]

export const pricingFaq: { q: Pair; a: Pair }[] = [
  {
    q: { en: 'Is it really one payment?', zh: '真的只付一次吗？' },
    a: {
      en: 'Yes. No subscription, no auto-renewal, no hidden fees. You are buying one listing, not renting a slot by the month.',
      zh: '是。没有订阅、没有自动续费、没有隐藏费用。你买的是一次上架，不是一个按月租的位置。',
    },
  },
  {
    q: { en: 'What do I get by paying?', zh: '免费和付费差在哪？' },
    a: {
      en: 'Three things: how long you wait, what kind of link you get, and where you appear. Free waits usually 7–14 days with a nofollow link. Paid goes live the day payment is confirmed, with a permanent dofollow link, listed above free submissions.',
      zh: '三件事：等待时间、链接类型、展示位置。免费要排队，通常 7–14 天，不保证；高峰可能更长，链接是 nofollow；付费档：付款确认后当天上线（人工确认收款），反链永久 dofollow，目录页排在免费收录之前。再往上一档才开始买「位置」——目录页和分类页置顶 7 天。',
    },
  },
  {
    q: { en: 'Why is there a $19 tier in the middle?', zh: '为什么中间还有一个 $19？' },
    a: {
      en: 'Because most people want exactly two things: the link turns dofollow, and the listing goes live the day payment clears. They do not want a homepage position. With only Free and Featured on the menu, those people either freeload or get pushed into a tier they do not need.',
      zh: '因为绝大多数人只想要两件事：链接变 dofollow、确认收款后当天上线。他们并不想买首页位置，如果只有「免费」和「置顶」两个选择，这些人要么白嫖，要么被推去买一个用不上的档位。标准档就是给他们准备的。',
    },
  },
  {
    q: { en: 'Is the dofollow link permanent?', zh: 'dofollow 反链是永久的吗？' },
    a: {
      en: 'On paid tiers, yes — permanent. No badge to install, no periodic re-check, nothing that lapses because a payment was missed. Free listings are nofollow, but the page and the link stay online permanently.',
      zh: '付费的是永久的：不用挂 badge，不复查，不会因为某天忘了续费而消失。免费收录是 nofollow，但页面和链接永久保留，不删。',
    },
  },
  {
    q: { en: 'How is an ad slot different from a listing?', zh: '广告位和收录有什么区别？' },
    a: {
      en: 'A listing is a page you buy once and keep. An ad slot is a position you rent by the week and lose when the week ends. They are independent — you can buy both. Board is $29/week, sidebar $19/week, with a discount for four weeks.',
      zh: '收录是买一个页面，一次付费、长期存在；广告位是租一个位置，按周计费、到期下架。两者互不影响，也可以同时买。榜单位 $29 / 周，右栏位 $19 / 周 —— 榜单是决定投票的那一屏，所以比右栏贵；连投 4 周有折扣。',
    },
  },
  {
    q: { en: 'How fast does it go live?', zh: '多久能上线？' },
    a: {
      en: 'Paid listings are published the same day the owner confirms the payment. Free listings join the manual review queue, usually 7–14 days, not guaranteed.',
      zh: '付费档在站长确认收款后当天生成页面并上线（人工确认收款）。免费进入人工审核队列，通常 7–14 天，不保证；高峰可能更长。',
    },
  },
  {
    q: { en: 'Can I get a refund?', zh: '可以退款吗？' },
    a: {
      en: 'Full refund before your listing goes live. After it is live we cannot refund, because the backlink is already in place and cannot be taken back. If you are unsure, submit free first.',
      zh: '上线前可以全额退。上线后不支持退款——反链已经生效，撤不回来。所以如果不确定，先免费提交。',
    },
  },
  {
    q: { en: 'Why no monthly plan?', zh: '为什么不做月订阅？' },
    a: {
      en: 'Because the delivery is one-off. A permanent page is paid for once; charging monthly would mean charging repeatedly for the same thing.',
      zh: '因为交付是一次性的。一个永久页面收一次钱就够，按月收费等于为同一件东西反复收钱。',
    },
  },
]

/* -------------------------------------------------------------------------
   what a plan costs, in minor units

   Two spellings reach this function and both have to land on the same number:
   the submit form posts `paid` (the pricing page's word for that column) while
   the catalogue calls the same tier `featured`; a weekly ad posts `ad`, which
   is the board placement's $29 rather than a directory tier.

   Checkout reads the amount from here, never from the request body — a client
   that can name its own price is not a price.
------------------------------------------------------------------------- */

const PLAN_ALIASES: Record<string, string> = { paid: 'featured' }

export function planAmountCents(plan: string): number {
  const slug = PLAN_ALIASES[plan] ?? plan
  if (slug === 'ad') return 2900
  const tier = tiers.find((t) => t.id === slug)
  return tier ? tier.amountCents : 0
}
