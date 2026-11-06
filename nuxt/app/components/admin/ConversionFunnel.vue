<script setup lang="ts">
/**
 * Source `shipany-dir/src/routes/admin/-conversion-funnel.tsx`.
 *
 * Signup → checkout → paid, sliced by one of seven traffic dimensions. The
 * layout, the range switcher, the seven filter selects, the "clear filters"
 * escape hatch and the breakdown table are all the source's.
 *
 * The data side is honest about what this build records: `analytics_event`
 * does not exist here, so `/api/admin/analytics/funnel` answers an empty
 * report and the section renders the source's own `admin.analytics.empty`
 * row. Nothing is faked — the cards read zero because no event was ever
 * written, which is what the source shows before its first visit.
 */
import { CreditCard, RefreshCw, ShoppingCart, UserPlus, X } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const RANGES = ['24h', '7d', '30d'] as const
type Range = (typeof RANGES)[number]

const DIMENSIONS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'referrer',
  'country',
] as const
type Dimension = (typeof DIMENSIONS)[number]

interface Counts {
  signups: number
  checkouts: number
  paid: number
}
interface FunnelReport {
  since: string
  totals: Counts
  groupBy: Dimension
  rows: (Counts & { value: string })[]
  options: Record<Dimension, string[]>
}

/** Select values cannot be `''` — sentinels for "no filter" and "untagged". */
const ANY = '__any__'
const NONE = '__none__'

const { t } = useSettingsI18n()

const range = ref<Range>('7d')
const groupBy = ref<Dimension>('utm_source')
const filters = ref<Partial<Record<Dimension, string>>>({})

const api = useAdminApi()

const params = computed(() => {
  const search = new URLSearchParams({ range: range.value, groupBy: groupBy.value })
  for (const [dim, value] of Object.entries(filters.value)) {
    if (value !== undefined) search.set(dim, value)
  }
  return search.toString()
})

// A fresh key per query, so switching range or dimension re-fetches the same
// way the source's `queryKey` does. `useAsyncData` keeps the previous payload
// on screen while the new one is in flight — the source's `keepPreviousData`.
const { data, refresh, status } = await useAsyncData<FunnelReport | null>(
  'admin-funnel',
  () => api.get<FunnelReport>(`/api/admin/analytics/funnel?${params.value}`),
  { watch: [params], default: () => null },
)

const report = computed(() => data.value)
const totals = computed(() => report.value?.totals ?? { signups: 0, checkouts: 0, paid: 0 })
const hasFilters = computed(() => Object.keys(filters.value).length > 0)
const untagged = computed(() => t('admin.analytics.untagged'))
const pending = computed(() => status.value === 'pending')
const fetching = computed(() => status.value === 'pending')

function rate(part: number, whole: number) {
  if (!whole) return '—'
  return `${((part / whole) * 100).toFixed(1)}%`
}

function dimLabel(dim: Dimension) {
  return dim === 'referrer'
    ? t('admin.analytics.dim_referrer')
    : dim === 'country'
      ? t('admin.analytics.dim_country')
      : dim
}

function setFilter(dim: Dimension, value: string | undefined) {
  const next = { ...filters.value }
  if (value === undefined) delete next[dim]
  else next[dim] = value
  filters.value = next
}

function clearFilters() {
  filters.value = {}
}

function rangeLabel(r: Range) {
  return r === '24h'
    ? t('admin.analytics.range_24h')
    : r === '7d'
      ? t('admin.analytics.range_7d')
      : t('admin.analytics.range_30d')
}

/** The options for one dimension, keeping an active value that fell out of the list. */
function dimensionOptions(dim: Dimension) {
  const options = report.value?.options?.[dim] ?? []
  const current = filters.value[dim]
  return current !== undefined && !options.includes(current) ? [current, ...options] : options
}

function selectItems(dim: Dimension) {
  return [
    { value: ANY, label: `${dimLabel(dim)}: ${t('admin.analytics.any')}` },
    ...dimensionOptions(dim).map((v) => ({
      value: v || NONE,
      label: `${dimLabel(dim)}: ${v || untagged.value}`,
    })),
  ]
}

function selectValue(dim: Dimension) {
  const current = filters.value[dim]
  return current === undefined ? ANY : current || NONE
}

function selectText(dim: Dimension) {
  const current = filters.value[dim]
  return current === undefined
    ? `${dimLabel(dim)}: ${t('admin.analytics.any')}`
    : `${dimLabel(dim)}: ${current || untagged.value}`
}

function onSelect(dim: Dimension, value: string) {
  setFilter(dim, !value || value === ANY ? undefined : value === NONE ? '' : String(value))
}

const steps = computed(() => [
  {
    label: t('admin.analytics.signups'),
    value: totals.value.signups,
    hint: '',
    icon: UserPlus,
  },
  {
    label: t('admin.analytics.checkouts'),
    value: totals.value.checkouts,
    hint: t('admin.analytics.of_signups', { rate: rate(totals.value.checkouts, totals.value.signups) }),
    icon: ShoppingCart,
  },
  {
    label: t('admin.analytics.paid'),
    value: totals.value.paid,
    hint: `${t('admin.analytics.of_checkouts', { rate: rate(totals.value.paid, totals.value.checkouts) })} · ${t(
      'admin.analytics.of_signups',
      { rate: rate(totals.value.paid, totals.value.signups) },
    )}`,
    icon: CreditCard,
  },
])
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold">{{ t('admin.analytics.title') }}</h2>
        <p class="text-muted-foreground text-sm">{{ t('admin.analytics.description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="bg-muted inline-flex rounded-lg p-1">
          <button
            v-for="r in RANGES"
            :key="r"
            type="button"
            :class="
              cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                range === r
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )
            "
            @click="range = r"
          >
            {{ rangeLabel(r) }}
          </button>
        </div>
        <UiButton variant="outline" size="icon" :aria-label="t('admin.analytics.refresh')" @click="refresh()">
          <RefreshCw :class="cn('size-4', fetching && 'animate-spin')" />
        </UiButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiSelect
        v-for="dim in DIMENSIONS"
        :key="dim"
        :model-value="selectValue(dim)"
        @update:model-value="(v: string) => onSelect(dim, v)"
      >
        <UiSelectTrigger :class="cn('max-w-60', filters[dim] !== undefined && 'border-primary')">
          <UiSelectValue :text="selectText(dim)" />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem v-for="item in selectItems(dim)" :key="item.value" :value="item.value">
            {{ item.label }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>
      <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters">
        <X class="size-4" />
        {{ t('admin.analytics.clear_filters') }}
      </UiButton>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <template v-if="pending && !report">
        <UiCard v-for="i in 3" :key="i" aria-hidden="true">
          <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <UiSkeleton class="h-3.5 w-16" />
            <UiSkeleton class="size-4 rounded" />
          </UiCardHeader>
          <UiCardContent class="space-y-2">
            <UiSkeleton class="h-7 w-20" />
            <UiSkeleton class="h-3 w-28" />
          </UiCardContent>
        </UiCard>
      </template>
      <template v-else>
        <UiCard v-for="step in steps" :key="step.label">
          <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <UiCardTitle class="text-sm font-medium">{{ step.label }}</UiCardTitle>
            <component :is="step.icon" class="text-muted-foreground size-4" />
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold tabular-nums">{{ step.value.toLocaleString() }}</div>
            <p v-if="step.hint" class="text-muted-foreground mt-1 text-xs">{{ step.hint }}</p>
          </UiCardContent>
        </UiCard>
      </template>
    </div>

    <UiCard>
      <UiCardHeader class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <UiCardTitle class="text-base">{{ t('admin.analytics.breakdown') }}</UiCardTitle>
        <UiSelect
          :model-value="groupBy"
          @update:model-value="(v: string) => v && (groupBy = v as Dimension)"
        >
          <UiSelectTrigger>
            <UiSelectValue :text="`${t('admin.analytics.group_by')}: ${dimLabel(groupBy)}`" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="d in DIMENSIONS" :key="d" :value="d">
              {{ `${t('admin.analytics.group_by')}: ${dimLabel(d)}` }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </UiCardHeader>
      <UiCardContent>
        <div class="overflow-x-auto">
          <UiTable>
            <UiTableHeader>
              <UiTableRow>
                <UiTableHead>{{ dimLabel(groupBy) }}</UiTableHead>
                <UiTableHead class="text-right">{{ t('admin.analytics.signups') }}</UiTableHead>
                <UiTableHead class="text-right">{{ t('admin.analytics.checkouts') }}</UiTableHead>
                <UiTableHead class="text-right">{{ t('admin.analytics.checkout_rate') }}</UiTableHead>
                <UiTableHead class="text-right">{{ t('admin.analytics.paid') }}</UiTableHead>
                <UiTableHead class="text-right">{{ t('admin.analytics.paid_rate') }}</UiTableHead>
              </UiTableRow>
            </UiTableHeader>
            <UiTableBody :class="cn(fetching && 'opacity-60 transition-opacity')">
              <UiTableRow v-for="row in report?.rows ?? []" :key="row.value">
                <UiTableCell class="max-w-80">
                  <button
                    type="button"
                    class="hover:text-primary truncate text-left underline-offset-4 hover:underline"
                    :title="t('admin.analytics.filter_by_value')"
                    @click="setFilter(groupBy, row.value)"
                  >
                    {{ row.value || '' }}
                    <span v-if="!row.value" class="text-muted-foreground">{{ untagged }}</span>
                  </button>
                </UiTableCell>
                <UiTableCell class="text-right tabular-nums">{{ row.signups }}</UiTableCell>
                <UiTableCell class="text-right tabular-nums">{{ row.checkouts }}</UiTableCell>
                <UiTableCell class="text-muted-foreground text-right tabular-nums">
                  {{ rate(row.checkouts, row.signups) }}
                </UiTableCell>
                <UiTableCell class="text-right tabular-nums">{{ row.paid }}</UiTableCell>
                <UiTableCell class="text-muted-foreground text-right tabular-nums">
                  {{ rate(row.paid, row.signups) }}
                </UiTableCell>
              </UiTableRow>
              <UiTableRow v-if="report && report.rows.length === 0">
                <UiTableCell colspan="6" class="text-muted-foreground h-24 text-center">
                  <p>{{ t('admin.analytics.empty') }}</p>
                  <p class="mt-1 text-xs">{{ t('admin.analytics.empty_hint') }}</p>
                </UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
        </div>
        <p class="text-muted-foreground mt-4 text-xs">{{ t('admin.analytics.footnote') }}</p>
      </UiCardContent>
    </UiCard>
  </section>
</template>
