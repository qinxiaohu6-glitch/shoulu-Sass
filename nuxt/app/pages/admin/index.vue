<script setup lang="ts">
/**
 * /admin — source `shipany-dir/src/routes/admin/index.tsx`.
 *
 * Four metric cards over the conversion funnel. Card order, icons, hints and
 * the money formatter are the source's; the numbers come from
 * `/api/admin/analytics/overview`, which derives them from the tables this
 * build actually has (see that file's header for what is derived and why).
 *
 * The source's `DashboardSkeleton` renders while the query is pending. Here the
 * first paint is server-rendered with data, so the skeleton only appears when
 * the page is refreshing — same shape, no flash of empty cards on load.
 *
 * This replaces the hand-written review console that used to live at `/admin`.
 * Nothing it did is lost: the review queue became `/admin/directory/tools`
 * (approve / reject / force-unpublish), the payment list became
 * `/admin/payments`, and the weekly placements are still edited from
 * `/admin/directory/ads`. The old component remains in git history.
 */
definePageMeta({ layout: 'admin' })

import { DollarSign, LifeBuoy, Repeat, Users } from 'lucide-vue-next'

interface OverviewStats {
  users: { total: number; new24h: number }
  revenue30d: { currency: string; amount: number; orders: number }[]
  subscriptions: { active: number; trialing: number }
  openTickets: number
}

const { t } = useSettingsI18n()
const api = useAdminApi()

const { data, status } = await useAsyncData<OverviewStats | null>(
  'admin-overview-stats',
  () => api.get<OverviewStats>('/api/admin/analytics/overview'),
  { default: () => null },
)

/**
 * Amounts are in minor units; derive the divisor from the currency itself so
 * zero-decimal currencies (JPY, KRW…) are not divided by 100.
 */
function formatMoney(amount: number, currency: string) {
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() })
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2
    return fmt.format(amount / 10 ** digits)
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

const stats = computed(() => data.value)
const pending = computed(() => status.value === 'pending' && !stats.value)

type Pulse = {
  weekId: string
  prices: { kind: string; id: string; label: string; priceLabel: string; strikeLabel: string | null }[]
  week: { count: number; items: { slug: string; name: string; plan: string; votes: number; shots: number }[] }
  month: { count: number; items: { slug: string; name: string; votes: number }[] }
  featured: { slug: string; name: string; plan: string; votes: number }[]
}

const { data: pulse, error: pulseError } = await useAsyncData<Pulse | null>(
  'admin-home-pulse',
  () => api.get<Pulse>('/api/admin/home-pulse'),
  { default: () => null },
)

const cards = computed(() => {
  const s = stats.value
  const [mainRevenue, ...otherRevenue] = s?.revenue30d ?? []
  const payments = (s?.revenue30d ?? []).reduce((n, r) => n + r.orders, 0)

  return [
    {
      title: t('admin.stats.total_users'),
      icon: Users,
      value: s ? s.users.total.toLocaleString() : '',
      hint: s ? t('admin.stats.new_24h', { count: s.users.new24h }) : null,
    },
    {
      title: t('admin.stats.revenue_30d'),
      icon: DollarSign,
      value: s ? (mainRevenue ? formatMoney(mainRevenue.amount, mainRevenue.currency) : formatMoney(0, 'usd')) : '',
      hint: s
        ? [
            t('admin.stats.payments_net', { count: payments }),
            ...otherRevenue.map((r) => `+ ${formatMoney(r.amount, r.currency)}`),
          ].join(' · ')
        : null,
    },
    {
      title: t('admin.stats.active_subscriptions'),
      icon: Repeat,
      value: s ? s.subscriptions.active.toLocaleString() : '',
      hint: s ? t('admin.stats.trialing', { count: s.subscriptions.trialing }) : null,
    },
    {
      title: t('admin.stats.open_tickets'),
      icon: LifeBuoy,
      value: s ? s.openTickets.toLocaleString() : '',
      hint: s ? t('admin.stats.open_tickets_hint') : null,
    },
  ]
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.description') }}</p>
    </div>

    <AdminDashboardSkeleton
      v-if="pending"
      :cards="4"
      cards-class-name="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      :charts="0"
    />

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiCard v-for="card in cards" :key="card.title">
        <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <UiCardTitle class="text-sm font-medium">{{ card.title }}</UiCardTitle>
          <component :is="card.icon" class="text-muted-foreground size-4" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold tabular-nums">{{ card.value }}</div>
          <p v-if="card.hint" class="text-muted-foreground mt-1 text-xs">{{ card.hint }}</p>
        </UiCardContent>
      </UiCard>
    </div>

    <AdminConversionFunnel />

    <section class="space-y-3">
      <div>
        <h2 class="text-lg font-semibold">首页正在卖的价，和刚刚发布</h2>
        <p class="text-muted-foreground text-sm">
          价格是结账实际收取的金额。划线是上线定价前的标价，截止后划线消失，实付不变。Billboard 地板价不做划线。周/月按上海时间切，和首页 Just launched 同一窗口。票数来自本周 votes 表（{{ pulse?.weekId || '…' }}）。这里只读。
        </p>
      </div>
      <p v-if="pulseError" class="text-sm text-muted-foreground">首页数据暂时读不出来。</p>
      <template v-else-if="pulse">
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="price in pulse.prices" :key="`${price.kind}-${price.id}`" class="rounded-lg border p-3 text-sm">
            <div class="text-muted-foreground text-xs">{{ price.label }}</div>
            <div class="text-lg font-semibold">
              {{ price.priceLabel }}
              <s v-if="price.strikeLabel" class="text-muted-foreground ml-1 text-xs font-normal">{{ price.strikeLabel }}</s>
            </div>
          </li>
        </ul>
        <div class="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 class="mb-2 text-sm font-semibold">本周发布 · {{ pulse.week.count }}</h3>
            <ul class="space-y-1 text-sm">
              <li v-for="item in pulse.week.items" :key="`w-${item.slug}`" class="flex justify-between gap-3">
                <span class="min-w-0 truncate">{{ item.name }} <span class="text-muted-foreground text-xs">{{ item.plan || item.slug }}</span></span>
                <span class="shrink-0">{{ item.votes }} 票 · {{ item.shots }} 图</span>
              </li>
              <li v-if="!pulse.week.items.length" class="text-muted-foreground">本周没有新发布。</li>
            </ul>
          </div>
          <div>
            <h3 class="mb-2 text-sm font-semibold">本月发布 · {{ pulse.month.count }}</h3>
            <ul class="space-y-1 text-sm">
              <li v-for="item in pulse.month.items" :key="`m-${item.slug}`" class="flex justify-between gap-3">
                <span class="min-w-0 truncate">{{ item.name }}</span>
                <span class="shrink-0">{{ item.votes }} 票</span>
              </li>
              <li v-if="!pulse.month.items.length" class="text-muted-foreground">本月没有新发布。</li>
            </ul>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-semibold">已付款精选 / 专业</h3>
          <p v-if="!pulse.featured.length" class="text-muted-foreground text-sm">还没有付费精选出现在首页卡位。</p>
          <ul v-else class="space-y-1 text-sm">
            <li v-for="item in pulse.featured" :key="`f-${item.slug}`">
              {{ item.name }} · {{ item.plan || 'featured' }} · {{ item.votes }} 票
            </li>
          </ul>
        </div>
      </template>
    </section>
  </div>
</template>
