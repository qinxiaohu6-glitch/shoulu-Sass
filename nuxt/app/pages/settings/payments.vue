<script setup lang="ts">
/**
 * /settings/payments — source `routes/settings/payments.tsx`.
 *
 * The whole page is the source's: the four type tabs, the eight-column table,
 * the status filter and the search box. This is the one settings page backed by
 * real rows — `payment_order` exists and every order is owned through the
 * submission it paid for, so `/api/my/orders` can answer it.
 *
 * Three shape differences, all handled here:
 *
 *   source                      this build
 *   ─────────────────────────   ──────────────────────────────
 *   `orderNo`                   the order id (already short and opaque)
 *   `amount` + `currency`       `amount_cents` + `currency`
 *   `paidAt`/`createdAt` (ISO)  `paid_at`/`created_at`, Unix seconds
 *
 * The status filter lists the five statuses this build can actually produce
 * (`pending`, `paid`, `failed`, `cancelled`, `refunded`) rather than the
 * source's four, because filtering by a status no row can have is a control
 * that only ever returns nothing. `settings.payments.status_cancelled` is the
 * one message key added on top of the source's table, for the same reason.
 */
import { ExternalLink } from 'lucide-vue-next'
import { cn, type DataColumn } from '~/utils/ui'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const { isZh } = useLang()

type Order = {
  id: string
  order_no: string
  status: string
  amount_cents: number
  currency: string
  provider: string
  payment_type: string
  product_name: string
  plan_name: string
  invoice_url: string | null
  paid_at: number | null
  created_at: number
  slug: string
}

const TABS = ['all', 'one-time', 'subscription', 'renew'] as const
type Tab = (typeof TABS)[number]

const PAGE_SIZE = 20
const FILTER_STATUSES = ['paid', 'pending', 'refunded', 'failed', 'cancelled']

const tab = ref<Tab>('all')
const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const status = ref('all')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})
onBeforeUnmount(() => clearTimeout(debounceTimer))

watch([tab, debouncedSearch, status], () => {
  page.value = 1
})

const requestFetch = useRequestFetch()

const {
  data: listData,
  refresh,
  status: listStatus,
} = await useAsyncData(
  'my-orders',
  () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page.value - 1) * PAGE_SIZE),
    })
    if (tab.value !== 'all') params.set('paymentType', tab.value)
    if (debouncedSearch.value) params.set('search', debouncedSearch.value)
    if (status.value !== 'all') params.set('status', status.value)
    return requestFetch<{ items: Order[]; total: number }>(`/api/my/orders?${params}`)
  },
  { watch: [page, tab, debouncedSearch, status] },
)

const orders = computed(() => listData.value?.items ?? [])
const total = computed(() => listData.value?.total ?? 0)
const loading = computed(() => listStatus.value === 'pending')

/** "Product · Plan", or one of them when they are the same / missing. */
function productLabel(o: Order) {
  if (o.product_name && o.plan_name && o.plan_name !== o.product_name) {
    return `${o.product_name} · ${o.plan_name}`
  }
  return o.plan_name || o.product_name || '—'
}

function statusLabel(value: string) {
  const key = `settings.payments.status_${value}`
  const label = t(key)
  return label === key ? value : label
}

function formatAmount(cents: number, currency: string) {
  const normalized = (currency || 'usd').toUpperCase()
  return new Intl.NumberFormat(isZh.value ? 'zh-CN' : undefined, {
    style: 'currency',
    currency: normalized,
  }).format(cents / 100)
}

function statusVariant(value: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = value.toLowerCase()
  if (s === 'paid' || s === 'succeeded' || s === 'active') return 'default'
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'destructive'
  return 'secondary'
}

const typeLabelOf = (value: string) =>
  (TABS as readonly string[]).includes(value)
    ? t(`settings.payments.tab_${value.replace('-', '_')}`)
    : value || '—'

const statusFilterLabel = computed(() =>
  status.value === 'all' ? t('settings.payments.status_all') : statusLabel(status.value),
)

const columns = computed<DataColumn[]>(() => [
  { key: 'no', header: t('settings.payments.order_no') },
  { key: 'product', header: t('settings.payments.product') },
  { key: 'amount', header: t('settings.payments.amount') },
  { key: 'status', header: t('settings.payments.status') },
  { key: 'type', header: t('settings.payments.type') },
  { key: 'provider', header: t('settings.payments.provider') },
  { key: 'date', header: t('settings.payments.date') },
  { key: 'invoice', header: t('settings.payments.invoice'), class: 'w-[60px]' },
])

useHead({
  title: computed(() => `${t('settings.payments.title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <SettingsFeatureGate feature="payments">
    <div class="space-y-6 p-6">
      <div>
        <h1 class="text-2xl font-bold">{{ t('settings.payments.title') }}</h1>
        <p class="text-muted-foreground">{{ t('settings.payments.description') }}</p>
      </div>

      <div class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        <button
          v-for="tb in TABS"
          :key="tb"
          :class="
            cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          "
          @click="tab = tb"
        >
          {{ t(`settings.payments.tab_${tb.replace('-', '_')}`) }}
        </button>
      </div>

      <UiCard>
        <UiCardContent>
          <DataTable
            :columns="columns"
            :rows="orders"
            :total="total"
            :page="page"
            :page-size="PAGE_SIZE"
            :search="search"
            :loading="loading"
            :empty-text="t('settings.payments.no_payments')"
            show-refresh
            has-toolbar
            @update:page="(p: number) => (page = p)"
            @update:search="(v: string) => (search = v)"
            @refresh="refresh()"
          >
            <template #toolbar>
              <UiSelect
                :model-value="status"
                @update:model-value="(v: string) => (status = v || 'all')"
              >
                <UiSelectTrigger class="h-9 w-[140px]">
                  <UiSelectValue :text="statusFilterLabel" />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem value="all">{{ t('settings.payments.status_all') }}</UiSelectItem>
                  <UiSelectItem v-for="st in FILTER_STATUSES" :key="st" :value="st">
                    {{ statusLabel(st) }}
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </template>

            <template #cell-no="{ row }">
              <span class="font-mono text-xs">{{ row.order_no }}</span>
            </template>

            <template #cell-product="{ row }">
              <div class="min-w-0">
                <span>{{ productLabel(row) }}</span>
              </div>
            </template>

            <template #cell-amount="{ row }">
              <span class="font-medium">{{ formatAmount(row.amount_cents, row.currency) }}</span>
            </template>

            <template #cell-status="{ row }">
              <UiBadge :variant="statusVariant(row.status)">{{ statusLabel(row.status) }}</UiBadge>
            </template>

            <template #cell-type="{ row }">
              {{ typeLabelOf(row.payment_type) }}
            </template>

            <template #cell-provider="{ row }">
              <span class="capitalize">{{ row.provider }}</span>
            </template>

            <template #cell-date="{ row }">
              <span class="text-sm text-muted-foreground">
                {{
                  new Date((row.paid_at ?? row.created_at) * 1000).toLocaleDateString()
                }}
              </span>
            </template>

            <template #cell-invoice="{ row }">
              <a
                v-if="row.invoice_url"
                :href="row.invoice_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                :aria-label="t('settings.payments.invoice')"
              >
                <ExternalLink class="size-3.5" />
              </a>
              <span v-else class="text-muted-foreground">—</span>
            </template>
          </DataTable>
        </UiCardContent>
      </UiCard>
    </div>
  </SettingsFeatureGate>
</template>
