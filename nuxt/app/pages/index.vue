<script setup lang="ts">
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'
import { adPlans } from '~~/shared/content/pricing'

const { lang, isZh, pick } = useLang()

const router = useRouter()
// @nuxtjs/i18n v10 exposes this as a composable rather than an auto-import,
// so it has to be pulled in during setup — not inside the submit handler.
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
const { board: boardAd, sidebar: sidebarAd } = await useAds()

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
const { data: homeSpots } = await useAsyncData<{
  board: AdAvailability
  sidebar: AdAvailability
}>(
  'home-spot-availability',
  async () => {
    const [board, sidebar] = await Promise.all([
      requestFetch<AdAvailability>('/api/ads/availability?slot=board&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
      requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
    ])
    return { board, sidebar }
  },
  { default: () => ({ board: EMPTY_AD_AVAILABILITY, sidebar: EMPTY_AD_AVAILABILITY }) },
)

const spotStrip = computed(() =>
  adPlans.map((entry) => {
    const payload = entry.id === 'board' ? homeSpots.value?.board : homeSpots.value?.sidebar
    const open = openAdWeeks(payload)
    return {
      id: entry.id,
      name: isZh.value ? entry.name.zh : entry.name.en,
      price: entry.price,
      unit: isZh.value ? entry.unit.zh : entry.unit.en,
      where: isZh.value ? entry.where.zh : entry.where.en,
      openCount: open.length,
      hasLive: Boolean(payload?.ok),
    }
  }),
)

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

/* "Sponsored" hero card — the one listing that is both paid and featured. */
const heroCard = computed(() => {
  const featured = featuredTools(lang.value, overrides.value)
  return featured.find((tool) => tool.is_paid && tool.is_featured) ?? featured[0]
})

/* The three tiles beside it are a curated set, in this order, on the live site. */
const tileSlugs = ['coding', 'chatbots', 'image']
const tiles = computed(() =>
  tileSlugs
    .map((slug) => categoryBySlug(slug, liveCategories.value))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => localizeCategory(c, lang.value)),
)

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
    board: boardAd.value,
    sidebar: sidebarAd.value,
  }),
)

const maxCatVotes = computed(() => Math.max(...cats.value.map((c) => c.votes), 1))

const pills = computed(() => pillCategories(lang.value, liveCategories.value))

const latest = computed(() =>
  [...submitted.value, ...latestTools(lang.value, 6, overrides.value)]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6),
)

const stats = computed(() => [
  { value: String(all.value.length), label: pick('个产品已收录', 'products listed') },
  { value: String(liveCategories.value.length), label: pick('个分类', 'categories') },
  { value: 'dofollow', label: pick('付费收录外链', 'on paid listings') },
  { value: pick('每周一', 'Weekly'), label: pick('榜单重置', 'board reset') },
])

const proofs = computed(() => [
  pick('30 秒提交', '30-second submit'),
  pick('付费收录 dofollow', 'Dofollow on paid'),
  pick('付款成功自动上线', 'Live automatically on payment'),
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
const heroUrl = ref('')
const { ensure: ensureSession } = useSession()

/**
 * The old site pushed signed-out visitors through Google before the form, so
 * nobody filled in three steps and then discovered they had to sign in. The
 * address they typed rides inside `next` and comes back with them — it is
 * sealed into the OAuth state cookie, not left in the query string where a
 * third party could edit it.
 */
async function startSubmit() {
  const url = heroUrl.value.trim()
  const target = url ? `/submit?url=${encodeURIComponent(url)}` : '/submit'

  if (!(await ensureSession())) {
    await navigateTo(localePath({ path: '/sign-in', query: { next: target } }))
    return
  }
  router.push(url ? { path: '/submit', query: { url } } : '/submit')
}

const popularTags = computed(() => liveTags.value.slice(0, 15))

useSeo({
  title: computed(() =>
    isZh.value
      ? 'Product Atlas — 发布你的产品，反链永久保留'
      : 'Product Atlas — Launch your product, keep the backlink',
  ),
  description: computed(() =>
    isZh.value
      ? '为 Maker 做的产品目录：免费提交、付费收录给 dofollow 反链、一个 AI 搜索愿意引用的页面，以及每周一重置的榜单。'
      : 'A product directory built for makers: free submission, dofollow backlink on paid placements, a page AI search can cite, and a weekly leaderboard that resets every Monday.',
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
    <!-- ── Hero + Top picks ─────────────────────────────────────────────── -->
    <div class="home-top">
      <section class="mk-hero mk-hero--center">
        <p class="mk-eyebrow">{{ pick('写给 Maker', 'For makers') }}</p>

        <h1 v-if="isZh" class="mk-h1">
          发布你的产品，<span class="mk-h1__em">反链永久保留</span>。
        </h1>
        <h1 v-else class="mk-h1">
          Launch your product.<br><span class="mk-h1__em">Keep the backlink forever.</span>
        </h1>

        <p class="mk-sub">
          {{
            pick(
              '付费收录给一条永久 dofollow 反链、一个 AI 搜索读得懂也愿意引用的页面，以及每周一重置的榜单曝光。免费提交也能上，链接是 nofollow。',
              'Paid listings get a permanent dofollow backlink, a page AI search can read and cite, and a weekly leaderboard that resets every Monday. Free listings go up too — nofollow.',
            )
          }}
        </p>

        <form class="mk-url" @submit.prevent="startSubmit">
          <div class="mk-url__row">
            <input
              v-model="heroUrl"
              class="mk-url__input"
              type="text"
              inputmode="url"
              autocomplete="url"
              name="url"
              spellcheck="false"
              :placeholder="pick('https://你的产品.com', 'https://yourtool.com')"
              :aria-label="pick('输入产品网址，登录后进入提交', 'Your product URL — sign in to continue')"
            >
            <button class="btn btn--primary btn--lg mk-url__btn" type="submit">
              {{ pick('免费提交', 'Submit free') }}
              <Icon name="arrow-right" />
            </button>
          </div>
          <ul class="mk-proofs">
            <li v-for="proof in proofs" :key="proof">
              <Icon name="check" />
              {{ proof }}
            </li>
          </ul>
        </form>

        <div class="mk-stats">
          <div v-for="stat in stats" :key="stat.label" class="mk-stat">
            <b>{{ stat.value }}</b>
            <span>{{ stat.label }}</span>
          </div>
        </div>
      </section>

      <aside class="home-top__side">
        <TopPicks :limit="5" />
      </aside>
    </div>

    <!-- ── Both placements, priced up front ──────────────────────────────── -->
    <section class="home-spots" aria-labelledby="home-spots-title">
      <div class="home-spots__head">
        <div>
          <p class="home-spots__eyebrow">{{ pick('本周还有位置', 'SPOTS OPEN THIS WEEK') }}</p>
          <h2 id="home-spots-title">{{ pick('两个位置，明码标价', 'Two placements, priced up front') }}</h2>
        </div>
        <p class="home-spots__note">
          {{
            pick(
              '可订周次实时读取排期表。付款成功后系统自动排期，同一周不会卖两次。',
              'Open weeks come from the live schedule. Payment schedules it automatically and no week is sold twice.',
            )
          }}
        </p>
      </div>
      <div class="home-spots__grid">
        <NuxtLink
          v-for="spot in spotStrip"
          :key="spot.id"
          class="home-spot"
          :to="`${localePath('/book-ad')}?slot=${spot.id}&weeks=1`"
        >
          <span class="home-spot__top">
            <b>{{ spot.name }}</b>
            <span class="home-spot__price">{{ spot.price }}<small>{{ spot.unit }}</small></span>
          </span>
          <span class="home-spot__where">{{ spot.where }}</span>
          <span class="home-spot__foot">
            <span v-if="spot.hasLive">
              {{ spotOpenLabel(spot.openCount) }}
            </span>
            <span v-else>{{ pick('在线选周', 'Pick a week online') }}</span>
            <span class="home-spot__cta">
              {{ pick('选周次', 'Pick a week') }}
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
                    '有真实订单就展示那个产品。空着写「你的产品」，不放示例。',
                    'A paid order shows that product. An empty spot says “Your product” and is not filled with a sample.',
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
                v-else
                class="offer-card"
                :class="{ 'is-taken': Boolean(offer.occupant) }"
                :to="localePath(offer.occupant ? offer.occupant.href : offer.href)"
              >
                <span class="offer-card__logo">
                  <ToolLogo
                    v-if="offer.occupant"
                    :logo="offer.occupant.logo"
                    :name="offer.occupant.name"
                    :size="40"
                    decorative
                  />
                  <span v-else class="offer-card__ghost" aria-hidden="true">+</span>
                </span>
                <span class="offer-card__body">
                  <span class="offer-card__kicker">
                    {{ pick(offer.name.zh, offer.name.en) }}
                    <b>{{ offer.price }}</b>
                    <small>{{ pick(offer.unit.zh, offer.unit.en) }}</small>
                  </span>
                  <strong>{{ offer.occupant ? offer.occupant.name : pick('你的产品', 'Your product') }}</strong>
                  <span class="offer-card__line">
                    {{
                      offer.occupant
                        ? offer.occupant.line
                        : pick('这个位置可订', 'This spot is open')
                    }}
                  </span>
                  <span class="offer-card__detail">{{ pick(offer.detail.zh, offer.detail.en) }}</span>
                  <span class="offer-card__cta">
                    {{ offer.occupant ? pick('查看', 'View') : pick('预订这个位置', 'Book this spot') }}
                    <Icon name="arrow-right" :size="14" />
                  </span>
                </span>
              </NuxtLink>
            </template>
          </div>
        </section>

        <!-- Featured -->
        <section v-if="heroCard">
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('精选', 'Featured') }}</h2>
            </div>
            <NuxtLink class="more" :to="localePath('/tools')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="featured-grid">
            <div class="hero-card">
              <div class="hero-card__glow" aria-hidden="true" />
              <div class="hero-card__inner">
                <div class="hero-card__head">
                  <span class="hero-card__logo">
                    <img :src="`/${heroCard.logo}`" alt="" width="36" height="36" >
                  </span>
                  <span class="badge-pick">{{ pick('赞助', 'Sponsored') }}</span>
                </div>
                <h3>{{ heroCard.name }}</h3>
                <p class="hero-card__desc">{{ heroCard.short }}</p>
                <div class="hero-card__cta">
                  <NuxtLink class="btn btn--primary" :to="localePath(`/tools/${heroCard.slug}`)">
                    {{ pick('查看详情', 'View details') }}
                    <Icon name="arrow-right" />
                  </NuxtLink>
                  <span class="hero-card__meta">
                    <Icon name="arrow-up" />
                    <span>{{ heroCard.votes_week }} {{ pick('票', 'votes') }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="featured-tiles">
              <NuxtLink v-for="cat in tiles" :key="cat.slug" class="cat-tile" :to="localePath(`/categories/${cat.slug}`)">
                <span class="cat-tile__icon"><Icon :name="cat.icon" /></span>
                <span class="cat-tile__body">
                  <p>{{ cat.name }}</p>
                  <p>{{ cat.desc }}</p>
                </span>
                <Icon name="chevron-right" />
              </NuxtLink>
            </div>
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
              <h2>{{ pick('本周榜单', "This week's board") }}</h2>
              <p>{{ weekText }} · {{ pick('每周一重置', 'resets every Monday') }}</p>
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
