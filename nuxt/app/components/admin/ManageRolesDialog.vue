<script setup lang="ts">
/**
 * Source `routes/admin/-users-dialogs.tsx` — `ManageRolesDialog`.
 *
 * Every role is a checkbox; ticking one assigns it and unticking removes it, so
 * there is no Save button — only Cancel. That is the source's design, and it is
 * why each toggle fires its own request.
 *
 * The role list comes from `GET /api/admin/roles`, which answers empty in this
 * build (no roles table), so the checklist renders the source's own
 * `admin.roles.no_roles` line.
 */
import { toast } from 'vue-sonner'
import type { AdminUser } from '~/utils/admin-users-ui'

const props = defineProps<{ user: AdminUser | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

interface RoleInfo {
  id: string
  name: string
  title: string
}

interface UserRoleInfo {
  roleId: string
  roleName: string
  roleTitle: string
}

const allRoles = ref<RoleInfo[]>([])
const heldRoleIds = ref<string[]>([])
const toggling = ref(false)

watch(
  () => props.user?.id,
  async (id) => {
    allRoles.value = []
    heldRoleIds.value = []
    if (!id) return
    try {
      const [roles, held] = await Promise.all([
        api.get<{ items: RoleInfo[] }>('/api/admin/roles'),
        api.get<{ items: UserRoleInfo[] }>(pageQuery('/api/admin/roles', { userId: id })),
      ])
      allRoles.value = roles.items ?? []
      heldRoleIds.value = (held.items ?? []).map((role) => role.roleId)
    } catch (error) {
      toast.error((error as Error).message)
    }
  },
  { immediate: true },
)

async function toggleRole(roleId: string) {
  const user = props.user
  if (!user || toggling.value) return
  toggling.value = true
  try {
    if (heldRoleIds.value.includes(roleId)) {
      await api.del(pageQuery('/api/admin/roles/assign', { userId: user.id, roleId }))
      toast.success(t('admin.users.role_removed'))
      heldRoleIds.value = heldRoleIds.value.filter((id) => id !== roleId)
    } else {
      await api.post('/api/admin/roles/assign', { userId: user.id, roleId })
      toast.success(t('admin.users.role_assigned'))
      heldRoleIds.value = [...heldRoleIds.value, roleId]
    }
    emit('changed')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    toggling.value = false
  }
}
</script>

<template>
  <UiDialog :open="!!props.user" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>{{ t('admin.users.manage_roles_title') }}</UiDialogTitle>
        <UiDialogDescription>{{ t('admin.users.manage_roles_description') }}</UiDialogDescription>
      </UiDialogHeader>
      <div class="max-h-64 space-y-3 overflow-y-auto py-4">
        <label
          v-for="role in allRoles"
          :key="role.id"
          class="flex cursor-pointer items-center gap-3"
        >
          <UiCheckbox
            :model-value="heldRoleIds.includes(role.id)"
            :disabled="toggling"
            @update:model-value="() => toggleRole(role.id)"
          />
          <div>
            <div class="text-sm font-medium">{{ role.title }}</div>
            <div class="text-muted-foreground font-mono text-xs">{{ role.name }}</div>
          </div>
        </label>
        <p v-if="allRoles.length === 0" class="text-muted-foreground py-4 text-center text-sm">
          {{ t('admin.roles.no_roles') }}
        </p>
      </div>
      <UiDialogFooter>
        <UiButton variant="outline" @click="emit('close')">{{ t('admin.roles.cancel') }}</UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
