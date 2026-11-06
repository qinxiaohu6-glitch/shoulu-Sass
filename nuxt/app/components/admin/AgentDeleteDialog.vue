<script setup lang="ts">
/**
 * Source `routes/admin/-agent-account-dialogs.tsx` — `AgentDeleteDialog`.
 *
 * Deleting removes the agent, its role assignments and its keys; the execution
 * history stays, which is why the log rows keep the name they were recorded
 * with. The warning text says all of that, so the dialog only asks once.
 */
import type { Agent } from '~/utils/admin-agent-ui'

const props = defineProps<{
  agent: Agent | null
  deleting: boolean
}>()

const emit = defineEmits<{ close: []; delete: [] }>()

const { t } = useSettingsI18n()
</script>

<template>
  <UiDialog :open="!!props.agent" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>
          {{ t('admin.agent.delete_title', { name: props.agent?.name ?? '' }) }}
        </UiDialogTitle>
        <UiDialogDescription>{{ t('admin.agent.delete_warning') }}</UiDialogDescription>
      </UiDialogHeader>
      <UiDialogFooter>
        <UiButton variant="outline" @click="emit('close')">
          {{ t('admin.agent.cancel') }}
        </UiButton>
        <UiButton variant="destructive" :disabled="props.deleting" @click="emit('delete')">
          {{ t('admin.agent.delete') }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
