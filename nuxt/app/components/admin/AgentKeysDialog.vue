<script setup lang="ts">
/**
 * Source `routes/admin/-agent-account-keys.tsx` — `AgentKeysDialog`.
 *
 * Issue form (name + expiry) above a six-column table of the agent's keys. The
 * issued key is shown once: after a successful create the form is replaced by
 * an amber block with the key and a "next: connect" shortcut, because a key
 * that is not copied here can never be read again.
 *
 * This build has no key store, so issuing answers 400 and the toast carries the
 * reason (see `server/api/admin/agent/keys.post.ts`) — the form itself is the
 * source's.
 */
import { Plus } from 'lucide-vue-next'
import {
  AGENT_EXPIRY_DAYS,
  agentKeyStateVariant,
  keyState,
  type Agent,
} from '~/utils/admin-agent-ui'

const props = defineProps<{
  open: boolean
  keysAgent: Agent | null
  createdKey: string
  creating: boolean
  revoking: boolean
}>()

const emit = defineEmits<{ close: []; connect: []; create: []; revoke: [string] }>()

const keyName = defineModel<string>('keyName', { required: true })
const expiryDays = defineModel<string>('expiryDays', { required: true })

const { t } = useSettingsI18n()

function expiryLabel(d: string) {
  return d === 'never'
    ? t('admin.agent.never_expires')
    : t('admin.agent.days', { count: d })
}
</script>

<template>
  <UiDialog :open="props.open" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent class="sm:max-w-2xl">
      <UiDialogHeader>
        <UiDialogTitle>
          {{ t('admin.agent.keys_of', { name: props.keysAgent?.name ?? '' }) }}
        </UiDialogTitle>
        <UiDialogDescription>{{ t('admin.agent.keys_hint') }}</UiDialogDescription>
      </UiDialogHeader>

      <div
        v-if="props.createdKey"
        class="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
      >
        <p class="text-xs text-amber-700 dark:text-amber-400">
          {{ t('admin.agent.created_warning') }}
        </p>
        <div class="bg-background flex items-center rounded-md pl-3">
          <code class="min-w-0 flex-1 py-2 text-xs break-all">{{ props.createdKey }}</code>
          <AdminCopyButton :value="props.createdKey" />
        </div>
        <UiButton
          size="sm"
          variant="outline"
          @click="
            () => {
              emit('close')
              emit('connect')
            }
          "
        >
          {{ t('admin.agent.next_connect') }}
        </UiButton>
      </div>

      <form
        v-else
        class="flex flex-wrap items-end gap-2"
        @submit.prevent.stop="emit('create')"
      >
        <!-- flex gap, not space-y: the Select appends a hidden input, and
             space-y would push a margin under the trigger. -->
        <div class="flex min-w-40 flex-1 flex-col gap-1.5">
          <UiLabel for="key-name">{{ t('admin.agent.key_name') }}</UiLabel>
          <UiInput
            id="key-name"
            v-model="keyName"
            :maxlength="100"
            placeholder="default"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <UiLabel>{{ t('admin.agent.token_expires') }}</UiLabel>
          <UiSelect v-model="expiryDays">
            <UiSelectTrigger class="w-32">
              <UiSelectValue :text="expiryLabel(expiryDays)" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="d in AGENT_EXPIRY_DAYS" :key="d" :value="d">
                {{ expiryLabel(d) }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>
        <UiButton type="submit" :disabled="props.creating">
          <Plus class="size-4" />
          {{ t('admin.agent.issue_key') }}
        </UiButton>
        <p
          v-if="expiryDays === 'never'"
          class="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        >
          {{ t('admin.agent.never_warning') }}
        </p>
      </form>

      <div class="overflow-x-auto">
        <UiTable>
          <UiTableHeader>
            <UiTableRow>
              <UiTableHead>{{ t('admin.agent.key_name') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.token_prefix') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.token_expires') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.token_last_used') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.token_status') }}</UiTableHead>
              <UiTableHead />
            </UiTableRow>
          </UiTableHeader>
          <UiTableBody>
            <UiTableRow v-for="k in props.keysAgent?.keys ?? []" :key="k.id">
              <UiTableCell>{{ k.name }}</UiTableCell>
              <UiTableCell>
                <code class="text-xs">{{ k.keyPrefix }}…</code>
              </UiTableCell>
              <UiTableCell class="text-muted-foreground text-sm">
                {{ k.expiresAt ? formatDateTime(k.expiresAt) : t('admin.agent.never_expires') }}
              </UiTableCell>
              <UiTableCell class="text-muted-foreground text-sm">
                {{ k.lastUsedAt ? formatDateTime(k.lastUsedAt) : '—' }}
              </UiTableCell>
              <UiTableCell>
                <UiBadge :variant="agentKeyStateVariant(keyState(k))">
                  {{ t(`admin.agent.status_${keyState(k)}`) }}
                </UiBadge>
              </UiTableCell>
              <UiTableCell class="text-right">
                <UiButton
                  v-if="keyState(k) === 'active'"
                  variant="ghost"
                  size="sm"
                  :disabled="props.revoking"
                  @click="emit('revoke', k.id)"
                >
                  {{ t('admin.agent.revoke') }}
                </UiButton>
              </UiTableCell>
            </UiTableRow>
            <UiTableRow v-if="props.keysAgent && props.keysAgent.keys.length === 0">
              <UiTableCell colspan="6" class="text-muted-foreground h-16 text-center">
                {{ t('admin.agent.no_tokens') }}
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" @click="emit('close')">
          {{ t('admin.agent.done') }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
