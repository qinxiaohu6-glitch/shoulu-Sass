<script setup lang="ts">
/**
 * /admin/permissions — source `shipany-dir/src/routes/admin/permissions.tsx`.
 *
 * Five columns, search, and create / edit / delete dialogs with four fields
 * each. The source blocks a submit that fails its own guards without printing
 * anything, and this port keeps that: an incomplete form simply does not
 * submit. Every write then refuses for the same reason the list is empty —
 * this build has no permission catalogue and checks no per-permission rules
 * (`server/utils/admin.ts` gates the console with one token).
 */
definePageMeta({ layout: 'admin' })

import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'
import {
  emptyPermissionForm,
  isPermissionFormValid,
  PERMISSIONS_PAGE_SIZE,
  type PermissionForm,
  type PermissionRow,
} from '~/utils/admin-permissions-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')

const createOpen = ref(false)
const form = ref<PermissionForm>(emptyPermissionForm())
const creating = ref(false)

const editingPerm = ref<PermissionRow | null>(null)
const editForm = ref<PermissionForm>(emptyPermissionForm())
const savingEdit = ref(false)

const deletingPerm = ref<PermissionRow | null>(null)
const deleting = ref(false)

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
  pageQuery('/api/admin/permissions', {
    page: page.value,
    pageSize: PERMISSIONS_PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: PermissionRow[]; total: number }>(
  'admin-permissions',
  () => api.get<{ items: PermissionRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')
const saving = computed(() => creating.value || savingEdit.value)

const columns = computed<DataColumn[]>(() => [
  { key: 'code', header: t('admin.permissions.code_col') },
  { key: 'resource', header: t('admin.permissions.resource_col') },
  { key: 'action', header: t('admin.permissions.action_col') },
  { key: 'title', header: t('admin.permissions.title_col') },
  { key: 'actions', header: t('admin.permissions.actions_col'), class: 'w-[80px]' },
])

function openCreate() {
  form.value = emptyPermissionForm()
  createOpen.value = true
}

function onCreateToggle(open: boolean) {
  createOpen.value = open
  if (!open) form.value = emptyPermissionForm()
}

async function handleCreate() {
  if (!isPermissionFormValid(form.value)) return
  creating.value = true
  try {
    await api.post('/api/admin/permissions', form.value)
    toast.success(t('admin.permissions.created'))
    createOpen.value = false
    form.value = emptyPermissionForm()
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    creating.value = false
  }
}

function openEdit(permission: PermissionRow) {
  editForm.value = {
    code: permission.code,
    resource: permission.resource,
    action: permission.action,
    title: permission.title,
  }
  editingPerm.value = permission
}

async function handleEdit() {
  const permission = editingPerm.value
  if (!permission || !isPermissionFormValid(editForm.value, false)) return
  savingEdit.value = true
  try {
    await api.put('/api/admin/permissions', { id: permission.id, ...editForm.value })
    toast.success(t('admin.permissions.updated'))
    editingPerm.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    savingEdit.value = false
  }
}

async function handleDelete() {
  const permission = deletingPerm.value
  if (!permission) return
  deleting.value = true
  try {
    await api.del(`/api/admin/permissions?id=${encodeURIComponent(permission.id)}`)
    toast.success(t('admin.permissions.deleted'))
    deletingPerm.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.permissions.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.permissions.description') }}</p>
      </div>
      <UiButton class="gap-1.5" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.permissions.create_permission') }}
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
          :page-size="PERMISSIONS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.permissions.no_permissions')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-code="{ row }">
            <span class="font-mono text-sm">{{ row.code }}</span>
          </template>

          <template #cell-resource="{ row }">
            <span class="font-medium">{{ row.resource }}</span>
          </template>

          <template #cell-action="{ row }">{{ row.action }}</template>

          <template #cell-title="{ row }">
            <span class="text-muted-foreground">{{ row.title }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="deletingPerm = row">
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
          <UiDialogTitle>{{ t('admin.permissions.create_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.permissions.create_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form class="grid gap-4" @submit.prevent.stop="handleCreate">
          <div class="space-y-4 py-4">
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.code_field') }}</UiLabel>
              <UiInput v-model="form.code" :placeholder="t('admin.permissions.code_placeholder')" />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.resource_field') }}</UiLabel>
              <UiInput
                v-model="form.resource"
                :placeholder="t('admin.permissions.resource_placeholder')"
              />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.action_field') }}</UiLabel>
              <UiInput
                v-model="form.action"
                :placeholder="t('admin.permissions.action_placeholder')"
              />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.title_field') }}</UiLabel>
              <UiInput v-model="form.title" :placeholder="t('admin.permissions.title_placeholder')" />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="onCreateToggle(false)">
              {{ t('admin.permissions.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">{{ t('admin.permissions.save') }}</UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Edit -->
    <UiDialog :open="!!editingPerm" @update:open="(v: boolean) => !v && (editingPerm = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.permissions.edit_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.permissions.edit_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form class="grid gap-4" @submit.prevent.stop="handleEdit">
          <div class="space-y-4 py-4">
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.code_field') }}</UiLabel>
              <UiInput v-model="editForm.code" :placeholder="t('admin.permissions.code_placeholder')" />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.resource_field') }}</UiLabel>
              <UiInput
                v-model="editForm.resource"
                :placeholder="t('admin.permissions.resource_placeholder')"
              />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.action_field') }}</UiLabel>
              <UiInput
                v-model="editForm.action"
                :placeholder="t('admin.permissions.action_placeholder')"
              />
            </div>
            <div class="space-y-2">
              <UiLabel>{{ t('admin.permissions.title_field') }}</UiLabel>
              <UiInput
                v-model="editForm.title"
                :placeholder="t('admin.permissions.title_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="editingPerm = null">
              {{ t('admin.permissions.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">{{ t('admin.permissions.save') }}</UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete -->
    <UiDialog :open="!!deletingPerm" @update:open="(v: boolean) => !v && (deletingPerm = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.permissions.delete_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.permissions.delete_confirm') }}</UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter>
          <UiButton variant="outline" @click="deletingPerm = null">
            {{ t('admin.permissions.cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="deleting" @click="handleDelete">
            {{ t('admin.permissions.confirm_delete') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
