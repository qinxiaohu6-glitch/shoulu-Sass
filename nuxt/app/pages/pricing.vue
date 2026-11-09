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
import {
  BILLBOARD_TIERS,
  campaignActive,
  campaignDeadlineShanghai,
  quoteCents,
} from '~~/shared/content/billboard'
import { adPlans, comparison, listingBenefits, pricingFaq, tiers } from '~~/shared/content/pricing'
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

const deadline = campaignDeadlineShanghai()
const promoOn = computed(() => campaignActive())

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
      '把产品放进目录。价格是表现价，黑五只在表价上划线，不另写一套更高的原价。',
      'Get a page in the directory. Prices are the list prices. The promotion strikes those prices and does not invent a higher one.',
    ),
    cta: pick('看四档收录', 'See the four tiers'),
    to: '#pricing',
    muted: false,
  },
  {
    n: '2',
    title: pick('被看到', 'Get seen'),
    price: pick('Billboard $15 / $29 / $49 · 右栏 $19/周', 'Billboard $15 / $29 / $49 · sidebar $19/week'),
    body: pick(
      'Billboard 是一次性三档，替代原来的榜单周租。右栏仍按周。Billboard 先索取发票，这里不打开结账。',
      'Billboard is three one-time tiers and replaces the weekly board rental. The sidebar stays weekly. Billboard asks for an invoice — this page does not open a checkout for it.',
    ),
    cta: pick('看 Billboard', 'See Billboard'),
    to: '#ads',
    muted: false,
  },
  {
    n: '3',
    title: pick('代提交', 'Done for you'),
    price: pick('不提供', 'Not offered'),
    body: pick(
      '我们不代你把产品提交到别的网站。这一步没有可买的服务。',
      'We do not submit your product to other sites for you. There is nothing to buy in this step.',
    ),
    cta: '',
    to: '',
    muted: true,
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
    line: pick('我不提交产品，只想买首页那一块板', 'I do not have a listing, I just want the homepage board'),
    answer: pick('Billboard 一次性：入门 $15、标准 $29、优先 $49。先索取发票。右栏仍可按周租。', 'Billboard is one-time: Entry $15, Standard $29, Prime $49. Request an invoice. The sidebar is still weekly.'),
    cta: pick('索取 Billboard 发票', 'Request a Billboard invoice'),
    to: `${localePath('/billboard')}#claim`,
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
    'Billboard 三档都是一次性：入门 $15、标准 $29、优先 $49。标准档替代原来的榜单 $29/周，不再按周出售。右栏仍是 $19/周，连投 4 周 $65。Billboard 不改变每周投票榜的名次。',
    'Billboard is one-time: Entry $15, Standard $29, Prime $49. Standard replaces the old $29/week board, which is no longer sold by the week. The sidebar is still $19 a week, or $65 for four. Billboard does not change rank on the weekly vote list.',
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
  sidebar: AdAvailability
}
const EMPTY_LIVE: PricingLive = {
  toolsCount: 0,
  sidebar: EMPTY_AD_AVAILABILITY,
}

const { data: live } = await useAsyncData<PricingLive>(
  'pricing-live',
  async () => {
    const [toolsRes, sidebarRes] = await Promise.all([
      requestFetch<{ tools?: unknown[] }>('/api/tools').catch(() => null),
      requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1').catch(() => EMPTY_AD_AVAILABILITY),
    ])
    return {
      toolsCount: toolsRes?.tools?.length ?? 0,
      sidebar: {
        ok: Boolean(sidebarRes?.ok),
        starts: sidebarRes?.starts ?? [],
        available: sidebarRes?.available ?? {},
      },
    }
  },
  { default: () => EMPTY_LIVE },
)

const liveData = computed(() => live.value ?? EMPTY_LIVE)
const sidebarOpen = computed(() => openAdWeeks(liveData.value.sidebar))
const openWeekCount = computed(() => sidebarOpen.value.length)
const nextOpenWeek = computed(() => sidebarOpen.value[0] ?? '')

const priceStats = computed(() => [
  {
    value: String(
      tools.filter((tool) => !overrides.value.hidden.includes(tool.slug)).length +
        liveData.value.toolsCount,
    ),
    label: pick('个产品已收录', 'products listed'),
  },
  { value: String(categories.length), label: pick('个分类', 'categories') },
  { value: String(openWeekCount.value), label: pick('个右栏周次仍可订', 'sidebar weeks open, next 6') },
  { value: String(tiers.length - 1), label: pick('档一次性付费收录', 'one-time paid tiers') },
])

const adLiveWeeks = computed(() =>
  pick(
    `未来 6 周：右栏 ${sidebarOpen.value.length} 周可订。Billboard 不按周卖。`,
    `Next 6 weeks: ${sidebarOpen.value.length} sidebar weeks open. Billboard is not sold by the week.`,
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
            <component
              :is="step.muted ? 'div' : 'a'"
              :href="step.muted ? undefined : step.to"
              class="flex h-full flex-col rounded-2xl border border-border p-5"
              :class="step.muted ? 'bg-muted/70 opacity-60' : 'bg-background transition hover:border-foreground/30'"
            >
              <span class="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                STEP {{ step.n }}
              </span>
              <span class="mt-2 font-serif text-xl tracking-tight">{{ step.title }}</span>
              <span class="mt-1 text-xs font-medium text-primary">{{ step.price }}</span>
              <span class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ step.body }}</span>
              <span v-if="step.cta" class="mt-auto pt-4 text-xs font-medium text-foreground">{{ step.cta }} →</span>
            </component>
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
                '产品数和分类数来自当前目录。右栏可订周次来自排期表。Billboard 不按周计数。不承诺搜索排名、流量或权重。',
                'Product and category counts come from the live directory. Sidebar weeks come from the schedule. Billboard is not counted by the week. No claims about rankings, traffic or domain authority.',
              )
            }}
          </p>
        </div>

        <div id="black-friday" class="mb-8 text-sm leading-relaxed text-muted-foreground">
          <template v-if="promoOn">
            <p>
              {{
                pick(
                  `黑五约七折。划掉的是现在的表价，没有抬高。截止 ${deadline}（Asia/Shanghai）。收录档的在线金额仍是表价；Billboard 按约价开发票，入门保持 $15。`,
                  `Black Friday is about 30% off. The struck figure is the current list price, not a higher one. Ends ${deadline} (Asia/Shanghai). Listing checkout still charges the list price. Billboard invoices use the lower figure. Entry stays at $15.`,
                )
              }}
            </p>
            <ul class="mt-3 flex flex-wrap gap-2">
              <li
                v-for="tier in tiers.filter((item) => item.amountCents > 0)"
                :key="tier.id"
                class="rounded-full border border-border px-3 py-1"
              >
                {{ t(tier.name) }}
                <s class="text-muted-foreground">{{ quoteCents(tier.amountCents).listLabel }}</s>
                {{ pick(`约 ${quoteCents(tier.amountCents).priceLabel}`, `about ${quoteCents(tier.amountCents).priceLabel}`) }}
              </li>
              <li
                v-for="plan in adPlans"
                :key="plan.id"
                class="rounded-full border border-border px-3 py-1"
              >
                {{ t(plan.name) }}
                <s class="text-muted-foreground">{{ quoteCents(plan.weeklyCents).listLabel }}</s>
                {{ pick(`约 ${quoteCents(plan.weeklyCents).priceLabel}/周`, `about ${quoteCents(plan.weeklyCents).priceLabel}/wk`) }}
              </li>
            </ul>
          </template>
          <p v-else>
            {{
              pick(
                '下面是表价。Billboard 为一次性三档，不按周租。',
                'Prices below are the list prices. Billboard is three one-time tiers, not a weekly rental.',
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
            {{ pick('被看到', 'Get seen') }}
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
          <NuxtLink class="ml-auto font-medium text-primary" :to="`${localePath('/book-ad')}?slot=sidebar&weeks=1`">
            {{ pick('查右栏周次', 'See sidebar weeks') }} →
          </NuxtLink>
        </div>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="tier in BILLBOARD_TIERS"
            :key="tier.id"
            class="flex flex-col rounded-2xl border border-border bg-background p-6"
          >
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium">{{ t(tier.name) }}</span>
              <span class="text-right">
                <span
                  v-if="quoteCents(tier.amountCents, Date.now(), tier.floorCents).strikeLabel"
                  class="mr-2 text-sm text-muted-foreground line-through"
                >{{ quoteCents(tier.amountCents, Date.now(), tier.floorCents).strikeLabel }}</span>
                <span class="font-serif text-3xl tracking-tight">
                  {{
                    quoteCents(tier.amountCents, Date.now(), tier.floorCents).strikeLabel
                      ? pick(
                          `约 ${quoteCents(tier.amountCents, Date.now(), tier.floorCents).priceLabel}`,
                          quoteCents(tier.amountCents, Date.now(), tier.floorCents).priceLabel,
                        )
                      : tier.price
                  }}
                </span>
              </span>
            </div>
            <p class="text-xs font-semibold tracking-wide">BILLBOARD</p>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t(tier.blurb) }}</p>
            <div class="mt-auto pt-6">
              <NuxtLink
                :to="`${localePath('/billboard')}#claim`"
                class="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
              >
                {{ pick('索取发票', 'Request invoice') }}
              </NuxtLink>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
              {{ pick('一次性。此按钮不打开结账。', 'One-time. This button does not open a checkout.') }}
            </p>
          </article>
          <article
            v-for="plan in adPlans"
            :key="plan.id"
            class="flex flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:border-foreground/30"
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
              {{ pick('右栏仍按周计费，到期下架。榜单周租已停。', 'The sidebar is still billed by the week and comes down when the week ends. The weekly board rental has stopped.') }}
            </p>
          </article>
        </div>

        <p class="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {{ pick('Billboard 先记下网址和档位，确认发票收款后才公开。右栏按周、同一周不卖两次。卖的是站内位置，不承诺搜索排名。广告链接带 rel="sponsored"。', 'Billboard stores the URL and tier, and stays private until the invoice is confirmed paid. The sidebar is weekly and is not sold twice in the same week. We sell on-site placement, make no claims about search rankings, and mark ad links rel="sponsored".') }}
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

    <!-- Moved off the homepage so that grid can sell placements. -->
    <section id="after-listing" class="scroll-mt-24 border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <header class="mb-8 max-w-3xl">
          <h2 class="font-serif text-3xl font-normal tracking-tight">
            {{ pick('收录后你能得到什么', 'What you get when you list') }}
          </h2>
          <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
            {{ pick('四件事，每一条收录都有。', 'Four things, on every listing.') }}
          </p>
        </header>
        <div class="grid gap-4 sm:grid-cols-2">
          <article
            v-for="item in listingBenefits"
            :key="item.title.en"
            class="rounded-2xl border border-border bg-background p-6"
          >
            <h3 class="text-base font-semibold tracking-tight">{{ t(item.title) }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t(item.body) }}</p>
          </article>
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
