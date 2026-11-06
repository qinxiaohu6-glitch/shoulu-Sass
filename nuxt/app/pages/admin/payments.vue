<script setup lang="ts">
/**
 * /admin/payments — source `shipany-dir/src/routes/admin/payments.tsx`.
 *
 * Three tabs (`all` / `subscription` / `one_time`), a status filter in the
 * table toolbar, eight columns and two row actions (refund when the order is
 * `paid` or `refunding`, edit always).
 *
 * `?search=` prefills the box because payment notifications deep-link here.
 *
 * Data notes: this build's `payment_order` has no subscription and no credit
 * grant, so the subscription tab is answered with an empty list (see
 * `server/api/admin/orders/list.get.ts`) and the refund dialog's "also cancel
 * the subscription" row stays hidden. Both writes report why nothing happened
 * instead of pretending to succeed.
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Undo2 } from 'lucide-vue-next'
import { cn, type DataColumn } from '~/utils/ui'
import { formatOrderAmount } from '~/utils/admin-user-detail-ui'
import {
  PAYMENTS_PAGE_SIZE,
  PAYMENT_STATUSES,
  PAYMENT_TABS,
  paymentStatusVariant,
  type AdminOrder,
  type PaymentTab,
} from '~/utils/admin-payments-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''

const page = ref(1)
const tab = ref<PaymentTab>('all')
const search = ref(initialSearch)
const debouncedSearch = ref(initialSearch)
const statusFilter = ref('all')

const editingOrder = ref<AdminOrder | null>(null)
const refundingOrder = ref<AdminOrder | null>(null)

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([tab, statusFilter, debouncedSearch], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/orders/list', {
    page: page.value,
    pageSize: PAYMENTS_PAGE_SIZE,
    paymentType:
      tab.value === 'subscription' ? 'subscription' : tab.value === 'one_time' ? 'one_time' : undefined,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminOrder[]; total: number }>(
  'admin-payments',
  () => api.get<{ items: AdminOrder[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const orders = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const statusText = computed(() =>
  statusFilter.value === 'all' ? t('admin.payments.tab_all') : t(`admin.payments.status_${statusFilter.value}`),
)

const columns = computed<DataColumn[]>(() => [
  { key: 'order_no', header: t('admin.payments.order_no') },
  { key: 'user', header: t('admin.payments.user') },
  { key: 'amount', header: t('admin.payments.amount') },
  { key: 'status', header: t('admin.payments.status') },
  { key: 'type', header: t('admin.payments.type') },
  { key: 'provider', header: t('admin.payments.provider') },
  { key: 'created', header: t('admin.payments.created_at') },
  { key: 'actions', header: '', class: 'w-[88px]' },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.payments.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.payments.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in PAYMENT_TABS"
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
        {{ t(`admin.payments.tab_${tb}`) }}
      </button>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          v-model:page="page"
          v-model:search="search"
          :columns="columns"
          :rows="orders"
          :total="total"
          :page-size="PAYMENTS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.payments.no_payments')"
          :search-placeholder="t('admin.payments.search_placeholder')"
          has-toolbar
          show-refresh
          @refresh="refresh"
        >
          <template #toolbar>
            <UiSelect v-model="statusFilter">
              <UiSelectTrigger class="h-8 w-[120px]">
                <UiSelectValue :text="statusText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">{{ t('admin.payments.tab_all') }}</UiSelectItem>
                <UiSelectItem v-for="s in PAYMENT_STATUSES" :key="s" :value="s">
                  {{ t(`admin.payments.status_${s}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </template>

          <template #cell-order_no="{ row }">
            <span class="font-mono text-xs">{{ row.orderNo }}</span>
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
            <div class="flex flex-col">
              <span class="font-medium">{{ formatOrderAmount(row.amount, row.currency) }}</span>
              <span v-if="row.refundAmount != null" class="text-muted-foreground text-xs">
                {{
                  t('admin.payments.refunded_amount', {
                    amount: formatOrderAmount(row.refundAmount, row.currency),
                  })
                }}
              </span>
            </div>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="paymentStatusVariant(row.status)">
              {{ t(`admin.payments.status_${row.status}`) }}
            </UiBadge>
          </template>

          <template #cell-type="{ row }">
            {{ row.paymentType || '—' }}
          </template>

          <template #cell-provider="{ row }">
            {{ row.paymentProvider }}
          </template>

          <template #cell-created="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center gap-1">
              <UiButton
                v-if="row.status === 'paid' || row.status === 'refunding'"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="t('admin.payments.refund')"
                :aria-label="t('admin.payments.refund')"
                @click="refundingOrder = row"
              >
                <Undo2 class="size-4" />
              </UiButton>
              <UiButton
                variant="ghost"
                size="icon"
                class="size-7"
                :aria-label="t('admin.payments.edit_title')"
                @click="editingOrder = row"
              >
                <Pencil class="size-4" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <AdminEditOrderDialog
      :order="editingOrder"
      @close="editingOrder = null"
      @changed="refresh"
    />
    <AdminRefundOrderDialog
      :order="refundingOrder"
      @close="refundingOrder = null"
      @changed="refresh"
    />
  </div>
</template>
