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
 * Launch + Get seen. Directory-submission packages are not sold here.
 * Paid buttons say "Request invoice" until /api/payments/config reports ready.
 */
import type { PricingGroup, PricingPlan } from '~/utils/directory-ui'
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'
import { campaignActive, campaignDeadlineShanghai } from '~~/shared/content/billboard'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { contactHref } from '~~/shared/content/site-contact'
import {
  adPlans,
  comparison,
  listingBenefits,
  pricingBillboardChecks,
  pricingFaq,
  tiers,
} from '~~/shared/content/pricing'
import { categories, tools } from '~~/shared/utils/catalog'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const overrides = useOverrides()
const router = useRouter()
const requestFetch = useRequestFetch()
const { ready: paymentReady } = await usePayment()

const t = (pair: { en: string; zh: string }) => (lang.value === 'zh' ? pair.zh : pair.en)
const tl = (pair: { en: string[]; zh: string[] }) => (lang.value === 'zh' ? pair.zh : pair.en)

const title = computed(() =>
  pick('把产品放到 maker 正在看的地方', 'Put your product where makers already browse'),
)
const lead = computed(() =>
  pick(
    '免费可上。付费买更快上线与 dofollow 链接。不订阅。',
    'Launch free. Pay once for a faster go-live and a dofollow link. No subscription.',
  ),
)

function listingCta(id: string, name: { en: string; zh: string }) {
  if (id === 'free') return pick('免费提交', 'Submit free')
  if (paymentReady.value) return pick(`去付款 · ${name.zh}`, `Pay · ${name.en}`)
  return pick(`索取发票 · ${name.zh}`, `Request invoice · ${name.en}`)
}

function invoiceMail(plan: string) {
  const href = contactHref()
  const subject = encodeURIComponent(`Invoice request · ${plan}`)
  return href ? `${href}?subject=${subject}` : localePath('/pricing')
}

const deadline = campaignDeadlineShanghai()
const promoOn = computed(() => campaignActive())

function skuQuote(kind: 'listing' | 'sidebar' | 'billboard', id: string) {
  return effectiveQuote(kind, id, Date.now())
}

const plans = computed<PricingPlan[]>(() =>
  tiers.map((tier) => {
    const quote = skuQuote('listing', tier.id)
    return {
      id: tier.id,
      name: t(tier.name),
      description: t(tier.tagline),
      price: quote.priceLabel,
      originalPrice: quote.strikeLabel ?? undefined,
      featured: tier.id === 'featured',
      badge: tier.badge ? t(tier.badge) : undefined,
      kicker: quote.active ? pick('BLACK FRIDAY · 约 30% OFF', 'BLACK FRIDAY · ~30% OFF') : undefined,
      features: tl(tier.features),
      buttonText: listingCta(tier.id, tier.name),
    }
  }),
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
  router.push({ path: localePath('/submit'), query: { plan: plan.id } })
}

function band(kind: 'listing' | 'billboard', ids: string[]) {
  return ids.map((id) => skuQuote(kind, id).priceLabel).join(' / ')
}

/** Launch + Get seen. Directory-submission packages are not a product line. */
const steps = computed(() => [
  {
    n: '1',
    title: pick('上线', 'Launch'),
    price: `${band('listing', ['free', 'standard', 'featured', 'pro'])} · ${pick('一次性', 'one-time')}`,
    body: pick(
      '获得永久产品页。付费一次，付款即上线，并得到 dofollow 链接。',
      'Get a permanent page. Pay once to go live on payment, with a dofollow link.',
    ),
    cta: pick('看四档收录', 'See the four tiers'),
    to: '#plans',
  },
  {
    n: '2',
    title: pick('被看到', 'Get seen'),
    price: pick(
      `Billboard 从 $15 起 · 右栏 ${skuQuote('sidebar', '1').priceLabel}/周`,
      `Billboard from $15 · sidebar ${skuQuote('sidebar', '1').priceLabel}/wk`,
    ),
    body: pick(
      '自己出价，从 $15 起，一次付清。黑五不降低 Billboard 地板价。右栏仍按周。',
      'Name your price from $15, one-time. Black Friday does not lower the Billboard floor. Sidebar stays weekly.',
    ),
    cta: pick('看 Billboard', 'See Billboard'),
    to: '#ads',
  },
])

function salePhrase(quote: { priceLabel: string; strikeLabel: string | null }) {
  if (!quote.strikeLabel) {
    return { zh: quote.priceLabel, en: quote.priceLabel }
  }
  return {
    zh: `${quote.strikeLabel}（现价 ${quote.priceLabel}）`,
    en: `${quote.strikeLabel} (now ${quote.priceLabel})`,
  }
}

/** Three intents. Paid buttons follow the checkout-ready flag. */
const scenarios = computed(() => {
  const standard = salePhrase(skuQuote('listing', 'standard'))
  const featured = salePhrase(skuQuote('listing', 'featured'))
  const entry = salePhrase(skuQuote('billboard', 'entry'))
  const billboardTo = paymentReady.value ? `${localePath('/billboard')}#claim` : invoiceMail('Billboard')
  return [
    {
      line: pick('我只需要一条 dofollow 链接', 'I just need a dofollow link'),
      answer: pick(
        `标准档 — ${standard.zh}，一次付清。付款即上线。`,
        `Standard — ${standard.en}, one-time. Live on payment.`,
      ),
      cta: listingCta('standard', { en: 'Standard', zh: '标准' }),
      to: `${localePath('/submit')}?plan=standard`,
      external: false,
    },
    {
      line: pick('我要上线当周的置顶', 'I want the pin on launch week'),
      answer: pick(
        `精选 — ${featured.zh}。置顶 7 天，加首页卡片。`,
        `Featured — ${featured.en}. A 7-day pin and a homepage card.`,
      ),
      cta: listingCta('featured', { en: 'Featured', zh: '精选' }),
      to: `${localePath('/submit')}?plan=featured`,
      external: false,
    },
    {
      line: pick('我要首页 Billboard', 'I want the homepage Billboard'),
      answer: pick(
        `Billboard 起价 ${entry.zh}。付款即上线。Top 10 同步首页。`,
        `Billboard from ${entry.en}. Live the second you pay. Top 10 on the home page.`,
      ),
      cta: paymentReady.value
        ? pick('认领展示位', 'Claim your spot')
        : pick('索取发票 · Billboard', 'Request invoice · Billboard'),
      to: billboardTo,
      external: !paymentReady.value,
    },
  ]
})

const adHead = computed(() =>
  pick(
    '一次付清。付款即上线。Top 10 同步首页。右栏仍按周。',
    'One-time payment. Live the second you pay. Top 10 on the home page. Sidebar stays weekly.',
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
    `未来 6 周：右栏 ${sidebarOpen.value.length} 周可订。`,
    `Next 6 weeks: ${sidebarOpen.value.length} sidebar weeks open.`,
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
  title: computed(() => pick('定价 · Product Atlas', 'Pricing · Product Atlas')),
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
          <p class="text-xs font-semibold tracking-[0.18em] uppercase text-primary">
            {{ pick('定价', 'Pricing') }}
          </p>
          <h1 class="mt-4 font-serif text-4xl font-normal tracking-tight text-balance sm:text-5xl">{{ title }}</h1>
          <p class="mx-auto mt-5 max-w-2xl text-muted-foreground">{{ lead }}</p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <NuxtLink
              class="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
              :to="localePath('/submit')"
            >
              {{ pick('免费提交', 'Submit free') }}
            </NuxtLink>
            <a
              class="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-background px-6 text-sm font-medium text-foreground"
              href="#plans"
            >
              {{ pick('查看方案', 'See plans') }}
            </a>
          </div>
        </div>

        <ol class="mb-12 grid gap-3 sm:grid-cols-2">
          <li v-for="step in steps" :key="step.n">
            <a
              :href="step.to"
              class="flex h-full flex-col rounded-2xl border border-border bg-background p-5 transition hover:border-foreground/30"
            >
              <span class="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                STEP {{ step.n }}
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
                '数字来自当前目录与排期。不承诺搜索排名、流量或域名权重。',
                'Counts come from the live directory and the booking schedule. No promise of search rank, traffic, or domain authority.',
              )
            }}
          </p>
        </div>

        <div
          id="black-friday"
          class="mb-8 scroll-mt-24 rounded-3xl px-6 py-8 text-stone-100 sm:px-8"
          :class="promoOn ? 'bg-zinc-950' : 'bg-muted text-foreground'"
        >
          <template v-if="promoOn">
            <p class="inline-flex items-center rounded-full bg-amber-300 px-3 py-1 text-xs font-bold tracking-wide text-zinc-950">
              {{ pick('黑色星期五 · 约 30% OFF', 'Black Friday · ~30% off') }}
            </p>
            <h2 class="mt-4 max-w-2xl font-serif text-3xl tracking-tight text-white sm:text-4xl">
              {{ pick('划线是表价。页面价格是实付。', 'Struck price is the list price. The page price is what you pay.') }}
            </h2>
            <p class="mt-3 text-sm text-stone-300">
              {{ pick(`截止 ${deadline} Asia/Shanghai。Billboard 地板价仍是 $15。`, `Ends ${deadline} Asia/Shanghai. The Billboard floor stays $15.`) }}
            </p>
            <ul class="mt-5 flex flex-wrap gap-2 text-sm">
              <li
                v-for="tier in tiers.filter((item) => item.amountCents > 0)"
                :key="tier.id"
                class="rounded-full border border-white/15 bg-white/5 px-3 py-1"
              >
                <span class="mr-2 rounded-full bg-amber-300 px-1.5 text-[10px] font-bold text-zinc-950">SAVE</span>
                {{ t(tier.name) }}
                <s class="mx-1 text-stone-400">{{ skuQuote('listing', tier.id).listLabel }}</s>
                {{ skuQuote('listing', tier.id).priceLabel }}
              </li>
              <li class="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                <span class="mr-2 rounded-full bg-amber-300 px-1.5 text-[10px] font-bold text-zinc-950">SAVE</span>
                {{ pick('右栏', 'Sidebar') }}
                <s class="mx-1 text-stone-400">{{ skuQuote('sidebar', '1').listLabel }}</s>
                {{ skuQuote('sidebar', '1').priceLabel }}{{ pick('/周', '/wk') }}
              </li>
              <li class="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                Billboard {{ pick('从 $15 起', 'from $15') }}
              </li>
            </ul>
          </template>
          <p v-else class="text-sm leading-relaxed">
            {{
              pick(
                '下面是表价。页面价格即为实付。Billboard 从 $15 起，一次付清。',
                'Prices below are the list prices, and the price on the page is what you pay. Billboard is name-your-price from $15.',
              )
            }}
          </p>
        </div>

        <div id="plans" class="scroll-mt-24">
          <DirectoryPricingTable :groups="groups" @select="choosePlan" />
        </div>
      </div>
    </section>

    <section id="ads" class="scroll-mt-24 border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <header class="mb-10 max-w-3xl">
          <h2 class="font-serif text-3xl font-normal tracking-tight">
            {{ pick('被看到', 'Get seen') }}
          </h2>
          <p class="mt-4 text-sm leading-relaxed text-muted-foreground">{{ adHead }}</p>
          <ul class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li
              v-for="item in pricingBillboardChecks"
              :key="item.en"
              class="inline-flex items-center gap-2"
            >
              <Icon name="check" :size="16" class="shrink-0 text-primary" />
              {{ t(item) }}
            </li>
          </ul>
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

        <div class="grid gap-6 sm:grid-cols-2">
          <article class="flex flex-col rounded-2xl border border-border bg-background p-6">
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium">Billboard</span>
              <span class="text-right">
                <span class="text-sm text-muted-foreground">{{ pick('从', 'from') }}</span>
                <span class="ml-1 font-serif text-3xl tracking-tight">$15</span>
              </span>
            </div>
            <p class="text-[11px] font-semibold tracking-wide text-muted-foreground">
              {{ pick('自己出价 · 黑五不减地板价', 'Name your price · Black Friday does not cut the floor') }}
            </p>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
              {{
                pick(
                  '一次付清。按累计金额排名。前 10 名同步首页。同一网站再付会累加。',
                  'One-time. Ranked by total backed. Top 10 on the homepage. Another payment for the same website stacks.',
                )
              }}
            </p>
            <div class="mt-auto pt-6">
              <NuxtLink
                v-if="paymentReady"
                :to="`${localePath('/billboard')}#claim`"
                class="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
              >
                {{ pick('认领展示位 · $15 起', 'Claim your spot · from $15') }}
              </NuxtLink>
              <a
                v-else
                :href="invoiceMail('Billboard')"
                class="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
              >
                {{ pick('索取发票 · $15 起', 'Request invoice · from $15') }}
              </a>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
              {{
                paymentReady
                  ? pick('一次付清。付款即上线。', 'One-time payment. Live the second you pay.')
                  : pick('一次付清。发票确认后上线。', 'One-time payment. Live after the invoice is confirmed.')
              }}
            </p>
          </article>
          <article
            v-for="plan in adPlans"
            :key="plan.id"
            class="flex flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:border-foreground/30"
          >
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-foreground">{{ t(plan.name) }}</span>
              <span class="text-right">
                <s
                  v-if="skuQuote('sidebar', '1').strikeLabel"
                  class="mr-2 text-sm text-muted-foreground"
                >{{ skuQuote('sidebar', '1').strikeLabel }}</s>
                <span class="font-serif text-3xl tracking-tight">{{ skuQuote('sidebar', '1').priceLabel }}</span>
                <small class="ml-1 text-sm text-muted-foreground">{{ pick('/周', '/wk') }}</small>
              </span>
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
            <p class="mt-4 text-xs text-muted-foreground">
              <s v-if="skuQuote('sidebar', '4').strikeLabel" class="mr-1">{{ skuQuote('sidebar', '4').strikeLabel }}</s>
              {{
                pick(
                  `连投 4 周 ${skuQuote('sidebar', '4').priceLabel}`,
                  `4 weeks ${skuQuote('sidebar', '4').priceLabel}`,
                )
              }}
            </p>
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
                {{
                  paymentReady
                    ? pick('预订这个位置', 'Book this spot')
                    : pick('索取发票', 'Request invoice')
                }}
              </NuxtLink>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
              {{ pick('首页与最新收录右栏。周一起算 7 天。', 'Homepage and the just-added rail. 7 days from Monday.') }}
            </p>
          </article>
        </div>

        <p class="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {{
            promoOn
              ? pick(
                  `页面价格即为实付。发票确认后上线。Black Friday 截止 ${deadline} Asia/Shanghai。不承诺搜索排名。`,
                  `The price on the page is what you pay. Invoice confirmed, then it goes live. Black Friday ends ${deadline} Asia/Shanghai. No promise of search rank.`,
                )
              : pick(
                  '页面价格即为实付。发票确认后上线。不承诺搜索排名。',
                  'The price on the page is what you pay. Invoice confirmed, then it goes live. No promise of search rank.',
                )
          }}
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
              <tr class="border-b border-border">
                <th scope="row" class="py-3 pr-4 text-left font-normal text-muted-foreground">
                  {{ pick('价格', 'Price') }}
                </th>
                <td
                  v-for="tier in tiers"
                  :key="tier.id"
                  class="px-3 py-3 align-top"
                  :class="tier.id === 'featured' ? 'font-medium' : ''"
                >
                  <s
                    v-if="skuQuote('listing', tier.id).strikeLabel"
                    class="mr-1 text-muted-foreground"
                  >{{ skuQuote('listing', tier.id).strikeLabel }}</s>
                  {{ skuQuote('listing', tier.id).priceLabel }}
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

    <section class="border-t border-border px-4 py-20">
      <div class="mx-auto max-w-3xl">
        <div class="text-center">
          <p class="font-serif text-2xl tracking-tight">
            {{ pick('不确定从哪开始？', 'Not sure where to start?') }}
          </p>
          <p class="mt-3 text-sm text-muted-foreground">
            {{ pick('选一个意图。价格是当前实付。', 'Pick an intent. The price is what you pay now.') }}
          </p>
          <div class="mt-6 grid gap-3 text-left sm:grid-cols-3">
            <template v-for="item in scenarios" :key="item.line">
              <a
                v-if="item.external"
                :href="item.to"
                class="flex flex-col rounded-xl border border-border bg-background p-4 text-left transition hover:border-foreground/30"
              >
                <span class="text-sm font-medium">{{ item.line }}</span>
                <span class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ item.answer }}</span>
                <span class="mt-auto pt-4 text-xs font-medium text-primary">{{ item.cta }} →</span>
              </a>
              <NuxtLink
                v-else
                :to="item.to"
                class="flex flex-col rounded-xl border border-border bg-background p-4 text-left transition hover:border-foreground/30"
              >
                <span class="text-sm font-medium">{{ item.line }}</span>
                <span class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ item.answer }}</span>
                <span class="mt-auto pt-4 text-xs font-medium text-primary">{{ item.cta }} →</span>
              </NuxtLink>
            </template>
          </div>
        </div>

        <h2 class="mb-3 mt-16 font-serif text-3xl font-normal tracking-tight">
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
            {{ pick('免费提交，或选择一档付费方案。', 'Submit free, or pick a paid plan.') }}
          </p>
          <NuxtLink
            :to="localePath('/submit')"
            class="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            {{ pick('免费提交', 'Submit free') }}
            <Icon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
