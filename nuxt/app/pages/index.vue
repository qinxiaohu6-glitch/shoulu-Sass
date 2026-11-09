<script setup lang="ts">
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'
import { BILLBOARD_TIERS } from '~~/shared/content/billboard'
import { adPlans, tiers } from '~~/shared/content/pricing'
import { samePlacementUrl } from '~~/shared/utils/billboard'

const { lang, isZh, pick } = useLang()

const localePath = useLocalePath()
const requestFetch = useRequestFetch()

// Community listings, so the "products listed" figure and the newest strip
// agree with /tools and /just-added rather than quietly undercounting.
const submitted = await useSubmittedTools()
const overrides = useOverrides()

/* Category and tag names come from the live taxonomy, not the build-time
   catalogue: the console can rename either, and this page shows both (the tile
   row, the category cards, the pill row, the tag cloud, the board's badges).
   The layout is untouched — only the words in it follow the database. */
const { categories: liveCategories, tags: liveTags } = useDirectoryMeta()

// Booked placements. `null` is the normal empty state: the offer card then
// recruits, and the rail renders nothing until a campaign is actually live.
// The weekly board ad is not a Billboard row — that list has its own source.
const { sidebar: sidebarAd } = await useAds()
const { ranked: billboardRanked, homeGrid } = await useBillboard()

/**
 * The sidebar slot's price, read from the same table `/pricing` renders so the
 * two can never quote different numbers. `sidebar` is a fixed member of
 * `adPlans`, but the lookup stays defensive: a missing row must hide the promo
 * card, not crash the homepage.
 */
const sidebarPlan = adPlans.find((plan) => plan.id === 'sidebar') ?? null

/**
 * Price-forward placement band. Both slots are advertised with their real
 * prices before a visitor has to go looking, and the open-week count comes
 * from the same read-only endpoint /book-ad uses. A failed read hides the
 * count rather than inventing one.
 */
const { data: homeSpots } = await useAsyncData<AdAvailability>(
  'home-spot-availability',
  () =>
    requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
  { default: () => EMPTY_AD_AVAILABILITY },
)

const spotStrip = computed(() => {
  const sidebar = adPlans.find((plan) => plan.id === 'sidebar')
  const open = openAdWeeks(homeSpots.value)
  const billboardPrices = BILLBOARD_TIERS.map((tier) => tier.price).join(' / ')
  return [
    {
      id: 'billboard',
      name: 'Billboard',
      price: billboardPrices,
      strike: '',
      unit: pick('一次性', 'one-time'),
      where: pick('首页 Top 10。固定三档，不再按周租。', 'Homepage Top 10. Three fixed tiers, not a weekly rental.'),
      foot: pick('去付款', 'Pay now'),
      to: `${localePath('/billboard')}#claim`,
    },
    {
      id: 'sidebar',
      name: sidebar ? (isZh.value ? sidebar.name.zh : sidebar.name.en) : '',
      price: sidebar?.price ?? '',
      strike: '',
      unit: sidebar ? (isZh.value ? sidebar.unit.zh : sidebar.unit.en) : '',
      where: sidebar ? (isZh.value ? sidebar.where.zh : sidebar.where.en) : '',
      foot: homeSpots.value?.ok ? spotOpenLabel(open.length) : pick('选周次', 'Pick a week'),
      to: `${localePath('/book-ad')}?slot=sidebar&weeks=1`,
    },
  ]
})

/** Kept out of the template so the string builder stays plain TypeScript. */
function spotOpenLabel(count: number): string {
  return pick(`未来 6 周 ${count} 周可订`, `${count} of the next 6 weeks open`)
}

const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

/**
 * The live homepage shows the most recent *archived* week, not the calendar
 * week — `currentWeek()` is empty until the Monday cron writes a row, and
 * falling back to live vote totals there would relabel the board while it is
 * still the previous week's result. So: newest archive, full stop.
 *
 * There are two archives: the weeks baked into the catalogue at build time, and
 * the ones the Monday cron has closed since. The cron's copy wins only when its
 * id is genuinely newer — with an empty `week_archive` this resolves to the
 * catalogue and the page renders exactly as it did before the cron existed.
 */
const archivedWeek = await useBoard()

const latestWeek = computed(() => {
  const newestStatic = [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1))[0]
  const archived = archivedWeek.value
  if (archived && (!newestStatic || archived.id > newestStatic.id)) return archived
  return newestStatic
})

const weekText = computed(() => weekLabel(latestWeek.value, lang.value))
const board = computed(() => boardRows(latestWeek.value, lang.value, 6, overrides.value))

const cats = computed(() =>
  liveCategories.value
    .filter((entry) => entry.status !== 'deleted')
    .map((entry) => {
      const model = categoryBrowseModel(
        entry.slug,
        tools,
        submitted.value,
        overrides.value.hidden,
      )
      return {
        ...localizeCategory(entry, lang.value),
        ...model,
        links: emptyCategoryLinks(entry.slug),
      }
    }),
)

/**
 * Four bookable spots where the benefit cards used to be. Occupants are real
 * paid submissions (`plan` + `is_paid`) or a live ad. Catalogue seed products
 * are not passed in, so an empty database stays four recruit cards.
 */
const offerSlots = computed(() =>
  homeOfferSlots({
    listings: submitted.value,
    billboard: billboardRanked.value[0]
      ? {
          name: billboardRanked.value[0].name,
          headline: billboardRanked.value[0].tagline,
          logo: billboardRanked.value[0].logo,
          url: billboardRanked.value[0].url,
        }
      : null,
    sidebar: sidebarAd.value,
  }),
)

const featuredTier = tiers.find((tier) => tier.id === 'featured')
const sidebarPlanPrice = adPlans.find((plan) => plan.id === 'sidebar')

const billboardKeys = computed(
  () => new Set(billboardRanked.value.map((row) => samePlacementUrl(row.url))),
)

function launchBadges(tool: { url?: string; plan?: string; is_featured?: boolean; is_paid?: boolean }): string[] {
  const badges: string[] = []
  if (tool.url && billboardKeys.value.has(samePlacementUrl(tool.url))) badges.push('BILLBOARD')
  if (tool.plan === 'pro' && tool.is_paid) badges.push('PRO')
  else if (tool.is_paid && (tool.plan === 'featured' || tool.is_featured)) badges.push('FEATURED')
  return badges
}

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(isZh.value ? 'zh-CN' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(new Date()),
)

const columnStats = computed(() => [
  { value: String(all.value.length), label: pick('个产品已收录', 'products listed') },
  { value: String(liveCategories.value.length), label: pick('个分类', 'categories') },
])

const columnCats = computed(() =>
  [...cats.value].sort((a, b) => b.count - a.count).slice(0, 5),
)

const columnLaunches = computed(() =>
  latest.value.slice(0, 5).map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    short: tool.short,
    logo: tool.logo,
    votes: tool.votes_week,
    category: categoryBySlug(tool.category, liveCategories.value)
      ? localizeCategory(categoryBySlug(tool.category, liveCategories.value)!, lang.value).name
      : '',
    badges: launchBadges(tool),
  })),
)

const columnFeatured = computed(() =>
  all.value
    .filter((tool) => tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro' || tool.is_featured))
    .slice(0, 3)
    .map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      short: tool.short,
      logo: tool.logo,
      votes: tool.votes_week,
      category: '',
      badges: launchBadges(tool),
    })),
)

const maxCatVotes = computed(() => Math.max(...cats.value.map((c) => c.votes), 1))

const pills = computed(() => pillCategories(lang.value, liveCategories.value))

const latest = computed(() =>
  [...submitted.value, ...latestTools(lang.value, 6, overrides.value)]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6),
)

const proofs = computed(() => [
  pick('目录页会留下', 'Listing page stays up'),
  pick('Billboard $15 / $29 / $49', 'Billboard $15 / $29 / $49'),
  pick('投票榜单独计票', 'Votes stay on their own list'),
])

const faq = computed(() =>
  isZh.value
    ? [
        {
          q: '提交要花钱吗？',
          a: '免费收录 0 元，进人工审核队列，通常 7–14 天，不保证；高峰可能更长，链接是 nofollow。标准一次性 $19：付款成功后自动收录发布、永久 dofollow、目录页排在免费收录之前。精选 $39：再加目录页和分类页置顶 7 天、首页精选卡。专业 $69：分类页置顶 90 天、全年 4 次文案修改、站长开启邮件后 24h 内回复。都是单次付费，不是订阅。',
        },
        {
          q: '多久能上线？',
          a: '付费档付款成功后由支付回调自动验签、自动发布上线，不需要人工确认收款。免费收录由人工审核，通常 7–14 天，不保证；高峰可能更长。',
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
          a: 'A free listing costs nothing, waits in the review queue (usually 7–14 days, not guaranteed; busy periods can take longer), and carries a nofollow link. Standard is a one-time $19: published automatically as soon as payment succeeds, permanent dofollow, listed above every free submission. Featured is $39 and adds a 7-day pin on the directory and category pages plus the homepage card. Pro is $69 for a 90-day category pin, four copy edits a year, and a reply within 24 hours after the site owner turns email on. All one-time payments, never a subscription.',
        },
        {
          q: 'How fast does my listing go live?',
          a: 'Paid listings are published automatically as soon as payment succeeds — a signed webhook settles the order and publishes the page, with no manual confirmation. Free listings are reviewed by a person, usually 7–14 days, not guaranteed; busy periods can take longer.',
        },
        {
          q: 'Is the free link nofollow?',
          a: 'Yes. Free listings cost nothing, so the link is nofollow — the page still stays up forever and still competes on the weekly board. Dofollow comes with a paid listing, and there are no strings attached to it: no badge to install, no periodic re-check, nothing that expires while you are not looking.',
        },
        {
          q: 'Can I edit after it goes live?',
          a: 'Yes, any time from My submissions. Edits to a live listing are re-reviewed before they publish.',
        },
      ],
)

const openFaq = ref(-1)

const popularTags = computed(() => liveTags.value.slice(0, 15))

useSeo({
  title: computed(() =>
    isZh.value
      ? 'Product Atlas — 发布你的产品，反链永久保留'
      : 'Product Atlas — Launch your product, keep the backlink',
  ),
  description: computed(() =>
    isZh.value
      ? '产品目录。Billboard 是一次性站内展示（$15 / $29 / $49），和每周投票榜分开。'
      : 'A product directory. Billboard is a one-time on-site placement ($15 / $29 / $49), kept separate from the weekly vote list.',
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
    <section class="mk-hero mk-hero--center mk-hero--compact">
      <p class="mk-eyebrow">Product Atlas</p>
      <h1 v-if="isZh" class="mk-h1">
        今天提交。<span class="mk-h1__em">留下一个目录页。</span>
      </h1>
      <h1 v-else class="mk-h1">
        Launch today.<br><span class="mk-h1__em">Keep a listing page.</span>
      </h1>
      <p class="mk-sub">
        {{
          pick(
            '一个永久目录页。一次付费的展示位。没有订阅。',
            'A permanent listing page. A one-time placement. No subscription.',
          )
        }}
      </p>
      <div class="mk-cta">
        <NuxtLink class="btn btn--primary btn--lg" :to="localePath('/submit')">
          {{ pick('提交产品', 'Submit a product') }}
          <Icon name="arrow-right" />
        </NuxtLink>
        <NuxtLink class="btn btn--ghost btn--lg" :to="`${localePath('/billboard')}#claim`">
          {{ pick('认领 Billboard', 'Claim a Billboard spot') }}
        </NuxtLink>
      </div>
      <ul class="mk-proofs">
        <li v-for="proof in proofs" :key="proof">
          <Icon name="check" />
          {{ proof }}
        </li>
      </ul>
    </section>

    <BillboardGrid :cells="homeGrid" />

    <HomeColumns
      :stats="columnStats"
      :categories="columnCats"
      :launches="columnLaunches"
      :month-label="monthLabel"
      :featured="columnFeatured"
      :featured-price="featuredTier?.price ?? ''"
      :sidebar-price="sidebarPlanPrice?.price ?? ''"
    />

    <section class="home-how" aria-labelledby="home-how-title">
      <h2 id="home-how-title">{{ pick('交付的就是这三件事', 'Three things that are actually delivered') }}</h2>
      <ol>
        <li>
          <b>1</b>
          <span>{{ pick('一个目录页。', 'A page in the directory.') }}</span>
        </li>
        <li>
          <b>2</b>
          <span>{{ pick('如果买了 Billboard，首页和 /billboard 用同一份已确认名单，并标明 BILLBOARD。', 'If you buy Billboard, the homepage and /billboard share the confirmed list and mark it BILLBOARD.') }}</span>
        </li>
        <li>
          <b>3</b>
          <span>{{ pick('页面会留着。我们不代你提交到别的网站。', 'The page stays up. We do not submit your product to other sites for you.') }}</span>
        </li>
      </ol>
    </section>

    <!-- Style-3 price strip. Billboard is one-time; only the sidebar is weekly. -->
    <section class="home-spots" aria-labelledby="home-spots-title">
      <div class="home-spots__head">
        <div>
          <p class="home-spots__eyebrow">{{ pick('明码标价', 'PRICED UP FRONT') }}</p>
          <h2 id="home-spots-title">{{ pick('Billboard 一次性，右栏仍按周', 'Billboard is one-time. The sidebar is still weekly.') }}</h2>
        </div>
        <p class="home-spots__note">
          {{
            pick(
              'Billboard 在这一页不扣款，去 /billboard 付款后上板。右栏周次来自排期表。',
              'Billboard is not charged on this page — pay on /billboard and it goes live. Sidebar weeks come from the schedule.',
            )
          }}
        </p>
      </div>
      <div class="home-spots__grid">
        <NuxtLink
          v-for="spot in spotStrip"
          :key="spot.id"
          class="home-spot"
          :to="spot.to"
        >
          <span class="home-spot__top">
            <b>{{ spot.name }}</b>
            <span class="home-spot__price">
              <s v-if="spot.strike">{{ spot.strike }}</s>
              {{ spot.price }}<small>{{ spot.unit }}</small>
            </span>
          </span>
          <span class="home-spot__where">{{ spot.where }}</span>
          <span class="home-spot__foot">
            <span class="home-spot__cta">
              {{ spot.foot }}
              <Icon name="arrow-right" :size="14" />
            </span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- ── Main + rail ──────────────────────────────────────────────────── -->
    <div class="home-layout">
      <div class="home-main">
        <!-- Bookable spots. The four benefit lines moved to /pricing. -->
        <section id="home-offers" class="home-offers" aria-labelledby="home-offers-title">
          <div class="section-head">
            <div class="section-head__title">
              <h2 id="home-offers-title">{{ pick('这些位置可以订', 'Spots you can book') }}</h2>
              <p>
                {{
                  pick(
                    '有真实订单就展示那个产品。空位只写档位和价格，不放示例。',
                    'A paid order shows that product. An empty spot shows the tier and its price, not a sample.',
                  )
                }}
              </p>
            </div>
          </div>
          <div class="offer-grid">
            <template v-for="offer in offerSlots" :key="offer.id">
              <a
                v-if="offer.occupant?.external"
                class="offer-card is-taken"
                :href="offer.occupant.href"
                rel="sponsored nofollow noopener"
                target="_blank"
              >
                <span class="offer-card__logo">
                  <ToolLogo :logo="offer.occupant.logo" :name="offer.occupant.name" :size="40" decorative />
                </span>
                <span class="offer-card__body">
                  <span class="offer-card__kicker">
                    <em class="offer-card__flag">{{ offer.flag }}</em>
                    {{ pick(offer.name.zh, offer.name.en) }}
                    <b>{{ offer.price }}</b>
                    <small>{{ pick(offer.unit.zh, offer.unit.en) }}</small>
                  </span>
                  <strong>{{ offer.occupant.name }}</strong>
                  <span v-if="offer.occupant.line" class="offer-card__line">{{ offer.occupant.line }}</span>
                  <span class="offer-card__detail">{{ pick(offer.detail.zh, offer.detail.en) }}</span>
                  <span class="offer-card__cta">
                    {{ pick('查看', 'View') }}
                    <Icon name="arrow-right" :size="14" />
                  </span>
                </span>
              </a>
              <NuxtLink
                v-else-if="!offer.occupant"
                class="offer-card offer-card--open"
                :to="localePath(offer.href)"
              >
                <Icon name="megaphone" :size="22" />
                <strong>{{ pick('投放广告', 'Advertise') }}</strong>
                <span class="offer-card__sub">{{ offerSpotLine(offer, lang) }}</span>
              </NuxtLink>
              <NuxtLink
                v-else
                class="offer-card is-taken"
                :to="localePath(offer.occupant.href)"
              >
                <span class="offer-card__logo">
                  <ToolLogo
                    :logo="offer.occupant.logo"
                    :name="offer.occupant.name"
                    :size="40"
                    decorative
                  />
                </span>
                <span class="offer-card__body">
                  <span class="offer-card__kicker">
                    <em class="offer-card__flag">{{ offer.flag }}</em>
                    {{ pick(offer.name.zh, offer.name.en) }}
                    <b>{{ offer.price }}</b>
                    <small>{{ pick(offer.unit.zh, offer.unit.en) }}</small>
                  </span>
                  <strong>{{ offer.occupant.name }}</strong>
                  <span v-if="offer.occupant.line" class="offer-card__line">{{ offer.occupant.line }}</span>
                  <span class="offer-card__detail">{{ pick(offer.detail.zh, offer.detail.en) }}</span>
                  <span class="offer-card__cta">
                    {{ pick('查看', 'View') }}
                    <Icon name="arrow-right" :size="14" />
                  </span>
                </span>
              </NuxtLink>
            </template>
          </div>
        </section>

        <!-- Category pills — these filter the listing page in place, they do
             not navigate to /categories/<slug>; the cat cards below do that. -->
        <nav class="pills scrollbar-none" :aria-label="pick('分类', 'Categories')">
          <NuxtLink class="pill is-active" :to="localePath('/tools')" aria-current="page">{{ pick('全部', 'All') }}</NuxtLink>
          <NuxtLink
            v-for="cat in pills"
            :key="cat.slug"
            class="pill"
            :to="localePath(`/tools?category=${cat.slug}`)"
          >
            {{ cat.name }}
          </NuxtLink>
        </nav>

        <!-- This week's board -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('本周投票榜', "This week's votes") }}</h2>
              <p>{{ weekText }} · {{ pick('每周一重置。付费 Billboard 不改变这里的名次。', 'resets every Monday. A paid Billboard does not change this rank.') }}</p>
            </div>
            <NuxtLink class="more" :to="localePath('/weekly')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <ol class="board">
            <li
              v-for="row in board"
              :key="row.tool?.slug || row.rank"
              class="board__row"
              :class="{ 'is-top': row.rank <= 3 }"
            >
              <NuxtLink v-if="row.tool" class="board__link" :to="localePath(`/tools/${row.tool.slug}`)">
                <span class="board__rank" :class="{ 'is-top': row.rank <= 3 }">{{ row.rank }}</span>
                <span class="tool-icon" style="width: 38px; height: 38px">
                  <img :src="`/${row.tool.logo}`" alt="" width="38" height="38" loading="lazy" >
                </span>
                <span class="board__body">
                  <span class="board__name">{{ row.tool.name }}</span>
                  <span class="board__desc">{{ row.tool.short }}</span>
                </span>
                <span class="board__meta">
                  <span class="board__tag">
                    <Icon name="shapes" />
                    {{
                      categoryBySlug(row.tool.category, liveCategories)
                        ? localizeCategory(categoryBySlug(row.tool.category, liveCategories)!, lang).name
                        : ''
                    }}
                  </span>
                  <span class="board__votes">
                    <Icon name="arrow-up" />{{ row.votes }}
                  </span>
                </span>
              </NuxtLink>
            </li>
          </ol>
        </section>

        <!-- Browse by category -->
        <section id="browse-by-category">
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('按分类浏览', 'Browse by category') }}</h2>
            </div>
            <NuxtLink class="more" :to="localePath('/categories')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="cat-grid">
            <article
              v-for="cat in cats"
              :key="cat.slug"
              class="cat-card"
              :class="{ 'is-open': cat.empty }"
            >
              <div v-if="cat.empty" class="cat-card__open">
                <span class="cat-card__icon"><Icon :name="cat.icon" /></span>
                <span class="cat-card__body">
                  <span class="cat-card__title">{{ cat.name }}</span>
                  <span class="cat-card__desc">
                    {{ pick('这个分类还没有产品。', 'No products in this category yet.') }}
                  </span>
                  <span class="cat-card__actions">
                    <NuxtLink :to="localePath(cat.links.list)">
                      {{ pick('成为该分类第一个', 'Be the first in this category') }}
                    </NuxtLink>
                    <NuxtLink :to="localePath(cat.links.sponsor)">
                      {{ pick('赞助这个分类', 'Sponsor this category') }}
                    </NuxtLink>
                  </span>
                </span>
              </div>
              <NuxtLink
                v-else
                class="cat-card__fill"
                :to="localePath(`/categories/${cat.slug}`)"
              >
                <span
                  v-if="cat.thumbs.length"
                  class="cat-card__mix"
                  :data-n="cat.thumbs.length"
                  aria-hidden="true"
                >
                  <img
                    v-for="tool in cat.thumbs"
                    :key="tool.slug"
                    :src="logoSrc(tool.logo)"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  >
                </span>
                <span v-else class="cat-card__icon"><Icon :name="cat.icon" /></span>
                <span class="cat-card__body">
                  <span class="cat-card__title">
                    {{ cat.name }}
                    <span class="cat-card__count">{{ cat.count }} {{ pick('个产品', 'products') }}</span>
                  </span>
                  <span class="cat-card__desc">{{ cat.desc }}</span>
                </span>
                <span
                  v-if="cat.showVoteBar"
                  class="cat-card__heat"
                  :title="`${cat.votes} ${pick('票 / 本周', 'votes this week')}`"
                >
                  <span class="cat-card__bar">
                    <span :style="{ width: `${Math.round((cat.votes / maxCatVotes) * 100)}%` }" />
                  </span>
                  <span class="cat-card__num">{{ cat.votes }}</span>
                </span>
              </NuxtLink>
            </article>
          </div>
        </section>

        <!-- Just added -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('最新收录', 'Just added') }}</h2>
              <p>{{ pick('目录里最近上线的产品。', 'The newest products in the directory.') }}</p>
            </div>
            <NuxtLink class="more" :to="localePath('/just-added')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="tool-grid">
            <ToolCard v-for="tool in latest" :key="tool.slug" :tool="tool" />
          </div>
        </section>

        <!-- FAQ -->
        <section class="home-faq">
          <h2>{{ pick('常见问题', 'Questions') }}</h2>
          <div class="accordion">
            <div
              v-for="(item, i) in faq"
              :key="item.q"
              class="acc-item"
              :class="{ 'is-open': openFaq === i }"
            >
              <button
                class="acc-trigger"
                type="button"
                :aria-expanded="openFaq === i"
                @click="openFaq = openFaq === i ? -1 : i"
              >
                {{ item.q }}
                <Icon name="chevron-down" />
              </button>
              <div class="acc-panel">{{ item.a }}</div>
            </div>
          </div>
        </section>
      </div>

      <!-- Rail -->
      <aside class="rail">
        <AdSlot slot="sidebar" :ad="sidebarAd" />

        <!--
          The empty state of the sidebar slot.

          `AdSlot` renders nothing while no campaign is booked, on purpose: the
          original site has no empty frame there. But a slot nobody can see is a
          slot nobody books, so the empty state sells the next one instead of
          leaving a hole — price first, from `adPlans`, so it cannot drift from
          `/pricing`.
        -->
        <section v-if="!sidebarAd && sidebarPlan" class="rail-for-rent">
          <p class="rail-for-rent__tag">{{ pick('这个位置招租', 'This spot is for rent') }}</p>
          <p class="rail-for-rent__price">
            <b>{{ sidebarPlan.price }}</b>
            <span>{{ pick(sidebarPlan.unit.zh, sidebarPlan.unit.en) }}</span>
          </p>
          <p class="rail-for-rent__meta">
            {{ pick(sidebarPlan.bundle.zh, sidebarPlan.bundle.en) }}
          </p>
          <p class="rail-for-rent__where">
            {{ pick(sidebarPlan.where.zh, sidebarPlan.where.en) }}
          </p>
          <NuxtLink
            class="rail-for-rent__cta"
            :to="`${localePath('/book-ad')}?slot=sidebar&weeks=1`"
          >
            {{ pick('选一个周次', 'Pick a week') }}
            <Icon name="arrow-right" :size="14" />
          </NuxtLink>
        </section>

        <RailHeat />

        <section class="paid-card">
          <div class="paid-card__preview">
            <span class="paid-card__thumb"><Icon name="sparkles" /></span>
            <span class="paid-card__pv">
              <b>{{ pick('你的产品', 'Your tool') }}</b>
              <span>{{ pick('排在免费收录之前', 'Listed above free') }}</span>
            </span>
            <span class="paid-card__flag">STANDARD</span>
          </div>
          <h2>{{ pick('让更多人先看到你', 'Get seen first') }}</h2>
          <p class="paid-card__sub">
            {{ pick('付款成功后自动收录发布。', 'Published automatically as soon as payment succeeds.') }}
          </p>
          <ul class="paid-feats">
            <li><Icon name="circle-check" /><span>{{ pick('永久 dofollow 反链，不挂 badge', 'Permanent dofollow link, no badge') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('付款成功后自动收录发布', 'Published automatically as soon as payment succeeds') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('目录页排在免费收录之前', 'Listed above every free submission') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('想再往前：精选 $39 加置顶 7 天', 'Want the top? Featured adds a 7-day pin for $39') }}</span></li>
          </ul>
          <p class="paid-card__price">
            <span>{{ pick('从', 'From') }}</span><b>$19</b><em>{{ pick('一次性', 'one-time') }}</em>
          </p>
          <NuxtLink class="btn btn--primary btn--block" :to="localePath('/pricing')">
            {{ pick('升级收录', 'Upgrade your listing') }}
            <Icon name="arrow-right" />
          </NuxtLink>
        </section>

        <section>
          <div class="section-head section-head--stack">
            <div class="section-head__title">
              <h2>{{ pick('热门标签', 'Popular tags') }}</h2>
            </div>
          </div>
          <div class="tag-cloud">
            <NuxtLink
              v-for="tag in popularTags"
              :key="tag.slug"
              class="tag-pill"
              :to="localePath(`/tags/${tag.slug}`)"
            >
              #{{ localizeTag(tag, lang).name }}
            </NuxtLink>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
