<script setup lang="ts">
/**
 * Source `routes/admin/-user-orders.tsx` — this user's payment attempts.
 *
 * Seven columns, a status filter, a type filter, debounced search and
 * server-side paging. The endpoint is `/api/admin/orders/list` rather than the
 * source's `/api/admin/orders`, which this build already uses for the legacy
 * console's own shape — see that route's header.
 */
import type { DataColumn } from '~/utils/ui'
import {
  formatOrderAmount,
  orderStatusVariant,
  ORDERS_PAGE_SIZE,
  ORDER_STATUSES,
  ORDER_TYPES,
  type AdminOrderRow,
} from '~/utils/admin-user-detail-ui'

const props = defineProps<{ userId: string }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const status = ref('all')
const paymentType = ref('all')
const search = ref('')
const debouncedSearch = ref('')

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

// Source: `useEffect(() => setPage(1), [status, paymentType, debouncedSearch])`.
watch([status, paymentType, debouncedSearch], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/orders/list', {
    userId: props.userId,
    page: page.value,
    pageSize: ORDERS_PAGE_SIZE,
    status: status.value === 'all' ? undefined : status.value,
    paymentType: paymentType.value === 'all' ? undefined : paymentType.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminOrderRow[]; total: number }>(
  `admin-user-orders-${props.userId}`,
  () => api.get<{ items: AdminOrderRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const statusText = computed(() =>
  status.value === 'all' ? t('admin.user_detail.status_all') : t(`admin.payments.status_${status.value}`),
)

const typeText = computed(() => typeLabel(paymentType.value === 'all' ? '' : paymentType.value) || t('admin.user_detail.type_all'))

/** Source `ORDER_TYPES.find(...)` + `tDynamic`; unknown values print as stored. */
function typeLabel(value: string | null) {
  const type = ORDER_TYPES.find(([v]) => v === value)
  return type ? t(`settings.payments.tab_${type[1]}`) : value || ''
}

const columns = computed<DataColumn[]>(() => [
  { key: 'order_no', header: t('admin.payments.order_no') },
  { key: 'product', header: t('admin.payments.product_name_label') },
  { key: 'amount', header: t('admin.payments.amount') },
  { key: 'status', header: t('admin.payments.status') },
  { key: 'type', header: t('admin.payments.type') },
  { key: 'provider', header: t('admin.payments.provider') },
  { key: 'created_at', header: t('admin.payments.created_at') },
])
</script>

<template>
  <UiCard>
    <UiCardHeader>
      <UiCardTitle>{{ t('admin.user_detail.orders_title') }}</UiCardTitle>
    </UiCardHeader>
    <UiCardContent>
      <DataTable
        v-model:page="page"
        v-model:search="search"
        :columns="columns"
        :rows="rows"
        :total="total"
        :page-size="ORDERS_PAGE_SIZE"
        :loading="loading"
        :empty-text="t('admin.payments.no_payments')"
        :search-placeholder="t('admin.user_detail.order_search')"
        has-toolbar
        show-refresh
        @refresh="refresh"
      >
        <template #toolbar>
          <div class="flex gap-2">
            <UiSelect v-model="status">
              <UiSelectTrigger class="h-9 w-[130px]">
                <UiSelectValue :text="statusText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">{{ t('admin.user_detail.status_all') }}</UiSelectItem>
                <UiSelectItem v-for="s in ORDER_STATUSES" :key="s" :value="s">
                  {{ t(`admin.payments.status_${s}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>

            <UiSelect v-model="paymentType">
              <UiSelectTrigger class="h-9 w-[130px]">
                <UiSelectValue :text="typeText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">{{ t('admin.user_detail.type_all') }}</UiSelectItem>
                <UiSelectItem v-for="[value, key] in ORDER_TYPES" :key="value" :value="value">
                  {{ t(`settings.payments.tab_${key}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </template>

        <template #cell-order_no="{ row }">
          <span class="font-mono text-xs">{{ row.orderNo }}</span>
        </template>

        <template #cell-product="{ row }">{{ row.productName || '—' }}</template>

        <template #cell-amount="{ row }">
          <span class="font-medium">{{ formatOrderAmount(row.amount, row.currency) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiBadge :variant="orderStatusVariant(row.status)">
            {{ t(`admin.payments.status_${row.status}`) }}
          </UiBadge>
        </template>

        <template #cell-type="{ row }">{{ typeLabel(row.paymentType) || '—' }}</template>

        <template #cell-provider="{ row }">{{ row.paymentProvider }}</template>

        <template #cell-created_at="{ row }">
          <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
        </template>
      </DataTable>
    </UiCardContent>
  </UiCard>
</template>
