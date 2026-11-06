<script setup lang="ts">
/**
 * /admin/directory/ads — source
 * `shipany-dir/src/routes/admin/directory/ads.tsx`.
 *
 * The sponsor-placement queue: four status tabs, four columns, and an edit
 * drawer that only touches the creative fields.
 *
 * There is no "new ad" button, and that is the source's design — a placement is
 * created by paying for it, not by an operator typing one in. What the console
 * does is curate the copy, take a live campaign down, and remove a dead record.
 *
 * Row actions:
 *   any row      → Edit
 *   `active`     → Force take down (confirmed) → `expired`
 *   not `active` → Delete (confirmed)
 *
 * This build's `ads` table is the weekly-placement model, not the source's
 * sponsor-ad table, so `tier` / `status` / the two dates are mapped in
 * `server/utils/admin-directory.ts` and the page above only sees the source's
 * vocabulary.
 */
definePageMeta({ layout: 'admin' })

import { Ban, Pencil, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import {
  AD_TABS,
  canDeleteAd,
  canForceExpireAd,
  PAGE_SIZE,
  valuesFromAd,
  type AdFormValues,
  type AdTab,
  type DirAd,
} from '~/utils/admin-ads-ui'
import { faviconUrlForWebsite } from '~/utils/admin-tools-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const { confirm, open: confirmOpen, options: confirmOptions, settle, labels } = useConfirm()

const page = ref(1)
const tab = ref<AdTab>('all')
const search = ref('')
const debouncedSearch = ref('')
const editing = ref<DirAd | null>(null)
const saving = ref(false)
const formError = ref('')

const editForm = ref<AdFormValues>(valuesFromAd({
  id: '',
  name: '',
  tagline: '',
  url: '',
  iconUrl: '',
  tier: 'board',
  status: 'active',
  startsAt: null,
  endsAt: null,
  createdAt: '',
}))

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})
// Source: `useEffect(() => setPage(1), [debouncedSearch, tab])`.
watch([debouncedSearch, tab], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/directory/ads', {
    page: page.value,
    pageSize: PAGE_SIZE,
    status: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status, refresh } = await useAsyncData<{ items: DirAd[]; total: number }>(
  'admin-dir-ads',
  () => api.get<{ items: DirAd[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

function openEdit(row: DirAd) {
  editForm.value = valuesFromAd(row)
  formError.value = ''
  editing.value = row
}

async function submitEdit() {
  const row = editing.value
  if (!row) return
  // Source zod: `name` and `url` are `.min(1)`; the other two are free text.
  if (!editForm.value.name.trim()) {
    formError.value = t('admin.directory.ads.col_name') + ' *'
    return
  }
  if (!editForm.value.url.trim()) {
    formError.value = t('admin.directory.ads.url') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    // Billing fields are locked in the UI and ignored by the API.
    await api.put('/api/admin/directory/ads', {
      id: row.id,
      name: editForm.value.name.trim(),
      tagline: editForm.value.tagline.trim(),
      url: editForm.value.url.trim(),
      iconUrl: editForm.value.iconUrl.trim(),
    })
    toast.success(t('admin.directory.ads.updated'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function forceExpire(row: DirAd) {
  const ok = await confirm({
    title: t('admin.directory.ads.force_expire_title'),
    description: t('admin.directory.ads.force_expire_confirm'),
    confirmLabel: t('admin.directory.ads.force_expire'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.put('/api/admin/directory/ads', { id: row.id, forceExpire: true })
    toast.success(t('admin.directory.ads.force_expired'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDelete(row: DirAd) {
  const ok = await confirm({
    title: t('admin.directory.ads.delete_title'),
    description: t('admin.directory.ads.delete_confirm'),
    confirmLabel: t('admin.directory.common.delete'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.del(pageQuery('/api/admin/directory/ads', { id: row.id }))
    toast.success(t('admin.directory.ads.deleted'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

const columns = computed<DataColumn[]>(() => [
  { key: 'name', header: t('admin.directory.ads.col_name') },
  { key: 'tier', header: t('admin.directory.ads.col_tier') },
  { key: 'status', header: t('admin.directory.common.status') },
  { key: 'period', header: t('admin.directory.ads.col_period'), class: 'hidden md:table-cell' },
  { key: 'actions', header: t('admin.directory.common.actions'), class: 'w-[110px]' },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.directory.ads.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.directory.ads.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in AD_TABS"
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
        {{ t(`admin.directory.ads.tab_${tb}`) }}
      </button>
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
          :empty-text="t('admin.directory.ads.empty')"
          :search-placeholder="t('admin.directory.common.search')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-name="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <SettingsListIcon
                :src="logoSrc(row.iconUrl) || faviconUrlForWebsite(row.url)"
                :alt="row.name"
                :size="28"
              />
              <div class="min-w-0">
                <p class="truncate font-medium">{{ row.name }}</p>
                <p class="text-muted-foreground truncate text-xs">{{ row.url }}</p>
              </div>
            </div>
          </template>

          <template #cell-tier="{ row }">
            <UiBadge variant="secondary">{{ t(`admin.directory.tier_${row.tier}`) }}</UiBadge>
          </template>

          <template #cell-status="{ row }">
            <UiBadge
              :variant="row.status === 'active' ? 'default' : row.status === 'expired' ? 'secondary' : 'outline'"
            >
              {{ t(`admin.directory.status_${row.status}`) }}
            </UiBadge>
          </template>

          <template #cell-period="{ row }">
            <span class="text-muted-foreground text-xs">
              {{ row.startsAt ? formatDateTime(row.startsAt) : '—' }}
              {{ ' → ' }}
              {{ row.endsAt ? formatDateTime(row.endsAt) : '—' }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton
                v-if="canForceExpireAd(row.status)"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="t('admin.directory.ads.force_expire')"
                @click="forceExpire(row)"
              >
                <Ban class="size-3" />
              </UiButton>
              <UiButton
                v-if="canDeleteAd(row.status)"
                variant="ghost"
                size="icon"
                class="size-7"
                @click="handleDelete(row)"
              >
                <Trash2 class="size-3" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <DirectoryFormDrawer
      :open="!!editing"
      :title="t('admin.directory.ads.edit_title')"
      @update:open="(v: boolean) => !v && (editing = null)"
    >
      <form v-if="editing" class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitEdit">
        <DirectoryFormBody>
          <DirectoryAdFields :form="editForm" />
          <p v-if="formError" class="text-destructive text-sm">{{ formError }}</p>
          <template #actions>
            <UiButton type="button" variant="outline" @click="editing = null">
              {{ t('admin.directory.common.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">{{ t('admin.directory.common.save') }}</UiButton>
          </template>
        </DirectoryFormBody>
      </form>
    </DirectoryFormDrawer>

    <ConfirmDialog
      :open="confirmOpen"
      :title="confirmOptions?.title ?? ''"
      :description="confirmOptions?.description"
      :confirm-label="labels.confirmLabel"
      :cancel-label="labels.cancelLabel"
      :destructive="confirmOptions?.destructive"
      @confirm="settle(true)"
      @cancel="settle(false)"
    />
  </div>
</template>
