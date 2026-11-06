<script setup lang="ts">
/**
 * /admin/directory/collections — source
 * `shipany-dir/src/routes/admin/directory/collections.tsx`.
 *
 * Seven columns; the "Tools" cell is a button that opens the manage-tools
 * drawer, and there is a second entry point for it in the actions column — the
 * source puts both there because the count is the thing you notice and the
 * icon is the thing you look for.
 *
 * Collections have no catalogue fallback, so unlike categories and tags a delete
 * really removes the rows and every membership link with them.
 */
definePageMeta({ layout: 'admin' })

import { ListTree, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'
import {
  emptyCollectionForm,
  toCollectionEditPayload,
  toCollectionPayload,
  valuesFromCollection,
  type CollectionFormValues,
  type DirCollection,
  type ToolOption,
} from '~/utils/admin-collections-ui'

const PAGE_SIZE = 20

const { t } = useSettingsI18n()
const api = useAdminApi()
const { confirm, open: confirmOpen, options: confirmOptions, settle, labels } = useConfirm()

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const createOpen = ref(false)
const editing = ref<DirCollection | null>(null)
const managingTools = ref<DirCollection | null>(null)
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
  pageQuery('/api/admin/directory/collections', {
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status, refresh } = await useAsyncData<{ items: DirCollection[]; total: number }>(
  'admin-dir-collections',
  () => api.get<{ items: DirCollection[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

/**
 * The tool pool is fetched when the drawer opens, not with the page: the
 * console's first paint has no reason to carry every listing, and the source
 * gates the query the same way (`enabled: !!managingTools`).
 */
const tools = ref<ToolOption[]>([])
const toolsLoading = ref(false)

async function loadTools() {
  toolsLoading.value = true
  try {
    const result = await api.get<{ items: ToolOption[] }>('/api/admin/directory/tools?all=true')
    tools.value = result.items ?? []
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    toolsLoading.value = false
  }
}

function openTools(row: DirCollection) {
  managingTools.value = row
  void loadTools()
}

const createForm = ref<CollectionFormValues>(emptyCollectionForm())
const editForm = ref<CollectionFormValues>(emptyCollectionForm())

function openCreate() {
  createForm.value = emptyCollectionForm()
  formError.value = ''
  createOpen.value = true
}

function openEdit(row: DirCollection) {
  editForm.value = valuesFromCollection(row)
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
    await api.post('/api/admin/directory/collections', toCollectionPayload(createForm.value))
    toast.success(t('admin.directory.collections.created'))
    createOpen.value = false
    createForm.value = emptyCollectionForm()
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
    await api.put('/api/admin/directory/collections', { id: row.id, ...toCollectionEditPayload(editForm.value) })
    toast.success(t('admin.directory.collections.updated'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: DirCollection) {
  const ok = await confirm({
    title: t('admin.directory.collections.delete_title'),
    description: t('admin.directory.collections.delete_confirm', { count: row.toolCount || 0 }),
    confirmLabel: t('admin.directory.common.delete'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.del(pageQuery('/api/admin/directory/collections', { id: row.id }))
    toast.success(t('admin.directory.collections.deleted'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

const columns = computed<DataColumn[]>(() => [
  { key: 'slug', header: t('admin.directory.common.slug') },
  { key: 'name', header: t('admin.directory.common.name') },
  { key: 'tools', header: t('admin.directory.collections.tools') },
  { key: 'sort', header: t('admin.directory.collections.sort') },
  { key: 'status', header: t('admin.directory.common.status') },
  { key: 'created_at', header: t('admin.directory.common.created_at') },
  { key: 'actions', header: t('admin.directory.common.actions'), class: 'w-[110px]' },
])
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.directory.collections.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.directory.collections.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.directory.collections.create') }}
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
          :empty-text="t('admin.directory.collections.empty')"
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
            <UiButton
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 px-2 tabular-nums"
              @click="openTools(row)"
            >
              {{ row.toolCount }}
            </UiButton>
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
              <UiButton
                variant="ghost"
                size="icon"
                class="size-7"
                :title="t('admin.directory.collections.manage_tools')"
                @click="openTools(row)"
              >
                <ListTree class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="handleDelete(row)">
                <Trash2 class="size-3" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <DirectoryFormDrawer
      :open="createOpen"
      :title="t('admin.directory.collections.create_title')"
      @update:open="(v: boolean) => (createOpen = v)"
    >
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitCreate">
        <DirectoryFormBody>
          <DirectoryCollectionFields :form="createForm" />
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
      :title="t('admin.directory.collections.edit_title')"
      @update:open="(v: boolean) => !v && (editing = null)"
    >
      <form v-if="editing" class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitEdit">
        <DirectoryFormBody>
          <DirectoryCollectionFields :form="editForm" lock-slug />
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

    <DirectoryCollectionToolsDrawer
      :collection="managingTools"
      :tools="tools"
      :tools-loading="toolsLoading"
      @close="managingTools = null"
      @saved="refresh()"
    />

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
