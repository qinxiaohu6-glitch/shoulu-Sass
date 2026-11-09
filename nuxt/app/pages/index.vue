<script setup lang="ts">
import { contactHref } from '~~/shared/content/site-contact'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { samePlacementUrl } from '~~/shared/utils/billboard'
import {
  filterByWindow,
  nextLaunchInstant,
  parseInstant,
  remainingHms,
  shanghaiMonthRange,
  shanghaiParts,
  shanghaiWeekRange,
} from '~~/shared/utils/directory-window'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const { homeGrid, ranked: billboardRanked } = await useBillboard()
const { ready: paymentReady } = await usePayment()
const requestFetch = useRequestFetch()
const { data: weekVotes } = await useAsyncData(
  'home-week-votes',
  async () => {
    try {
      return await requestFetch<{ ok: boolean; counts?: Record<string, number> }>('/api/votes')
    } catch {
      return { ok: false, counts: {} as Record<string, number> }
    }
  },
  { default: () => ({ ok: false, counts: {} as Record<string, number> }) },
)

function votesOf(tool: { slug: string; votes_week: number }): number {
  return Math.max(Number(tool.votes_week) || 0, Number(weekVotes.value?.counts?.[tool.slug]) || 0)
}

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
const weekItems = computed(() =>
  filterByWindow(directory.value, shanghaiWeekRange(new Date(tick.value)), (row) => row.created_at),
)
const monthItems = computed(() =>
  filterByWindow(directory.value, shanghaiMonthRange(new Date(tick.value)), (row) => row.created_at),
)
const windowFilter = ref<'week' | 'month'>('week')
const feed = computed(() => (windowFilter.value === 'week' ? weekItems.value : monthItems.value))

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

const featuredQuote = computed(() => effectiveQuote('listing', 'featured', tick.value))
const standardQuote = computed(() => effectiveQuote('listing', 'standard', tick.value))
const proQuote = computed(() => effectiveQuote('listing', 'pro', tick.value))

function invoiceHref(plan: string): string {
  const href = contactHref()
  const subject = encodeURIComponent(`Invoice request · ${plan}`)
  return href ? `${href}?subject=${subject}` : localePath('/pricing')
}

const featuredTo = computed(() =>
  paymentReady.value ? `${localePath('/submit')}?plan=featured` : invoiceHref('Featured'),
)
const featuredCta = computed(() =>
  paymentReady.value
    ? pick(`获得推荐 · ${featuredQuote.value.priceLabel}`, `Get Featured · ${featuredQuote.value.priceLabel}`)
    : pick(`索取发票 · ${featuredQuote.value.priceLabel}`, `Request invoice · ${featuredQuote.value.priceLabel}`),
)

function categoryName(slug: string): string {
  const found = categoryBySlug(slug, liveCategories.value)
  return found ? localizeCategory(found, lang.value).name : ''
}

const proofs = computed(() => [
  pick('永久产品页', 'Permanent listing page'),
  pick('数分钟即可提交', 'Submit in minutes'),
  pick('一次性 Billboard · 无订阅', 'One-time Billboard · no subscription'),
])

const faq = computed(() => {
  const standard = standardQuote.value.priceLabel
  const featured = featuredQuote.value.priceLabel
  const pro = proQuote.value.priceLabel
  return isZh.value
    ? [
        {
          q: '提交要花钱吗？',
          a: `免费收录 0 元，进人工审核队列，通常 7–14 天，不保证；高峰可能更长，链接是 nofollow。标准一次性 ${standard}：付款成功后自动收录发布、永久 dofollow、目录页排在免费收录之前。精选 ${featured}：再加目录页和分类页置顶 7 天、首页精选卡。专业 ${pro}：分类页置顶 90 天、全年 4 次文案修改、站长开启邮件后 24h 内回复。都是单次付费，不是订阅。Billboard 从 $15 起自己出价，黑五不降低这个地板价。`,
        },
        {
          q: '多久能上线？',
          a: '付费档在付款成功后自动发布。若走发票，则在发票确认后上线。免费收录由人工审核，通常 7–14 天，不保证；高峰可能更长。',
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
          a: `A free listing costs nothing, waits in the review queue (usually 7–14 days, not guaranteed; busy periods can take longer), and carries a nofollow link. Standard is a one-time ${standard}: published automatically as soon as payment succeeds, permanent dofollow, listed above every free submission. Featured is ${featured} and adds a 7-day pin on the directory and category pages plus the homepage card. Pro is ${pro} for a 90-day category pin, four copy edits a year, and a reply within 24 hours after the site owner turns email on. All one-time payments, never a subscription. Billboard is name-your-price from $15, and Black Friday does not lower that floor.`,
        },
        {
          q: 'How fast does my listing go live?',
          a: 'Paid listings publish when payment succeeds. An invoice request goes live after that invoice is confirmed. Free listings are reviewed by a person, usually 7–14 days, not guaranteed; busy periods can take longer.',
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
      ? 'Product Atlas — 发布你的产品，反链永久保留'
      : 'Product Atlas — Launch your product, keep the backlink',
  ),
  description: computed(() =>
    isZh.value
      ? '产品目录。Billboard 从 $15 起自己出价，一次付清，和每周投票榜分开。'
      : 'A product directory. Billboard is name-your-price from $15, one-time, kept separate from the weekly vote list.',
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
          <p class="mk-eyebrow">{{ pick('发现优质 AI 与 SaaS 产品', 'Discover the best AI & SaaS tools') }}</p>
          <h1 v-if="isZh" class="mk-h1">
            今日上线，<br><span class="mk-h1__em">即被发现。</span>
          </h1>
          <h1 v-else class="mk-h1">
            Launch today.<br><span class="mk-h1__em">Get discovered.</span>
          </h1>
          <p class="mk-sub">
            {{
              pick(
                '首页 Billboard 展示、永久产品页，以及上线之后持续被发现。',
                'Homepage Billboard placement, a permanent listing page, and founders discovering your product long after launch day.',
              )
            }}
          </p>
          <div class="mk-cta">
            <NuxtLink class="btn btn--primary btn--lg" :to="localePath('/submit')">
              {{ pick('立即上线', 'Launch Now') }}
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
          <p class="home-dir__stat"><strong>{{ all.length }}</strong> {{ pick('个产品已收录', 'products listed') }}</p>
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
          <p v-else class="home-clock home-clock--empty">
            {{ pick('即将开放排期', 'Schedule opens soon') }}
          </p>
        </div>
        <p class="home-dir__month">{{ monthLabel }}</p>
        <div class="home-dir__filters" role="tablist">
          <button type="button" :class="{ 'is-on': windowFilter === 'week' }" @click="windowFilter = 'week'">
            {{ pick('本星期', 'This week') }} <em>{{ weekItems.length }}</em>
          </button>
          <button type="button" :class="{ 'is-on': windowFilter === 'month' }" @click="windowFilter = 'month'">
            {{ pick('本月', 'This month') }} <em>{{ monthItems.length }}</em>
          </button>
        </div>
        <ol class="home-feed">
          <li v-for="(tool, index) in feed" :key="tool.slug" class="launch-row">
            <NuxtLink class="launch-row__link" :to="localePath(`/products/${tool.slug}`)">
              <span class="launch-row__rank">{{ index + 1 }}</span>
              <span class="launch-row__logo">
                <ToolLogo :logo="tool.logo" :name="tool.name" :size="40" decorative />
              </span>
              <span class="launch-row__body">
                <strong>
                  {{ tool.name }}
                  <em v-for="badge in launchBadges(tool)" :key="badge" class="launch-row__badge">{{ badge }}</em>
                </strong>
                <span>{{ tool.short }}</span>
                <span v-if="categoryName(tool.category)" class="launch-row__cat">{{ categoryName(tool.category) }}</span>
              </span>
            </NuxtLink>
            <VoteButton stack :slug="tool.slug" :votes="votesOf(tool)" />
          </li>
        </ol>
        <p v-if="!feed.length" class="home-feed__empty">
          {{
            windowFilter === 'week'
              ? pick('本周还没有新发布。', 'No launches this week.')
              : pick('本月还没有新发布。', 'No launches this month.')
          }}
          <NuxtLink :to="localePath('/submit')">{{ pick('立即上线', 'Launch Now') }}</NuxtLink>
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
          <a v-if="!paymentReady" class="btn btn--primary btn--block" :href="featuredTo">
            {{ featuredCta }}
          </a>
          <NuxtLink v-else class="btn btn--primary btn--block" :to="featuredTo">
            {{ featuredCta }}
          </NuxtLink>
          <p class="feat-sell__note">
            {{
              paymentReady
                ? pick('付款成功后上线。', 'Live when payment succeeds.')
                : pick('发票确认后上线。', 'Live after the invoice is confirmed.')
            }}
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
