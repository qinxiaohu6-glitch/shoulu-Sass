<script setup lang="ts">
/**
 * /admin/categories — source `shipany-dir/src/routes/admin/-categories-page.tsx`.
 *
 * Six columns (slug / title / description / status / created / actions), a
 * create dialog, an edit dialog and a delete confirmation. No tabs, no toolbar.
 *
 * This is the *content* taxonomy — the source stores it in `taxonomy` with
 * `type = 'category'`. This build ships no blog, so there is no taxonomy table:
 * the list is the source's own empty state and all three writes say why nothing
 * happened. `/admin/directory/categories` is the other one and still edits
 * `dir_category`.
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { type DataColumn } from '~/utils/ui'
import {
  CATEGORIES_PAGE_SIZE,
  emptyCategoryForm,
  isCategoryFormValid,
  type AdminCategory,
  type CategoryForm,
} from '~/utils/admin-categories-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')

const createOpen = ref(false)
const creating = ref(false)
const createForm = ref<CategoryForm>(emptyCategoryForm())

const editing = ref<AdminCategory | null>(null)
const saving = ref(false)
const editForm = ref<CategoryForm>(emptyCategoryForm())

const deleting = ref<AdminCategory | null>(null)
const removing = ref(false)

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
  pageQuery('/api/admin/categories', {
    page: page.value,
    pageSize: CATEGORIES_PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminCategory[]; total: number }>(
  'admin-categories',
  () => api.get<{ items: AdminCategory[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'slug', header: t('admin.categories.slug_col') },
  { key: 'title', header: t('admin.categories.title_col') },
  { key: 'description', header: t('admin.categories.description_col') },
  { key: 'status', header: t('admin.categories.status_col') },
  { key: 'created', header: t('admin.categories.created_at') },
  { key: 'actions', header: t('admin.categories.actions_col'), class: 'w-[80px]' },
])

function onCreateToggle(open: boolean) {
  createOpen.value = open
  // The source resets the form on open, so a cancelled draft does not come back.
  if (open) createForm.value = emptyCategoryForm()
}

function openEdit(row: AdminCategory) {
  editing.value = row
  editForm.value = {
    slug: row.slug,
    title: row.title,
    description: row.description || '',
  }
}

async function submitCreate() {
  if (!isCategoryFormValid(createForm.value)) {
    toast.error(t('admin.categories.invalid_input'))
    return
  }
  creating.value = true
  try {
    await api.post('/api/admin/categories', {
      slug: createForm.value.slug.trim(),
      title: createForm.value.title.trim(),
      description: createForm.value.description.trim(),
    })
    toast.success(t('admin.categories.created'))
    createOpen.value = false
    createForm.value = emptyCategoryForm()
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    creating.value = false
  }
}

async function submitEdit() {
  const row = editing.value
  if (!row) return
  if (!isCategoryFormValid(editForm.value)) {
    toast.error(t('admin.categories.invalid_input'))
    return
  }
  saving.value = true
  try {
    await api.put('/api/admin/categories', {
      id: row.id,
      slug: editForm.value.slug.trim(),
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim(),
    })
    toast.success(t('admin.categories.updated'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const row = deleting.value
  if (!row) return
  removing.value = true
  try {
    await api.del(pageQuery('/api/admin/categories', { id: row.id }))
    toast.success(t('admin.categories.deleted'))
    deleting.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.categories.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.categories.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="onCreateToggle(true)">
        <Plus class="size-4" />
        {{ t('admin.categories.create') }}
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
          :page-size="CATEGORIES_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.categories.no_data')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-slug="{ row }">
            <span class="font-mono text-sm">{{ row.slug }}</span>
          </template>

          <template #cell-title="{ row }">
            <span class="font-medium">{{ row.title }}</span>
          </template>

          <template #cell-description="{ row }">
            <span class="text-muted-foreground block max-w-[200px] truncate text-sm">
              {{ row.description || '—' }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="row.status === 'published' ? 'default' : 'secondary'">
              {{ row.status }}
            </UiBadge>
          </template>

          <template #cell-created="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="deleting = row">
                <Trash2 class="size-3" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <!-- Create -->
    <UiDialog :open="createOpen" @update:open="onCreateToggle">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.categories.create_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.categories.create_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitCreate">
          <div class="space-y-4 py-4">
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.slug_field') }}</UiLabel>
              <UiInput
                v-model="createForm.slug"
                :placeholder="t('admin.categories.slug_placeholder')"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.title_field') }}</UiLabel>
              <UiInput
                v-model="createForm.title"
                :placeholder="t('admin.categories.title_placeholder')"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.description_field') }}</UiLabel>
              <UiInput
                v-model="createForm.description"
                :placeholder="t('admin.categories.description_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="onCreateToggle(false)">
              {{ t('admin.categories.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="creating">
              {{ t('admin.categories.save') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Edit -->
    <UiDialog :open="!!editing" @update:open="(v: boolean) => !v && !saving && (editing = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.categories.edit_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.categories.edit_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitEdit">
          <div class="space-y-4 py-4">
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.slug_field') }}</UiLabel>
              <UiInput
                v-model="editForm.slug"
                :placeholder="t('admin.categories.slug_placeholder')"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.title_field') }}</UiLabel>
              <UiInput
                v-model="editForm.title"
                :placeholder="t('admin.categories.title_placeholder')"
              />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.categories.description_field') }}</UiLabel>
              <UiInput
                v-model="editForm.description"
                :placeholder="t('admin.categories.description_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="editing = null">
              {{ t('admin.categories.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">
              {{ t('admin.categories.save') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete -->
    <UiDialog :open="!!deleting" @update:open="(v: boolean) => !v && !removing && (deleting = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.categories.delete_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.categories.delete_confirm') }}</UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter>
          <UiButton variant="outline" @click="deleting = null">
            {{ t('admin.categories.cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="removing" @click="confirmDelete">
            {{ t('admin.categories.confirm_delete') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
