<script setup lang="ts">
/**
 * /book-ad — self-serve booking for the two weekly ad placements on /pricing.
 *
 * Why a new page instead of /advertise: that page is a verbatim port of the
 * source's sponsor tiers (Silver / Gold / Platinum, monthly subscriptions) and
 * is deliberately left untouched. The pricing page sells something else — two
 * slots rented by the week. Overwriting the source page would both break the
 * port and mix two incompatible billing models.
 *
 * The price shown here mirrors `adPriceCents()`; the checkout endpoint
 * recomputes it on the server and ignores any amount in the request. The open
 * weeks come from the server too — the same conflict check the webhook repeats
 * when the money lands.
 *
 * Markup follows the public site (`.src-page`, the pill buttons and fields of
 * /submit), not the admin console.
 *
 * Added 2026-11-08 from the launchit.fast billboard teardown (docs/10, §4.3):
 * a live "weeks still open" line, three trust badges and a visible FAQ with
 * matching FAQPage markup. No bidding, no stackable payments and no "no review"
 * claim — this site keeps its conflict checks and its Acceptable Use Policy.
 */
import {
  AD_WEEK_OPTIONS,
  adPlans,
  adPriceCents,
  formatAdPrice,
} from '~~/shared/content/pricing'
import { openAdWeeks } from '~/composables/useAds'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const requestFetch = useRequestFetch()
const payment = await usePayment()

type Slot = 'board' | 'sidebar'
type Availability = {
  ok: boolean
  starts: string[]
  available: Record<string, boolean>
}

const slot = ref<Slot>(
  route.query.slot === 'sidebar' || route.query.slot === 'board'
    ? (route.query.slot as Slot)
    : 'board',
)
const weeks = ref<number>(
  AD_WEEK_OPTIONS.includes(Number(route.query.weeks) as 1 | 4) ? Number(route.query.weeks) : 1,
)
const start = ref('')

const form = reactive({
  name: '',
  headline: '',
  url: '',
  logo: '',
  email: '',
})
const busy = ref(false)
const error = ref('')

const { data } = await useAsyncData<Availability>(
  () => `ad-availability:${slot.value}:${weeks.value}`,
  () =>
    requestFetch<Availability>(
      `/api/ads/availability?slot=${slot.value}&weeks=${weeks.value}`,
    ).catch(() => ({ ok: false, starts: [], available: {} })),
  { watch: [slot, weeks], default: () => ({ ok: false, starts: [], available: {} }) },
)

const starts = computed(() => data.value?.starts ?? [])
const available = computed(() => data.value?.available ?? {})
const openWeeks = computed(() => openAdWeeks(data.value))
const plan = computed(() => adPlans.find((entry) => entry.id === slot.value) ?? adPlans[0]!)
const priceCents = computed(() => adPriceCents(slot.value, weeks.value))
const price = computed(() => formatAdPrice(priceCents.value))

const openWeeksLine = computed(() =>
  pick(
    `未来 6 周还有 ${openWeeks.value.length} 周可订${openWeeks.value[0] ? ` · 最早 ${openWeeks.value[0]}` : ''}`,
    `Next 6 weeks: ${openWeeks.value.length} still open${openWeeks.value[0] ? ` · earliest ${openWeeks.value[0]}` : ''}`,
  ),
)

const trust = computed(() => [
  { icon: 'circle-check', label: pick('付款成功自动排期', 'Scheduled on payment') },
  { icon: 'receipt', label: pick('一次性付款，不自动续费', 'One payment, no renewal') },
  { icon: 'shield-check', label: pick('同一周不会超卖', 'Never oversold') },
])

/** Visible FAQ. The JSON-LD below is built from this exact array. */
const bookFaq = computed(() => [
  {
    q: pick('付款后多久上线？', 'How soon does it go live?'),
    a: pick(
      '付款成功后支付回调自动验签并完成订单，系统立即把广告排进你选的周次，不需要人工确认，也不用提交产品。收据发到你填的邮箱。',
      'A verified payment webhook settles the order and schedules the ad in the week you picked as soon as payment succeeds. No manual confirmation and no product submission. The receipt goes to the email you entered.',
    ),
  },
  {
    q: pick('同一周会被卖两次吗？', 'Can the same week be sold twice?'),
    a: pick(
      '不会。下单时先做一次冲突检测并预留 30 分钟，付款成功时系统再核对一次；极少数并发情况下，后付款的订单会被标记冲突，由站长退款或改期。',
      'No. Booking runs a conflict check and holds the week for 30 minutes; the webhook repeats the check when payment succeeds. In the rare case of a simultaneous payment, the later order is flagged as a conflict and refunded or rescheduled by the operator.',
    ),
  },
  {
    q: pick('会影响搜索排名吗？', 'Will this affect search rankings?'),
    a: pick(
      '我们不承诺任何搜索排名、流量、收录或域名权重提升。卖的是站内展示位置与看到它的读者；广告链接带 rel="sponsored"，并明确标注为赞助内容。',
      'We make no claims about rankings, traffic, indexing or domain authority. What we sell is on-site placement and the readers who see it. Ad links carry rel="sponsored" and are clearly marked as sponsored.',
    ),
  },
  {
    q: pick('会一直显示吗？', 'Does it stay up forever?'),
    a: pick(
      '不会。位置按周出租，周一起算、到期自动下架；1 周展示 7 天，连投 4 周展示 28 天。想续租，直接选后面的周再订一次，没有自动续费。',
      'No. Slots are rented by the week, starting Monday, and come down on their own: 7 days for one week, 28 for four. To renew, book a later week — there is no auto-renewal.',
    ),
  },
])

const faqSchema = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: bookFaq.value.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }),
)

/** Keep the chosen Monday valid when the slot, length or availability changes. */
watch(
  [starts, available],
  ([list, flags]) => {
    if (!list.length) return
    const preferred = String(route.query.start ?? '')
    if (start.value && list.includes(start.value) && flags[start.value] !== false) return
    start.value =
      (list.includes(preferred) && flags[preferred] !== false
        ? preferred
        : list.find((day) => flags[day] !== false)) ?? ''
  },
  { immediate: true },
)

function windowLabel(day: string): string {
  if (!day) return '—'
  const from = new Date(`${day}T00:00:00Z`)
  const to = new Date(from)
  to.setUTCDate(to.getUTCDate() + 7 * weeks.value - 1)
  const fmt = (d: Date) =>
    isZh.value
      ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(from)} → ${fmt(to)}`
}

const canSubmit = computed(() =>
  Boolean(payment.ready.value && start.value && priceCents.value && !busy.value),
)

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok: boolean; url?: string }>('/api/payments/ad-checkout', {
      method: 'POST',
      body: {
        slot: slot.value,
        weeks: weeks.value,
        start: start.value,
        name: form.name,
        headline: form.headline,
        url: form.url,
        logo: form.logo,
        email: form.email,
      },
    })
    if (!res?.url) throw new Error('no checkout url')
    window.location.href = res.url
  } catch (err) {
    const info = (err as { data?: { message_zh?: string; message_en?: string } })?.data
    error.value =
      (isZh.value ? info?.message_zh : info?.message_en) ||
      pick('暂时打不开付款页面，请稍后再试。', 'Could not open the payment page — try again in a moment.')
    busy.value = false
  }
}

useSeo({
  title: computed(() => pick('预订周广告位 · Product Atlas', 'Book a weekly ad slot · Product Atlas')),
  description: computed(() =>
    pick(
      '按周预订榜单或右栏广告位，在线付款后自动排期，到期自动下架。',
      'Rent a weekly board or sidebar placement. Pay online, get scheduled automatically, come down when the week ends.',
    ),
  ),
})

useHead({
  script: [{ type: 'application/ld+json', innerHTML: faqSchema }],
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-6 sm:py-14">
    <header class="mb-10 max-w-3xl">
      <p class="mb-3 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        {{ pick('周广告位', 'Weekly ad slots') }}
      </p>
      <h1 class="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
        {{ pick('预订一个广告位', 'Book a weekly placement') }}
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        {{
          pick(
            '位置按周出租，周一起算、到期自动下架，同一周不会卖两次。付款成功后系统自动排期，不需要提交产品，也不需要等人工确认。想续租，直接选后面的周再订一次。',
            'Slots are rented by the week, starting Monday, and come down on their own when the window ends. One position is never sold twice for the same week. Payment schedules it automatically — no product submission and no manual confirmation. To renew, simply book a later week.',
          )
        }}
      </p>

      <ul class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <li v-for="item in trust" :key="item.label" class="inline-flex items-center gap-1.5">
          <Icon :name="item.icon" :size="14" />
          {{ item.label }}
        </li>
      </ul>
      <p v-if="openWeeks.length" class="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {{ openWeeksLine }}
      </p>
    </header>

    <form class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" @submit.prevent="submit">
      <div class="space-y-8">
        <!-- position -->
        <section class="space-y-3">
          <h2 class="text-sm font-semibold">{{ pick('选择位置', 'Choose a position') }}</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="entry in adPlans"
              :key="entry.id"
              type="button"
              class="rounded-2xl border p-5 text-left transition"
              :class="
                slot === entry.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background hover:border-foreground/30'
              "
              @click="slot = entry.id as Slot"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-medium">{{ isZh ? entry.name.zh : entry.name.en }}</span>
                <span class="font-serif text-xl tabular-nums">{{ entry.price }}</span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ isZh ? entry.where.zh : entry.where.en }}
              </p>
              <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
                {{ isZh ? entry.pitch.zh : entry.pitch.en }}
              </p>
            </button>
          </div>
        </section>

        <!-- length -->
        <section class="space-y-3">
          <h2 class="text-sm font-semibold">{{ pick('投放时长', 'How long') }}</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in AD_WEEK_OPTIONS"
              :key="option"
              type="button"
              class="inline-flex h-9 cursor-pointer items-center rounded-full border px-5 text-sm transition"
              :class="
                weeks === option
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              "
              @click="weeks = option"
            >
              {{ option === 1 ? pick('1 周', '1 week') : pick('连投 4 周', '4 weeks') }}
            </button>
          </div>
          <p v-if="weeks === 4" class="text-xs text-muted-foreground">
            {{ isZh ? plan.bundle.zh : plan.bundle.en }}
          </p>
        </section>

        <!-- start -->
        <section class="space-y-3">
          <h2 class="text-sm font-semibold">{{ pick('从哪一周开始', 'Start week') }}</h2>
          <select
            v-model="start"
            class="h-10 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-sm"
            required
          >
            <option v-if="!starts.length" value="">
              {{ pick('正在读取可订周…', 'Loading open weeks…') }}
            </option>
            <option
              v-for="day in starts"
              :key="day"
              :value="day"
              :disabled="available[day] === false"
            >
              {{ day }} · {{ windowLabel(day) }}
              {{ available[day] === false ? pick('（已订满）', ' (booked)') : '' }}
            </option>
          </select>
          <p class="text-xs text-muted-foreground">
            {{ pick('每周一 00:00 UTC 起算，展示 7 天；连投 4 周展示 28 天。', 'Every window starts Monday 00:00 UTC: 7 days for one week, 28 for four.') }}
          </p>
        </section>

        <!-- creative -->
        <section class="space-y-4">
          <h2 class="text-sm font-semibold">{{ pick('广告内容', 'The creative') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label for="book-name" class="text-sm font-medium">{{ pick('品牌 / 产品名', 'Brand or product name') }}</label>
              <input
                id="book-name"
                v-model="form.name"
                type="text"
                required
                minlength="2"
                maxlength="60"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                :placeholder="pick('例如 Acme', 'e.g. Acme')"
              >
            </div>
            <div class="space-y-2">
              <label for="book-email" class="text-sm font-medium">{{ pick('邮箱（收据 / 退款联系）', 'Email (receipt and refunds)') }}</label>
              <input
                id="book-email"
                v-model="form.email"
                type="email"
                required
                maxlength="160"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="you@example.com"
              >
            </div>
          </div>
          <div class="space-y-2">
            <label for="book-headline" class="text-sm font-medium">{{ pick('一句话文案', 'One-line pitch') }}</label>
            <input
              id="book-headline"
              v-model="form.headline"
              type="text"
              required
              minlength="4"
              maxlength="90"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              :placeholder="pick('例如：把每周榜单变成你的落地页', 'e.g. Turn the weekly board into your landing page')"
            >
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label for="book-url" class="text-sm font-medium">{{ pick('落地页 URL', 'Destination URL') }}</label>
              <input
                id="book-url"
                v-model="form.url"
                type="url"
                required
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="https://example.com"
              >
            </div>
            <div class="space-y-2">
              <label for="book-logo" class="text-sm font-medium">{{ pick('Logo URL（可选）', 'Logo URL (optional)') }}</label>
              <input
                id="book-logo"
                v-model="form.logo"
                type="url"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="https://example.com/logo.png"
              >
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ pick('链接直接指向你的落地页，中间没有跳转页；外链会带 rel="sponsored"。', 'Links go straight to your page with no interstitial, and carry rel="sponsored".') }}
          </p>
        </section>
      </div>

      <!-- summary -->
      <aside class="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6">
        <h2 class="text-sm font-semibold">{{ pick('订单摘要', 'Order summary') }}</h2>
        <dl class="mt-5 space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-muted-foreground">{{ pick('位置', 'Position') }}</dt>
            <dd>{{ isZh ? plan.name.zh : plan.name.en }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted-foreground">{{ pick('时长', 'Length') }}</dt>
            <dd>{{ weeks === 1 ? pick('1 周', '1 week') : pick('4 周', '4 weeks') }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted-foreground">{{ pick('投放期', 'Window') }}</dt>
            <dd class="tabular-nums">{{ start ? windowLabel(start) : '—' }}</dd>
          </div>
          <div class="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <dt class="font-medium">{{ pick('合计', 'Total') }}</dt>
            <dd class="font-serif text-2xl tabular-nums">{{ price }}</dd>
          </div>
        </dl>

        <p class="mt-2 text-xs text-muted-foreground">
          {{ pick('一次性付款，不自动续费。', 'One payment. No auto-renewal.') }}
        </p>

        <p v-if="!payment.ready.value" class="mt-5 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          {{ pick('在线预订暂未开通，请联系我们人工排期。', 'Online booking is not switched on yet — contact us to reserve a week.') }}
        </p>
        <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

        <button
          type="submit"
          class="mt-5 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canSubmit"
        >
          {{ busy ? pick('正在打开付款页…', 'Opening checkout…') : pick('去付款', 'Continue to payment') }}
        </button>

        <NuxtLink
          :to="localePath('/pricing')"
          class="mt-3 block text-center text-xs text-muted-foreground underline underline-offset-4"
        >
          {{ pick('返回定价页', 'Back to pricing') }}
        </NuxtLink>
      </aside>
    </form>

    <!-- Visible FAQ; the FAQPage schema above is generated from bookFaq. -->
    <section class="mt-14 border-t border-border pt-10">
      <div class="max-w-3xl">
        <h2 class="font-serif text-2xl font-normal tracking-tight">
          {{ pick('预订前常见问答', 'Before you book') }}
        </h2>
        <dl class="mt-6 space-y-6">
          <div v-for="item in bookFaq" :key="item.q">
            <dt class="text-sm font-medium">{{ item.q }}</dt>
            <dd class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ item.a }}</dd>
          </div>
        </dl>
        <NuxtLink
          :to="localePath('/faq')"
          class="mt-8 inline-block text-xs text-muted-foreground underline underline-offset-4"
        >
          {{ pick('更多问题见 /faq', 'More questions on /faq') }} →
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
