<script setup lang="ts">
/**
 * /admin/directory/categories — source
 * `shipany-dir/src/routes/admin/directory/categories.tsx`.
 *
 * Seven columns (slug, name + Chinese name, listing count, sort, status badge,
 * created, actions), the same 300 ms debounced search, and two drawers that
 * share one field set (`DirectoryCategoryFields`).
 *
 * The trash icon only exists on a row with no listings, and the API refuses the
 * delete anyway — both come from the source, where a category with tools cannot
 * be removed because those tools would be orphaned.
 *
 * `createdAt` is `dir_category.updated_at`: the table has no separate creation
 * timestamp, so the column shows when the row was last touched.
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'
import {
  emptyCategoryForm,
  toCategoryEditPayload,
  toCategoryPayload,
  valuesFromCategory,
  type DirCategory,
  type DirectoryFormValues,
} from '~/utils/admin-directory-ui'

const PAGE_SIZE = 20

const { t } = useSettingsI18n()
const api = useAdminApi()
const { confirm, open: confirmOpen, options: confirmOptions, settle, labels } = useConfirm()

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const createOpen = ref(false)
const editing = ref<DirCategory | null>(null)
const saving = ref(false)
const formError = ref('')

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})
watch(debouncedSearch, () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/directory/categories', {
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status, refresh } = await useAsyncData<{ items: DirCategory[]; total: number }>(
  'admin-dir-categories',
  () => api.get<{ items: DirCategory[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

const createForm = ref<DirectoryFormValues>(emptyCategoryForm())
const editForm = ref<DirectoryFormValues>(emptyCategoryForm())

function openCreate() {
  createForm.value = emptyCategoryForm()
  formError.value = ''
  createOpen.value = true
}

function openEdit(row: DirCategory) {
  editForm.value = valuesFromCategory(row)
  formError.value = ''
  editing.value = row
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.post('/api/admin/directory/categories', toCategoryPayload(createForm.value))
    toast.success(t('admin.directory.categories.created'))
    createOpen.value = false
    createForm.value = emptyCategoryForm()
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function submitEdit() {
  const row = editing.value
  if (!row) return
  if (!editForm.value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.put('/api/admin/directory/categories', { id: row.id, ...toCategoryEditPayload(editForm.value) })
    toast.success(t('admin.directory.categories.updated'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: DirCategory) {
  if ((row.toolCount || 0) > 0) {
    toast.error(t('admin.directory.categories.delete_blocked', { count: row.toolCount }))
    return
  }
  const ok = await confirm({
    title: t('admin.directory.categories.delete_title'),
    description: t('admin.directory.categories.delete_confirm'),
    confirmLabel: t('admin.directory.common.delete'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.del(pageQuery('/api/admin/directory/categories', { id: row.id }))
    toast.success(t('admin.directory.categories.deleted'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

const columns = computed<DataColumn[]>(() => [
  { key: 'slug', header: t('admin.directory.common.slug') },
  { key: 'name', header: t('admin.directory.common.name') },
  { key: 'tools', header: t('admin.directory.categories.tools') },
  { key: 'sort', header: t('admin.directory.categories.sort') },
  { key: 'status', header: t('admin.directory.common.status') },
  { key: 'created_at', header: t('admin.directory.common.created_at') },
  { key: 'actions', header: t('admin.directory.common.actions'), class: 'w-[80px]' },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.directory.categories.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.directory.categories.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.directory.categories.create') }}
      </UiButton>
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
          :empty-text="t('admin.directory.categories.empty')"
          :search-placeholder="t('admin.directory.common.search')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-slug="{ row }">
            <span class="font-mono text-sm">{{ row.slug }}</span>
          </template>

          <template #cell-name="{ row }">
            <div class="min-w-0">
              <p class="truncate font-medium">{{ row.name }}</p>
              <p v-if="row.nameZh" class="text-muted-foreground truncate text-xs">{{ row.nameZh }}</p>
            </div>
          </template>

          <template #cell-tools="{ row }">
            <span class="text-sm tabular-nums">{{ row.toolCount ?? 0 }}</span>
          </template>

          <template #cell-sort="{ row }">
            <span class="text-sm">{{ row.sort }}</span>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="row.status === 'published' ? 'default' : 'secondary'">
              {{ t(`admin.directory.status_${row.status}`) }}
            </UiBadge>
          </template>

          <template #cell-created_at="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton
                v-if="(row.toolCount || 0) === 0"
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
      :title="t('admin.directory.categories.create_title')"
      @update:open="(v: boolean) => (createOpen = v)"
    >
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitCreate">
        <DirectoryFormBody>
          <DirectoryCategoryFields :form="createForm" />
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
      :open="!!editing"
      :title="t('admin.directory.categories.edit_title')"
      @update:open="(v: boolean) => !v && (editing = null)"
    >
      <form v-if="editing" class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitEdit">
        <DirectoryFormBody>
          <DirectoryCategoryFields
            :form="editForm"
            lock-slug
            :disable-draft="(editing.toolCount || 0) > 0"
          />
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
