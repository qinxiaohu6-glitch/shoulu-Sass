<script setup lang="ts">
/**
 * /admin/posts — source `shipany-dir/src/routes/admin/-posts-page.tsx`.
 *
 * Three tabs (`all` / `published` / `draft` → `?status=`), six columns, a create
 * dialog, an edit dialog (which loads the body separately, because the list
 * endpoint omits it) and a delete confirmation.
 *
 * This build has no CMS: `/blog` renders `shared/content/blog.ts`, so the list
 * is the source's own empty state and every write says why nothing happened.
 * The dialogs stay because the page is the source's — including the Tiptap
 * body editor, which `/admin/guest-posts` uses too.
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import {
  emptyPostForm,
  isPostFormValid,
  POST_TABS,
  POSTS_PAGE_SIZE,
  postStatusVariant,
  type AdminPost,
  type CategoryOption,
  type PostForm,
  type PostTab,
} from '~/utils/admin-posts-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const tab = ref<PostTab>('all')
const search = ref('')
const debouncedSearch = ref('')

const createOpen = ref(false)
const creating = ref(false)
const createForm = ref<PostForm>(emptyPostForm())

const editing = ref<AdminPost | null>(null)
const saving = ref(false)
const editForm = ref<PostForm>(emptyPostForm())

const deleting = ref<AdminPost | null>(null)
const removing = ref(false)

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

const { data: categoryOptions } = await useAsyncData<CategoryOption[]>(
  'admin-post-category-options',
  () => api.get<CategoryOption[]>('/api/admin/categories?all=true'),
  { default: () => [] },
)

const listParams = computed(() =>
  pageQuery('/api/admin/posts', {
    page: page.value,
    pageSize: POSTS_PAGE_SIZE,
    status: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminPost[]; total: number }>(
  'admin-posts',
  () => api.get<{ items: AdminPost[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'title', header: t('admin.posts.title_col') },
  { key: 'slug', header: t('admin.posts.slug_col') },
  { key: 'author', header: t('admin.posts.author_col') },
  { key: 'status', header: t('admin.posts.status_col') },
  { key: 'created', header: t('admin.posts.created_at') },
  { key: 'actions', header: t('admin.posts.actions_col'), class: 'w-[80px]' },
])

function onCreateToggle(open: boolean) {
  createOpen.value = open
  if (open) createForm.value = emptyPostForm()
}

/**
 * The list endpoint omits `content`, so the editor loads the body on open. The
 * fetch is allowed to fail quietly: a post that is gone leaves an empty editor
 * rather than a toast over a dialog the operator is about to close.
 */
async function openEdit(row: AdminPost) {
  editForm.value = {
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    content: '',
    categories: row.categories || '',
    authorName: row.authorName || '',
    status: row.status,
  }
  editing.value = row
  try {
    const full = await api.get<AdminPost & { content: string | null }>(
      pageQuery('/api/admin/posts', { id: row.id }),
    )
    if (editing.value?.id === row.id) editForm.value.content = full.content || ''
  } catch {
    // see above — nothing to report
  }
}

async function submitCreate() {
  if (!isPostFormValid(createForm.value)) {
    toast.error(t('admin.posts.invalid_input'))
    return
  }
  creating.value = true
  try {
    await api.post('/api/admin/posts', { ...createForm.value })
    toast.success(t('admin.posts.created'))
    createOpen.value = false
    createForm.value = emptyPostForm()
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
  if (!isPostFormValid(editForm.value)) {
    toast.error(t('admin.posts.invalid_input'))
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = { id: row.id, ...editForm.value }
    // The source omits an empty body so a save does not wipe the stored content.
    if (!body.content) delete body.content
    await api.put('/api/admin/posts', body)
    toast.success(t('admin.posts.updated'))
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
    await api.del(pageQuery('/api/admin/posts', { id: row.id }))
    toast.success(t('admin.posts.deleted'))
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
        <h1 class="text-2xl font-bold">{{ t('admin.posts.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.posts.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="onCreateToggle(true)">
        <Plus class="size-4" />
        {{ t('admin.posts.create') }}
      </UiButton>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in POST_TABS"
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
        {{ t(`admin.posts.tab_${tb}`) }}
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
          :page-size="POSTS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.posts.no_data')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-title="{ row }">
            <span class="font-medium">{{ row.title }}</span>
          </template>

          <template #cell-slug="{ row }">
            <span class="font-mono text-xs">{{ row.slug }}</span>
          </template>

          <template #cell-author="{ row }">
            {{ row.authorName || '—' }}
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="postStatusVariant(row.status)">{{ row.status }}</UiBadge>
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
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.posts.create_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.posts.create_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitCreate">
          <AdminPostFields :form="createForm" :categories="categoryOptions ?? []" />
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="onCreateToggle(false)">
              {{ t('admin.posts.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="creating">
              {{ t('admin.posts.save') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Edit -->
    <UiDialog :open="!!editing" @update:open="(v: boolean) => !v && !saving && (editing = null)">
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.posts.edit_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.posts.edit_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitEdit">
          <AdminPostFields :form="editForm" :categories="categoryOptions ?? []" />
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="editing = null">
              {{ t('admin.posts.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">
              {{ t('admin.posts.save') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete -->
    <UiDialog :open="!!deleting" @update:open="(v: boolean) => !v && !removing && (deleting = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.posts.delete_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.posts.delete_confirm') }}</UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter>
          <UiButton variant="outline" @click="deleting = null">
            {{ t('admin.posts.cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="removing" @click="confirmDelete">
            {{ t('admin.posts.confirm_delete') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
