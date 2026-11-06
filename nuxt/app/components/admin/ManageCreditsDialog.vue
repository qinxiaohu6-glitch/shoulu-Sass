<script setup lang="ts">
/**
 * Source `routes/admin/-users-dialogs.tsx` — `ManageCreditsDialog`.
 *
 * Grant / deduct are two plain buttons that paint themselves solid when active
 * (the source builds them from `<button>` rather than the Button component, so
 * the selected state can invert the colours). Amount must be a positive number;
 * the description is optional.
 *
 * The API refuses in this build — there is no credits ledger — so submitting
 * reports that instead of closing.
 *
 * `text-background!` is the one place the source's class list needed a `!`:
 * `legacy.css` opens with an unlayered `button { color: inherit }`, so a plain
 * `text-background` lost to it and the selected segment rendered black-on-black
 * with no visible label. `!important` is the only way a layered utility beats
 * an unlayered declaration here.
 */
import { toast } from 'vue-sonner'
import type { AdminUser } from '~/utils/admin-users-ui'

const props = defineProps<{ user: AdminUser | null }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const action = ref<'grant' | 'deduct'>('grant')
const amount = ref('')
const description = ref('')
const submitting = ref(false)

watch(
  () => props.user,
  (user) => {
    if (!user) return
    action.value = 'grant'
    amount.value = ''
    description.value = ''
  },
)

async function submit() {
  const user = props.user
  if (!user) return
  const value = Number(amount.value)
  if (!Number.isFinite(value) || value <= 0) {
    toast.error(t('admin.users.credits_invalid_amount'))
    return
  }
  submitting.value = true
  try {
    await api.post('/api/admin/users/credits', {
      userId: user.id,
      action: action.value,
      credits: value,
      description: description.value || undefined,
    })
    toast.success(action.value === 'grant' ? t('admin.users.credits_granted') : t('admin.users.credits_deducted'))
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
        <UiDialogTitle>{{ t('admin.users.manage_credits_title') }}</UiDialogTitle>
        <UiDialogDescription>
          <template v-if="props.user">
            {{
              t('admin.users.manage_credits_for', {
                name: props.user.name || props.user.email,
                balance: props.user.credits.toLocaleString(),
              })
            }}
          </template>
        </UiDialogDescription>
      </UiDialogHeader>

      <form class="grid gap-4" @submit.prevent.stop="submit">
        <div class="space-y-4 py-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              :class="action === 'grant' ? 'border-foreground bg-foreground text-background!' : 'border-border hover:bg-muted'"
              @click="action = 'grant'"
            >
              {{ t('admin.users.credits_action_grant') }}
            </button>
            <button
              type="button"
              class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              :class="action === 'deduct' ? 'border-foreground bg-foreground text-background!' : 'border-border hover:bg-muted'"
              @click="action = 'deduct'"
            >
              {{ t('admin.users.credits_action_deduct') }}
            </button>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('admin.users.credits_amount_label') }}</label>
            <UiInput v-model="amount" type="number" min="1" placeholder="0" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('admin.users.credits_desc_label') }}</label>
            <UiInput v-model="description" :placeholder="t('admin.users.credits_desc_placeholder')" />
          </div>
        </div>

        <UiDialogFooter>
          <UiButton type="button" variant="outline" @click="emit('close')">
            {{ t('admin.roles.cancel') }}
          </UiButton>
          <UiButton type="submit" :disabled="submitting">
            {{ submitting ? t('admin.users.credits_submitting') : t('admin.users.credits_submit') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
