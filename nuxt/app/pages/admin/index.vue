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
  </div>
</template>
