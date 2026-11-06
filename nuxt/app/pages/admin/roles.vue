<script setup lang="ts">
/**
 * /admin/roles — source `shipany-dir/src/routes/admin/-roles-page.tsx`.
 *
 * Four columns, search, and four dialogs (create, edit, delete, manage
 * permissions). Every dialog and every column is the source's; the writes all
 * refuse because this build has no roles table and no capability model — one
 * admin token gates the whole console (`server/utils/admin.ts`). The list is
 * the source's own "No roles defined yet" state.
 */
definePageMeta({ layout: 'admin' })

import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'
import {
  emptyRoleForm,
  isRoleFormValid,
  ROLES_PAGE_SIZE,
  type Permission,
  type Role,
  type RoleForm,
} from '~/utils/admin-roles-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')

const createOpen = ref(false)
const createForm = ref<RoleForm>(emptyRoleForm())
const creating = ref(false)

const editingRole = ref<Role | null>(null)
const editForm = ref<RoleForm>(emptyRoleForm())
const saving = ref(false)

const deletingRole = ref<Role | null>(null)
const deleting = ref(false)

const permRole = ref<Role | null>(null)
const allPermissions = ref<Permission[]>([])
const assignedPermIds = ref<Set<string>>(new Set())
const savingPermissions = ref(false)

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
  pageQuery('/api/admin/roles', {
    page: page.value,
    pageSize: ROLES_PAGE_SIZE,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: Role[]; total: number }>(
  'admin-roles',
  () => api.get<{ items: Role[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'name', header: t('admin.roles.name_col') },
  { key: 'title', header: t('admin.roles.title_col') },
  { key: 'description', header: t('admin.roles.description_col') },
  { key: 'actions', header: t('admin.roles.actions_col'), class: 'w-[120px]' },
])

function openCreate() {
  createForm.value = emptyRoleForm()
  createOpen.value = true
}

function onCreateToggle(open: boolean) {
  createOpen.value = open
  if (open) createForm.value = emptyRoleForm()
}

async function submitCreate() {
  if (!isRoleFormValid(createForm.value)) {
    toast.error(t('admin.roles.invalid_input'))
    return
  }
  creating.value = true
  try {
    await api.post('/api/admin/roles', createForm.value)
    toast.success(t('admin.roles.created'))
    createOpen.value = false
    createForm.value = emptyRoleForm()
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    creating.value = false
  }
}

function openEdit(role: Role) {
  editForm.value = {
    name: role.name,
    title: role.title,
    description: role.description || '',
  }
  editingRole.value = role
}

async function submitEdit() {
  const role = editingRole.value
  if (!role) return
  if (!isRoleFormValid(editForm.value)) {
    toast.error(t('admin.roles.invalid_input'))
    return
  }
  saving.value = true
  try {
    await api.put('/api/admin/roles', { id: role.id, ...editForm.value })
    toast.success(t('admin.roles.updated'))
    editingRole.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const role = deletingRole.value
  if (!role) return
  deleting.value = true
  try {
    await api.del(`/api/admin/roles?id=${encodeURIComponent(role.id)}`)
    toast.success(t('admin.roles.deleted'))
    deletingRole.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    deleting.value = false
  }
}

async function openPermissions(role: Role) {
  permRole.value = role
  try {
    const [perms, assigned] = await Promise.all([
      api.get<{ items: Permission[] }>('/api/admin/permissions'),
      api.get<{ items: { permissionId: string }[] }>(
        `/api/admin/roles/permissions?roleId=${encodeURIComponent(role.id)}`,
      ),
    ])
    allPermissions.value = perms.items ?? []
    assignedPermIds.value = new Set((assigned.items ?? []).map((p) => p.permissionId))
  } catch (error) {
    toast.error((error as Error).message)
  }
}

function togglePermission(permissionId: string) {
  const next = new Set(assignedPermIds.value)
  if (next.has(permissionId)) next.delete(permissionId)
  else next.add(permissionId)
  assignedPermIds.value = next
}

async function savePermissions() {
  const role = permRole.value
  if (!role) return
  savingPermissions.value = true
  try {
    await api.put('/api/admin/roles/permissions', {
      roleId: role.id,
      permissionIds: [...assignedPermIds.value],
    })
    toast.success(t('admin.roles.permissions_saved'))
    permRole.value = null
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    savingPermissions.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.roles.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.roles.description') }}</p>
      </div>
      <UiButton class="gap-1.5" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.roles.create_role') }}
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
          :page-size="ROLES_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.roles.no_roles')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-name="{ row }">
            <span class="font-mono text-sm">{{ row.name }}</span>
          </template>

          <template #cell-title="{ row }">
            <span class="font-medium">{{ row.title }}</span>
          </template>

          <template #cell-description="{ row }">
            <span class="text-muted-foreground">{{ row.description || '—' }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex gap-1">
              <UiButton variant="ghost" size="icon" class="size-7" @click="openPermissions(row)">
                <KeyRound class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="openEdit(row)">
                <Pencil class="size-3" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="size-7" @click="deletingRole = row">
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
          <UiDialogTitle>{{ t('admin.roles.create_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.roles.create_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitCreate">
          <div class="space-y-4 py-4">
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.name_field') }}</UiLabel>
              <UiInput v-model="createForm.name" :placeholder="t('admin.roles.name_placeholder')" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.title_field') }}</UiLabel>
              <UiInput v-model="createForm.title" :placeholder="t('admin.roles.title_placeholder')" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.description_field') }}</UiLabel>
              <UiInput
                v-model="createForm.description"
                :placeholder="t('admin.roles.description_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="onCreateToggle(false)">
              {{ t('admin.roles.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="creating">{{ t('admin.roles.save') }}</UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Edit -->
    <UiDialog :open="!!editingRole" @update:open="(v: boolean) => !v && (editingRole = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.roles.edit_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.roles.edit_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitEdit">
          <div class="space-y-4 py-4">
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.name_field') }}</UiLabel>
              <UiInput v-model="editForm.name" :placeholder="t('admin.roles.name_placeholder')" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.title_field') }}</UiLabel>
              <UiInput v-model="editForm.title" :placeholder="t('admin.roles.title_placeholder')" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.roles.description_field') }}</UiLabel>
              <UiInput
                v-model="editForm.description"
                :placeholder="t('admin.roles.description_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="editingRole = null">
              {{ t('admin.roles.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="saving">{{ t('admin.roles.save') }}</UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete -->
    <UiDialog :open="!!deletingRole" @update:open="(v: boolean) => !v && (deletingRole = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.roles.delete_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.roles.delete_confirm') }}</UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter>
          <UiButton variant="outline" @click="deletingRole = null">
            {{ t('admin.roles.cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="deleting" @click="confirmDelete">
            {{ t('admin.roles.confirm_delete') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Permissions -->
    <UiDialog :open="!!permRole" @update:open="(v: boolean) => !v && (permRole = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.roles.manage_permissions_title') }}</UiDialogTitle>
          <UiDialogDescription>
            {{ t('admin.roles.manage_permissions_description') }}
          </UiDialogDescription>
        </UiDialogHeader>
        <form class="grid gap-4" @submit.prevent.stop="savePermissions">
          <div class="max-h-64 space-y-3 overflow-y-auto py-4">
            <label
              v-for="perm in allPermissions"
              :key="perm.id"
              class="flex cursor-pointer items-center gap-3"
            >
              <UiCheckbox
                :model-value="assignedPermIds.has(perm.id)"
                @update:model-value="togglePermission(perm.id)"
              />
              <div>
                <div class="text-sm font-medium">{{ perm.title }}</div>
                <div class="text-muted-foreground font-mono text-xs">{{ perm.code }}</div>
              </div>
            </label>
            <p v-if="allPermissions.length === 0" class="text-muted-foreground py-4 text-center text-sm">
              {{ t('admin.permissions.no_permissions') }}
            </p>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="permRole = null">
              {{ t('admin.roles.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="savingPermissions">
              {{ t('admin.roles.save') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
