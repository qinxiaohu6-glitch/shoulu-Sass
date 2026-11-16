<script setup lang="ts">
import { centsLabel } from '~~/shared/content/campaign'
import { englishCount } from '~~/shared/utils/english-count'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { BILLBOARD_FLOOR_CENTS } from '~~/shared/utils/billboard-bid'
import { samePlacementUrl } from '~~/shared/utils/billboard'
import {
  filterByWindow,
  nextLaunchInstant,
  parseInstant,
  remainingHms,
  shanghaiMonthRange,
  shanghaiParts,
} from '~~/shared/utils/directory-window'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

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

function launchBadges(tool: { url?: string; plan?: string; is_featured?: boolean; is_paid?: boolean }): string[] {
  const badges: string[] = []
  if (tool.url && billboardKeys.value.has(samePlacementUrl(tool.url))) badges.push('BILLBOARD')
  if (tool.plan === 'pro' && tool.is_paid) badges.push('PRO')
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

const tick = ref(Date.now())
onMounted(() => {
  const id = setInterval(() => {
    tick.value = Date.now()
  }, 1000)
  onBeforeUnmount(() => clearInterval(id))
})

const directory = computed(() =>
  [...all.value].sort((a, b) => (parseInstant(b.created_at) ?? 0) - (parseInstant(a.created_at) ?? 0)),
)
const monthItems = computed(() =>
  filterByWindow(directory.value, shanghaiMonthRange(new Date(tick.value)), (row) => row.created_at),
)

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
  votes: number
  rank: number
  badges: string[]
}

function decorate(
  tool: { slug: string; name: string; short: string; logo: string; category: string; url?: string; plan?: string; is_featured?: boolean; is_paid?: boolean } | undefined,
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
    votes,
    rank,
    badges: tool ? launchBadges(tool) : [],
  }
}

const weekFeed = computed(() => {
  const bySlug = new Map(all.value.map((tool) => [tool.slug, tool]))
  return (boardData.value.current?.ranking ?? [])
    .filter((row) => row.votes > 0)
    .map((row, index) => decorate(bySlug.get(row.slug), row.slug, row.votes, row.rank ?? index + 1))
})

const monthFeed = computed(() => {
  const votes = new Map((boardData.value.current?.ranking ?? []).map((row) => [row.slug, row.votes]))
  return monthItems.value.map((tool) => decorate(tool, tool.slug, votes.get(tool.slug) ?? 0, 0))
})

const windowFilter = ref<'week' | 'month'>('week')
const feed = computed(() => (windowFilter.value === 'week' ? weekFeed.value : monthFeed.value))

const nextAt = computed(() => nextLaunchInstant(all.value, tick.value))
const clock = computed(() => (nextAt.value ? remainingHms(nextAt.value, tick.value) : null))

const monthLabel = computed(() => {
  const parts = shanghaiParts(new Date(tick.value))
  if (isZh.value) return `${parts.year}年${parts.month}月`
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(tick.value))
})

const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)
const featuredQuote = computed(() => effectiveQuote('listing', 'featured', tick.value))
const standardQuote = computed(() => effectiveQuote('listing', 'standard', tick.value))
const proQuote = computed(() => effectiveQuote('listing', 'pro', tick.value))

const featuredTo = computed(() => `${localePath('/submit')}?plan=featured`)
const featuredCta = computed(() => pick('去付款 · 精选', 'Pay · Featured'))

function categoryName(slug: string): string {
  const found = categoryBySlug(slug, liveCategories.value)
  return found ? localizeCategory(found, lang.value).name : ''
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
      ? '提交你的产品。把页面留下来。 | Product Atlas'
      : 'List your product. Keep the page. | Product Atlas',
  ),
  description: computed(() =>
    isZh.value
      ? '在 Product Atlas 提交产品。可以免费提交，或一次付费换更快上线和 dofollow 链接。Billboard 另付，从 $10 起。'
      : 'List your product on Product Atlas. Free to submit, or pay once for a faster go-live and a dofollow link. Billboard is separate, from $10.',
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

        <section class="mk-hero mk-hero--center mk-hero--launch">
          <p class="mk-eyebrow">{{ pick('产品目录，每个产品都有一页会留下来的页面', 'A directory of products, with a lasting page for each one') }}</p>
          <h1 v-if="isZh" class="mk-h1">
            提交你的产品。<br><span class="mk-h1__em">把页面留下来。</span>
          </h1>
          <h1 v-else class="mk-h1">
            List your product.<br><span class="mk-h1__em">Keep the page.</span>
          </h1>
          <p class="mk-sub">
            {{
              pick(
                '获得一页永久产品页。一次付费，得到 dofollow 链接和更快上线。Billboard 另付，从 $10 起自己出价。',
                'Get a permanent listing page. Pay once for a dofollow link and a faster go-live. Billboard is separate: name your price from $10.',
              )
            }}
          </p>
          <div class="mk-cta">
            <NuxtLink class="btn btn--primary btn--lg" :to="localePath('/submit')">
              {{ pick('提交产品', 'Submit a product') }}
              <Icon name="arrow-right" />
            </NuxtLink>
            <NuxtLink class="btn btn--outline btn--lg" :to="localePath('/billboard')">
              {{ pick('认领 Billboard 位置', 'Claim a Billboard spot') }}
            </NuxtLink>
          </div>
          <ul class="mk-proofs">
            <li v-for="proof in proofs" :key="proof">
              <Icon name="check" />
              {{ proof }}
            </li>
          </ul>
          <LiveDirectoryFacts />
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

    <BillboardGrid :cells="homeGrid" />

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
        </div>
      </aside>

      <section class="home-dir__main" aria-labelledby="just-launched-title">
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
        <p class="home-dir__month">{{ monthLabel }}</p>
        <div class="home-dir__filters" role="tablist">
          <button type="button" :class="{ 'is-on': windowFilter === 'week' }" @click="windowFilter = 'week'">
            {{ pick('本星期', 'This week') }} <em>{{ weekFeed.length }}</em>
          </button>
          <button type="button" :class="{ 'is-on': windowFilter === 'month' }" @click="windowFilter = 'month'">
            {{ pick('本月 · 最新', 'This month · Newest') }} <em>{{ monthFeed.length }}</em>
          </button>
        </div>
        <ol class="home-feed">
          <li
            v-for="row in feed"
            :key="row.slug"
            class="launch-row"
            :class="{ 'launch-row--newest': windowFilter === 'month' }"
          >
            <NuxtLink class="launch-row__link" :to="localePath(`/products/${row.slug}`)">
              <span v-if="windowFilter === 'week'" class="launch-row__rank">{{ row.rank }}</span>
              <span class="launch-row__logo">
                <ToolLogo :logo="row.logo" :name="row.name" :size="40" decorative />
              </span>
              <span class="launch-row__body">
                <strong>
                  {{ row.name }}
                  <em v-for="badge in row.badges" :key="badge" class="launch-row__badge">{{ badge }}</em>
                </strong>
                <span>{{ row.short }}</span>
                <span v-if="categoryName(row.category)" class="launch-row__cat">{{ categoryName(row.category) }}</span>
              </span>
            </NuxtLink>
            <VoteButton stack :slug="row.slug" :votes="row.votes" />
          </li>
        </ol>
        <p v-if="!feed.length" class="home-feed__empty">
          {{
            windowFilter === 'week'
              ? pick('本周榜上还没有票。', 'No votes on the board this week.')
              : pick('本月还没有新发布。', 'No launches this month.')
          }}
          <NuxtLink :to="localePath('/submit')">{{ pick('提交产品', 'Submit a product') }}</NuxtLink>
        </p>
      </section>

      <aside class="home-dir__right" aria-labelledby="featured-sell-title">
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
.launch-row--newest .launch-row__link {
  grid-template-columns: 44px minmax(0, 1fr);
}
</style>
