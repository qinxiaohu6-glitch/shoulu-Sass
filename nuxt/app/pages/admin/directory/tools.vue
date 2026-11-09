<script setup lang="ts">
/**
 * /admin/directory/tools — source
 * `shipany-dir/src/routes/admin/directory/tools.tsx`.
 *
 * The moderation queue for listings: five status tabs, a debounced search, eight
 * columns (four of which fold away on narrow screens), and the row actions that
 * move a listing between statuses.
 *
 * Row actions, exactly as the source splits them:
 *
 *  - `pending`          → Approve (publish) or Reject (both need no confirm for
 *                         approve; reject asks, because it is destructive)
 *  - any row            → Edit
 *  - `published`        → Force unpublish, confirmed, lands the row in `rejected`
 *  - not `published`    → Delete, confirmed
 *
 * The status API stores `approved` where the console says `published` and
 * `awaiting_payment` where it says `pending_payment`; the mapping lives in
 * `server/utils/admin-directory.ts`, so this page speaks console vocabulary only.
 *
 * Approved submissions are rows on this list too (source `community`). Hiding
 * one, pinning it, or changing its recommend weight writes `tool_overrides`,
 * which is what the public directory reads. The review queue still owns
 * approve / reject of the submission record itself. A hidden row is labeled
 * 「已下架」, not rejected: restore clears `hidden`, and the submission stays
 * approved. Nothing here deletes it or sends a rejection email.
 *
 * The edit drawer does not render its fields until the detail payload for *this*
 * row has arrived (`detail.id === editingId`). Mounting the form against a
 * half-filled object would leave the image uploader and the tag checkboxes
 * showing the previous row's values.
 */
definePageMeta({ layout: 'admin' })

import { Ban, Check, Pencil, Plus, ThumbsDown, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import {
  canDeleteTool,
  canForceUnpublishTool,
  emptyToolForm,
  faviconUrlForWebsite,
  PAGE_SIZE,
  TOOL_TABS,
  toToolEditPayload,
  toToolPayload,
  valuesFromToolDetail,
  type DirOption,
  type DirTool,
  type ToolFormValues,
  type ToolTab,
} from '~/utils/admin-tools-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const { confirm, open: confirmOpen, options: confirmOptions, settle, labels } = useConfirm()

const page = ref(1)
const tab = ref<ToolTab>('all')
const search = ref('')
const debouncedSearch = ref('')
const createOpen = ref(false)
const editingId = ref<string | null>(null)
const detailLoading = ref(false)
const saving = ref(false)
const formError = ref('')

const createForm = ref<ToolFormValues>(emptyToolForm())
const editForm = ref<ToolFormValues>(emptyToolForm())

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
  pageQuery('/api/admin/directory/tools', {
    page: page.value,
    pageSize: PAGE_SIZE,
    status: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status, refresh } = await useAsyncData<{ items: DirTool[]; total: number }>(
  'admin-dir-tools',
  () => api.get<{ items: DirTool[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

/* Option lists: the source runs both queries on mount, unpaged. */
const { data: categoryOptions } = await useAsyncData<DirOption[]>(
  'admin-dir-category-options',
  async () => (await api.get<{ items: DirOption[] }>('/api/admin/directory/categories?all=true')).items,
  { default: () => [] },
)
const { data: tagOptions } = await useAsyncData<DirOption[]>(
  'admin-dir-tag-options',
  async () => (await api.get<{ items: DirOption[] }>('/api/admin/directory/tags?all=true')).items,
  { default: () => [] },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

/* --- create --------------------------------------------------------------- */

function openCreate() {
  createForm.value = emptyToolForm()
  formError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.post('/api/admin/directory/tools', toToolPayload(createForm.value))
    toast.success(t('admin.directory.tools.created'))
    createOpen.value = false
    createForm.value = emptyToolForm()
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

/* --- edit ----------------------------------------------------------------- */

/**
 * The source keeps a `useQuery(['admin-dir-tool', editingId])` and gates the
 * form on `data.id === editingId`. Here the fetch is explicit, and the same
 * guard is `detailId`, so a slow response for row A can never paint row A's
 * values into a drawer the user already re-opened for row B.
 */
const detailId = ref<string | null>(null)

async function openEdit(row: DirTool) {
  // Paint the fields from the row that is already on screen. The drawer used
  // to stay on "加载中..." until a second request's `id` matched, and that
  // request 404'd whenever the slug was past the paged list.
  editingId.value = row.id
  editForm.value = valuesFromToolDetail(row)
  detailId.value = row.id
  formError.value = ''
  detailLoading.value = true
  try {
    const detail = await api.get<Record<string, unknown>>(
      pageQuery('/api/admin/directory/tools', { id: row.id }),
    )
    if (editingId.value !== row.id) return
    editForm.value = valuesFromToolDetail({ ...row, ...detail, id: row.id })
    detailId.value = row.id
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    detailLoading.value = false
  }
}

const editReady = computed(() => !!detailId.value && detailId.value === editingId.value)

async function submitEdit() {
  const id = editingId.value
  if (!id) return
  if (!editForm.value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.put('/api/admin/directory/tools', { id, ...toToolEditPayload(editForm.value) })
    toast.success(t('admin.directory.tools.updated'))
    editingId.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

/* --- row actions ---------------------------------------------------------- */

async function approve(row: DirTool) {
  try {
    await api.put('/api/admin/directory/tools', { id: row.id, status: 'published' })
    toast.success(t('admin.directory.tools.approved'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function reject(row: DirTool) {
  const ok = await confirm({
    title: t('admin.directory.tools.reject_title'),
    description: t('admin.directory.tools.reject_confirm'),
    confirmLabel: t('admin.directory.tools.reject'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.put('/api/admin/directory/tools', { id: row.id, status: 'rejected' })
    toast.success(t('admin.directory.tools.rejected'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function forceUnpublish(row: DirTool) {
  const ok = await confirm({
    title: t('admin.directory.tools.force_unpublish_title'),
    description: t('admin.directory.tools.force_unpublish_confirm'),
    confirmLabel: t('admin.directory.tools.force_unpublish'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.put('/api/admin/directory/tools', { id: row.id, forceUnpublish: true })
    toast.success(t('admin.directory.tools.force_unpublished'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDelete(row: DirTool) {
  const ok = await confirm({
    title: t('admin.directory.tools.delete_title'),
    description: t('admin.directory.tools.delete_confirm'),
    confirmLabel: t('admin.directory.common.delete'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.del(pageQuery('/api/admin/directory/tools', { id: row.id }))
    toast.success(t('admin.directory.tools.deleted'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

/* --- columns -------------------------------------------------------------- */

const columns = computed<DataColumn[]>(() => [
  { key: 'name', header: t('admin.directory.tools.col_name') },
  { key: 'category', header: t('admin.directory.tools.col_category'), class: 'hidden md:table-cell' },
  { key: 'source', header: t('admin.directory.tools.col_source'), class: 'hidden sm:table-cell' },
  { key: 'status', header: t('admin.directory.common.status') },
  { key: 'featured', header: t('admin.directory.tools.col_featured'), class: 'hidden lg:table-cell w-[70px]' },
  { key: 'sort', header: t('admin.directory.tools.sort'), class: 'hidden lg:table-cell w-[70px]' },
  { key: 'created_at', header: t('admin.directory.common.created_at'), class: 'hidden xl:table-cell' },
  { key: 'actions', header: t('admin.directory.common.actions'), class: 'w-[140px]' },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.directory.tools.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.directory.tools.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.directory.tools.create') }}
      </UiButton>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in TOOL_TABS"
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
        {{ t(`admin.directory.tools.tab_${tb}`) }}
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
          :empty-text="t('admin.directory.tools.empty')"
          :search-placeholder="t('admin.directory.common.search')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-name="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <SettingsListIcon
                :src="logoSrc(row.iconUrl) || faviconUrlForWebsite(row.websiteUrl)"
                :alt="row.name"
                :size="28"
              />
              <div class="min-w-0">
                <p class="truncate font-medium">{{ row.name }}</p>
                <p class="text-muted-foreground truncate text-xs">{{ row.slug }}</p>
              </div>
            </div>
          </template>

          <template #cell-category="{ row }">
            <span class="text-sm">{{ row.categoryName || t('admin.directory.tools.no_category') }}</span>
          </template>

          <template #cell-source="{ row }">
            <UiBadge variant="secondary">{{ t(`admin.directory.source_${row.source}`) }}</UiBadge>
          </template>

          <template #cell-status="{ row }">
            <UiBadge
              :variant="row.status === 'published' ? 'default' : row.status === 'pending' ? 'outline' : 'secondary'"
            >
              {{ t(`admin.directory.status_${row.status}`) }}
            </UiBadge>
          </template>

          <template #cell-featured="{ row }">{{ row.featured ? '✓' : '—' }}</template>

          <template #cell-sort="{ row }">
            <span class="text-sm tabular-nums">{{ row.sort }}</span>
          </template>

          <template #cell-created_at="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex flex-wrap gap-1">
              <template v-if="row.status === 'pending' || row.status === 'rejected' || row.status === 'hidden'">
                <UiButton
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  :title="row.status === 'hidden' ? t('admin.directory.tools.restore') : t('admin.directory.tools.approve')"
                  @click="approve(row)"
                >
                  <Check class="size-3.5 text-green-600" />
                </UiButton>
                <UiButton
                  v-if="row.status === 'pending'"
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  :title="t('admin.directory.tools.reject')"
                  @click="reject(row)"
                >
                  <ThumbsDown class="text-destructive size-3.5" />
                </UiButton>
              </template>
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton
                v-if="canForceUnpublishTool(row.status)"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="t('admin.directory.tools.force_unpublish')"
                @click="forceUnpublish(row)"
              >
                <Ban class="size-3" />
              </UiButton>
              <UiButton
                v-if="canDeleteTool(row.status) && row.source !== 'community'"
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
      :open="createOpen"
      :title="t('admin.directory.tools.create_title')"
      @update:open="(v: boolean) => (createOpen = v)"
    >
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitCreate">
        <DirectoryFormBody>
          <DirectoryToolFields
            :form="createForm"
            :categories="categoryOptions"
            :tags="tagOptions"
          />
          <p v-if="formError" class="text-destructive text-sm">{{ formError }}</p>
          <template #actions>
            <UiButton type="button" variant="outline" @click="createOpen = false">
              {{ t('admin.directory.common.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">{{ t('admin.directory.common.save') }}</UiButton>
          </template>
        </DirectoryFormBody>
      </form>
    </DirectoryFormDrawer>

    <DirectoryFormDrawer
      :open="!!editingId"
      :title="t('admin.directory.tools.edit_title')"
      @update:open="(v: boolean) => !v && (editingId = null)"
    >
      <p v-if="!editReady" class="text-muted-foreground px-6 py-8 text-sm">
        {{ t('admin.loading') }}
      </p>
      <form v-else class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitEdit">
        <DirectoryFormBody>
          <DirectoryToolFields
            :form="editForm"
            :categories="categoryOptions"
            :tags="tagOptions"
            lock-meta
          />
          <p v-if="formError" class="text-destructive text-sm">{{ formError }}</p>
          <template #actions>
            <UiButton type="button" variant="outline" @click="editingId = null">
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
