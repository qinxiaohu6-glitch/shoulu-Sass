<script setup lang="ts">
/**
 * Source `routes/admin/-users-dialogs.tsx` — `SetPasswordDialog`.
 *
 * The source's own guard is length only (`< 8` → toast); the API owns the rest.
 * In this build the API refuses outright — sign-in is Google-only — so a
 * successful submit reports why nothing changed rather than closing silently.
 */
import { toast } from 'vue-sonner'
import type { AdminUser } from '~/utils/admin-users-ui'

const props = defineProps<{ user: AdminUser | null }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const newPassword = ref('')
const submitting = ref(false)

watch(
  () => props.user,
  (user) => {
    if (user) newPassword.value = ''
  },
)

async function submit() {
  const user = props.user
  if (!user) return
  if (newPassword.value.length < 8) {
    toast.error(t('admin.users.password_too_short'))
    return
  }
  submitting.value = true
  try {
    await api.post('/api/admin/users/password', { userId: user.id, password: newPassword.value })
    toast.success(t('admin.users.password_updated'))
    emit('close')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UiDialog :open="!!props.user" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>{{ t('admin.users.set_password_title') }}</UiDialogTitle>
        <UiDialogDescription>
          <template v-if="props.user">
            {{ t('admin.users.set_password_description', { name: props.user.name || props.user.email }) }}
          </template>
        </UiDialogDescription>
      </UiDialogHeader>
      <form class="grid gap-4" @submit.prevent.stop="submit">
        <div class="space-y-1.5 py-2">
          <label class="text-sm font-medium">{{ t('admin.users.new_password_label') }}</label>
          <UiInput
            v-model="newPassword"
            type="text"
            autocomplete="off"
            :placeholder="t('admin.users.new_password_placeholder')"
          />
        </div>
        <UiDialogFooter>
          <UiButton type="button" variant="outline" @click="emit('close')">
            {{ t('admin.roles.cancel') }}
          </UiButton>
          <UiButton type="submit" :disabled="submitting">
            {{ submitting ? t('admin.users.credits_submitting') : t('admin.users.password_submit') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
