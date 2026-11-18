<script setup lang="ts">
/**
 * /pricing — ProductsBoost-style pricing page, adapted to this site's real SKUs.
 *
 * The competitor's shell is the point: a quiet left rail, a compact centre
 * column, two numbered launch cards, a yellow Boost/featured treatment, a
 * separate Advertise block, "Where each option shows", a two-column Free vs
 * Boost table and a bordered FAQ accordion. Copy follows the competitor where
 * it is true for this site; where it is not (Creem, 30 free spots, weekly
 * Featured spot, badge-unlocked links) the line is rewritten rather than
 * promising something checkout cannot deliver.
 *
 * Prices still come from `effectiveQuote`, the same source checkout uses.
 */
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'
import { campaignDeadlineShanghai } from '~~/shared/content/billboard'
import { effectiveQuote, type EffectiveQuote } from '~~/shared/utils/pricing-effective'
import { pricingFaq, tiers } from '~~/shared/content/pricing'
import { tools } from '~~/shared/utils/catalog'
import type { Week } from '~~/shared/types/catalog'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()
const t = (pair: { en: string; zh: string }) => (lang.value === 'zh' ? pair.zh : pair.en)
const tl = (pair: { en: string[]; zh: string[] }) => (lang.value === 'zh' ? pair.zh : pair.en)

const title = computed(() => {
  const boost = effectiveQuote('listing', 'boost').priceLabel
  return pick(`免费发布。${boost} 加速。`, `Launch free. Boost for ${boost}.`)
})
const lead = computed(() =>
  pick(
    '一次付费。广告位按周预订。没有订阅，没有自动续费。',
    'One-time payments. Ads are booked per week. Nothing renews.',
  ),
)
/**
 * The visible subheadline is one short sentence, which is far too thin for a
 * search result. The competitor lists every price in its description and gets
 * a longer, more clickable snippet for it; this does the same, and the numbers
 * still come from `effectiveQuote` so a campaign price cannot go stale here.
 */
const metaDescription = computed(() => {
  const price = (id: string) => effectiveQuote('listing', id).priceLabel
  const week = effectiveQuote('sidebar', '1').priceLabel
  return pick(
    `免费发布，或一次付费上线：加速 ${price('boost')}、标准 ${price('standard')}、精选 ${price('featured')}、专业 ${price('pro')}。广告位每周 ${week} 起。无订阅，不自动续费。`,
    `Launch free, or pay once to go live: Boost ${price('boost')}, Standard ${price('standard')}, Featured ${price('featured')}, Pro ${price('pro')}. Ads from ${week} a week. No subscription, nothing renews.`,
  )
})
const promises = computed(() => [
  pick('无订阅', 'No subscription'),
  pick('安全结账', 'Secure checkout'),
  pick('付款成功后即刻上线', 'Applied in seconds'),
])

type PlanView = {
  id: string
  n: string
  name: string
  badge?: string
  description: string
  pricePrefix?: string
  price: string
  unit: string
  original?: string
  limited?: string
  features: string[]
  cta: string
  to: string
  featured?: boolean
}

function submitTo(id: string) {
  return `${localePath('/submit')}?plan=${id}`
}

const freePlan = computed<PlanView>(() => ({
  id: 'free',
  n: '1',
  name: pick('免费发布', 'Free launch'),
  description: pick('先上线，不需要信用卡。', 'Everything to go live, no card required.'),
  price: effectiveQuote('listing', 'free').priceLabel,
  unit: pick('永久', 'forever'),
  features: pick(
    [
      '进入每周发布榜，按投票排名',
      '拥有自己的公开产品页',
      '进入前三可获得冠军徽章',
      '人工审核后上线',
      '永久保留页面，链接为 nofollow',
    ],
    [
      'Listed on the weekly launch board, ranked by upvotes',
      'Your own public product page',
      'Winner badge if you finish in the top 3',
      'Reviewed by hand before it goes live',
      'Permanent page with a nofollow link',
    ],
  ),
  cta: pick('免费发布 ↗', 'Launch for free ↗'),
  to: submitTo('free'),
}))

const boostPlan = computed<PlanView>(() => {
  const quote: EffectiveQuote = effectiveQuote('listing', 'boost')
  return {
    id: 'boost',
    n: '2',
    name: pick('加速发布', 'Boost launch'),
    badge: pick('最多人选', 'Most popular'),
    description: pick('无需额外步骤，整周都更显眼。', 'No extra steps, and you stand out all week.'),
    price: quote.priceLabel,
    unit: pick('一次性', 'one-time'),
    original: quote.strikeLabel ?? undefined,
    limited: quote.strikeLabel ? pick('限时优惠', 'LIMITED TIME') : undefined,
    features: pick(
      [
        '包含免费发布全部权益',
        '不用等免费名额，付款成功后上线',
        '榜单与产品页金色认证徽章',
        '发布榜金色高亮行',
        '排在标准收录之前',
        '永久 dofollow 反链',
      ],
      [
        'Everything in Free launch',
        'No free-spot wait — live when payment succeeds',
        'Gold verified badge on the board and product page',
        'Highlighted gold row on the launch board',
        'Placed above standard launches',
        'Always dofollow backlink to your website',
      ],
    ),
    cta: pick(`加速 · ${quote.priceLabel} ↗`, `Boost for ${quote.priceLabel} ↗`),
    to: submitTo('boost'),
    featured: true,
  }
})

const extraPlans = computed<PlanView[]>(() =>
  ['standard', 'featured', 'pro'].map((id, index) => {
    const tier = tiers.find((item) => item.id === id)!
    const quote = effectiveQuote('listing', id)
    return {
      id,
      n: String(index + 3),
      name: t(tier.name),
      badge: tier.badge ? t(tier.badge) : undefined,
      description: t(tier.tagline),
      price: quote.priceLabel,
      unit: t(tier.unit),
      original: quote.strikeLabel ?? undefined,
      features: tl(tier.features).slice(0, 4),
      cta: pick(`选择 ${t(tier.name)} ↗`, `Choose ${t(tier.name)} ↗`),
      to: submitTo(id),
    }
  }),
)

const adPlans = computed<PlanView[]>(() => {
  const floor = effectiveQuote('billboard', 'floor')
  const sidebar = effectiveQuote('sidebar', '1')
  return [
    {
      id: 'billboard',
      n: 'A',
      name: 'Billboard',
      badge: pick('Top 10', 'Top 10'),
      description: pick('发布榜上的那一块大广告位。', 'The one big ad on the launch board.'),
      pricePrefix: pick('起', 'from'),
      price: floor.priceLabel,
      unit: pick('一次性', 'one-time'),
      features: pick(
        [
          'Billboard Top 10 中的赞助横幅',
          '同时出现在发布榜与首页',
          '一次付清，同一产品可追加金额',
          '包含 logo、名称、标语与按钮',
          '付款成功后进入排名',
        ],
        [
          'Sponsored banner in the Billboard Top 10',
          'Shown on the launch board and the homepage',
          'Pay once; bids stack for the same product',
          'Your logo, name, headline and button',
          'It goes live when payment succeeds',
        ],
      ),
      cta: pick(`认领 Billboard · ${floor.priceLabel} 起 ↗`, `Claim Billboard · from ${floor.priceLabel} ↗`),
      to: `${localePath('/billboard')}#claim`,
      featured: true,
    },
    {
      id: 'sidebar',
      n: 'B',
      name: pick('右栏广告', 'Right sidebar ad'),
      badge: pick('4 个位置', '4 slots'),
      description: pick('网站每个页面旁边的一张卡片。', 'A card beside every page of the site.'),
      price: sidebar.priceLabel,
      unit: pick('/ 周', '/ week'),
      original: sidebar.strikeLabel ?? undefined,
      features: pick(
        [
          '首页右侧栏卡片',
          '小屏时移到榜单下方',
          '共 4 个位置，每个品牌独立卡片',
          '包含 logo、名称、标语与按钮',
          '周一到周日展示 7 天',
        ],
        [
          'Card in the right sidebar on the homepage',
          'Under the board on smaller screens',
          'Four slots, each brand gets its own card',
          'Your logo, name, headline and button',
          'Runs Monday to Sunday',
        ],
      ),
      cta: pick(`预订右栏 · ${sidebar.priceLabel} ↗`, `Book sidebar · ${sidebar.priceLabel} ↗`),
      to: `${localePath('/sponsor')}?spot=sidebar#book`,
    },
  ]
})

const whereItems = computed(() => [
  { n: '1', title: pick('免费发布', 'Free launch'), body: pick('发布周榜单中的普通一行，按投票排序。', "A regular row in your launch week's board, ranked by upvotes."), spot: '1' },
  { n: '2', title: pick('加速发布', 'Boost launch'), body: pick('金色高亮行，带认证徽章，排在标准收录之前。', 'A highlighted gold row with a verified badge, above standard launches.'), spot: '2' },
  { n: 'A', title: 'Billboard', body: pick('发布榜 Top 10 中的赞助横幅。', 'Sponsored banner in the Billboard Top 10.'), spot: 'A' },
  { n: 'B', title: pick('右栏广告', 'Right sidebar ad'), body: pick('首页右栏，以及小屏时的榜单下方。', 'Right sidebar on the homepage, under the board on smaller screens.'), spot: 'B' },
])

const hoverSpot = ref('')
function focus(spot: string) {
  hoverSpot.value = spot
}
function blur() {
  hoverSpot.value = ''
}

const compareRows = computed(() => [
  { label: pick('价格', 'Price'), free: freePlan.value.price, boost: `${boostPlan.value.price} ${boostPlan.value.unit}` },
  { label: pick('如何解锁', 'How to unlock'), free: pick('人工审核', 'Reviewed by hand'), boost: pick('付款即可', 'Nothing to do') },
  { label: pick('发布周', 'Launch week'), free: pick('任意开放周', 'Any open week'), boost: pick('任意开放周', 'Any open week') },
  { label: pick('进入每周发布榜', 'Listed on the weekly board'), free: '✓', boost: '✓' },
  { label: pick('前三名冠军徽章', 'Winner badge for the top 3'), free: '✓', boost: '✓' },
  { label: pick('金色认证徽章', 'Gold verified badge'), free: '—', boost: '✓' },
  { label: pick('排在标准收录之前', 'Placed above standard launches'), free: '—', boost: '✓' },
  { label: pick('金色高亮行', 'Highlighted gold row'), free: '—', boost: '✓' },
  { label: pick('反链', 'Backlink'), free: 'nofollow', boost: pick('始终 dofollow', 'always dofollow') },
])

const openFaq = ref<number | null>(null)
const deadline = campaignDeadlineShanghai()

type BoardLite = { current: Week | null; history: Week[] }
type PricingLive = {
  toolsCount: number
  sidebar: AdAvailability
  board: BoardLite
}
const EMPTY_LIVE: PricingLive = {
  toolsCount: 0,
  sidebar: EMPTY_AD_AVAILABILITY,
  board: { current: null, history: [] },
}

const { data: live } = await useAsyncData<PricingLive>(
  'pricing-live',
  async () => {
    const [toolsRes, sidebarRes, boardRes] = await Promise.all([
      requestFetch<{ tools?: unknown[] }>('/api/tools').catch(() => null),
      requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
      requestFetch<BoardLite>('/api/board').catch(() => EMPTY_LIVE.board),
    ])
    return {
      toolsCount: toolsRes?.tools?.length ?? 0,
      sidebar: {
        ok: Boolean(sidebarRes?.ok),
        starts: sidebarRes?.starts ?? [],
        available: sidebarRes?.available ?? {},
      },
      board: {
        current: boardRes?.current ?? null,
        history: boardRes?.history ?? [],
      },
    }
  },
  { default: () => EMPTY_LIVE },
)

const liveData = computed(() => live.value ?? EMPTY_LIVE)
const openWeekCount = computed(() => openAdWeeks(liveData.value.sidebar).length)
const nextOpenWeek = computed(() => openAdWeeks(liveData.value.sidebar)[0] ?? '')

const lastWeekTop3 = computed(() => {
  const payload = liveData.value.board
  const week = payload.history[0] ?? payload.current
  if (!week) return []
  const bySlug = new Map(tools.map((tool) => [tool.slug, tool]))
  return week.ranking
    .slice()
    .sort((a, b) => Number(b.votes) - Number(a.votes))
    .slice(0, 3)
    .map((row, index) => ({
      rank: index + 1,
      slug: row.slug,
      name: bySlug.get(row.slug)?.name_en ?? row.slug,
      votes: Number(row.votes) || 0,
    }))
})
const top3Label = computed(() =>
  liveData.value.board.history.length
    ? pick("上周前三", "Last week's top 3")
    : pick('本周前三', 'This week’s top 3'),
)

const faqSchema = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pricingFaq.map((item) => ({
      '@type': 'Question',
      name: t(item.q),
      acceptedAnswer: { '@type': 'Answer', text: t(item.a) },
    })),
  }),
)

useSeo({
  title: computed(() =>
    pick('定价：免费发布或付费加速 · Product Atlas', 'Pricing: launch free or boost your launch · Product Atlas'),
  ),
  description: metaDescription,
})

useHead({
  script: [{ type: 'application/ld+json', innerHTML: faqSchema }],
})
</script>

<template>
  <div id="pricing-page" class="src-page pb-page">
    <div class="pb-shell">
      <!-- Left rail: the competitor keeps the pricing page inside the same
           quiet navigation shell as the board. Links use this site's routes. -->
      <aside class="pb-rail pb-rail--left" aria-label="Pricing sections">
        <p class="pb-rail__label">{{ pick('浏览', 'BROWSE') }}</p>
        <nav class="pb-rail__nav">
          <NuxtLink :to="localePath('/')">{{ pick('发布周', 'Launch weeks') }}</NuxtLink>
          <NuxtLink :to="localePath('/weekly')">{{ pick('周榜', 'Weekly board') }}</NuxtLink>
          <NuxtLink :to="localePath('/alternatives')">{{ pick('替代品', 'Alternatives') }}</NuxtLink>
          <NuxtLink class="is-active" :to="localePath('/pricing')">{{ pick('定价', 'Pricing') }}</NuxtLink>
          <NuxtLink :to="localePath('/sponsor')">{{ pick('投放', 'Advertise') }}</NuxtLink>
          <NuxtLink :to="localePath('/seo-check')">{{ pick('SEO 诊断', 'SEO check') }}</NuxtLink>
        </nav>
        <p class="pb-rail__label pb-rail__label--gap">{{ pick('资源', 'RESOURCES') }}</p>
        <nav class="pb-rail__nav">
          <NuxtLink :to="localePath('/submit')">{{ pick('发布产品', 'Submit launch') }}</NuxtLink>
          <NuxtLink :to="localePath('/settings/submissions')">{{ pick('我的发布', 'My launches') }}</NuxtLink>
          <NuxtLink :to="localePath('/rules')">{{ pick('排名规则', 'Ranking rules') }}</NuxtLink>
          <NuxtLink :to="localePath('/faq')">{{ pick('常见问题', 'Questions') }}</NuxtLink>
        </nav>
        <p class="pb-rail__note">
          {{ pick('一次付费，没有订阅。', 'Pay once. Nothing renews.') }}
        </p>
      </aside>

      <main class="pb-main">
        <header class="pb-hero">
          <p class="pb-hero__kicker">{{ pick('定价', 'Pricing') }}</p>
          <h1>{{ title }}</h1>
          <p class="pb-hero__lead">{{ lead }}</p>
          <ul class="pb-hero__promises">
            <li v-for="promise in promises" :key="promise"><span class="pb-check" aria-hidden="true">✓</span>{{ promise }}</li>
          </ul>
          <p class="pb-hero__badge-note">
            {{ pick('展示徽章是可选的。付费收录已经包含 dofollow 链接；不展示徽章也不会失去这条链接。', 'A listing badge is optional. Paid listings already include a dofollow link; you do not need to display the badge to keep it.') }}
          </p>
        </header>

        <section id="plans" class="pb-section" aria-labelledby="pb-plans-title">
          <h2 id="pb-plans-title" class="sr-only">{{ pick('收录方案', 'Listing plans') }}</h2>
          <div class="pb-card-grid pb-card-grid--two">
            <DirectoryPricingPlanCard :plan="freePlan" />
            <DirectoryPricingPlanCard :plan="boostPlan" />
          </div>
          <div class="pb-card-grid pb-card-grid--three">
            <DirectoryPricingPlanCard v-for="plan in extraPlans" :key="plan.id" :plan="plan" compact />
          </div>
        </section>

        <section id="ads" class="pb-section" aria-labelledby="pb-ads-title">
          <header class="pb-section-head">
            <h2 id="pb-ads-title"><span class="pb-section-head__icon" aria-hidden="true">◈</span>{{ pick('投放', 'Advertise') }}</h2>
            <p>{{ pick('按周预订，周一到周日。把你的品牌放到正在看榜单的开发者和早期用户面前。', 'Booked per week, Monday to Sunday. Put your brand in front of makers and early adopters.') }}</p>
            <NuxtLink :to="localePath('/sponsor')">{{ pick('查看开放周次', 'See availability') }} →</NuxtLink>
          </header>
          <div class="pb-card-grid pb-card-grid--two">
            <DirectoryPricingPlanCard v-for="plan in adPlans" :key="plan.id" :plan="plan" />
          </div>
          <p v-if="nextOpenWeek" class="pb-live-note">
            <span class="pb-live-dot" aria-hidden="true" />
            {{ pick(`右栏未来 6 周还有 ${openWeekCount} 周可订，最早 ${nextOpenWeek}。`, `${openWeekCount} sidebar weeks open in the next 6, earliest ${nextOpenWeek}.`) }}
          </p>
        </section>

        <section class="pb-section" aria-labelledby="pb-where-title">
          <h2 id="pb-where-title">{{ pick('每个选项显示在哪里', 'Where each option shows') }}</h2>
          <p class="pb-section__intro">{{ pick('编号对应上面的卡片。移到一项，看看它在页面里的位置。', 'The numbers match the cards above. Hover one to see it in the picture.') }}</p>
          <div class="pb-where">
            <ol class="pb-where__list">
              <li
                v-for="item in whereItems"
                :key="item.n"
                :class="{ 'is-focus': hoverSpot === item.spot }"
                @mouseenter="focus(item.spot)"
                @mouseleave="blur"
              >
                <span class="pb-num pb-num--small">{{ item.n }}</span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.body }}</p>
                </div>
              </li>
            </ol>
            <div class="pb-mock" aria-hidden="true">
              <div class="pb-mock__bar"><span>Product Atlas</span><span>W47</span></div>
              <div class="pb-mock__body">
                <div class="pb-mock__main">
                  <div class="pb-mock__row" :class="{ 'is-focus': hoverSpot === '1' }"><b>1</b><span>Launch A</span><em>12</em></div>
                  <div class="pb-mock__row is-gold" :class="{ 'is-focus': hoverSpot === '2' }"><b>2</b><span>Launch B · verified</span><em>9</em></div>
                  <div class="pb-mock__row" :class="{ 'is-focus': hoverSpot === 'A' }"><b>A</b><span>Sponsored banner</span><em>↗</em></div>
                  <div class="pb-mock__row"><b>3</b><span>Launch C</span><em>6</em></div>
                </div>
                <div class="pb-mock__rail" :class="{ 'is-focus': hoverSpot === 'B' }">
                  <span>B</span>
                  <p>Your ad here</p>
                  <small>{{ effectiveQuote('sidebar', '1').priceLabel }} / {{ pick('周', 'week') }}</small>
                </div>
              </div>
            </div>
          </div>
          <p class="pb-fine">
            {{ pick('价格为美元，适用时另加 VAT 或销售税。', 'Prices in USD, plus VAT or sales tax where it applies.') }}
          </p>
        </section>

        <section class="pb-section" aria-labelledby="pb-compare-title">
          <h2 id="pb-compare-title">{{ pick('免费 vs 加速', 'Free vs Boost') }}</h2>
          <div class="pb-table-wrap">
            <table class="pb-table">
              <thead>
                <tr>
                  <th scope="col">{{ pick('对比', 'Compare') }}</th>
                  <th scope="col">{{ pick('免费', 'Free') }}</th>
                  <th scope="col" class="is-boost">{{ pick('加速', 'Boost') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in compareRows" :key="row.label">
                  <th scope="row">{{ row.label }}</th>
                  <td>{{ row.free }}</td>
                  <td class="is-boost">{{ row.boost }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="pb-section" aria-labelledby="pb-faq-title">
          <h2 id="pb-faq-title">Questions</h2>
          <div class="pb-faq">
            <article v-for="(item, index) in pricingFaq" :key="item.q.en" class="pb-faq__item">
              <h3>
                <button
                  type="button"
                  :aria-expanded="openFaq === index"
                  @click="openFaq = openFaq === index ? null : index"
                >
                  <span>{{ t(item.q) }}</span>
                  <span class="pb-faq__chevron" :class="{ 'is-open': openFaq === index }" aria-hidden="true">⌄</span>
                </button>
              </h3>
              <p v-if="openFaq === index">{{ t(item.a) }}</p>
            </article>
          </div>
        </section>

        <footer class="pb-page-foot">
          <p class="pb-fine">
            {{ pick('页面价格即为实付。It goes live when payment succeeds. 不承诺搜索排名、流量或域名权重。', 'The price on the page is what you pay. It goes live when payment succeeds. No promise of search rank, traffic, or domain authority.') }}
          </p>
          <p v-if="campaignDeadlineShanghai()" class="pb-fine">
            {{ pick(`当前优惠截止 ${deadline}（上海时间）。`, `Current pricing ends ${deadline} Asia/Shanghai.`) }}
          </p>
        </footer>
      </main>

      <aside class="pb-rail pb-rail--right" aria-label="Advertising and weekly winners">
        <header class="pb-right-head">
          <strong>{{ pick('投放', 'Advertise') }}</strong>
          <NuxtLink :to="localePath('/sponsor')">{{ pick('所有价格', 'All prices') }}</NuxtLink>
        </header>

        <article class="pb-mini-ad">
          <span class="pb-mini-ad__tag">{{ pick('Billboard', 'Billboard') }}</span>
          <strong>{{ pick('你的广告放这里', 'Your ad here') }}</strong>
          <p>{{ pick('首页 Billboard Top 10，付款成功后进入排名。', 'Billboard Top 10 on the homepage. It goes live when payment succeeds.') }}</p>
          <div class="pb-mini-ad__price">{{ pick('起', 'from') }} {{ effectiveQuote('billboard', 'floor').priceLabel }} <small>{{ pick('一次性', 'one-time') }}</small></div>
          <NuxtLink :to="`${localePath('/billboard')}#claim`">{{ pick('认领展示位', 'Claim a spot') }} ↗</NuxtLink>
        </article>

        <article v-for="slot in 2" :key="slot" class="pb-mini-ad">
          <span class="pb-mini-ad__tag">{{ pick('右栏广告', 'Right sidebar') }} · {{ slot }}/2</span>
          <strong>{{ pick('你的广告放这里', 'Your ad here') }}</strong>
          <p>{{ pick('首页右栏卡片，面向正在看发布榜的开发者和早期用户。', 'A card in the homepage sidebar, beside makers and early adopters.') }}</p>
          <div class="pb-mini-ad__price">{{ effectiveQuote('sidebar', '1').priceLabel }} <small>{{ pick('/ 周', '/ week') }}</small></div>
          <NuxtLink :to="`${localePath('/sponsor')}?spot=sidebar#book`">{{ pick('预订这个位置', 'Book this spot') }} ↗</NuxtLink>
        </article>

        <section v-if="lastWeekTop3.length" class="pb-top3-mini">
          <header>
            <strong>🏆 {{ top3Label }}</strong>
            <NuxtLink :to="localePath('/weekly')">{{ pick('查看全部', 'See all') }} ›</NuxtLink>
          </header>
          <ol>
            <li v-for="row in lastWeekTop3" :key="row.slug">
              <span class="pb-num pb-num--small" :class="`is-rank-${row.rank}`">{{ row.rank }}</span>
              <NuxtLink :to="localePath(`/products/${row.slug}`)"><strong>{{ row.name }}</strong><em>{{ row.votes }} {{ pick('票', 'votes') }}</em></NuxtLink>
            </li>
          </ol>
        </section>

        <p class="pb-right-foot">
          © 2026 Product Atlas ·
          <NuxtLink :to="localePath('/weekly')">{{ pick('周榜', 'Weekly') }}</NuxtLink> ·
          <NuxtLink :to="localePath('/pricing')">{{ pick('定价', 'Pricing') }}</NuxtLink> ·
          <NuxtLink :to="localePath('/submit')">{{ pick('提交', 'Submit') }}</NuxtLink>
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pb-page { --pb-line: #e5e7eb; --pb-ink: #17181a; --pb-muted: #6b7280; --pb-gold: #f5c451; --pb-gold-soft: #fff9e8; --pb-green: #6fbf3b; }
.pb-shell { display: grid; grid-template-columns: 216px minmax(0, 1fr) 286px; max-width: 1440px; margin: 0 auto; min-height: 70vh; }
.pb-rail { min-width: 0; padding: 30px 18px 40px; }
.pb-rail--left { border-right: 1px dashed var(--pb-line); }
.pb-rail--right { border-left: 1px dashed var(--pb-line); }
.pb-rail__label { margin: 0 0 10px; font-size: 10px; font-weight: 800; letter-spacing: .14em; color: var(--pb-muted); text-transform: uppercase; }
.pb-rail__label--gap { margin-top: 26px; }
.pb-rail__nav { display: grid; gap: 2px; }
.pb-rail__nav a { display: block; padding: 8px 10px; border-radius: 8px; font-size: 13px; color: #3f4145; text-decoration: none; }
.pb-rail__nav a:hover { background: #f3f4f6; }
.pb-rail__nav a.is-active { background: #fff4d6; color: #7a4b00; font-weight: 700; }
.pb-rail__note { margin: 28px 10px 0; padding-top: 16px; border-top: 1px solid var(--pb-line); font-size: 12px; line-height: 1.6; color: var(--pb-muted); }
.pb-main { min-width: 0; padding: 30px 32px 56px; }
.pb-hero { text-align: center; margin: 0 0 30px; }
.pb-hero__kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #9a6700; }
.pb-hero h1 { margin: 8px 0 8px; font-size: clamp(30px, 4vw, 42px); line-height: 1.1; letter-spacing: -.035em; font-weight: 800; color: var(--pb-ink); }
.pb-hero__lead { margin: 0; font-size: 14px; color: var(--pb-muted); }
.pb-hero__promises { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin: 14px 0 0; padding: 0; list-style: none; }
.pb-hero__promises li { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--pb-muted); }
.pb-hero__badge-note { margin: 10px auto 0; max-width: 620px; font-size: 11px; line-height: 1.5; color: var(--pb-muted); }
.pb-check { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 16px; height: 16px; border-radius: 999px; background: #e8f6dc; color: #4f992d; font-size: 11px; font-weight: 900; line-height: 1; }
.pb-section { margin-top: 34px; }
.pb-section h2 { margin: 0 0 10px; font-size: 23px; letter-spacing: -.025em; color: var(--pb-ink); }
.pb-section__intro { margin: 0 0 18px; font-size: 13px; color: var(--pb-muted); }
.pb-card-grid { display: grid; gap: 14px; }
.pb-card-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pb-card-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 14px; }
.pb-card { display: flex; flex-direction: column; min-width: 0; padding: 20px; border: 1px solid var(--pb-line); border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(20,20,20,.03); }
.pb-card.is-featured { background: var(--pb-gold-soft); border-color: #f0d58b; box-shadow: 0 6px 22px rgba(245,196,81,.12); }
.pb-card.is-compact { padding: 16px; }
.pb-card__head { display: flex; align-items: center; gap: 10px; }
.pb-num { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 22px; height: 22px; border-radius: 999px; background: #17181a; color: #fff; font-size: 11px; font-weight: 800; }
.pb-num--small { width: 20px; height: 20px; font-size: 10px; }
.pb-num.is-rank-1 { background: #f5b426; color: #4a3400; }
.pb-num.is-rank-2 { background: #c9ced6; color: #2a2d33; }
.pb-num.is-rank-3 { background: #e0b48a; color: #3a2a1a; }
.pb-card__title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.pb-card__title strong { font-size: 15px; color: var(--pb-ink); }
.pb-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: #dff3c4; color: #2d6416; font-size: 10px; font-weight: 800; }
.pb-card.is-featured .pb-pill { background: var(--pb-gold); color: #3d2b00; }
.pb-card__mark { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid var(--pb-line); border-radius: 8px; color: #9a6700; font-size: 13px; }
.pb-card__desc { margin: 12px 0 10px; font-size: 12px; color: var(--pb-muted); }
.pb-card__price { display: flex; align-items: baseline; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--pb-line); }
.pb-card__price small { font-size: 11px; color: var(--pb-muted); }
.pb-card__price s { font-size: 13px; color: var(--pb-muted); }
.pb-card__price strong { font-size: 34px; line-height: 1; letter-spacing: -.04em; color: var(--pb-ink); }
.pb-card.is-compact .pb-card__price strong { font-size: 28px; }
.pb-card__price span { font-size: 11px; color: var(--pb-muted); }
.pb-card__limited { margin: 7px 0 0; font-size: 11px; font-weight: 700; color: #4f992d; }
.pb-card__features { display: grid; gap: 7px; margin: 12px 0 18px; padding: 0; list-style: none; }
.pb-card__features li { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.45; color: #3e4146; }
.pb-card__cta { display: inline-flex; align-items: center; justify-content: center; margin-top: auto; min-height: 36px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 999px; background: #fff; color: var(--pb-ink); font-size: 12px; font-weight: 700; text-decoration: none; }
.pb-card__cta:hover { border-color: #17181a; }
.pb-card__cta.is-solid { background: #17181a; border-color: #17181a; color: #fff; }
.pb-section-head { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: start; margin-bottom: 14px; }
.pb-section-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
.pb-section-head__icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: #f3f4f6; font-size: 12px; }
.pb-section-head p { grid-column: 1; margin: 0; font-size: 12px; color: var(--pb-muted); }
.pb-section-head > a { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-size: 12px; font-weight: 700; color: #8a5a00; text-decoration: none; }
.pb-live-note { display: flex; align-items: center; gap: 7px; margin: 12px 0 0; font-size: 11px; color: var(--pb-muted); }
.pb-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #4ade80; box-shadow: 0 0 0 3px #e7f8df; }
.pb-where { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 20px; align-items: start; }
.pb-where__list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.pb-where__list li { display: flex; gap: 10px; padding: 10px; border-radius: 10px; }
.pb-where__list li.is-focus { background: #fff7e6; }
.pb-where__list strong { font-size: 13px; }
.pb-where__list p { margin: 3px 0 0; font-size: 12px; line-height: 1.5; color: var(--pb-muted); }
.pb-mock { min-width: 0; overflow: hidden; padding: 10px; border: 1px solid var(--pb-line); border-radius: 14px; background: #fff; box-shadow: 0 8px 22px rgba(20,20,20,.06); }
.pb-mock__bar { display: flex; justify-content: space-between; padding: 6px 8px; border-radius: 8px; background: #17181a; color: #fff; font-size: 10px; }
.pb-mock__body { display: grid; grid-template-columns: minmax(0, 1fr) 86px; gap: 8px; margin-top: 8px; }
.pb-mock__main { display: grid; gap: 4px; min-width: 0; }
.pb-mock__row { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 6px; align-items: center; padding: 6px; border: 1px solid var(--pb-line); border-radius: 7px; font-size: 10px; }
.pb-mock__row b { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 999px; background: #17181a; color: #fff; font-size: 8px; }
.pb-mock__row em { color: var(--pb-muted); font-style: normal; }
.pb-mock__row.is-gold { background: #fff8e2; border-color: #f0d58b; }
.pb-mock__row.is-focus { outline: 2px solid #f5c451; }
.pb-mock__rail { padding: 8px; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 9px; color: var(--pb-muted); }
.pb-mock__rail.is-focus { outline: 2px solid #f5c451; background: #fff8e2; }
.pb-mock__rail p { margin: 6px 0 2px; }
.pb-mock__rail small { font-size: 9px; }
.pb-fine { margin: 12px 0 0; font-size: 11px; line-height: 1.6; color: var(--pb-muted); }
.pb-table-wrap { overflow-x: auto; border: 1px solid var(--pb-line); border-radius: 14px; background: #fff; }
.pb-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 12px; }
.pb-table th, .pb-table td { padding: 10px 12px; border-bottom: 1px solid var(--pb-line); text-align: left; vertical-align: middle; }
.pb-table tbody tr:last-child th, .pb-table tbody tr:last-child td { border-bottom: 0; }
.pb-table thead th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--pb-muted); }
.pb-table tbody th { font-weight: 600; color: #3e4146; }
.pb-table .is-boost { background: #fffaf0; }
.pb-faq { border: 1px solid var(--pb-line); border-radius: 14px; background: #fff; overflow: hidden; }
.pb-faq__item { border-bottom: 1px solid var(--pb-line); }
.pb-faq__item:last-child { border-bottom: 0; }
.pb-faq__item h3 { margin: 0; }
.pb-faq__item button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 0; background: none; color: var(--pb-ink); font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
.pb-faq__chevron { flex: none; width: 16px; color: #6b7280; font-size: 18px; line-height: 1; transition: transform .15s; }
.pb-faq__chevron.is-open { transform: rotate(180deg); }
.pb-faq__item p { margin: 0; padding: 0 16px 14px; font-size: 12px; line-height: 1.65; color: var(--pb-muted); }
.pb-page-foot { margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--pb-line); }
.pb-right-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 12px; font-size: 12px; }
.pb-right-head a { color: var(--pb-muted); font-size: 11px; text-decoration: none; }
.pb-mini-ad { margin-bottom: 12px; padding: 14px; border: 1px dashed #d1d5db; border-radius: 14px; background: #fff; }
.pb-mini-ad__tag { display: inline-block; margin-bottom: 8px; padding: 2px 7px; border-radius: 999px; background: #f3f4f6; color: #4b5563; font-size: 10px; font-weight: 700; }
.pb-mini-ad strong { display: block; font-size: 13px; }
.pb-mini-ad p { margin: 5px 0 9px; font-size: 11px; line-height: 1.5; color: var(--pb-muted); }
.pb-mini-ad__price { font-size: 15px; font-weight: 800; }
.pb-mini-ad__price small { font-size: 10px; font-weight: 500; color: var(--pb-muted); }
.pb-mini-ad > a { display: inline-flex; margin-top: 10px; padding: 6px 10px; border-radius: 999px; background: #e9f7d9; color: #2d6416; font-size: 11px; font-weight: 800; text-decoration: none; }
.pb-top3-mini { margin-top: 18px; padding: 14px; border: 1px solid var(--pb-line); border-radius: 14px; background: #fff; }
.pb-top3-mini header { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.pb-top3-mini header a { color: var(--pb-muted); font-size: 11px; text-decoration: none; }
.pb-top3-mini ol { display: grid; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
.pb-top3-mini li { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pb-top3-mini li a { display: flex; flex: 1; justify-content: space-between; gap: 8px; min-width: 0; color: inherit; text-decoration: none; }
.pb-top3-mini li strong { flex: 1; min-width: 0; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.pb-top3-mini li em { flex: none; color: var(--pb-muted); font-size: 10px; font-style: normal; }
.pb-right-foot { margin: 18px 0 0; font-size: 10px; line-height: 1.7; color: #9ca3af; }
.pb-right-foot a { color: inherit; text-decoration: none; }
@media (max-width: 1180px) {
  .pb-shell { grid-template-columns: minmax(0, 1fr) 272px; }
  .pb-rail--left { display: none; }
  .pb-main { padding: 28px 24px 48px; }
}
@media (max-width: 900px) {
  .pb-shell { display: block; }
  .pb-rail--right { display: none; }
  .pb-main { padding: 24px 18px 40px; }
}
@media (max-width: 720px) {
  .pb-card-grid--two, .pb-card-grid--three, .pb-where { grid-template-columns: 1fr; }
  .pb-hero h1 { font-size: 30px; }
}
</style>
