<script setup lang="ts">
import { NuxtLink } from '#components'
import { centsLabel } from '~~/shared/content/campaign'
import { adPriceCents } from '~~/shared/content/pricing'
import { englishCount } from '~~/shared/utils/english-count'
import { liveRankingRows } from '~~/shared/utils/archive-rows'
import { isoWeekId } from '~~/shared/utils/iso-week'
import { weekFromQuery, weekPresentation } from '~~/shared/utils/weekly-board'
import { adAfterRank } from '~~/shared/utils/feed-ad'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { slugForPlacementUrl, samePlacementUrl } from '~~/shared/utils/billboard'
import {
  nextLaunchInstant,
  remainingHms,
} from '~~/shared/utils/directory-window'
import {
  SCHEMA_SITE,
  SCHEMA_SITE_NAME,
  faqPageSchema,
  itemListSchema,
  siteEntitySchema,
} from '~~/shared/utils/schema'
import { CONTACT_EMAIL, SOCIAL_X_URL } from '~~/shared/content/site-contact'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const submitted = await useSubmittedTools()
const submittedApps = await useSubmittedApps({ key: 'home-submitted-apps' })
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const { homeGrid, ranked: billboardRanked } = await useBillboard()
const boardData = await useBoardData()

/**
 * Slots 1–2 ride the left rail and 3–5 the right, so reading the page
 * left-to-right still runs 1→5. Splitting 3/2 would put rank 3 in the left
 * column and rank 1 in the right.
 */
const billboardLeft = computed(() => homeGrid.value.slice(0, 2))
const billboardRight = computed(() => homeGrid.value.slice(2))

const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

/** The app slot is deliberately separate from the ranked product feed and ad rows. */
const homeApps = computed(() => submittedApps.value.slice(0, 3))
const appMeta = (app: (typeof submittedApps.value)[number]) => {
  const stores = app.app_stores ?? []
  const platformLabels = { ios: 'iOS', android: 'Android', macos: 'Mac' }
  const rated = stores.find((store) => store.rating !== null)
  const rating = rated?.rating ?? null
  return {
    platforms: [...new Set(stores.map((store) => platformLabels[store.platform]))],
    // `hasRating` keeps the template narrowing explicit: template type-checking
    // cannot narrow a repeated function call, so `rating` is widened to a number.
    hasRating: rating !== null,
    rating: rating ?? 0,
    ratingCount: rated?.ratingCount ?? 0,
  }
}

/**
 * Entrance motion for the app slot. The animation classes are only applied
 * after mount, so SSR (and a failed hydration) still renders the slot fully
 * visible instead of leaving it stuck at opacity 0.
 */
const appSlotEl = ref<HTMLElement | null>(null)
const appSlotMounted = ref(false)
const appSlotVisible = ref(false)
onMounted(() => {
  appSlotMounted.value = true
  const el = appSlotEl.value
  if (!el || typeof IntersectionObserver === 'undefined') {
    appSlotVisible.value = true
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      appSlotVisible.value = true
      observer.disconnect()
    },
    { threshold: 0.2 },
  )
  observer.observe(el)
  onBeforeUnmount(() => observer.disconnect())
})

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
  // A row whose listing has since been deleted has no name to show and no page
  // to link to, so it drops out and the podium takes the next live listing.
  return liveRankingRows(week.ranking, all.value)
    .filter((row) => Number(row.votes) > 0)
    .slice(0, 3)
    .map((row, i) => ({
      slug: row.slug,
      name: row.tool.name,
      short: row.tool.short,
      votes: Number(row.votes) || 0,
      rank: i + 1,
    }))
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
const requestedWeekId = computed(() =>
  boardData.value.week?.id || boardData.value.current?.id || '',
)

/**
 * The week the feed renders.
 *
 * On Monday morning the open week has no launches yet, so `requestedWeekId`
 * points at an empty bucket and the page would open with "no votes yet" under
 * a live week label — every Monday, on the busiest page. Falling back to the
 * newest week that does have rows keeps something to read; the header prints
 * that week's real date range, and the switcher still reaches the open week.
 * An explicit ?year=&week= is honoured either way: if a visitor asked for an
 * empty week, that is the answer.
 */
const activeWeekId = computed(() => {
  const requested = requestedWeekId.value
  if (!requested) return availableWeeks.value[0] || ''
  if (weekFromQuery(route.query as Record<string, unknown>)) return requested
  if ((allByWeek.value.get(requested)?.length ?? 0) > 0) return requested
  return availableWeeks.value[0] || requested
})

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

  // Vote counts for the week on screen. `activeWeekId` can fall back to the
  // newest week that has rows (see above), and `/api/board` answers the
  // *requested* week — so the ranking has to be looked up by id across the
  // current week, the selected one and the archive. Reading `payload.week`
  // blindly printed 0 votes on every row whenever the fallback kicked in.
  const votesBySlug = new Map<string, number>()
  const boardWeek = [payload.current, payload.week, ...(payload.history ?? [])].find(
    (week) => week?.id === id,
  )
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
/* The sheen belongs to the #1 on screen, not to the #1 of every week block:
   if the feed ever stacks more than one week, `row.rank === 1` alone would
   light up a dozen rows at once. */
const liveGroupId = computed(() => (groups.value.find((group) => group.current) ?? groups.value[0])?.id)

const nextAt = computed(() => nextLaunchInstant(all.value, tick.value))
const clock = computed(() => (nextAt.value ? remainingHms(nextAt.value, tick.value) : null))

const boardLabel = centsLabel(adPriceCents('board', 1))
const boostQuote = computed(() => effectiveQuote('listing', 'boost', tick.value))
const sidebarQuote = computed(() => effectiveQuote('sidebar', '1'))

// Real booked ads (if any) drive the rail; empty slots show an honest placeholder.
const { sidebar: bookedSidebar, board: bookedBoard, app: bookedApp } = await useAds()
const adsTo = computed(() => `${localePath('/sponsor')}`)
const bookSidebarTo = computed(() => `${localePath('/book-ad')}?slot=sidebar&weeks=1`)

const boostTo = computed(() => `${localePath('/submit')}?plan=boost`)
const boardAdTo = computed(() => `${localePath('/book-ad')}?slot=board&weeks=1`)

/**
 * Where the sponsored row sits in the feed: after third place, the same rule
 * the /weekly table follows and the same sentence the slot is sold with.
 * `groups` holds one week, so the first group is the feed on screen.
 */
const adAnchor = computed(() => adAfterRank(groups.value[0]?.rows.length ?? 0))

/** Copy for the empty slot. The price comes from the pricing table, not here. */
const adPitch = computed(() =>
  pick(
    `榜单前三下方 · 整周展示 · ${boardLabel}/周 · 每周仅一位`,
    `Under the top 3, all week · ${boardLabel} / week · one slot per week`,
  ),
)

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

const faq = computed(() => {
  const boost = boostQuote.value.priceLabel
  return isZh.value
    ? [
        {
          q: '提交要花钱吗？',
          a: `免费收录 0 元。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。链接是 nofollow。Boost 一次 ${boost}：付款成功后上线，永久 dofollow，金色认证徽章，高亮行排在免费收录之前。发布榜广告 ${boardLabel}/周，每周一个品牌。右栏按周租。都不是订阅。已经买过的置顶留到原定日期结束。`,
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
          a: `A free listing costs nothing. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy. It carries a nofollow link. Boost is one payment of ${boost}: it goes live when payment succeeds, with a permanent dofollow link, a gold verified badge, and a highlighted row above free listings. The launch-board ad is ${boardLabel} a week, one brand. The sidebar is rented by the week. Nothing is a subscription. A pin already paid for stays until its original end date.`,
        },
        {
          q: 'How fast does my listing go live?',
          a: 'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
        },
        {
          q: 'Is the free link nofollow?',
          a: 'Yes. A free listing is nofollow. The page stays up and can still appear on the weekly board. Boost includes a permanent dofollow backlink. It does not expire, and you do not have to place a badge on your site to keep it.',
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
      ? '提交软件产品，获得永久目录页 | dirtool'
      : 'Submit your software product | dirtool',
  ),
  description: computed(() =>
    isZh.value
      ? '向 dirtool 提交软件产品。免费收录由人工审核，链接为 nofollow。付费收录在付款成功后上线，并包含永久 dofollow 反链。一次付费，不是订阅。'
      : 'Submit a software product to dirtool. Free listings are reviewed by hand and use a nofollow link. Paid listings include a permanent dofollow backlink and go live when payment succeeds.',
  ),
})

/** Rows the page is actually showing, minus the dev-only preview fixtures. */
const boardEntries = computed(() =>
  groups.value
    .flatMap((group) => group.rows)
    .filter((row) => !row.slug.startsWith('__preview_'))
    .map((row) => ({ name: row.name, path: `/products/${row.slug}` })),
)

type SchemaScript = { type: 'application/ld+json'; innerHTML: string }

const schemaScripts = computed<SchemaScript[]>(() => {
  const list: SchemaScript[] = [
    // First, and unconditional: the site's own identity. It is the only block
    // on the site that describes the publisher rather than a page, and it is
    // what a search engine reads to print "dirtool" above a result.
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(
        siteEntitySchema({
          name: SCHEMA_SITE_NAME,
          url: `${SCHEMA_SITE}/`,
          // The 128px square the site already serves. Google wants at least
          // 112px, and a logo that 404s is worse than none.
          logo: `${SCHEMA_SITE}/assets/img/brand/logo.png`,
          sameAs: [SOCIAL_X_URL],
          email: CONTACT_EMAIL,
        }),
      ),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(
        faqPageSchema(faq.value.map((item) => ({ question: item.q, answer: item.a }))),
      ),
    },
  ]
  // An empty ItemList says nothing and is not worth shipping.
  if (boardEntries.value.length) {
    list.push({
      type: 'application/ld+json',
      innerHTML: JSON.stringify(
        itemListSchema(
          isZh.value ? '本周产品发布' : "This week's product launches",
          boardEntries.value,
        ),
      ),
    })
  }
  return list
})

useHead({ script: schemaScripts })
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

          <!-- The APP placement: this column's dedicated slot, sold separately
               from the FEATURED rows above it. -->
          <HomeAppAdCard variant="hero" :ad="bookedApp" />
        </aside>

        <section class="mk-hero mk-hero--center mk-hero--launch hero-launch">
          <h1 class="hero-launch__title">
            {{ pick('提交你的软件产品。', 'Submit your software product.') }}<br>
            <span class="hero-launch__accent">{{ pick('获得一页永久目录页。', 'Get a permanent directory page.') }}</span>
          </h1>
          <p class="hero-launch__sub">
            {{
              pick(
                '免费收录由人工审核，链接为 nofollow。付费收录在付款成功后上线，并包含永久 dofollow 反链。一次付费，不是订阅。',
                'Free listings are reviewed by hand and use a nofollow link. Paid listings include a permanent dofollow backlink and go live when payment succeeds. One-time payment, no subscription.',
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
            {{ pick('免费收录，或一次付费，付款成功后即上线。无订阅、无续费。', 'Free to list, or pay once to go live when payment succeeds. No subscription, no renewal.') }}
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
          <NuxtLink class="feat-card feat-card--open" :to="boostTo">
            <span class="feat-card__mark" aria-hidden="true">★</span>
            <span>
              <strong>{{ pick('你的产品在这里', 'Your product here') }}</strong>
              <small>{{ pick('Boost · 永久 dofollow', 'Boost · permanent dofollow') }}</small>
            </span>
          </NuxtLink>
        </aside>
      </div>
    </div>

    <WeekSwitcher v-if="activeWeekId" :active-id="activeWeekId" :weeks="availableWeeks" />

    <div class="home-dir">
      <aside class="home-dir__left" :class="{ 'is-open': browseOpen }">
        <button class="home-dir__toggle" type="button" @click="browseOpen = !browseOpen">
          {{ pick('浏览', 'Browse') }}
          <span>{{ browseOpen ? '–' : '+' }}</span>
        </button>
        <!-- The board runs down the rail, not across the page: five slots level
             with the feed instead of a ten-cell band above it. -->
        <BillboardRail :cells="billboardLeft" :product-slugs="billboardProductSlugs" side="left" />
        <div class="rail-ad">
          <p class="rail-ad__kicker">
            {{ pick('APP 广告位', 'APP SPOT') }}
            <NuxtLink :to="adsTo">{{ pick('全部价格', 'All prices') }} ›</NuxtLink>
          </p>
          <HomeAppAdCard :ad="bookedApp" />
        </div>
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
        <!-- Phone layout only: the rails dissolve below 980px, so the board is
             rendered once here and the two rail copies are hidden. Without it
             the list would sit between slot 2 and slot 3. -->
        <BillboardRail class="bb-rail--stack" :cells="homeGrid" :product-slugs="billboardProductSlugs" side="stack" />
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

        <section
          ref="appSlotEl"
          class="home-app-spotlight"
          :class="{
            'home-app-spotlight--anim': appSlotMounted,
            'is-visible': appSlotVisible,
          }"
          aria-labelledby="home-app-spotlight-title"
        >
          <div class="home-app-spotlight__head">
            <div>
              <p class="home-app-spotlight__eyebrow">{{ pick('应用发现', 'APP DISCOVERY') }}</p>
              <h3 id="home-app-spotlight-title">{{ pick('应用收录已开放', 'App listings are open') }}</h3>
            </div>
            <NuxtLink class="home-app-spotlight__browse" :to="localePath('/apps')">
              {{ pick('浏览全部', 'Browse all') }} <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>

          <div v-if="homeApps.length" class="home-app-spotlight__list">
            <NuxtLink
              v-for="(app, index) in homeApps"
              :key="app.slug"
              class="home-app-spotlight__item"
              :style="{ '--i': index }"
              :to="localePath(`/apps/${app.slug}`)"
            >
              <span class="home-app-spotlight__logo">
                <!-- The top row wears the same crown the launch board's #1 wears,
                     so the two lists read as "first place" rather than one
                     having a mark the other cannot have. -->
                <span v-if="index === 0" class="home-app-spotlight__crown" aria-hidden="true">
                  <PaidCrown />
                </span>
                <ToolLogo :logo="app.logo" :name="app.name" :size="44" decorative />
              </span>
              <span class="home-app-spotlight__identity">
                <strong>{{ app.name }}</strong>
                <span class="home-app-spotlight__description">{{ app.short }}</span>
                <span
                  v-if="appMeta(app).platforms.length || appMeta(app).hasRating"
                  class="home-app-spotlight__meta"
                >
                  <em v-for="platform in appMeta(app).platforms" :key="platform">{{ platform }}</em>
                  <em v-if="appMeta(app).hasRating">
                    ★ {{ appMeta(app).rating }}<span v-if="appMeta(app).ratingCount"> ({{ appMeta(app).ratingCount.toLocaleString() }})</span>
                  </em>
                </span>
              </span>
              <span class="home-app-spotlight__action" aria-hidden="true">↗</span>
            </NuxtLink>

            <NuxtLink
              v-if="homeApps.length < 3"
              class="home-app-spotlight__item home-app-spotlight__item--cta"
              :to="localePath('/apps/submit')"
            >
              <span class="home-app-spotlight__cta-icon" aria-hidden="true">+</span>
              <span class="home-app-spotlight__identity">
                <strong>{{ pick('提交你的应用', 'Submit your app') }}</strong>
                <span class="home-app-spotlight__description">
                  {{ pick('iOS、Android、Mac 都可以，粘贴商店链接自动填充。', 'iOS, Android or Mac — paste a store link and we fill it in.') }}
                </span>
              </span>
              <span class="home-app-spotlight__action" aria-hidden="true">→</span>
            </NuxtLink>
          </div>

          <div v-else class="home-app-spotlight__empty">
            <span class="home-app-spotlight__empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <rect x="6" y="2.5" width="12" height="19" rx="3" />
                <path d="M10.5 18.5h3" />
              </svg>
            </span>
            <span class="home-app-spotlight__empty-copy">
              <strong>{{ pick('应用目录已开放', 'The app directory is open') }}</strong>
              <span>{{ pick('浏览 iOS、Android 和 Mac 应用，或提交第一个应用。', 'Explore iOS, Android, and Mac apps—or submit the first one.') }}</span>
            </span>
            <span class="home-app-spotlight__empty-actions">
              <NuxtLink :to="localePath('/apps')">{{ pick('浏览应用', 'Browse apps') }} →</NuxtLink>
              <NuxtLink :to="localePath('/apps/submit')">{{ pick('提交应用', 'Submit an app') }}</NuxtLink>
            </span>
          </div>
        </section>

        <template v-for="group in groups" :key="group.id">
          <div class="pb-week-head">
            <h3>{{ group.label }}</h3>
            <span v-if="group.current" class="pb-week-head__live">{{ pick('实时', 'LIVE') }}</span>
          </div>
          <ol class="home-feed">
            <template v-for="row in group.rows" :key="row.slug">
            <li
              class="pb-row"
              :class="{
                'pb-row--featured': row.badges.length > 0,
                'pb-row--podium': group.current && row.rank <= 3,
                'pb-row--first': group.id === liveGroupId && row.rank === 1,
              }"
            >
              <span class="pb-row__rank" :class="`is-${row.rank}`">
                <em>{{ row.rank }}</em>
              </span>
              <!-- The component is passed as a value, not as the string
                   'NuxtLink': Vue treats an unknown string in `:is` as a tag
                   name, so the string form rendered a literal <NuxtLink>
                   element with a `to` attribute and no href — the row looked
                   like a link, was styled like a link, and did nothing. The
                   30px arrow beside it was the only way in. -->
              <component
                :is="isPreview ? 'span' : NuxtLink"
                class="pb-row__link"
                :to="isPreview ? undefined : localePath(`/products/${row.slug}`)"
              >
                <span class="pb-row__logo">
                  <!-- The row's only crown: rank already reads gold/silver/bronze. -->
                  <span v-if="row.badges.length" class="pb-row__logo-crown">
                    <PaidCrown />
                  </span>
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

            <!-- The board slot, sold as "one sponsored row under the top 3"
                 (see `adPlans`). Booked: the buyer's row, clickable through to
                 their site. Unbooked: the slot sells itself at the same price
                 the pricing page charges. One component either way, so the
                 placement can never exist on one page and not the other. -->
            <li
              v-if="adAnchor > 0 && row.rank === adAnchor"
              class="pb-row pb-row--ad"
              :class="{ 'pb-row--ad-open': !bookedBoard }"
            >
              <span class="pb-row__rank" aria-hidden="true">
                <em class="pb-row__ad-tag">{{ pick('广告', 'AD') }}</em>
              </span>
              <a
                v-if="bookedBoard"
                class="pb-row__link"
                :href="bookedBoard.url"
                target="_blank"
                rel="sponsored nofollow noopener"
              >
                <span class="pb-row__logo">
                  <ToolLogo :logo="bookedBoard.logo" :name="bookedBoard.name" :size="56" decorative />
                </span>
                <span class="pb-row__body">
                  <strong class="pb-row__title">
                    {{ bookedBoard.name }}
                    <em class="pb-row__badge pb-row__badge--ad">{{ pick('赞助', 'SPONSORED') }}</em>
                  </strong>
                  <span class="pb-row__desc">{{ bookedBoard.headline }}</span>
                  <span class="pb-row__meta">
                    <em class="pb-row__domain">🌐 {{ hostOf(bookedBoard.url) }}</em>
                  </span>
                </span>
              </a>
              <NuxtLink v-else class="pb-row__link" :to="boardAdTo">
                <span class="pb-row__logo pb-row__logo--ad" aria-hidden="true">📣</span>
                <span class="pb-row__body">
                  <strong class="pb-row__title">
                    {{ pick('你的广告在这里', 'Your ad here') }}
                    <em class="pb-row__badge pb-row__badge--ad">{{ pick('赞助位', 'SPONSORED') }}</em>
                  </strong>
                  <span class="pb-row__desc">{{ adPitch }}</span>
                </span>
              </NuxtLink>
              <span v-if="bookedBoard" class="pb-row__visit pb-row__visit--static" aria-hidden="true">↗</span>
              <NuxtLink v-else class="pb-row__ad-cta" :to="boardAdTo">
                {{ pick('预订此位', 'Book this spot') }} →
              </NuxtLink>
            </li>
            </template>
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
        <BillboardRail :cells="billboardRight" :product-slugs="billboardProductSlugs" side="right" />
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

        <p class="home-dir__kicker">{{ pick('加速', 'BOOST') }}</p>
        <section class="feat-sell">
          <span class="launch-row__badge">BOOST</span>
          <h2 id="featured-sell-title">{{ pick('你的产品', 'Your product') }}</h2>
          <p>{{ pick('永久 dofollow 反链、金色认证徽章、高亮行。一次付费，不是月费。', 'A permanent dofollow link, a gold verified badge, and a highlighted row. One payment, not a monthly fee.') }}</p>
          <ul>
            <li>{{ pick('永久 dofollow 反链', 'Permanent dofollow backlink') }}</li>
            <li>{{ pick('金色认证徽章', 'Gold verified badge') }}</li>
            <li>{{ pick('排在免费收录之前', 'Listed above free listings') }}</li>
          </ul>
          <p class="feat-sell__price">
            <s v-if="boostQuote.strikeLabel">{{ boostQuote.strikeLabel }}</s>
            <b>{{ boostQuote.priceLabel }}</b>
            <span>{{ pick('一次性', 'one-time') }}</span>
          </p>
          <NuxtLink class="btn btn--primary btn--block" :to="boostTo">
            {{ pick('去付款 · Boost', 'Pay · Boost') }}
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

          <NuxtLink class="rail-ad__card rail-ad__card--featured" :to="boardAdTo">
            <span class="rail-ad__mark" aria-hidden="true">👑</span>
            <span class="rail-ad__body">
              <strong>{{ pick('发布榜广告', 'Launch board ad') }}</strong>
              <em>{{ pick('榜单前三下方 · 每周一个品牌', 'Under the top 3 · one brand per week') }}</em>
              <span class="rail-ad__foot">
                <b>{{ boardLabel }}<small>/{{ pick('周', 'week') }}</small></b>
                <span>{{ pick('预订此位', 'Book this spot') }} →</span>
              </span>
            </span>
          </NuxtLink>

          <!-- The APP placement, same booking as the hero card and the left
               rail: one app, three spots on this page. -->
          <HomeAppAdCard :ad="bookedApp" />
        </div>
      </aside>
    </div>

    <section class="home-faq">
      <h2>{{ pick('常见问题', 'Questions') }}</h2>
      <div class="accordion">
        <div v-for="(item, i) in faq" :key="item.q" class="acc-item" :class="{ 'is-open': openFaq === i }">
          <button
            class="acc-trigger"
            type="button"
            :aria-expanded="openFaq === i"
            :aria-controls="`home-faq-panel-${i}`"
            @click="openFaq = openFaq === i ? -1 : i"
          >
            {{ item.q }}
            <Icon name="chevron-down" />
          </button>
          <div :id="`home-faq-panel-${i}`" class="acc-panel">{{ item.a }}</div>
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
.rail-ad__foot b { font-size: 14px; font-weight: 850; white-space: nowrap; }
/* The base layer gives `<small>` a block-ish display, which broke the amount
   and its "/week" unit onto two lines in the 236px rail. Keep the unit inline. */
.rail-ad__foot b small { display: inline; font-size: 11px; font-weight: 600; }
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
/* One flat list with hairlines, not a stack of cards: the cards put a 1.5px
   border and 16px of padding around every row, so five products filled a
   screen and the board below them was pushed off it. */
.home-feed {
  display: grid;
  gap: 0;
  border-top: 1px solid #eceef2;
}
.pb-row {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 34px auto;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid #eceef2;
  background: transparent;
}
/* A paid row keeps a gold edge rather than a full gold box: a boxed row in a
   list of hairlines reads as a different component, not as a promoted row. */
.pb-row--featured {
  padding-left: 14px;
  background: linear-gradient(90deg, rgba(255, 247, 224, 0.85), rgba(255, 255, 255, 0));
  box-shadow: inset 3px 0 0 #e5b53a;
}
/* ---- Sponsored row, after third place -------------------------------------
   A booked placement reads like the paid row it is (solid gold edge). An empty
   slot uses the site's own "sellable space" language — a dashed amber outline,
   the same one the billboard's open cells and the stats strip use — so it
   cannot be mistaken for a product row with a gold badge. */
.pb-row--ad {
  /* Three tracks, not the product row's four: the ad row has no vote button,
     so its button (or its arrow) takes the last track instead of landing in
     the 34px arrow column and painting over the description. */
  grid-template-columns: 38px minmax(0, 1fr) auto;
  padding-left: 14px;
  background: linear-gradient(90deg, rgba(255, 247, 224, 0.9), rgba(255, 255, 255, 0));
  box-shadow: inset 3px 0 0 #e5b53a;
}
.pb-row--ad-open {
  margin: 6px 0;
  padding-left: 12px;
  border: 1.5px dashed #e8c97a;
  border-radius: 12px;
  background: #fffdf4;
  box-shadow: none;
}
.pb-row--ad-open {
  transform-origin: center;
  animation: board-ad-bob 5.2s ease-in-out infinite;
}
.pb-row--ad-open:hover { background: #fffbe9; }
.pb-row--ad-open:hover,
.pb-row--ad-open:focus-within {
  animation-play-state: paused;
}
.pb-row--ad-open .pb-row__logo--ad {
  transform-origin: 50% 68%;
  animation: board-ad-megaphone 5.2s ease-in-out infinite;
}
.pb-row--ad-open .pb-row__ad-cta {
  animation: board-ad-cta 5.2s ease-in-out infinite;
}
.pb-row--ad-open:hover .pb-row__logo--ad,
.pb-row--ad-open:focus-within .pb-row__logo--ad,
.pb-row--ad-open:hover .pb-row__ad-cta,
.pb-row--ad-open:focus-within .pb-row__ad-cta {
  animation-play-state: paused;
}
@keyframes board-ad-bob {
  0%, 68%, 100% { transform: translateY(0) scale(1); }
  76% { transform: translateY(-6px) scale(1.018); }
  84% { transform: translateY(1px) scale(1); }
  92% { transform: translateY(-3px) scale(1.008); }
}
@keyframes board-ad-megaphone {
  0%, 68%, 100% { transform: rotate(0deg) translateY(0); }
  76% { transform: rotate(-12deg) translateY(-4px); }
  84% { transform: rotate(5deg) translateY(1px); }
  92% { transform: rotate(-4deg) translateY(-2px); }
}
@keyframes board-ad-cta {
  0%, 68%, 100% { transform: scale(1); }
  76%, 92% { transform: scale(1.045); }
  84% { transform: scale(.99); }
}
.pb-row__rank .pb-row__ad-tag {
  width: 30px;
  height: 20px;
  border-radius: 6px;
  background: #f1f3f6;
  color: #8b9099;
  font-size: 9px;
  letter-spacing: 0.08em;
}
.pb-row__logo--ad {
  align-items: center;
  justify-content: center;
  background: #fff5d6;
  border: 1px solid #f0d79a;
  border-radius: 10px;
  font-size: 24px;
  line-height: 1;
}
/* Neutral, not gold: the row is an ad, not a paid listing. */
.pb-row__badge--ad {
  background: #eef0f3 !important;
  border-color: #dfe3e9 !important;
  color: #5b6470 !important;
  box-shadow: none !important;
  text-shadow: none !important;
}
.pb-row__badge--ad::before { content: none !important; }
/* Above the row's stretched link, or the CTA would open the pricing page as
   part of the row instead of being the button it looks like. */
.pb-row__ad-cta {
  position: relative;
  z-index: 1;
  flex: none;
  white-space: nowrap;
  padding: 9px 14px;
  border-radius: 10px;
  background: #f5b426;
  color: #4a3400;
  font-size: 12.5px;
  font-weight: 800;
  text-decoration: none;
}
.pb-row__ad-cta:hover { background: #eda01a; }
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
.pb-row__link {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
/* The row is the target, not the text. The anchor used to hug its own content,
   so the rank circle, the 12px gutter, the 12px of vertical padding and the
   space before the arrow were all dead — a visitor aiming at a product row had
   a link narrower than the row looks. Stretching the anchor over the whole row
   (the standard stretched-link pattern) makes every pixel of it open the
   product. The vote button and the arrow are lifted above the overlay, or the
   overlay would swallow the vote; the rank needs no lift because it comes
   earlier in the DOM, so the overlay paints over it. */
a.pb-row__link::after {
  content: '';
  position: absolute;
  inset: 0;
}
/* ---- The week's #1 ------------------------------------------------------
   The first row gets the two beats the newest app row already has: a sweep
   every three seconds, and an icon that tilts under the pointer. Only the
   first row — a wave down the whole list reads as noise. The sweep is painted
   by the row's own `::after` as a moving background, not a sliding box, so it
   never leaves the row and needs no `overflow: hidden` (which would slice the
   crown off the logo). */
.pb-row--first::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  /* The band is a stop range inside a 3.2x-wide background, so its on-screen
     width is `(stop range) x 3.2`. At 46–54% that was 26% of the row; the
     first attempt used 38–62% inside a 2.6x background and came out 62% wide,
     which read as the whole row fogging over rather than a light passing
     across it. */
  background: linear-gradient(
    100deg,
    transparent 46%,
    color-mix(in oklab, var(--primary, #b45309) 62%, transparent) 50%,
    transparent 54%
  );
  background-size: 320% 100%;
  background-position: 80% 0;
  opacity: 0;
  pointer-events: none;
  animation: pb-row-sheen 3s linear 1.2s infinite;
}
/* 0.9s of sweep, 2.1s of rest — the same clock as `app-slot-sheen`.
   With a 3.2x background, one row width of travel is 45% of the position
   range, so 80% → 20% is exactly "off the left edge" to "off the right edge".
   The first attempt ran 165% → -65%, five row widths of travel in the same
   0.9s, and the band was on screen for about 200ms — a flicker, not a sweep.
   Linear easing, because every segment here also moves the position: an eased
   per-segment curve made the band stutter at each keyframe. The fade lives in
   its own stops instead, holding full strength across the whole crossing. */
@keyframes pb-row-sheen {
  0% { opacity: 0; background-position: 80% 0; }
  4% { opacity: .85; }
  22% { opacity: .85; background-position: 36% 0; }
  30% { opacity: 0; background-position: 20% 0; }
  100% { opacity: 0; background-position: 20% 0; }
}
.pb-row--first:hover .pb-row__logo { transform: scale(1.05) rotate(-3deg); }
/* A row that is one big target needs to look like one. */
.pb-row:not(.pb-row--featured):hover {
  background: #fafbfc;
}
.pb-row--featured:hover {
  background: linear-gradient(90deg, rgba(255, 247, 224, 0.95), rgba(255, 255, 255, 0));
}
.pb-row__logo {
  position: relative;
  flex: none;
  display: inline-flex;
  /* No plate, no ring. Every catalogue logo is an opaque tile with its own
     background, so the white box plus grey border framed all of them in the
     same square and flattened them into identical blocks. The icon is the
     mark; the rounding lives on the image so it cannot clip the crown.
     Explicit box: a listing with no icon falls back to a monogram, and a
     shrink-to-fit wrapper collapsed that to the width of one letter. */
  width: 56px;
  height: 56px;
  border-radius: 10px;
  transition: transform .3s cubic-bezier(.22, .61, .36, 1);
}
.pb-row__logo :deep(img) {
  display: block;
  width: 56px;
  height: 56px;
  /* `contain`, not `cover`: some brand marks are SVG with a non-square ratio
     and stretching them would distort the logo. */
  object-fit: contain;
  border-radius: 10px;
}
.pb-row__logo :deep(.tool-logo__initial) {
  background: #f2f3f5;
  border-radius: 10px;
}
.pb-row__logo-crown {
  position: absolute;
  /* Perched on the logo's top edge, pivoting on its own bottom edge so the tilt
     reads as "set down at an angle" rather than "rotated in place".
     22px on a 56px tile: the catalogue icons are glyphs with generous internal
     padding, so a crown sized to the tile covers the mark itself — at 28px the
     "R" of Refund Score disappeared behind it.
     Explicit box — the SVG inside is `100%` and would otherwise collapse. */
  top: -13px;
  left: 50%;
  width: 22px;
  height: 17px;
  transform: translateX(-50%) rotate(-14deg);
  transform-origin: 50% 100%;
  pointer-events: none;
}
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-style: normal;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  color: #4a3200;
  /* Minted, not printed: a warm face, a light lip on top, a dark lip below and
     a hairline of shadow under it. Flat gold on a gold row read as a label. */
  background: linear-gradient(180deg, #ffeaab 0%, #ffcb40 40%, #eda01a 62%, #d88a05 100%);
  border: 1px solid #c07a00;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 0 rgba(150, 90, 0, 0.35),
    0 1px 2px rgba(140, 90, 0, 0.3);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
}
/* The paid pill is a promise ("this row is promoted"), so it reads as a badge
   rather than as a category label — same shape as the one on the pricing page. */
.pb-row__badge::before {
  content: '↑';
  font-size: 10px;
  line-height: 1;
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
  /* Above the stretched link: it is its own control with its own hover. */
  position: relative;
  z-index: 1;
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
  /* Above the stretched link. Without this the row's overlay covers the vote
     button and every click on it navigates to the product instead of voting —
     the one thing on the row that must not be the row. */
  position: relative;
  z-index: 1;
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

/* A permanent app discovery slot, kept outside the ranked list and ad anchor. */
.home-app-spotlight {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 18px 0 22px;
  padding: 14px;
  border: 1px solid color-mix(in oklab, var(--primary, #b45309) 18%, var(--border, #e5e7eb));
  border-radius: 14px;
  background: color-mix(in oklab, var(--primary, #b45309) 5%, var(--card, #fff));
}
/* Slow drifting brand glow, so the slot reads as "alive" without shouting. */
.home-app-spotlight::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -45% -12%;
  background:
    radial-gradient(38% 55% at 16% 0%, color-mix(in oklab, var(--primary, #b45309) 22%, transparent), transparent 70%),
    radial-gradient(34% 52% at 88% 100%, color-mix(in oklab, var(--primary, #b45309) 15%, transparent), transparent 72%);
  animation: app-slot-drift 18s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes app-slot-drift {
  from { transform: translate3d(-2%, -1%, 0) scale(1); }
  to { transform: translate3d(3%, 2%, 0) scale(1.07); }
}
/* Staged reveal: only armed after mount, so SSR never hides the slot.
   `backwards` (not `both`) keeps the finished animation from pinning
   `transform`, which would otherwise kill the row's hover lift. */
.home-app-spotlight--anim .home-app-spotlight__head,
.home-app-spotlight--anim .home-app-spotlight__item,
.home-app-spotlight--anim .home-app-spotlight__empty { opacity: 0; }
.home-app-spotlight--anim.is-visible .home-app-spotlight__head {
  opacity: 1;
  animation: app-slot-rise .5s cubic-bezier(.22, .61, .36, 1) backwards;
}
.home-app-spotlight--anim.is-visible .home-app-spotlight__item,
.home-app-spotlight--anim.is-visible .home-app-spotlight__empty {
  opacity: 1;
  animation: app-slot-rise .5s cubic-bezier(.22, .61, .36, 1) backwards;
  animation-delay: calc(.1s + var(--i, 0) * .07s);
}
@keyframes app-slot-rise {
  from { opacity: 0; transform: translate3d(0, 12px, 0) scale(.985); }
  to { opacity: 1; transform: none; }
}
.home-app-spotlight__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}
.home-app-spotlight__eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 3px;
  color: var(--primary, #b45309);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .09em;
}
.home-app-spotlight__eyebrow::before {
  content: '';
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: app-slot-ping 2.6s ease-out infinite;
}
@keyframes app-slot-ping {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--primary, #b45309) 55%, transparent); }
  70% { box-shadow: 0 0 0 6px color-mix(in oklab, var(--primary, #b45309) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--primary, #b45309) 0%, transparent); }
}
.home-app-spotlight__head h3 {
  margin: 0;
  color: var(--foreground, #1a1a1a);
  font-size: 14px;
  font-weight: 750;
  letter-spacing: -.01em;
}
.home-app-spotlight__browse {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  color: var(--primary, #b45309);
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
}
.home-app-spotlight__browse:hover { text-decoration: underline; text-underline-offset: 3px; }
.home-app-spotlight__browse span { display: inline-block; transition: transform .2s ease; }
.home-app-spotlight__browse:hover span { transform: translateX(3px); }
/* Up to three apps, one row each: the homepage column is too narrow for a
   3-up card grid, and a row reads like the ranked feed right below it. */
.home-app-spotlight__list { display: grid; gap: 8px; }
.home-app-spotlight__item {
  position: relative;
  display: grid;
  overflow: hidden;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 11px;
  background: var(--card, #fff);
  color: inherit;
  text-decoration: none;
  transition: border-color .2s, transform .28s cubic-bezier(.22, .61, .36, 1), box-shadow .28s;
}
/* Only the newest row carries the looping sweep; a wave down all three would
   read as noise. */
.home-app-spotlight__item:first-child::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -55%;
  width: 40%;
  background: linear-gradient(
    100deg,
    transparent 4%,
    color-mix(in oklab, var(--primary, #b45309) 38%, transparent) 50%,
    transparent 96%
  );
  opacity: 0;
  transform: skewX(-14deg);
  animation: app-slot-sheen 3s ease-in-out 1.2s infinite;
  pointer-events: none;
}
/* 0.9s of sweep, 2.1s of rest, repeating every 3s. */
@keyframes app-slot-sheen {
  0% { opacity: 0; transform: translateX(0) skewX(-14deg); }
  6% { opacity: .9; }
  30% { opacity: 0; transform: translateX(330%) skewX(-14deg); }
  100% { opacity: 0; transform: translateX(330%) skewX(-14deg); }
}
.home-app-spotlight__item:hover {
  border-color: color-mix(in oklab, var(--primary, #b45309) 42%, var(--border, #e5e7eb));
  transform: translateY(-2px);
  box-shadow: 0 12px 26px -16px color-mix(in oklab, var(--primary, #b45309) 60%, transparent);
}
.home-app-spotlight__item:focus-visible,
.home-app-spotlight__browse:focus-visible,
.home-app-spotlight__empty-actions a:focus-visible {
  outline: 3px solid var(--ring, var(--primary, #b45309));
  outline-offset: 3px;
}
/* The empty slot doubles as a submission prompt, so three rows never leave a
   hole when the directory is still small. */
.home-app-spotlight__item--cta {
  border-style: dashed;
  border-color: color-mix(in oklab, var(--primary, #b45309) 38%, var(--border, #e5e7eb));
  background: color-mix(in oklab, var(--primary, #b45309) 4%, var(--card, #fff));
}
.home-app-spotlight__cta-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px dashed color-mix(in oklab, var(--primary, #b45309) 45%, var(--border, #e5e7eb));
  border-radius: 10px;
  color: var(--primary, #b45309);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
.home-app-spotlight__logo {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  /* `visible`, not `hidden`: the crown perches above the tile and a clipped
     box would slice its top off. The image carries its own radius. */
  overflow: visible;
  place-items: center;
  border-radius: 10px;
  background: var(--secondary, #f4f4f5);
  transition: transform .3s cubic-bezier(.22, .61, .36, 1);
}
/* Sized like the launch board's crown (22/56 of the tile), scaled to 44px.
   Pivots on its own bottom edge so the tilt reads as "set down at an angle". */
.home-app-spotlight__crown {
  position: absolute;
  top: -8px;
  left: 50%;
  width: 17px;
  height: 13px;
  transform: translateX(-50%) rotate(-14deg);
  transform-origin: 50% 100%;
  pointer-events: none;
}
.home-app-spotlight__item:hover .home-app-spotlight__logo { transform: scale(1.05) rotate(-3deg); }
.home-app-spotlight__logo :deep(img) { width: 44px; height: 44px; border-radius: 10px; object-fit: contain; }
.home-app-spotlight__identity { display: grid; min-width: 0; gap: 2px; }
.home-app-spotlight__identity > strong {
  overflow: hidden;
  color: var(--foreground, #1a1a1a);
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home-app-spotlight__description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted-foreground, #6b7280);
  font-size: 11.5px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
.home-app-spotlight__meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.home-app-spotlight__meta em {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--secondary, #f4f4f5);
  color: var(--muted-foreground, #6b7280);
  font-size: 9.5px;
  font-style: normal;
  line-height: 1.5;
}
.home-app-spotlight__action {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in oklab, var(--primary, #b45309) 9%, transparent);
  color: var(--primary, #b45309);
  font-size: 11px;
  font-weight: 800;
  transition: background-color .2s ease, transform .2s ease;
}
.home-app-spotlight__item:hover .home-app-spotlight__action {
  background: color-mix(in oklab, var(--primary, #b45309) 18%, transparent);
  transform: translate(2px, -2px);
}
.home-app-spotlight__empty {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px dashed color-mix(in oklab, var(--primary, #b45309) 35%, var(--border, #e5e7eb));
  border-radius: 12px;
  background: var(--card, #fff);
}
.home-app-spotlight__empty-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: color-mix(in oklab, var(--primary, #b45309) 10%, var(--card, #fff));
  color: var(--primary, #b45309);
  animation: app-slot-float 3.8s ease-in-out infinite;
}
@keyframes app-slot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.home-app-spotlight__empty-copy { display: grid; min-width: 0; gap: 3px; }
.home-app-spotlight__empty-copy strong { font-size: 13px; font-weight: 800; }
.home-app-spotlight__empty-copy > span { color: var(--muted-foreground, #6b7280); font-size: 11.5px; line-height: 1.45; }
.home-app-spotlight__empty-actions { display: flex; flex: none; align-items: center; gap: 8px; }
.home-app-spotlight__empty-actions a {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--primary, #b45309);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
  transition: transform .2s ease, filter .2s ease;
}
.home-app-spotlight__empty-actions a:first-child {
  background: var(--primary, #b45309);
  color: var(--primary-foreground, #fff);
}
.home-app-spotlight__empty-actions a:hover { filter: brightness(.96); transform: translateY(-1px); }

@media (max-width: 760px) {
  .pb-row { grid-template-columns: 30px minmax(0, 1fr) auto; gap: 8px; padding: 12px; }
  .pb-row__visit { display: none; }
  .pb-row__logo { display: none; }
  .pb-row__rank em { width: 28px; height: 28px; font-size: 13px; }
  .home-app-spotlight { padding: 11px; }
  .home-app-spotlight__item { grid-template-columns: 40px minmax(0, 1fr) auto; gap: 9px; padding: 8px 10px; }
  .home-app-spotlight__logo,
  .home-app-spotlight__logo :deep(img),
  .home-app-spotlight__cta-icon { width: 40px; height: 40px; }
  .home-app-spotlight__empty { grid-template-columns: 40px minmax(0, 1fr); gap: 10px; }
  .home-app-spotlight__empty-actions { grid-column: 2; flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .pb-row--ad-open,
  .pb-row--ad-open .pb-row__logo--ad,
  .pb-row--ad-open .pb-row__ad-cta {
    animation: none !important;
    transform: none !important;
  }
  .home-app-spotlight__item { transition: none; }
  .home-app-spotlight__item:hover { transform: none; }
  .home-app-spotlight::before,
  .home-app-spotlight__eyebrow::before,
  .home-app-spotlight__empty-icon { animation: none !important; }
  .home-app-spotlight__item:first-child::after { animation: none; opacity: 0; }
  .pb-row--first::after { animation: none; opacity: 0; }
  .pb-row--first:hover .pb-row__logo { transform: none; }
  .home-app-spotlight__item:hover .home-app-spotlight__logo,
  .home-app-spotlight__item:hover .home-app-spotlight__action,
  .home-app-spotlight__browse:hover span,
  .home-app-spotlight__empty-actions a:hover { transform: none; }
  .home-app-spotlight--anim .home-app-spotlight__head,
  .home-app-spotlight--anim .home-app-spotlight__item,
  .home-app-spotlight--anim .home-app-spotlight__empty {
    opacity: 1 !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>
