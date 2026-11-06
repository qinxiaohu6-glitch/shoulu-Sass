<script setup lang="ts">
/**
 * /admin/credits — source `shipany-dir/src/routes/admin/credits.tsx`.
 *
 * Three tabs (`all` / `grant` / `consume` → `?transactionType=`), nine columns,
 * search and refresh. No row actions, no dialogs.
 *
 * The ledger is empty in this build: nothing is metered, so there is no grant
 * path and no consume path. The endpoint answers with the source's own empty
 * table rather than inventing rows.
 */
definePageMeta({ layout: 'admin' })

import { cn, type DataColumn } from '~/utils/ui'
import {
  ADMIN_CREDITS_PAGE_SIZE,
  CREDITS_TABS,
  creditAmountClass,
  type AdminCreditListRow,
  type CreditsTab,
} from '~/utils/admin-credits-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''

const page = ref(1)
const tab = ref<CreditsTab>('all')
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
  pageQuery('/api/admin/credits', {
    page: page.value,
    pageSize: ADMIN_CREDITS_PAGE_SIZE,
    transactionType: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{
  items: AdminCreditListRow[]
  total: number
}>('admin-credits', () => api.get<{ items: AdminCreditListRow[]; total: number }>(listParams.value), {
  watch: [listParams],
  default: () => ({ items: [], total: 0 }),
})

const credits = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

/**
 * The source's subtitle reuses `admin.credits.description`, which is also the
 * "Description" column header — the two read the same there, so they read the
 * same here instead of being quietly reworded.
 */
const columns = computed<DataColumn[]>(() => [
  { key: 'transaction_no', header: t('admin.credits.transaction_no') },
  { key: 'user', header: t('admin.credits.user') },
  { key: 'amount', header: t('admin.credits.amount') },
  { key: 'remaining', header: t('admin.credits.remaining') },
  { key: 'type', header: t('admin.credits.type') },
  { key: 'scene', header: t('admin.credits.scene') },
  { key: 'description', header: t('admin.credits.description') },
  { key: 'expires', header: t('admin.credits.expires_at') },
  { key: 'created', header: t('admin.credits.created_at') },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.credits.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.credits.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in CREDITS_TABS"
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
        {{ t(`admin.credits.tab_${tb}`) }}
      </button>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          v-model:page="page"
          v-model:search="search"
          :columns="columns"
          :rows="credits"
          :total="total"
          :page-size="ADMIN_CREDITS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.credits.no_credits')"
          :search-placeholder="t('admin.credits.search_placeholder')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-transaction_no="{ row }">
            <span class="font-mono text-xs">{{ row.transactionNo }}</span>
          </template>

          <template #cell-user="{ row }">
            <AdminUserCell
              :user-id="row.userId"
              :name="row.userName"
              :email="row.userEmail"
              :image="row.userImage"
            />
          </template>

          <template #cell-amount="{ row }">
            <span :class="cn('font-medium', creditAmountClass(row.credits))">
              {{ row.credits > 0 ? `+${row.credits}` : row.credits }}
            </span>
          </template>

          <template #cell-remaining="{ row }">
            {{ row.remainingCredits }}
          </template>

          <template #cell-type="{ row }">
            {{ row.transactionType }}
          </template>

          <template #cell-scene="{ row }">
            {{ row.transactionScene || '—' }}
          </template>

          <template #cell-description="{ row }">
            <span class="text-muted-foreground block max-w-[200px] truncate text-sm">
              {{ row.description || '—' }}
            </span>
          </template>

          <template #cell-expires="{ row }">
            <span class="text-muted-foreground text-sm">
              {{ row.expiresAt ? formatDateTime(row.expiresAt) : '—' }}
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
