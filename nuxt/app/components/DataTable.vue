<script setup lang="ts">
/**
 * Source `components/data-table.tsx`.
 *
 * The source builds react-table column defs from a `Column<T>[]` whose `cell` is
 * a render function. Vue cannot pass a function that returns markup from a
 * template, so columns are declared as data (`key` / `header` / `class`) and the
 * cell body comes from a scoped slot named after the column key:
 *
 *   <DataTable :columns="cols" :rows="rows" ...>
 *     <template #cell-created="{ row }">{{ row.createdAt }}</template>
 *   </DataTable>
 *
 * Everything else — server-side pagination driven entirely by `page`/`total`,
 * the debounce-free search box, the refresh button's spin state, the skeleton
 * rows, the empty row and the footer count — is the source's behaviour.
 */
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-vue-next'
import type { DataColumn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    columns: DataColumn[]
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any --
       rows come from a dozen different server shapes; the column list is the
       only contract, and the cell slots type themselves at the call site. */
    rows: any[]
    total: number
    page: number
    pageSize: number
    search?: string
    searchPlaceholder?: string
    emptyText?: string
    loading?: boolean
    skeletonRowCount?: number
    showRefresh?: boolean
    /** Rendered by the caller's `#toolbar`; kept for the header's presence check. */
    hasToolbar?: boolean
  }>(),
  { skeletonRowCount: 5, showRefresh: false, hasToolbar: false },
)

const emit = defineEmits<{
  'update:page': [number]
  'update:search': [string]
  refresh: []
}>()

const { t } = useSettingsI18n()

const refreshing = ref(false)
const busy = computed(() => refreshing.value || !!props.loading)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const initialLoading = computed(() => !!props.loading && props.rows.length === 0)
const showHeader = computed(() => props.search !== undefined || props.hasToolbar || props.showRefresh)

async function onRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    emit('refresh')
    // The parent owns the fetch; this only keeps the icon spinning long enough
    // to read. The source awaited the query refetch here.
    await new Promise((r) => setTimeout(r, 400))
  } finally {
    refreshing.value = false
  }
}

function cellSlot(key: string) {
  return `cell-${key}`
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="showHeader" class="flex flex-wrap items-center gap-2">
      <div v-if="props.search !== undefined" class="relative max-w-sm">
        <Search class="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <UiInput
          :model-value="props.search"
          :placeholder="props.searchPlaceholder || t('common.search.placeholder')"
          class="h-9 pl-8"
          @update:model-value="(v: any) => emit('update:search', String(v ?? ''))"
        />
      </div>
      <slot name="toolbar" />
      <UiButton
        v-if="props.showRefresh"
        variant="outline"
        size="icon"
        class="ml-auto size-9"
        :disabled="busy"
        :aria-label="t('common.table.refresh')"
        @click="onRefresh"
      >
        <RefreshCw class="size-4" :class="busy && 'animate-spin'" />
      </UiButton>
    </div>

    <div class="overflow-x-auto">
      <UiTable>
        <UiTableHeader>
          <UiTableRow>
            <UiTableHead v-for="col in props.columns" :key="col.key" :class="col.class">
              {{ col.header }}
            </UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <template v-if="props.loading">
            <UiTableRow v-for="r in props.skeletonRowCount" :key="`skeleton-${r}`">
              <UiTableCell v-for="col in props.columns" :key="`skeleton-${r}-${col.key}`" :class="col.class">
                <UiSkeleton class="h-4 w-4/5" />
              </UiTableCell>
            </UiTableRow>
          </template>
          <UiTableRow v-else-if="props.rows.length === 0">
            <UiTableCell :colspan="props.columns.length" class="py-8 text-center text-muted-foreground">
              {{ props.emptyText || t('common.table.no_data') }}
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-for="(row, i) in props.rows" v-else :key="String(row.id ?? i)">
            <UiTableCell v-for="col in props.columns" :key="`${i}-${col.key}`" :class="col.class">
              <slot :name="cellSlot(col.key)" :row="row">{{ row[col.key] }}</slot>
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </div>

    <div class="flex items-center justify-between px-2">
      <p class="text-sm text-muted-foreground">
        {{ initialLoading ? '' : t('common.table.total', { count: props.total }) }}
      </p>
      <div v-if="props.total > props.pageSize" class="flex flex-wrap items-center gap-2">
        <UiButton variant="outline" size="sm" :disabled="props.page <= 1" @click="emit('update:page', props.page - 1)">
          <ChevronLeft class="size-4" />
          {{ t('common.table.previous') }}
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          :disabled="props.page >= totalPages"
          @click="emit('update:page', props.page + 1)"
        >
          {{ t('common.table.next') }}
          <ChevronRight class="size-4" />
        </UiButton>
      </div>
    </div>
  </div>
</template>
