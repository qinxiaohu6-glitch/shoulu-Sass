<script setup lang="ts">
/**
 * /admin/users — source `shipany-dir/src/routes/admin/users.tsx`.
 *
 * Eight columns, a 300 ms debounced search, and a UTM-source filter in the
 * table toolbar. `?search=` and `?utm_source=` prefill both — they are the deep
 * links other admin pages use to land here already filtered.
 *
 * What a "user" is in this build: there is no user table (Google is the identity
 * provider and the session is a signed cookie), so a row is one distinct `sub`
 * that has submitted a listing or opened a ticket. That is the same headcount
 * `/admin`'s first card reports, and the reason the Credits / Roles / Password
 * dialogs have nothing to write: `server/utils/admin-users.ts` and the four
 * endpoints under `server/api/admin/{users,roles}` document each gap.
 */
definePageMeta({ layout: 'admin' })

import { Coins, Eye, KeyRound, MoreHorizontal, Shield } from 'lucide-vue-next'
import { cn, type DataColumn } from '~/utils/ui'
import {
  ANY,
  NONE,
  PAGE_SIZE,
  type AdminUser,
  type SourceOption,
} from '~/utils/admin-users-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

/** `validateSearch`: empty `utm_source` is meaningful (untagged), so it is kept. */
const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''
const initialSource = typeof route.query.utm_source === 'string' ? route.query.utm_source : undefined

const page = ref(1)
const search = ref(initialSearch)
const debouncedSearch = ref(initialSearch)
/** `undefined` = any source; `''` = untagged (direct) sign-ups. */
const source = ref<string | undefined>(initialSource)

const managingUser = ref<AdminUser | null>(null)
const passwordUser = ref<AdminUser | null>(null)
const creditsUser = ref<AdminUser | null>(null)

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})
watch([debouncedSearch, source], () => {
  page.value = 1
})

const listParams = computed(() => {
  const base = pageQuery('/api/admin/users', {
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value,
  })
  return source.value === undefined ? base : `${base}&utm_source=${encodeURIComponent(source.value)}`
})

const { data, status, refresh } = await useAsyncData<{ items: AdminUser[]; total: number }>(
  'admin-users',
  () => api.get<{ items: AdminUser[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

/** Source: `staleTime: 5 * 60_000` — the option list is not refetched on every visit. */
const { data: sourceOptions } = await useAsyncData<SourceOption[]>(
  'admin-users-sources',
  async () => (await api.get<{ items: SourceOption[] }>('/api/admin/users/sources')).items,
  { default: () => [] },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

const sourceTitle = computed(() => t('admin.users.source_col'))
const untagged = computed(() => t('admin.users.source_none'))

const sourceItems = computed(() => [
  { value: ANY, label: `${sourceTitle.value}: ${t('admin.analytics.any')}` },
  // Keep the active value selectable even if it is not a top value.
  ...(source.value !== undefined && !sourceOptions.value.some((o) => o.value === source.value)
    ? [{ value: source.value || NONE, label: `${sourceTitle.value}: ${source.value || untagged.value}` }]
    : []),
  ...sourceOptions.value.map((o) => ({
    value: o.value || NONE,
    label: `${sourceTitle.value}: ${o.value || untagged.value} (${o.count})`,
  })),
])

const sourceValue = computed(() => (source.value === undefined ? ANY : source.value || NONE))
const sourceText = computed(
  () => sourceItems.value.find((item) => item.value === sourceValue.value)?.label ?? '',
)

function onSourceChange(value: unknown) {
  const next = String(value ?? '')
  source.value = !next || next === ANY ? undefined : next === NONE ? '' : next
}

const columns = computed<DataColumn[]>(() => [
  { key: 'id', header: t('admin.users.id_col') },
  { key: 'user', header: t('admin.users.user_col') },
  { key: 'roles', header: t('admin.users.roles_col') },
  { key: 'source', header: t('admin.users.source_col') },
  { key: 'ip', header: t('admin.users.ip_col') },
  { key: 'credits', header: t('admin.users.credits_col'), class: 'w-[120px]' },
  { key: 'joined', header: t('admin.users.joined_col') },
  { key: 'actions', header: t('admin.users.actions_col'), class: 'w-[80px]' },
])
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.users.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.users.description') }}</p>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          v-model:page="page"
          v-model:search="search"
          :columns="columns"
          :rows="rows"
          :total="total"
          :page-size="PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.users.no_users')"
          :search-placeholder="t('admin.users.search_placeholder')"
          has-toolbar
          show-refresh
          @refresh="refresh"
        >
          <template #toolbar>
            <UiSelect :model-value="sourceValue" @update:model-value="onSourceChange">
              <UiSelectTrigger :class="cn('h-9 max-w-60', source !== undefined && 'border-primary')">
                <UiSelectValue :text="sourceText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="item in sourceItems" :key="item.value" :value="item.value">
                  {{ item.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </template>

          <template #cell-id="{ row }">
            <div class="flex items-center gap-1">
              <span class="font-mono text-xs" :title="row.id">{{ row.id.slice(0, 8) }}…</span>
              <AdminCopyButton :value="row.id" />
            </div>
          </template>

          <template #cell-user="{ row }">
            <AdminUserCell
              :user-id="row.id"
              :name="row.name"
              :email="row.email"
              :image="row.image"
              :new-tab="false"
            />
          </template>

          <template #cell-roles="{ row }">
            <div v-if="row.roles.length" class="flex flex-wrap gap-1">
              <UiBadge v-for="r in row.roles" :key="r.name" variant="secondary" :title="r.name">
                {{ r.title }}
              </UiBadge>
            </div>
            <span v-else class="text-muted-foreground">—</span>
          </template>

          <template #cell-source="{ row }">
            <span
              v-if="row.utmSource"
              class="bg-muted inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
            >
              {{ row.utmSource }}
            </span>
            <span v-else class="text-muted-foreground">—</span>
          </template>

          <template #cell-ip="{ row }">
            <span v-if="row.ip" class="text-muted-foreground font-mono text-xs">{{ row.ip }}</span>
            <span v-else class="text-muted-foreground">—</span>
          </template>

          <template #cell-credits="{ row }">
            <span class="font-medium tabular-nums">{{ row.credits.toLocaleString() }}</span>
          </template>

          <template #cell-joined="{ row }">
            <span class="text-muted-foreground">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <UiDropdownMenu>
              <UiDropdownMenuTrigger as-child>
                <UiButton variant="ghost" size="icon" class="size-7">
                  <MoreHorizontal class="size-4" />
                </UiButton>
              </UiDropdownMenuTrigger>
              <UiDropdownMenuContent align="end" class="w-auto min-w-40 whitespace-nowrap">
                <UiDropdownMenuItem @select="navigateTo(`/admin/users/${row.id}`)">
                  <Eye class="size-4" />
                  {{ t('admin.user_detail.view') }}
                </UiDropdownMenuItem>
                <UiDropdownMenuItem @select="creditsUser = row">
                  <Coins class="size-4" />
                  {{ t('admin.users.manage_credits_title') }}
                </UiDropdownMenuItem>
                <UiDropdownMenuItem @select="managingUser = row">
                  <Shield class="size-4" />
                  {{ t('admin.users.manage_roles_title') }}
                </UiDropdownMenuItem>
                <UiDropdownMenuItem @select="passwordUser = row">
                  <KeyRound class="size-4" />
                  {{ t('admin.users.set_password_title') }}
                </UiDropdownMenuItem>
              </UiDropdownMenuContent>
            </UiDropdownMenu>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <AdminManageRolesDialog :user="managingUser" @close="managingUser = null" @changed="refresh()" />
    <AdminSetPasswordDialog :user="passwordUser" @close="passwordUser = null" />
    <AdminManageCreditsDialog :user="creditsUser" @close="creditsUser = null" />
  </div>
</template>
