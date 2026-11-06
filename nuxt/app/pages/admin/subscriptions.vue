<script setup lang="ts">
/**
 * /admin/subscriptions — source `shipany-dir/src/routes/admin/subscriptions.tsx`.
 *
 * Three tabs (`all` / `month` / `year` → `?interval=`), eight columns, search
 * and refresh. No row actions, no dialogs — the source has none either.
 *
 * Nothing in this build renews: listings are bought once through
 * `payment_order`, so the endpoint answers with the source's own empty table.
 * See `server/api/admin/subscriptions/index.get.ts`.
 */
definePageMeta({ layout: 'admin' })

import { cn, type DataColumn } from '~/utils/ui'
import {
  formatSubscriptionAmount,
  SUBSCRIPTIONS_PAGE_SIZE,
  SUBSCRIPTION_TABS,
  subscriptionStatusVariant,
  type AdminSubscription,
  type SubscriptionTab,
} from '~/utils/admin-subscriptions-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''

const page = ref(1)
const tab = ref<SubscriptionTab>('all')
const search = ref(initialSearch)
const debouncedSearch = ref(initialSearch)

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([tab, debouncedSearch], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/subscriptions', {
    page: page.value,
    pageSize: SUBSCRIPTIONS_PAGE_SIZE,
    interval: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{
  items: AdminSubscription[]
  total: number
}>('admin-subscriptions', () => api.get<{ items: AdminSubscription[]; total: number }>(listParams.value), {
  watch: [listParams],
  default: () => ({ items: [], total: 0 }),
})

const subscriptions = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'subscription_no', header: t('admin.subscriptions.subscription_no') },
  { key: 'user', header: t('admin.subscriptions.user') },
  { key: 'amount', header: t('admin.subscriptions.amount') },
  { key: 'interval', header: t('admin.subscriptions.interval') },
  { key: 'status', header: t('admin.subscriptions.status') },
  { key: 'provider', header: t('admin.subscriptions.provider') },
  { key: 'period', header: t('admin.subscriptions.period') },
  { key: 'created', header: t('admin.subscriptions.created_at') },
])

function formatDate(value: string | null) {
  return value ? formatDateTime(value) : '—'
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.subscriptions.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.subscriptions.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in SUBSCRIPTION_TABS"
        :key="tb"
        type="button"
        :class="
          cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === tb
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )
        "
        @click="tab = tb"
      >
        {{ t(`admin.subscriptions.tab_${tb}`) }}
      </button>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          v-model:page="page"
          v-model:search="search"
          :columns="columns"
          :rows="subscriptions"
          :total="total"
          :page-size="SUBSCRIPTIONS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.subscriptions.no_subscriptions')"
          :search-placeholder="t('admin.subscriptions.search_placeholder')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-subscription_no="{ row }">
            <span class="font-mono text-xs">{{ row.subscriptionNo }}</span>
          </template>

          <template #cell-user="{ row }">
            <AdminUserCell
              :user-id="row.userId"
              :name="row.userName"
              :email="row.userAccountEmail || row.userEmail"
              :image="row.userImage"
            />
          </template>

          <template #cell-amount="{ row }">
            <span class="font-medium">
              {{ formatSubscriptionAmount(row.amount, row.currency) }}
            </span>
          </template>

          <template #cell-interval="{ row }">
            {{ row.interval || '—' }}
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="subscriptionStatusVariant(row.status)">{{ row.status }}</UiBadge>
          </template>

          <template #cell-provider="{ row }">
            {{ row.paymentProvider }}
          </template>

          <template #cell-period="{ row }">
            <span class="text-muted-foreground text-sm">
              {{ formatDate(row.currentPeriodStart) }} ~ {{ formatDate(row.currentPeriodEnd) }}
            </span>
          </template>

          <template #cell-created="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>
  </div>
</template>
