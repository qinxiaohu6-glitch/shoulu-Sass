<script setup lang="ts">
/**
 * Source `routes/admin/-agent-account-dialogs.tsx` — `AgentEditDialog`.
 *
 * Create and edit share one dialog: `isNew` only changes the title. The role
 * checklist is the source's `max-h-64 overflow-y-auto` box; this build has no
 * roles table (see `server/api/admin/roles/index.get.ts`), so the box renders
 * empty — the source's own state for "no roles exist yet".
 */
import type { AgentRole } from '~/utils/admin-agent-ui'

const props = defineProps<{
  open: boolean
  isNew: boolean
  roles: AgentRole[]
  saving: boolean
}>()

const emit = defineEmits<{ close: []; save: [] }>()

const name = defineModel<string>('name', { required: true })
const roleIds = defineModel<string[]>('roleIds', { required: true })

const { t } = useSettingsI18n()

function toggle(id: string, checked: boolean) {
  roleIds.value = checked ? [...roleIds.value, id] : roleIds.value.filter((v) => v !== id)
}

function submit() {
  if (name.value.trim()) emit('save')
}
</script>

<template>
  <UiDialog :open="props.open" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent class="sm:max-w-lg">
      <UiDialogHeader>
        <UiDialogTitle>
          {{ props.isNew ? t('admin.agent.create_agent') : t('admin.agent.edit_agent') }}
        </UiDialogTitle>
        <UiDialogDescription>{{ t('admin.agent.agent_form_hint') }}</UiDialogDescription>
      </UiDialogHeader>
      <form class="space-y-4" @submit.prevent.stop="submit">
        <div class="space-y-1.5">
          <UiLabel for="agent-name">{{ t('admin.agent.agent_name') }}</UiLabel>
          <UiInput
            id="agent-name"
            v-model="name"
            :maxlength="100"
            placeholder="Claude Code"
          />
        </div>
        <div class="space-y-2">
          <UiLabel>{{ t('admin.agent.agent_roles') }}</UiLabel>
          <div class="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
            <label
              v-for="r in props.roles"
              :key="r.id"
              class="flex cursor-pointer items-start gap-2 text-sm"
            >
              <UiCheckbox
                class="mt-0.5"
                :model-value="roleIds.includes(r.id)"
                @update:model-value="(v: any) => toggle(r.id, !!v)"
              />
              <span>
                <span class="font-medium">{{ r.title || r.name }}</span>
                <code class="text-muted-foreground text-xs">{{ r.name }}</code>
                <span v-if="r.description" class="text-muted-foreground block text-xs">
                  {{ r.description }}
                </span>
              </span>
            </label>
          </div>
        </div>
        <UiDialogFooter>
          <UiButton type="submit" :disabled="!name.trim() || props.saving">
            {{ t('admin.agent.save') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
