<script setup lang="ts">
/**
 * Source `routes/admin/-user-credits.tsx` — this user's credit ledger.
 *
 * Nine columns, a status filter, a transaction-type filter, debounced search
 * and server-side paging. Nothing in this build is metered, so the endpoint
 * always answers with an empty page and the card renders the source's own
 * "No credits" state; the code is the source's so the day a ledger exists the
 * card needs no change.
 */
import { cn, type DataColumn } from '~/utils/ui'
import {
  CREDITS_PAGE_SIZE,
  CREDIT_STATUSES,
  CREDIT_TYPES,
  type AdminCreditRow,
} from '~/utils/admin-user-detail-ui'

const props = defineProps<{ userId: string }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const status = ref('all')
const transactionType = ref('all')
const search = ref('')
const debouncedSearch = ref('')

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([status, transactionType, debouncedSearch], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/credits', {
    userId: props.userId,
    page: page.value,
    pageSize: CREDITS_PAGE_SIZE,
    // The endpoint defaults to active records; 'all' lifts that filter.
    status: status.value,
    transactionType: transactionType.value === 'all' ? undefined : transactionType.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminCreditRow[]; total: number }>(
  `admin-user-credits-${props.userId}`,
  () => api.get<{ items: AdminCreditRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const statusText = computed(() =>
  status.value === 'all'
    ? t('admin.user_detail.status_all')
    : t(`admin.user_detail.credit_status_${status.value}`),
)
const typeText = computed(() =>
  transactionType.value === 'all'
    ? t('admin.user_detail.type_all')
    : t(`admin.user_detail.tab_${transactionType.value}`),
)

const columns = computed<DataColumn[]>(() => [
  { key: 'transaction_no', header: t('admin.credits.transaction_no') },
  { key: 'amount', header: t('admin.credits.amount') },
  { key: 'remaining', header: t('admin.credits.remaining') },
  { key: 'status', header: t('admin.payments.status') },
  { key: 'type', header: t('admin.credits.type') },
  { key: 'scene', header: t('admin.credits.scene') },
  { key: 'description', header: t('admin.credits.description') },
  { key: 'expires_at', header: t('admin.credits.expires_at') },
  { key: 'created_at', header: t('admin.credits.created_at') },
])
</script>

<template>
  <UiCard>
    <UiCardHeader>
      <UiCardTitle>{{ t('admin.user_detail.credits_title') }}</UiCardTitle>
    </UiCardHeader>
    <UiCardContent>
      <DataTable
        v-model:page="page"
        v-model:search="search"
        :columns="columns"
        :rows="rows"
        :total="total"
        :page-size="CREDITS_PAGE_SIZE"
        :loading="loading"
        :empty-text="t('admin.credits.no_credits')"
        :search-placeholder="t('admin.user_detail.credit_search')"
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
                <UiSelectItem v-for="s in CREDIT_STATUSES" :key="s" :value="s">
                  {{ t(`admin.user_detail.credit_status_${s}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>

            <UiSelect v-model="transactionType">
              <UiSelectTrigger class="h-9 w-[130px]">
                <UiSelectValue :text="typeText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">{{ t('admin.user_detail.type_all') }}</UiSelectItem>
                <UiSelectItem v-for="type in CREDIT_TYPES" :key="type" :value="type">
                  {{ t(`admin.user_detail.tab_${type}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </template>

        <template #cell-transaction_no="{ row }">
          <span class="font-mono text-xs">{{ row.transactionNo }}</span>
        </template>

        <template #cell-amount="{ row }">
          <span
            :class="
              cn('font-medium tabular-nums', row.credits > 0 ? 'text-green-600' : 'text-red-500')
            "
          >
            {{ row.credits > 0 ? `+${row.credits}` : row.credits }}
          </span>
        </template>

        <template #cell-remaining="{ row }">
          {{ row.transactionType === 'grant' ? row.remainingCredits : '—' }}
        </template>

        <template #cell-status="{ row }">
          <UiBadge :variant="row.status === 'active' ? 'default' : 'secondary'">
            {{ t(`admin.user_detail.credit_status_${row.status}`) }}
          </UiBadge>
        </template>

        <template #cell-type="{ row }">{{ t(`admin.user_detail.tab_${row.transactionType}`) }}</template>

        <template #cell-scene="{ row }">{{ row.transactionScene || '—' }}</template>

        <template #cell-description="{ row }">
          <span class="text-muted-foreground block max-w-[240px] truncate text-sm">
            {{ row.description || '—' }}
          </span>
        </template>

        <template #cell-expires_at="{ row }">
          <span class="text-muted-foreground text-sm">
            {{ row.expiresAt ? formatDateTime(row.expiresAt) : '—' }}
          </span>
        </template>

        <template #cell-created_at="{ row }">
          <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
        </template>
      </DataTable>
    </UiCardContent>
  </UiCard>
</template>
