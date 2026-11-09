<script setup lang="ts">
/**
 * /pricing — the source's pricing page (`routes/pricing.tsx` + `blocks/pricing.tsx`)
 * laid out with this site's own plans.
 *
 * Why not the source's plans: the source sells SaaS subscriptions — Starter $9/mo,
 * Pro $29/mo, Enterprise $99/mo, in monthly / yearly / lifetime groups, with
 * credits and API access as the benefits. This build sells listings: Free,
 * Standard $19, Featured $39, Pro $69, all one-time, plus two weekly ad slots. The
 * credits ledger the source's tiers pay out does not exist here, so porting those
 * three cards verbatim would advertise something the site cannot deliver.
 *
 * What is the source's, unchanged: the centred serif headline, the `PricingTable`
 * itself (pill toggle when there is more than one group, 4-across cards, serif
 * 5xl price, full-width pill CTA above the feature list, ring + shadow on the
 * featured card), and the FAQ accordion's markup.
 *
 * The plans are one group, so the toggle does not render — the source hides it at
 * `groups.length <= 1` too.
 *
 * Added 2026-11-08 from the launchit.fast teardown (docs/10, §4.2): a three-step
 * funnel, a live-numbers bar, scenario-based guidance, a "keep showing up"
 * section and FAQPage markup. All pure additions — prices, checkout and link
 * policy are untouched, and every new link stays inside this site.
 */
import type { PricingGroup, PricingPlan } from '~/utils/directory-ui'
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'
import { adPlans, comparison, pricingFaq, tiers } from '~~/shared/content/pricing'
import { categories, tools } from '~~/shared/utils/catalog'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const overrides = useOverrides()
const router = useRouter()
const requestFetch = useRequestFetch()

const t = (pair: { en: string; zh: string }) => (lang.value === 'zh' ? pair.zh : pair.en)
const tl = (pair: { en: string[]; zh: string[] }) => (lang.value === 'zh' ? pair.zh : pair.en)

const title = computed(() => pick('定价', 'Pricing'))
const lead = computed(() =>
  pick(
    '免费就能上线。付费只买两件事：更早被看到，链接变 dofollow。不订阅、不自动续费。',
    'Launch free. Paying buys two things: being seen sooner, and a dofollow link. No subscription, no auto-renewal.',
  ),
)

const plans = computed<PricingPlan[]>(() =>
  tiers.map((tier) => ({
    id: tier.id,
    name: t(tier.name),
    description: t(tier.tagline),
    price: tier.price,
    featured: tier.id === 'featured',
    badge: tier.badge ? t(tier.badge) : undefined,
    features: tl(tier.features),
    buttonText: t(tier.cta),
  })),
)

const groups = computed<PricingGroup[]>(() => [
  { key: 'listing', label: pick('收录方案', 'Listing plans'), plans: plans.value },
])

/**
 * A plan is bought by submitting a listing, not by a standalone checkout: the
 * invoice has to point at something in the queue. So the CTA opens the submit
 * form with the plan preselected.
 */
function choosePlan(plan: PricingPlan) {
  router.push({ path: '/submit', query: { plan: plan.id } })
}

/** The three steps of the funnel. Each one names a real page on this site. */
const steps = computed(() => [
  {
    n: '1',
    title: pick('收录', 'Launch'),
    price: pick('$0 / $19 / $39 / $69 · 一次性', '$0 / $19 / $39 / $69 · one-time'),
    body: pick(
      '把产品放进目录。付费档付款成功后自动收录发布，免费档走人工审核。',
      'Get a page in the directory. Paid listings publish automatically on payment; free ones are reviewed by hand.',
    ),
    cta: pick('看四档收录', 'See the four tiers'),
    to: '#pricing',
  },
  {
    n: '2',
    title: pick('买曝光', 'Get seen'),
    price: pick('周广告位 $19 / $29 起', 'Weekly ad slots from $19 / $29'),
    body: pick(
      '不用提交产品，直接租一个按周计的位置：榜单位或右栏位，付款成功后自动排期。',
      'Rent a weekly position without submitting a product: board or sidebar, scheduled automatically once payment succeeds.',
    ),
    cta: pick('看广告位', 'See the ad slots'),
    to: '#ads',
  },
  {
    n: '3',
    title: pick('持续被看到', 'Keep showing up'),
    price: pick('不额外收费', 'Included, no extra fee'),
    body: pick(
      '页面永久保留、每周一重置的榜单、AI 搜索可读的纯文本版本，以及站内免费的 DR4 自查。',
      'A page that stays up, a board that resets every Monday, an AI-readable plain-text version, and a free on-site DR4 check.',
    ),
    cta: pick('看长期路径', 'See what keeps working'),
    to: '#compound',
  },
])

/** Three lines of scenario-based guidance. All links are in-site. */
const scenarios = computed(() => [
  {
    line: pick('我只想要一条 dofollow 反链', 'I just want a dofollow link'),
    answer: pick('标准档 $19，一次性。付款成功后自动收录发布。', 'Standard, $19 one-time. Published automatically as soon as payment succeeds.'),
    cta: pick('选标准 $19', 'Standard $19'),
    to: `${localePath('/submit')}?plan=standard`,
  },
  {
    line: pick('我要上新那一周的位置', 'I want the top spot on launch week'),
    answer: pick('精选 $39，目录与分类页置顶 7 天，加首页精选卡。', 'Featured, $39. A 7-day pin on the directory and category pages, plus the homepage card.'),
    cta: pick('选精选 $39', 'Featured $39'),
    to: `${localePath('/submit')}?plan=featured`,
  },
  {
    line: pick('我不提交产品，只想买展示', 'I do not have a listing, I just want the placement'),
    answer: pick('按周租榜单位或右栏位，选周次、在线付款、自动排期。', 'Rent a weekly board or sidebar slot: pick a week, pay online, get scheduled automatically.'),
    cta: pick('去预订广告位', 'Book an ad slot'),
    to: `${localePath('/book-ad')}?slot=sidebar&weeks=1`,
  },
])

/** After launch, three things that keep working without another payment. */
const compound = computed(() => [
  {
    title: pick('每周一重置的榜单', 'A board that resets every Monday'),
    body: pick('每个收录都能参与，一人一产品一周一票。付费不改变排名，规则全文写在 /rules。', 'Every listing competes: one person, one vote per product per week. Paying never changes rank — the full rules are on /rules.'),
    cta: pick('看本周榜单', 'See this week'),
    to: localePath('/weekly'),
  },
  {
    title: pick('永久保留的页面', 'A page that stays up'),
    body: pick('付费档外链永久 dofollow，免费档 nofollow；页面都不下架，也不按月续费。', 'Paid listings keep a permanent dofollow link, free ones nofollow. Neither page comes down and neither is billed monthly.'),
    cta: pick('浏览目录', 'Browse the directory'),
    to: localePath('/tools'),
  },
  {
    title: pick('免费的 DR4 自查', 'A free DR4 check'),
    body: pick('查自己的或竞品的 Domain Rating（DR4），可对照 DR3；查询与结果都留在站内。', 'Check the Domain Rating (DR4) of your site or a competitor, with a DR3 comparison. The query and the result both stay on this site.'),
    cta: pick('打开 DR 查询', 'Open the DR check'),
    to: localePath('/seo-check'),
  },
])

const adHead = computed(() =>
  pick(
    '榜单位 $29 / 周，右栏位 $19 / 周；连投 4 周分别 $99 和 $65。榜单位是「决定投谁」的那一屏，所以更贵；右栏按停留时长卖，所以更便宜。位置是租的，不是买的 —— 不用提交产品，也可以和收录同时买。',
    'Board $29 a week, sidebar $19 a week — or $99 and $65 for four weeks. The board is the screen where people decide what to upvote, so it costs more; the rail is sold on time-on-page, so it costs less. Both are rented, not bought — no product submission needed, and you can run one alongside a listing.',
  ),
)

const openFaq = ref<number | null>(null)

/* -------------------------------------------------------------------------
   Live numbers, read once per page load.

   The availability endpoint is the same read-only hint /book-ad uses, so the
   "N weeks open" claim can never drift from the booking page. A failed read
   hides the live strip instead of inventing a number.
------------------------------------------------------------------------- */
type PricingLive = {
  toolsCount: number
  board: AdAvailability
  sidebar: AdAvailability
}
const EMPTY_LIVE: PricingLive = {
  toolsCount: 0,
  board: EMPTY_AD_AVAILABILITY,
  sidebar: EMPTY_AD_AVAILABILITY,
}

const { data: live } = await useAsyncData<PricingLive>(
  'pricing-live',
  async () => {
    const [toolsRes, boardRes, sidebarRes] = await Promise.all([
      requestFetch<{ tools?: unknown[] }>('/api/tools').catch(() => null),
      requestFetch<AdAvailability>('/api/ads/availability?slot=board&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
      requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
    ])
    const shape = (res: AdAvailability | null): AdAvailability => ({
      ok: Boolean(res?.ok),
      starts: res?.starts ?? [],
      available: res?.available ?? {},
    })
    return {
      toolsCount: toolsRes?.tools?.length ?? 0,
      board: shape(boardRes),
      sidebar: shape(sidebarRes),
    }
  },
  { default: () => EMPTY_LIVE },
)

const liveData = computed(() => live.value ?? EMPTY_LIVE)
const boardOpen = computed(() => openAdWeeks(liveData.value.board))
const sidebarOpen = computed(() => openAdWeeks(liveData.value.sidebar))
const openWeekCount = computed(() => boardOpen.value.length + sidebarOpen.value.length)
const nextOpenWeek = computed(() => {
  const firsts = [boardOpen.value[0], sidebarOpen.value[0]].filter(Boolean).sort()
  return firsts[0] ?? ''
})

const priceStats = computed(() => [
  {
    value: String(
      tools.filter((tool) => !overrides.value.hidden.includes(tool.slug)).length +
        liveData.value.toolsCount,
    ),
    label: pick('个产品已收录', 'products listed'),
  },
  { value: String(categories.length), label: pick('个分类', 'categories') },
  { value: String(openWeekCount.value), label: pick('个周次仍可订', 'open weeks, next 6') },
  { value: String(tiers.length - 1), label: pick('档一次性付费收录', 'one-time paid tiers') },
])

const adLiveWeeks = computed(() =>
  pick(
    `未来 6 周：榜单位 ${boardOpen.value.length} 周可订 · 右栏位 ${sidebarOpen.value.length} 周可订`,
    `Next 6 weeks: ${boardOpen.value.length} board weeks open · ${sidebarOpen.value.length} sidebar weeks open`,
  ),
)
const adLiveNext = computed(() =>
  pick(`最早可订 ${nextOpenWeek.value}`, `Earliest open week ${nextOpenWeek.value}`),
)

/* FAQPage markup is generated from the very array the accordion renders, so
   the visible answer and the schema can never fall out of sync. */
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
  title: computed(() => `${title.value} · Product Atlas`),
  description: lead,
})

useHead({
  script: [{ type: 'application/ld+json', innerHTML: faqSchema }],
})
</script>

<template>
  <div class="src-page">
    <section id="pricing" class="scroll-mt-24 border-t border-border px-4 py-24 sm:py-32">
      <div class="mx-auto max-w-5xl">
        <div class="mb-14 text-center">
          <h1 class="font-serif text-4xl font-normal tracking-tight sm:text-5xl">{{ title }}</h1>
          <p class="mt-5 text-muted-foreground">{{ lead }}</p>
        </div>

        <!-- Step 1 / 2 / 3 funnel -->
        <ol class="mb-12 grid gap-3 sm:grid-cols-3">
          <li v-for="step in steps" :key="step.n">
            <a
              :href="step.to"
              class="flex h-full flex-col rounded-2xl border border-border bg-background p-5 transition hover:border-foreground/30"
            >
              <span class="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                {{ pick('第 ', 'Step ') }}{{ step.n }}
              </span>
              <span class="mt-2 font-serif text-xl tracking-tight">{{ step.title }}</span>
              <span class="mt-1 text-xs font-medium text-primary">{{ step.price }}</span>
              <span class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ step.body }}</span>
              <span class="mt-auto pt-4 text-xs font-medium text-foreground">{{ step.cta }} →</span>
            </a>
          </li>
        </ol>

        <!-- Live numbers from the directory and the booking schedule -->
        <div class="mb-14 rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
          <div class="grid gap-5 sm:grid-cols-4">
            <div v-for="stat in priceStats" :key="stat.label">
              <div class="font-serif text-2xl tabular-nums">{{ stat.value }}</div>
              <div class="mt-1 text-xs opacity-80">{{ stat.label }}</div>
            </div>
          </div>
          <p class="mt-4 border-t border-primary-foreground/20 pt-3 text-xs leading-relaxed opacity-80">
            {{
              pick(
                '数字来自当前目录与广告排期表，页面加载时读取。所有档位一次性付费；付费档付款成功后自动收录发布，不承诺搜索排名、流量或权重提升。',
                'Numbers come from the live directory and the ad schedule, read on page load. Every tier is a one-time payment; paid listings publish automatically when payment succeeds. No claims about rankings, traffic or domain authority.',
              )
            }}
          </p>
        </div>

        <DirectoryPricingTable :groups="groups" @select="choosePlan" />
      </div>
    </section>

    <section id="ads" class="scroll-mt-24 border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <header class="mb-10 max-w-3xl">
          <h2 class="font-serif text-3xl font-normal tracking-tight">
            {{ pick('周广告位', 'Weekly ad slots') }}
          </h2>
          <p class="mt-4 text-sm leading-relaxed text-muted-foreground">{{ adHead }}</p>
        </header>

        <!-- Live schedule hint, from the same endpoint /book-ad reads -->
        <div
          v-if="nextOpenWeek"
          class="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/50 px-5 py-3 text-xs"
        >
          <span class="inline-flex items-center gap-2 font-medium">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {{ pick('排期实时可读', 'Live availability') }}
          </span>
          <span class="text-muted-foreground">{{ adLiveWeeks }}</span>
          <span class="text-muted-foreground">{{ adLiveNext }}</span>
          <NuxtLink class="ml-auto font-medium text-primary" :to="localePath('/book-ad')">
            {{ pick('查全部周次', 'See all weeks') }} →
          </NuxtLink>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <article
            v-for="plan in adPlans"
            :key="plan.id"
            class="flex flex-col rounded-2xl border border-border bg-background p-8 transition-all hover:border-foreground/30"
          >
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-foreground">{{ t(plan.name) }}</span>
              <span class="font-serif text-3xl tracking-tight">{{ plan.price }}</span>
            </div>
            <h3 class="text-lg font-semibold tracking-tight">{{ t(plan.where) }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t(plan.pitch) }}</p>
            <ul class="mt-6 space-y-3">
              <li
                v-for="bullet in tl(plan.bullets)"
                :key="bullet"
                class="flex items-center gap-2.5 text-sm"
              >
                <Icon name="check" :size="16" class="shrink-0 text-muted-foreground" />
                <span class="text-foreground/90">{{ bullet }}</span>
              </li>
            </ul>
            <p class="mt-4 text-xs text-muted-foreground">{{ t(plan.bundle) }}</p>
            <div class="mt-auto pt-6">
              <!--
                Weekly slots are their own purchase: a date range, not a
                submission. `/book-ad` reads the slot from the query and shows
                only the weeks still open; sending this to `/submit` used to ask
                for a product name and category for something that is not a
                product, and could only ever charge the single legacy $29.
              -->
              <NuxtLink
                :to="`${localePath('/book-ad')}?slot=${plan.id}&weeks=1`"
                class="inline-flex h-10 w-full items-center justify-center rounded-full border border-transparent bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
              >
                {{ pick('预订这个位置', 'Book this spot') }}
              </NuxtLink>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
              {{ pick('按周计费，到期自动下架，可续租。', 'Billed weekly. Comes down when the week ends. Renew any time.') }}
            </p>
          </article>
        </div>

        <p class="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {{ pick('在线选周、在线付款，付款成功后自动排期，不用提交产品。位置只有两个，同一周不会重复出售；已订满的周在预订页会自动标灰。我们卖的是站内展示位置与读者，不对搜索排名做任何承诺，广告链接带 rel="sponsored"。', 'Pick a week and pay online — the placement is scheduled automatically once the payment clears, with no product submission. There are two positions and neither is sold twice in the same week; weeks that are gone are marked on the booking page. We sell on-site placement and the readers who see it, make no claims about search rankings, and mark ad links rel="sponsored".') }}
        </p>
      </div>
    </section>

    <section class="border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <h2 class="mb-8 font-serif text-3xl font-normal tracking-tight">
          {{ pick('方案对比', 'Compare the plans') }}
        </h2>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-border">
                <th scope="col" class="py-3 pr-4 text-left font-medium text-muted-foreground">
                  {{ pick('权益', 'What you get') }}
                </th>
                <th
                  v-for="tier in tiers"
                  :key="tier.id"
                  scope="col"
                  class="px-3 py-3 text-left font-semibold"
                  :class="tier.id === 'featured' ? 'text-primary' : ''"
                >
                  {{ t(tier.name) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparison" :key="row.label.en" class="border-b border-border">
                <th scope="row" class="py-3 pr-4 text-left font-normal text-muted-foreground">
                  {{ t(row.label) }}
                </th>
                <td
                  v-for="(value, index) in row.values"
                  :key="index"
                  class="px-3 py-3 align-top"
                  :class="tiers[index]?.id === 'featured' ? 'font-medium' : ''"
                >
                  {{ t(value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Step 3: what keeps working after launch, with no extra purchase -->
    <section id="compound" class="scroll-mt-24 border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <header class="mb-8 max-w-3xl">
          <h2 class="font-serif text-3xl font-normal tracking-tight">
            {{ pick('上线之后，持续被看到', 'After you launch, keep showing up') }}
          </h2>
          <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
            {{
              pick(
                '收录是一次性付款，但这三件事会一直生效，不需要续费。',
                'A listing is paid for once. These three things keep working without another payment.',
              )
            }}
          </p>
        </header>
        <div class="grid gap-4 sm:grid-cols-3">
          <NuxtLink
            v-for="item in compound"
            :key="item.title"
            :to="item.to"
            class="flex flex-col rounded-2xl border border-border bg-background p-6 transition hover:border-foreground/30"
          >
            <h3 class="text-base font-semibold tracking-tight">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ item.body }}</p>
            <span class="mt-auto pt-5 text-xs font-medium text-primary">{{ item.cta }} →</span>
          </NuxtLink>
        </div>
        <p class="mt-6 text-xs leading-relaxed text-muted-foreground">
          {{
            pick(
              '我们不承诺搜索排名、流量、收录或域名权重提升。费用购买的是站内展示位置与写明的链接属性，不是保证的结果。',
              'We make no claims about rankings, traffic, indexing or domain authority. The fee buys on-site placement and the stated link attribute, not a guaranteed result.',
            )
          }}
        </p>
      </div>
    </section>

    <section class="border-t border-border px-4 py-20">
      <div class="mx-auto max-w-3xl">
        <h2 class="mb-3 font-serif text-3xl font-normal tracking-tight">
          {{ pick('常见问题', 'Questions') }}
        </h2>
        <div class="flex w-full flex-col border-t border-border">
          <div v-for="(item, index) in pricingFaq" :key="item.q.en" class="border-b border-border">
            <h3>
              <button
                type="button"
                :aria-expanded="openFaq === index"
                class="flex w-full cursor-pointer items-start justify-between py-4 text-left text-[15px] font-medium transition-colors outline-none hover:text-primary"
                @click="openFaq = openFaq === index ? null : index"
              >
                <span class="pr-4">{{ t(item.q) }}</span>
                <Icon
                  name="chevron-down"
                  :size="16"
                  class="shrink-0 text-muted-foreground transition-transform duration-200"
                  :class="openFaq === index ? 'rotate-180' : ''"
                />
              </button>
            </h3>
            <div
              v-if="openFaq === index"
              class="animate-in fade-in-50 pb-4 text-sm leading-relaxed text-muted-foreground duration-150"
            >
              {{ t(item.a) }}
            </div>
          </div>
        </div>

        <div class="mt-12 text-center">
          <p class="font-serif text-2xl tracking-tight">
            {{ pick('不确定选哪个？', 'Not sure where to start?') }}
          </p>
          <p class="mt-3 text-sm text-muted-foreground">
            {{ pick('挑一句最像你的，或者直接免费提交，上线后再决定。', 'Pick the line that sounds like you — or submit free and decide once you are live.') }}
          </p>
          <div class="mt-6 grid gap-3 text-left sm:grid-cols-3">
            <NuxtLink
              v-for="item in scenarios"
              :key="item.line"
              :to="item.to"
              class="flex flex-col rounded-xl border border-border bg-background p-4 transition hover:border-foreground/30"
            >
              <span class="text-sm font-medium">「{{ item.line }}」</span>
              <span class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ item.answer }}</span>
              <span class="mt-auto pt-4 text-xs font-medium text-primary">{{ item.cta }} →</span>
            </NuxtLink>
          </div>
          <NuxtLink
            :to="localePath('/submit')"
            class="mt-8 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            {{ pick('提交产品', 'Submit a product') }}
            <Icon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
