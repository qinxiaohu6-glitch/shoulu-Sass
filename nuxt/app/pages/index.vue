<script setup lang="ts">
import { centsLabel } from '~~/shared/content/campaign'
import { englishCount } from '~~/shared/utils/english-count'
import { isoWeekId } from '~~/shared/utils/iso-week'
import { weekPresentation } from '~~/shared/utils/weekly-board'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { BILLBOARD_FLOOR_CENTS } from '~~/shared/utils/billboard-bid'
import { slugForPlacementUrl, samePlacementUrl } from '~~/shared/utils/billboard'
import {
  nextLaunchInstant,
  remainingHms,
} from '~~/shared/utils/directory-window'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const { homeGrid, ranked: billboardRanked } = await useBillboard()
const boardData = await useBoardData()

const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

const cats = computed(() =>
  liveCategories.value
    .filter((entry) => entry.status !== 'deleted')
    .map((entry) => {
      const model = categoryBrowseModel(entry.slug, tools, submitted.value, overrides.value.hidden)
      return { ...localizeCategory(entry, lang.value), ...model }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
)

const billboardKeys = computed(
  () => new Set(billboardRanked.value.map((row) => samePlacementUrl(row.url))),
)

/** Paid Billboard URLs that also have a real listing → our own product page. */
const billboardProductSlugs = computed(() => {
  const out: Record<string, string> = {}
  for (const row of billboardRanked.value) {
    const slug = slugForPlacementUrl(row.url, all.value, overrides.value.hidden)
    if (slug) out[row.url] = slug
  }
  return out
})

function launchBadges(tool: { url?: string; plan?: string; is_featured?: boolean; is_paid?: boolean }): string[] {
  const badges: string[] = []
  if (tool.url && billboardKeys.value.has(samePlacementUrl(tool.url))) badges.push('BILLBOARD')
  if (tool.plan === 'boost' && tool.is_paid) badges.push('BOOST')
  else if (tool.plan === 'pro' && tool.is_paid) badges.push('PRO')
  else if (tool.is_paid && (tool.plan === 'featured' || tool.is_featured)) badges.push('FEATURED')
  return badges
}

const featuredPool = computed(() =>
  all.value.filter(
    (tool) => tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro' || tool.is_featured),
  ),
)
const heroLeft = computed(() => featuredPool.value.slice(0, 3))
const heroRight = computed(() => featuredPool.value.slice(3, 5))

/** Last finished week's podium, from the board archive. Empty when there is none. */
const lastWeekTop3 = computed(() => {
  const week = boardData.value.history?.[0]
  if (!week) return []
  const bySlug = new Map(all.value.map((tool) => [tool.slug, tool]))
  return (week.ranking ?? [])
    .filter((row) => row.votes > 0)
    .slice(0, 3)
    .map((row, i) => {
      const tool = bySlug.get(row.slug)
      return {
        slug: row.slug,
        name: tool?.name ?? row.slug,
        short: tool?.short ?? '',
        votes: row.votes,
        rank: i + 1,
      }
    })
})

const tick = ref(Date.now())
onMounted(() => {
  const id = setInterval(() => {
    tick.value = Date.now()
  }, 1000)
  onBeforeUnmount(() => clearInterval(id))
})

type FeedRow = {
  slug: string
  name: string
  short: string
  logo: string
  category: string
  url?: string
  plan?: string
  is_featured?: boolean
  is_paid?: boolean
  maker?: string
  votes: number
  rank: number
  badges: string[]
}

type WeekGroup = {
  id: string
  label: string
  current: boolean
  rows: FeedRow[]
}

function decorate(
  tool: { slug: string; name: string; short: string; logo: string; category: string; url?: string; plan?: string; is_featured?: boolean; is_paid?: boolean; maker?: string } | undefined,
  slug: string,
  votes: number,
  rank: number,
): FeedRow {
  return {
    slug,
    name: tool?.name ?? slug,
    short: tool?.short ?? '',
    logo: tool?.logo ?? '',
    category: tool?.category ?? '',
    url: tool?.url,
    plan: tool?.plan,
    is_featured: tool?.is_featured,
    is_paid: tool?.is_paid,
    maker: tool?.maker,
    votes,
    rank,
    badges: tool ? launchBadges(tool) : [],
  }
}

/**
 * One continuous board, grouped by ISO week — aligned with ProductsBoost.
 *
 * Each week's list is the products that were *listed in that week* (from each
 * listing's real `created_at`), not only the handful with votes. This is the
 * key difference from the old board: on ProductsBoost a week shows every
 * launch from that week (including 0-vote ones), sorted by votes. Vote counts
 * are merged in from `/api/board`; a product with no vote still appears and
 * sorts last. Paid/boosted rows are pinned above the vote ranks. All week
 * ids and timestamps come from real data — nothing is invented.
 */
function weekOfCreatedAt(value: unknown): string {
  if (!value || typeof value !== 'string') return ''
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value)
  return Number.isFinite(ms) ? isoWeekId(new Date(ms)) : ''
}

/** Every public listing bucketed by the ISO week it was created in. */
const allByWeek = computed(() => {
  const map = new Map<string, typeof all.value>()
  for (const tool of all.value) {
    const wk = weekOfCreatedAt((tool as { created_at?: string }).created_at)
    if (!wk) continue
    const bucket = map.get(wk) ?? []
    bucket.push(tool)
    map.set(wk, bucket)
  }
  return map
})

/** Weeks that actually have listings, newest first — the switcher's ruler. */
const availableWeeks = computed(() => [...allByWeek.value.keys()].sort().reverse())

/** The selected week the board API resolved (?year=&week=, else current). */
const activeWeekId = computed(() =>
  boardData.value.week?.id || boardData.value.current?.id || '',
)

/**
 * The board shows ONE week at a time — the selected week's listings, sorted by
 * paid weight then votes (ProductsBoost's behavior). Time travel is the
 * WeekSwitcher's job; no infinite stacking. Vote counts come from that week's
 * `/api/board` response; a listing with no vote still appears and sorts last.
 */
const weekGroups = computed<WeekGroup[]>(() => {
  const payload = boardData.value
  const id = activeWeekId.value
  const tools = allByWeek.value.get(id) ?? []

  // Vote counts for the selected week only.
  const votesBySlug = new Map<string, number>()
  const boardWeek = id === payload.current?.id ? payload.current : payload.week
  for (const row of boardWeek?.ranking ?? []) votesBySlug.set(row.slug, Number(row.votes) || 0)

  const rows = tools
    .map((tool, index) => decorate(tool, tool.slug, votesBySlug.get(tool.slug) ?? 0, index + 1))
    .sort((a, b) => {
      const aPaid = a.badges.length > 0 ? 1 : 0
      const bPaid = b.badges.length > 0 ? 1 : 0
      if (aPaid !== bPaid) return bPaid - aPaid
      if (a.votes !== b.votes) return b.votes - a.votes
      const aRank = boardWeek?.ranking?.find((r) => r.slug === a.slug)?.rank ?? 9999
      const bRank = boardWeek?.ranking?.find((r) => r.slug === b.slug)?.rank ?? 9999
      return aRank - bRank || a.rank - b.rank
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))

  if (!tools.length) return []
  const presentation = weekPresentation(id)
  return [{
    id,
    label: presentation ? (isZh.value ? presentation.label_zh : presentation.label_en) : id,
    current: id === payload.current?.id,
    rows,
  }]
})

const realFeed = computed(() => weekGroups.value.reduce((sum, group) => sum + group.rows.length, 0))

/**
 * Dev-only visual preview. The local D1 has no votes, so the board renders
 * empty in development and the new row styling cannot be reviewed. This fake
 * feed is guarded by `import.meta.dev` — it is stripped from the production
 * build — and is clearly labelled in the UI as sample data. It never ships.
 */
const PREVIEW_GROUPS: WeekGroup[] = [
  {
    id: 'preview-current',
    label: isZh.value ? '本周 · 实时' : 'This week · live',
    current: true,
    rows: [
      { slug: '__preview_1', name: 'TruHuddle', short: 'Live chat, a shared team inbox and AI agents for customer support.',
        logo: '', category: 'chatbots', url: 'https://truhuddle.example', plan: 'boost', is_paid: true,
        maker: 'Samuel Ntekob', votes: 27, rank: 1, badges: ['BOOST'] },
      { slug: '__preview_2', name: 'Refund Score', short: 'A Trustpilot alternative for SaaS, courses and directories.',
        logo: '', category: 'finance', url: 'https://refundscore.example', plan: 'featured', is_paid: true,
        maker: 'Tom Baker', votes: 16, rank: 2, badges: ['FEATURED'] },
      { slug: '__preview_3', name: 'Healthy Raho', short: '健康、饮食、瑜伽和阿育吠陀的可靠信息。',
        logo: '', category: 'health', url: 'https://healthyraho.example', maker: 'HealthyRaho',
        votes: 9, rank: 3, badges: [] },
    ],
  },
]
const isPreview = computed(() => import.meta.dev && realFeed.value === 0)
const groups = computed(() => (isPreview.value ? PREVIEW_GROUPS : weekGroups.value))

const nextAt = computed(() => nextLaunchInstant(all.value, tick.value))
const clock = computed(() => (nextAt.value ? remainingHms(nextAt.value, tick.value) : null))

const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)
const featuredQuote = computed(() => effectiveQuote('listing', 'featured', tick.value))
const standardQuote = computed(() => effectiveQuote('listing', 'standard', tick.value))
const proQuote = computed(() => effectiveQuote('listing', 'pro', tick.value))
const boostQuote = computed(() => effectiveQuote('listing', 'boost', tick.value))
const sidebarQuote = computed(() => effectiveQuote('sidebar', '1'))

// Real booked ads (if any) drive the rail; empty slots show an honest placeholder.
const { sidebar: bookedSidebar } = await useAds()
const adsTo = computed(() => `${localePath('/sponsor')}`)
const bookSidebarTo = computed(() => `${localePath('/book-ad')}?slot=sidebar&weeks=1`)

const featuredTo = computed(() => `${localePath('/submit')}?plan=featured`)
const featuredCta = computed(() => pick('去付款 · 精选', 'Pay · Featured'))
const boostTo = computed(() => `${localePath('/submit')}?plan=boost`)

/** Homepage hero: paste a URL → prefill the submit draft in one step. */
const heroUrl = ref('')
function launchFromHero() {
  let value = heroUrl.value.trim()
  if (!value) {
    navigateTo(localePath('/submit'))
    return
  }
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    // Validate before navigating so garbage never reaches the draft step.
    const parsed = new URL(value)
    if (!parsed.hostname.includes('.')) throw new Error('bad host')
    navigateTo(`${localePath('/submit')}?url=${encodeURIComponent(parsed.toString())}`)
  } catch {
    navigateTo(localePath('/submit'))
  }
}

function categoryName(slug: string): string {
  const found = categoryBySlug(slug, liveCategories.value)
  return found ? localizeCategory(found, lang.value).name : ''
}

/** Bare hostname for the compact domain line, no scheme or trailing slash. */
function hostOf(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const proofs = computed(() => [
  pick('页面会留下来', 'A page that stays up'),
  pick(
    '可以免费提交，或一次付费，付款成功后上线。',
    'Free to list, or pay once to go live when payment succeeds.',
  ),
  pick('Billboard 从 $10 起，无订阅', 'Billboard from $10, no subscription'),
])

const faq = computed(() => {
  const standard = standardQuote.value.priceLabel
  const featured = featuredQuote.value.priceLabel
  const pro = proQuote.value.priceLabel
  return isZh.value
    ? [
        {
          q: '提交要花钱吗？',
          a: `免费收录 0 元。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。链接是 nofollow。标准一次性 ${standard}：付款成功后自动收录发布、永久 dofollow、目录页排在免费收录之前。精选 ${featured}：再加目录页和分类页置顶 7 天、首页精选卡。专业 ${pro}：分类页置顶 90 天、全年 4 次文案修改。问题发到页脚的联系地址。都是单次付费，不是订阅。Billboard 从 ${floorLabel} 起自己出价，此前从 $15 起。`,
        },
        {
          q: '多久能上线？',
          a: '付费档在付款成功后自动发布。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。',
        },
        {
          q: '免费收录的链接是 nofollow 吗？',
          a: '是。免费不收钱，链接就是 nofollow，页面照样永久保留、照常进每周榜单。要 dofollow 需要付费，付费之后没有附加条件：不用挂我们的 badge，不会定期复查，也不会因为某天忘了续费而消失。',
        },
        {
          q: '上线后还能改吗？',
          a: '可以。在「我的提交」里随时修改，已上线的条目改动后会重新过一遍审核。',
        },
      ]
    : [
        {
          q: 'How much does it cost?',
          a: `A free listing costs nothing. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy. It carries a nofollow link. Standard is a one-time ${standard}: published automatically as soon as payment succeeds, permanent dofollow, listed above every free submission. Featured is ${featured} and adds a 7-day pin on the directory and category pages plus the homepage card. Pro is ${pro} for a 90-day category pin and four copy edits a year. Questions go to the contact address in the footer. All one-time payments, never a subscription. Billboard is name-your-price from ${floorLabel}; was from $15.`,
        },
        {
          q: 'How fast does my listing go live?',
          a: 'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
        },
        {
          q: 'Is the free link nofollow?',
          a: 'Yes. Free listings cost nothing, so the link is nofollow — the page still stays up forever and still competes on the weekly board. Dofollow comes with a paid listing, and there are no strings attached to it: no badge to install, no periodic re-check, nothing that expires while you are not looking.',
        },
        {
          q: 'Can I edit after it goes live?',
          a: 'Yes, any time from My submissions. Edits to a live listing are re-reviewed before they publish.',
        },
      ]
})

const openFaq = ref(-1)
const browseOpen = ref(false)

useSeo({
  title: computed(() =>
    isZh.value
      ? '发布产品，获得长期曝光 | Product Atlas 产品目录'
      : 'List your product, get found | Product Atlas directory',
  ),
  description: computed(() =>
    isZh.value
      ? '在 Product Atlas 免费提交产品，获得一页永久产品页与 dofollow 链接。可被搜索引擎收录、被 AI 读取，一次付费升级，无订阅。'
      : 'Submit your product free to Product Atlas. Get a permanent product page with a dofollow link, indexed by search engines and readable by AI. Upgrade once, no subscription.',
  ),
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.value.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="container">
    <div class="home-stage">
      <div class="home-stage__sides">
        <aside class="home-feat home-feat--left" :aria-label="pick('精选', 'Featured')">
          <p class="home-feat__kicker">FEATURED</p>
          <NuxtLink
            v-for="tool in heroLeft"
            :key="tool.slug"
            class="feat-card"
            :to="localePath(`/products/${tool.slug}`)"
          >
            <ToolLogo :logo="tool.logo" :name="tool.name" :size="36" decorative />
            <span>
              <strong>{{ tool.name }} <em>FEATURED</em></strong>
              <small>{{ tool.short }}</small>
            </span>
          </NuxtLink>
        </aside>

        <section class="mk-hero mk-hero--center mk-hero--launch hero-launch">
          <h1 class="hero-launch__title">
            {{ pick('发布你的产品。', 'List your product.') }}<br>
            <span class="hero-launch__accent">{{ pick('被看见，不被埋没。', 'Get found, not buried.') }}</span>
          </h1>
          <p class="hero-launch__sub">
            {{
              pick(
                '一页永久产品页，含 dofollow 链接——可被搜索引擎收录，也能被 AI 读懂。免费提交，一次付费即可升级，无订阅。',
                'A permanent product page with a dofollow link — indexed by search engines and readable by AI. Submit free, upgrade once, no subscription.',
              )
            }}
          </p>
          <form class="hero-launch__form" @submit.prevent="launchFromHero">
            <label class="sr-only" for="hero-url">{{ pick('你的网址', 'Your website') }}</label>
            <span class="hero-launch__globe" aria-hidden="true">🌐</span>
            <input
              id="hero-url"
              v-model="heroUrl"
              type="text"
              inputmode="url"
              autocomplete="url"
              :placeholder="pick('yourproduct.com', 'yourproduct.com')"
              :aria-label="pick('你的网址', 'Your website')"
            >
            <button class="hero-launch__btn" type="submit">
              {{ pick('免费提交', 'List it free') }}
              <Icon name="arrow-right" />
            </button>
          </form>
          <p class="hero-launch__note">
            {{ pick('免费收录。dofollow 链接一次付费，无订阅、无续费。', 'Free to list. Dofollow link is a one-time payment — no subscription, no renewal.') }}
          </p>
        </section>

        <aside class="home-feat home-feat--right" :aria-label="pick('精选', 'Featured')">
          <p class="home-feat__kicker">FEATURED</p>
          <NuxtLink
            v-for="tool in heroRight"
            :key="tool.slug"
            class="feat-card"
            :to="localePath(`/products/${tool.slug}`)"
          >
            <ToolLogo :logo="tool.logo" :name="tool.name" :size="36" decorative />
            <span>
              <strong>{{ tool.name }} <em>FEATURED</em></strong>
              <small>{{ tool.short }}</small>
            </span>
          </NuxtLink>
          <NuxtLink class="feat-card feat-card--open" :to="featuredTo">
            <span class="feat-card__mark" aria-hidden="true">★</span>
            <span>
              <strong>{{ pick('你的产品在这里', 'Your product here') }}</strong>
              <small>{{ pick('全站精选位', 'Featured across the site') }}</small>
            </span>
          </NuxtLink>
        </aside>
      </div>
    </div>

    <BillboardGrid :cells="homeGrid" :product-slugs="billboardProductSlugs" />

    <WeekSwitcher v-if="activeWeekId" :active-id="activeWeekId" :weeks="availableWeeks" />

    <div class="home-dir">
      <aside class="home-dir__left" :class="{ 'is-open': browseOpen }">
        <button class="home-dir__toggle" type="button" @click="browseOpen = !browseOpen">
          {{ pick('浏览', 'Browse') }}
          <span>{{ browseOpen ? '–' : '+' }}</span>
        </button>
        <div class="home-dir__panel">
          <p class="home-dir__kicker">{{ pick('目录', 'DIRECTORY') }}</p>
          <p class="home-dir__stat"><strong>{{ all.length }}</strong> {{ isZh ? '个产品已收录' : `${englishCount(all.length, 'product')} listed` }}</p>
          <p class="home-dir__kicker">{{ pick('类别', 'CATEGORIES') }}</p>
          <ul class="home-dir__cats">
            <li v-for="cat in cats" :key="cat.slug">
              <NuxtLink :to="localePath(`/categories/${cat.slug}`)">{{ cat.name }}</NuxtLink>
              <em>{{ cat.count }}</em>
            </li>
          </ul>
          <NuxtLink class="more" :to="localePath('/categories')">{{ pick('查看全部', 'View all') }}</NuxtLink>

          <div class="rail-promo rail-promo--boost">
            <p class="rail-promo__kicker">{{ pick('加速上线', 'BOOST YOUR LAUNCH') }}</p>
            <p class="rail-promo__big">{{ boostQuote.priceLabel }} <small>{{ pick('一次性', 'one-time') }}</small></p>
            <p class="rail-promo__copy">
              {{ pick('金色认证徽章、榜单高亮、dofollow 链接。', 'Gold verified badge, a highlighted row, a dofollow link.') }}
            </p>
            <NuxtLink class="rail-promo__cta" :to="boostTo">
              {{ pick('立即加速', 'Boost now') }} →
            </NuxtLink>
          </div>
        </div>
      </aside>

      <section class="home-dir__main" aria-labelledby="just-launched-title">
        <WeeklyPulse />
        <p class="home-dir__kicker">{{ pick('实时目录', 'LIVE DIRECTORY') }}</p>
        <div class="home-dir__head">
          <h2 id="just-launched-title">{{ pick('刚刚发布', 'Just launched') }}</h2>
          <p v-if="clock" class="home-clock" :aria-label="pick('下一次发布', 'Next publish')">
            <i />
            {{ pick('下一次发布', 'Next publish') }}
            <b>{{ clock.h }}h</b>
            <b>{{ clock.m }}m</b>
            <b>{{ clock.s }}s</b>
          </p>
        </div>
        <template v-for="group in groups" :key="group.id">
          <div class="pb-week-head">
            <h3>{{ group.label }}</h3>
            <span v-if="group.current" class="pb-week-head__live">{{ pick('实时', 'LIVE') }}</span>
          </div>
          <ol class="home-feed">
            <li
              v-for="row in group.rows"
              :key="row.slug"
              class="pb-row"
              :class="{
                'pb-row--featured': row.badges.length > 0,
                'pb-row--podium': group.current && row.rank <= 3,
              }"
            >
              <span class="pb-row__rank" :class="`is-${row.rank}`">
                <span v-if="group.current && row.rank === 1" class="pb-row__crown" aria-hidden="true">♛</span>
                <em>{{ row.rank }}</em>
              </span>
              <component
                :is="isPreview ? 'span' : 'NuxtLink'"
                class="pb-row__link"
                :to="isPreview ? undefined : localePath(`/products/${row.slug}`)"
              >
                <span class="pb-row__logo">
                  <ToolLogo :logo="row.logo" :name="row.name" :size="56" decorative />
                </span>
                <span class="pb-row__body">
                  <strong class="pb-row__title">
                    {{ row.name }}
                    <span class="pb-row__verified" :title="pick('已验证收录', 'Verified listing')">✓</span>
                    <em v-for="badge in row.badges" :key="badge" class="pb-row__badge">{{ badge }}</em>
                  </strong>
                  <span class="pb-row__desc">{{ row.short }}</span>
                  <span class="pb-row__meta">
                    <em v-if="row.url" class="pb-row__domain">🌐 {{ hostOf(row.url) }}</em>
                    <em v-if="categoryName(row.category)" class="pb-row__cat">🏷 {{ categoryName(row.category) }}</em>
                    <em v-if="row.maker" class="pb-row__maker">👤 {{ isZh ? '由' : 'by' }} {{ row.maker }}</em>
                  </span>
                </span>
              </component>
              <NuxtLink v-if="!isPreview" class="pb-row__visit" :to="localePath(`/products/${row.slug}`)" :aria-label="pick('查看产品', 'View product')">↗</NuxtLink>
              <span v-else class="pb-row__visit pb-row__visit--static" aria-hidden="true">↗</span>
              <VoteButton v-if="!isPreview" stack :slug="row.slug" :votes="row.votes" />
              <span v-else class="pb-row__vote-static" :class="{ 'pb-row__vote-static--featured': row.badges.length > 0 }">
                <Icon name="arrow-up" />
                <b>{{ row.votes }}</b>
              </span>
            </li>
          </ol>
        </template>
        <p v-if="isPreview" class="pb-preview-note">
          {{ pick('预览示例：本地无投票数据，以下为开发模式示例行（生产不会显示）。', 'Preview sample: no local votes. These sample rows are dev-only and never ship.') }}
        </p>
        <p v-if="!groups.length" class="home-feed__empty">
          {{ pick('榜上还没有票。', 'No votes on the board yet.') }}
          <NuxtLink :to="localePath('/submit')">{{ pick('提交产品', 'Submit a product') }}</NuxtLink>
        </p>
      </section>

      <aside class="home-dir__right" aria-labelledby="featured-sell-title">
        <section v-if="lastWeekTop3.length" class="pb-top3" aria-labelledby="pb-top3-title">
          <div class="pb-top3__head">
            <h2 id="pb-top3-title">🏆 {{ pick('上周前三', "Last week's top 3") }}</h2>
            <NuxtLink :to="localePath('/weekly')">{{ pick('查看全部', 'See all') }} ›</NuxtLink>
          </div>
          <ol class="pb-top3__list">
            <li v-for="row in lastWeekTop3" :key="row.slug">
              <span class="pb-top3__medal" :class="`is-${row.rank}`">{{ row.rank }}</span>
              <NuxtLink class="pb-top3__body" :to="localePath(`/products/${row.slug}`)">
                <strong>{{ row.name }}</strong>
                <em>{{ row.short }}</em>
              </NuxtLink>
              <span class="pb-top3__votes"><b>{{ row.votes }}</b> {{ pick('票', 'upvotes') }}</span>
            </li>
          </ol>
        </section>

        <p class="home-dir__kicker">{{ pick('精选', 'FEATURED') }}</p>
        <section class="feat-sell">
          <span class="launch-row__badge">FEATURED</span>
          <h2 id="featured-sell-title">{{ pick('你的产品', 'Your product') }}</h2>
          <p>{{ pick('固定在首页与目录里。一次性，不是月费。', 'Pinned on the homepage and in the directory. One-time, not a monthly fee.') }}</p>
          <ul>
            <li>{{ pick('首页精选卡', 'Homepage featured card') }}</li>
            <li>{{ pick('目录页和分类页置顶', 'Pinned in the directory and category pages') }}</li>
            <li>{{ pick('永久产品页', 'Permanent product page') }}</li>
          </ul>
          <p class="feat-sell__price">
            <s v-if="featuredQuote.strikeLabel">{{ featuredQuote.strikeLabel }}</s>
            <b>{{ featuredQuote.priceLabel }}</b>
            <span>{{ pick('一次性', 'one-time') }}</span>
          </p>
          <NuxtLink class="btn btn--primary btn--block" :to="featuredTo">
            {{ featuredCta }}
          </NuxtLink>
          <p class="feat-sell__note">
            {{ pick('付款成功后上线。', 'It goes live when payment succeeds.') }}
          </p>
        </section>
        <ul class="feat-mini">
          <li v-for="tool in featuredPool.slice(0, 4)" :key="tool.slug">
            <NuxtLink :to="localePath(`/products/${tool.slug}`)">
              <ToolLogo :logo="tool.logo" :name="tool.name" :size="32" decorative />
              <span>
                <strong>{{ tool.name }}</strong>
                <em>FEATURED</em>
                <small>{{ tool.short }}</small>
              </span>
            </NuxtLink>
          </li>
        </ul>

        <div class="rail-ad">
          <p class="rail-ad__kicker">{{ pick('广告位', 'ADVERTISE') }} <NuxtLink :to="adsTo">{{ pick('全部价格', 'All prices') }} ›</NuxtLink></p>

          <a v-if="bookedSidebar && bookedSidebar.url" class="rail-ad__card rail-ad__card--live" :href="bookedSidebar.url" target="_blank" rel="noopener">
            <ToolLogo :logo="bookedSidebar.logo" :name="bookedSidebar.name" :size="36" decorative />
            <span class="rail-ad__body">
              <strong>{{ bookedSidebar.name }}</strong>
              <em>{{ pick('赞助', 'Sponsored') }}</em>
              <small>{{ bookedSidebar.headline }}</small>
            </span>
          </a>

          <div v-else class="rail-ad__card rail-ad__card--open">
            <span class="rail-ad__mark" aria-hidden="true">📣</span>
            <span class="rail-ad__body">
              <strong>{{ pick('你的广告在这里', 'Your ad here') }}</strong>
              <em>{{ pick('右栏广告 · 每周', 'Right sidebar · per week') }}</em>
              <small>{{ pick('每页展示，面向早期用户与开发者。', 'Shown on every page to makers and early adopters.') }}</small>
              <span class="rail-ad__foot">
                <b>{{ sidebarQuote.priceLabel }}<small>/{{ pick('周', 'week') }}</small></b>
                <NuxtLink :to="bookSidebarTo">{{ pick('预订此位', 'Book this spot') }} →</NuxtLink>
              </span>
            </span>
          </div>

          <NuxtLink class="rail-ad__card rail-ad__card--featured" :to="`${localePath('/billboard')}#claim`">
            <span class="rail-ad__mark" aria-hidden="true">👑</span>
            <span class="rail-ad__body">
              <strong>{{ pick('首页精选位', 'Featured spot') }}</strong>
              <em>{{ pick('榜单前三下方 · 每周一个品牌', 'Under the top 3 · one brand per week') }}</em>
              <span class="rail-ad__foot">
                <b>{{ pick('从', 'from') }} {{ floorLabel }}</b>
                <span>{{ pick('查看位置', 'See spot') }} →</span>
              </span>
            </span>
          </NuxtLink>
        </div>
      </aside>
    </div>

    <section class="home-faq">
      <h2>{{ pick('常见问题', 'Questions') }}</h2>
      <div class="accordion">
        <div v-for="(item, i) in faq" :key="item.q" class="acc-item" :class="{ 'is-open': openFaq === i }">
          <button class="acc-trigger" type="button" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? -1 : i">
            {{ item.q }}
            <Icon name="chevron-down" />
          </button>
          <div class="acc-panel">{{ item.a }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ---- Simplified launch hero: headline + one URL box ---- */
.hero-launch { padding: 26px 0 30px; }
.hero-launch__title {
  margin: 0 auto; max-width: 20ch;
  font-size: clamp(38px, 5.6vw, 62px); line-height: 1.06;
  font-weight: 850; letter-spacing: -0.045em; text-wrap: balance;
}
.hero-launch__accent { color: #dc3545; }
.hero-launch__sub {
  margin: 18px auto 0; max-width: 46rem;
  font-size: 16px; line-height: 1.6; color: var(--muted-foreground); text-wrap: balance;
}
.hero-launch__form {
  display: flex; align-items: center; gap: 10px;
  max-width: 640px; margin: 26px auto 0; padding: 8px 8px 8px 18px;
  border: 1px solid var(--border, #e5e7eb); border-radius: 16px;
  background: var(--card, #fff); box-shadow: 0 6px 22px rgba(20,12,4,.06);
}
.hero-launch__form:focus-within { border-color: var(--primary, #b45309); box-shadow: 0 0 0 3px rgba(180,83,9,.12); }
.hero-launch__globe { flex: none; font-size: 18px; opacity: .6; }
.hero-launch__form input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 16px; color: var(--foreground, #1a1a1a);
}
.hero-launch__form input::placeholder { color: var(--muted-foreground, #9ca3af); }
.hero-launch__btn {
  flex: none; display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border: 0; border-radius: 11px; cursor: pointer;
  background: #dc3545; color: #fff; font: inherit; font-size: 14px; font-weight: 750;
  transition: background .15s, transform .1s;
}
.hero-launch__btn:hover { background: #c62d3c; }
.hero-launch__btn:active { transform: scale(.98); }
.hero-launch__btn svg { width: 16px; height: 16px; }
.hero-launch__note { margin: 14px auto 0; font-size: 12.5px; color: var(--muted-foreground); text-align: center; }
@media (max-width: 560px) {
  .hero-launch__form { flex-wrap: wrap; padding: 12px; }
  .hero-launch__form input { flex-basis: calc(100% - 34px); }
  .hero-launch__btn { width: 100%; justify-content: center; }
}

/* ---- Left rail: Boost promo card ---- */
.rail-promo {
  margin-top: 22px; padding: 16px; border-radius: 16px;
  border: 1.5px solid var(--border, #e5e7eb); background: var(--card, #fff);
}
.rail-promo__kicker { margin: 0 0 8px; font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--primary, #b45309); }
.rail-promo__big { margin: 0 0 6px; font-size: 26px; font-weight: 850; letter-spacing: -0.03em; }
.rail-promo__big small { font-size: 11px; font-weight: 600; color: var(--muted-foreground); }
.rail-promo__copy { margin: 0 0 12px; font-size: 12px; line-height: 1.5; color: var(--muted-foreground); }
.rail-promo__cta { display: inline-block; font-size: 12px; font-weight: 800; color: var(--primary, #b45309); text-decoration: none; }
.rail-promo__cta:hover { text-decoration: underline; }

/* ---- Right rail: advertising slots ---- */
.rail-ad { margin-top: 20px; }
.rail-ad__kicker { display: flex; align-items: center; justify-content: space-between; margin: 0 0 10px; font-size: 11px; font-weight: 800; letter-spacing: .08em; color: var(--muted-foreground); }
.rail-ad__kicker a { font-size: 11px; font-weight: 600; color: var(--muted-foreground); text-decoration: none; letter-spacing: 0; }
.rail-ad__kicker a:hover { color: var(--primary, #b45309); }
.rail-ad__card {
  display: flex; gap: 12px; align-items: flex-start; min-width: 0;
  padding: 14px; margin-bottom: 12px; border-radius: 14px; text-decoration: none; color: inherit;
  background: var(--card, #fff); border: 1.5px dashed #d9dce2;
}
.rail-ad__card--live { border-style: solid; }
.rail-ad__card--featured { border-style: solid; border-color: #e7c987; background: #fffaf0; }
.rail-ad__mark { flex: none; font-size: 22px; line-height: 1; }
.rail-ad__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rail-ad__body strong { font-size: 13px; font-weight: 800; }
.rail-ad__body em { font-style: normal; font-size: 11px; color: var(--muted-foreground); }
.rail-ad__body small { font-size: 11px; line-height: 1.45; color: var(--muted-foreground); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.rail-ad__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; }
.rail-ad__foot b { font-size: 14px; font-weight: 850; }
.rail-ad__foot b small { font-size: 11px; font-weight: 600; }
.rail-ad__foot a, .rail-ad__foot span { font-size: 11px; font-weight: 800; color: var(--primary, #b45309); text-decoration: none; }

/* ---- Last week's top 3 rail card ---- */
.pb-top3 {
  min-width: 0;
  padding: 16px;
  margin-bottom: 18px;
  border: 1.5px dashed #d9dce2;
  border-radius: 16px;
  background: var(--card, #fff);
}
.pb-top3__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.pb-top3__head h2 { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
.pb-top3__head a { font-size: 12px; color: var(--muted-foreground); text-decoration: none; }
.pb-top3__head a:hover { color: var(--primary, #b45309); }
/* minmax(0,1fr) is required: a bare `grid` column resolves to max-content and
   lets a long product description blow past the 280px rail (horizontal scroll). */
.pb-top3__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.pb-top3__list li { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pb-top3__medal {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%; background: #eef0f3; color: #6b7280;
  font-size: 12px; font-weight: 800;
}
.pb-top3__medal.is-1 { background: #f5b426; color: #4a3400; }
.pb-top3__medal.is-2 { background: #c9ced6; color: #2a2d33; }
.pb-top3__medal.is-3 { background: #e0b48a; color: #3a2a1a; }
.pb-top3__body { min-width: 0; flex: 1; display: flex; flex-direction: column; text-decoration: none; color: inherit; }
.pb-top3__body strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-top3__body em { font-style: normal; font-size: 11px; color: var(--muted-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-top3__votes { flex: none; font-size: 11px; color: var(--muted-foreground); white-space: nowrap; }
.pb-top3__votes b { font-size: 14px; color: var(--foreground); }

/* ---- ProductsBoost-style launch rows ---- */
.pb-week-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}
.pb-week-head:first-child { margin-top: 0; }
.pb-week-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--foreground, #1a1a1a);
}
.pb-week-head__live {
  padding: 2px 8px;
  border-radius: 9999px;
  background: #e7f6ec;
  color: #0b7a3b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.home-feed {
  display: grid;
  gap: 12px;
}
.pb-row {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 34px auto;
  align-items: center;
  gap: 12px;
  padding: 16px 16px;
  border: 1.5px solid #e5e7eb;
  border-radius: 16px;
  background: var(--card, #fff);
}
.pb-row--featured {
  border-color: #e5b53a;
  background: linear-gradient(100deg, #fff7e0 0%, #fffaf0 70%, #fff 100%);
  box-shadow: 0 1px 0 #f5d987 inset;
}
.pb-row__rank {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.pb-row__rank em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #eef0f3;
  color: #6b7280;
  font-style: normal;
  font-weight: 800;
  font-size: 15px;
}
.pb-row__rank.is-1 em { background: #f5b426; color: #4a3400; }
.pb-row__rank.is-2 em { background: #c9ced6; color: #2a2d33; }
.pb-row__rank.is-3 em { background: #e0b48a; color: #3a2a1a; }
.pb-row__crown {
  position: absolute;
  top: -14px;
  font-size: 20px;
  color: #e5a023;
  line-height: 1;
}
.pb-row__link {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.pb-row__logo {
  flex: none;
  display: inline-flex;
  padding: 3px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.pb-row--featured .pb-row__logo { border-color: #e5b53a; }
.pb-row__body { min-width: 0; display: block; }
.pb-row__title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 16px;
}
.pb-row__verified {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #2f80ed;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
}
.pb-row__badge {
  font-style: normal;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f5b426;
  color: #4a3400;
}
.pb-row__desc {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pb-row__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 7px;
}
.pb-row__meta em {
  font-style: normal;
  font-size: 11px;
  color: #6b7280;
}
.pb-row__domain { color: #0b7a3b !important; }
.pb-row__visit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  color: #9ca3af;
  text-decoration: none;
  font-size: 16px;
}
.pb-row__visit:hover { color: var(--primary, #b45309); background: #f5f5f5; }
.pb-row__visit--static { cursor: default; }
.pb-row__vote-static {
  display: inline-flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 54px;
  min-width: 54px;
  padding: 8px 6px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  background: #f8f9fb;
  color: #6b7280;
}
.pb-row__vote-static--featured {
  background: #f5b426;
  border-color: #e0a020;
  color: #4a3400;
}
.pb-row__vote-static svg {
  display: block;
  flex: none;
  width: 16px;
  height: 16px;
}
.pb-row__vote-static b { font-size: 15px; }
.pb-preview-note {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff4d6;
  border: 1px solid #f0d48a;
  color: #8a6100;
  font-size: 12px;
}
/* vote button block — override the generic .vote for this list */
.pb-row :deep(.vote--stack) {
  display: inline-flex;
  flex: none;
  width: 54px;
  min-width: 54px;
  height: auto;
  padding: 8px 6px;
  gap: 2px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  background: #f8f9fb;
  color: #6b7280;
  line-height: 1.2;
}
.pb-row :deep(.vote--stack svg) {
  display: block;
  flex: none;
  width: 16px;
  height: 16px;
}
.pb-row--featured :deep(.vote--stack) {
  background: #f5b426;
  color: #4a3400;
  border-color: #e0a020;
}
@media (max-width: 760px) {
  .pb-row { grid-template-columns: 30px minmax(0, 1fr) auto; gap: 8px; padding: 12px; }
  .pb-row__visit { display: none; }
  .pb-row__logo { display: none; }
  .pb-row__rank em { width: 28px; height: 28px; font-size: 13px; }
}
</style>
