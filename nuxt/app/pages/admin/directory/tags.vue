<script setup lang="ts">
/**
 * /admin/directory/tags — source `shipany-dir/src/routes/admin/directory/tags.tsx`.
 *
 * Five columns (slug, name with its Chinese name underneath, listing count,
 * created, actions), a 300 ms debounced search that resets to page 1, a create
 * drawer and an edit drawer whose slug field is locked, and a delete that asks
 * first with the count of listings it is about to detach.
 *
 * Two deliberate differences from the source, both forced by this build's data
 * model and both visible in the UI rather than hidden:
 *
 *  - `createdAt` is `dir_tag.updated_at`. The table has no separate creation
 *    timestamp; the first write and every later edit share one column, so the
 *    list shows "last touched", which is what an operator sorting by recency
 *    actually wants.
 *  - Deleting a tag that ships with the built-in catalogue is refused by the
 *    API with a bilingual reason and toasted. The source allows it because its
 *    tags are pure rows; here they are re-derived from `catalog.json`, so a
 *    delete would undo itself on the next read.
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'

interface DirTag {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  toolCount: number
  createdAt: number
}

interface FormValues {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
}

const PAGE_SIZE = 20

const { t } = useSettingsI18n()
const api = useAdminApi()
const { confirm, open: confirmOpen, options: confirmOptions, settle, labels } = useConfirm()

const emptyForm = (): FormValues => ({ slug: '', name: '', description: '', nameZh: '', descriptionZh: '' })

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const createOpen = ref(false)
const editing = ref<DirTag | null>(null)
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
  pageQuery('/api/admin/directory/tags', {
    page: page.value,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status, refresh } = await useAsyncData<{ items: DirTag[]; total: number }>(
  'admin-dir-tags',
  () => api.get<{ items: DirTag[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => status.value === 'pending')

const createForm = ref<FormValues>(emptyForm())
const editForm = ref<FormValues>(emptyForm())

function valuesFromTag(row: DirTag): FormValues {
  return {
    slug: row.slug || '',
    name: row.name || '',
    description: row.description || '',
    nameZh: row.nameZh || '',
    descriptionZh: row.descriptionZh || '',
  }
}

/** Always send the descriptions, `''` included, so clearing them reaches the API. */
function toPayload(value: FormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    description: value.description.trim(),
    nameZh: value.nameZh.trim(),
    descriptionZh: value.descriptionZh.trim(),
  }
}

function toEditPayload(value: FormValues) {
  const { slug: _slug, ...rest } = toPayload(value)
  return rest
}

function openCreate() {
  createForm.value = emptyForm()
  formError.value = ''
  createOpen.value = true
}

function openEdit(row: DirTag) {
  editForm.value = valuesFromTag(row)
  formError.value = ''
  editing.value = row
}

async function submitCreate() {
  const value = createForm.value
  if (!value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.post('/api/admin/directory/tags', toPayload(value))
    toast.success(t('admin.directory.tags.created'))
    createOpen.value = false
    createForm.value = emptyForm()
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
  const value = editForm.value
  if (!value.name.trim()) {
    formError.value = t('admin.directory.common.name') + ' *'
    return
  }
  formError.value = ''
  saving.value = true
  try {
    await api.put('/api/admin/directory/tags', { id: row.id, ...toEditPayload(value) })
    toast.success(t('admin.directory.tags.updated'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: DirTag) {
  const ok = await confirm({
    title: t('admin.directory.tags.delete_title'),
    description: t('admin.directory.tags.delete_confirm', { count: row.toolCount || 0 }),
    confirmLabel: t('admin.directory.common.delete'),
    destructive: true,
  })
  if (!ok) return
  try {
    await api.del(pageQuery('/api/admin/directory/tags', { id: row.id }))
    toast.success(t('admin.directory.tags.deleted'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

const columns = computed<DataColumn[]>(() => [
  { key: 'slug', header: t('admin.directory.common.slug') },
  { key: 'name', header: t('admin.directory.common.name') },
  { key: 'tools', header: t('admin.directory.tags.tools') },
  { key: 'created_at', header: t('admin.directory.common.created_at') },
  { key: 'actions', header: t('admin.directory.common.actions'), class: 'w-[80px]' },
])

/** Field name for the active tab of the locale switcher. */
function localeName(locale: 'en' | 'zh') {
  return locale === 'en' ? 'name' : 'nameZh'
}
function localeDescription(locale: 'en' | 'zh') {
  return locale === 'en' ? 'description' : 'descriptionZh'
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.directory.tags.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.directory.tags.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.directory.tags.create') }}
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
          :empty-text="t('admin.directory.tags.empty')"
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

          <template #cell-created_at="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
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

    <!-- Create -->
    <DirectoryFormDrawer
      :open="createOpen"
      :title="t('admin.directory.tags.create_title')"
      @update:open="(v: boolean) => (createOpen = v)"
    >
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitCreate">
        <DirectoryFormBody>
          <DirectoryTextField
            v-model="createForm.slug"
            :label="t('admin.directory.common.slug')"
            placeholder="agent"
          />
          <DirectoryLocaleSection v-slot="{ locale }">
            <DirectoryTextField
              :model-value="createForm[localeName(locale)]"
              :label="t('admin.directory.common.name')"
              :placeholder="locale === 'en' ? 'Agent' : '智能体'"
              @update:model-value="(v: string) => (createForm[localeName(locale)] = v)"
            />
            <DirectoryTextField
              :model-value="createForm[localeDescription(locale)]"
              :label="t('admin.directory.common.description')"
              @update:model-value="(v: string) => (createForm[localeDescription(locale)] = v)"
            />
          </DirectoryLocaleSection>
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

    <!-- Edit -->
    <DirectoryFormDrawer
      :open="!!editing"
      :title="t('admin.directory.tags.edit_title')"
      @update:open="(v: boolean) => !v && (editing = null)"
    >
      <form v-if="editing" class="flex min-h-0 flex-1 flex-col" @submit.prevent.stop="submitEdit">
        <DirectoryFormBody>
          <DirectoryTextField
            v-model="editForm.slug"
            :label="t('admin.directory.common.slug')"
            disabled
          />
          <p class="text-muted-foreground text-xs">{{ t('admin.directory.common.slug_locked_hint') }}</p>
          <DirectoryLocaleSection v-slot="{ locale }">
            <DirectoryTextField
              :model-value="editForm[localeName(locale)]"
              :label="t('admin.directory.common.name')"
              @update:model-value="(v: string) => (editForm[localeName(locale)] = v)"
            />
            <DirectoryTextField
              :model-value="editForm[localeDescription(locale)]"
              :label="t('admin.directory.common.description')"
              @update:model-value="(v: string) => (editForm[localeDescription(locale)] = v)"
            />
          </DirectoryLocaleSection>
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
