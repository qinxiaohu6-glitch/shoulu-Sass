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
 */
import type { PricingGroup, PricingPlan } from '~/utils/directory-ui'
import { adPlans, comparison, pricingFaq, tiers } from '~~/shared/content/pricing'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const router = useRouter()

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

const adHead = computed(() =>
  pick(
    '榜单位 $29 / 周，右栏位 $19 / 周；连投 4 周分别 $99 和 $65。榜单位是「决定投谁」的那一屏，所以更贵；右栏按停留时长卖，所以更便宜。位置是租的，不是买的 —— 不用提交产品，也可以和收录同时买。',
    'Board $29 a week, sidebar $19 a week — or $99 and $65 for four weeks. The board is the screen where people decide what to upvote, so it costs more; the rail is sold on time-on-page, so it costs less. Both are rented, not bought — no product submission needed, and you can run one alongside a listing.',
  ),
)

const openFaq = ref<number | null>(null)

useSeo({
  title: computed(() => `${title.value} · Product Atlas`),
  description: lead,
})
</script>

<template>
  <div class="src-page">
    <section id="pricing" class="border-t border-border px-4 py-24 sm:py-32">
      <div class="mx-auto max-w-5xl">
        <div class="mb-20 text-center">
          <h1 class="font-serif text-4xl font-normal tracking-tight sm:text-5xl">{{ title }}</h1>
          <p class="mt-5 text-muted-foreground">{{ lead }}</p>
        </div>

        <DirectoryPricingTable :groups="groups" @select="choosePlan" />
      </div>
    </section>

    <section id="ads" class="border-t border-border px-4 py-20">
      <div class="mx-auto max-w-5xl">
        <header class="mb-10 max-w-3xl">
          <h2 class="font-serif text-3xl font-normal tracking-tight">
            {{ pick('周广告位', 'Weekly ad slots') }}
          </h2>
          <p class="mt-4 text-sm leading-relaxed text-muted-foreground">{{ adHead }}</p>
        </header>

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
          {{ pick('在线选周、在线付款，付款成功后自动排期，不用提交产品。位置只有两个，同一周不会重复出售；已订满的周在预订页会自动标灰。', 'Pick a week and pay online — the placement is scheduled automatically once the payment clears, with no product submission. There are two positions and neither is sold twice in the same week; weeks that are gone are marked on the booking page.') }}
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
            {{ pick('不确定选哪个？', 'Not sure which one?') }}
          </p>
          <p class="mt-3 text-sm text-muted-foreground">
            {{ pick('先免费提交，上线后再决定要不要升级。', 'Submit free, then decide about upgrading once you are live.') }}
          </p>
          <NuxtLink
            :to="localePath('/submit')"
            class="mt-6 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            {{ pick('提交产品', 'Submit a product') }}
            <Icon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
