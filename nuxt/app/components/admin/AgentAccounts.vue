<script setup lang="ts">
/**
 * Source `routes/admin/-agent-accounts.tsx` — the "Agents" tab.
 *
 * Agent service accounts: each is an `api`-type user whose permissions are its
 * RBAC roles, holding one or more admin API keys. Five columns (name / roles /
 * active keys / last used / row actions) and three dialogs: edit, keys, delete.
 *
 * This build has no agent store — `/admin` is gated by a single owner token
 * (see `server/utils/admin.ts`), so there is no `api`-type user to create and
 * no key to issue. The list is the source's own empty state and every write
 * says why nothing happened.
 *
 * `useConfirm()` in the source renders a dialog from a hook. Vue cannot render
 * a component out of a composable, so the same promise-based confirm lives here
 * as a ref plus `<ConfirmDialog>` — `askConfirm()` returns the promise the
 * source's callers await.
 */
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  keyState,
  type Agent,
  type AgentRole,
} from '~/utils/admin-agent-ui'

const emit = defineEmits<{ connect: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const { data: agentsData, refresh } = await useAsyncData<Agent[]>(
  'admin-agent-accounts',
  () => api.get<Agent[]>('/api/admin/agent/accounts'),
  { default: () => [] },
)

const { data: rolesData } = await useAsyncData<{ items: AgentRole[] }>(
  'admin-agent-roles',
  () => api.get<{ items: AgentRole[] }>('/api/admin/roles?pageSize=100'),
  { default: () => ({ items: [] }) },
)

const agents = computed(() => agentsData.value ?? [])
const roles = computed(() => rolesData.value?.items ?? [])

// Create / edit agent
const editing = ref<Agent | 'new' | null>(null)
const name = ref('')
const roleIds = ref<string[]>([])
const saving = ref(false)

function openEditor(agent: Agent | 'new') {
  editing.value = agent
  name.value = agent === 'new' ? '' : agent.name
  roleIds.value = agent === 'new' ? [] : agent.roles.map((r) => r.id)
}

async function save() {
  if (!name.value.trim()) return
  saving.value = true
  try {
    if (editing.value === 'new') {
      const created = await api.post<{ id: string }>('/api/admin/agent/accounts', {
        name: name.value.trim(),
        roleIds: roleIds.value,
      })
      editing.value = null
      await refresh()
      toast.success(t('admin.agent.saved'))
      // A new agent is useless without a key — go straight to issuing one.
      if (created?.id) keysFor.value = created.id
    } else {
      await api.patch('/api/admin/agent/accounts', {
        id: (editing.value as Agent).id,
        name: name.value.trim(),
        roleIds: roleIds.value,
      })
      editing.value = null
      await refresh()
      toast.success(t('admin.agent.saved'))
    }
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

// Delete agent
const deleting = ref<Agent | null>(null)
const removing = ref(false)

async function confirmDelete() {
  const agent = deleting.value
  if (!agent) return
  removing.value = true
  try {
    await api.del(pageQuery('/api/admin/agent/accounts', { id: agent.id }))
    deleting.value = null
    await refresh()
    toast.success(t('admin.agent.deleted'))
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    removing.value = false
  }
}

// Keys dialog
const keysFor = ref<string | null>(null)
const keysAgent = computed(() => agents.value.find((a) => a.id === keysFor.value) ?? null)
const keyName = ref('')
const expiryDays = ref<string>('30')
const createdKey = ref('')
const creatingKey = ref(false)
const revokingKey = ref(false)

async function createKey() {
  creatingKey.value = true
  try {
    const data = await api.post<{ token: string }>('/api/admin/agent/keys', {
      agentId: keysFor.value,
      name: keyName.value.trim() || 'default',
      expiresAt:
        expiryDays.value === 'never'
          ? null
          : new Date(Date.now() + Number(expiryDays.value) * 86400000).toISOString(),
    })
    createdKey.value = data.token
    keyName.value = ''
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    creatingKey.value = false
  }
}

async function revokeKey(id: string) {
  const ok = await askConfirm({
    title: t('admin.agent.revoke'),
    description: t('admin.agent.revoke_warning'),
    confirmLabel: t('admin.agent.revoke'),
    destructive: true,
  })
  if (!ok) return
  revokingKey.value = true
  try {
    await api.del(pageQuery('/api/admin/agent/keys', { id }))
    toast.success(t('admin.agent.revoked'))
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    revokingKey.value = false
  }
}

function closeKeys() {
  keysFor.value = null
  createdKey.value = ''
  expiryDays.value = '30'
}

// Confirm — the Vue stand-in for the source's `useConfirm()` hook.
const confirmState = ref({
  open: false,
  title: '',
  description: '',
  confirmLabel: t('common.confirm.ok'),
  cancelLabel: t('common.confirm.cancel'),
  destructive: false,
})
let confirmResolve: ((ok: boolean) => void) | null = null

function askConfirm(opts: {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}) {
  // A second question while one is open answers the first with "no", which is
  // what the source's `resolveRef.current?.(false)` does.
  confirmResolve?.(false)
  confirmState.value = {
    open: true,
    title: opts.title,
    description: opts.description ?? '',
    confirmLabel: opts.confirmLabel ?? t('common.confirm.ok'),
    cancelLabel: t('common.confirm.cancel'),
    destructive: !!opts.destructive,
  }
  return new Promise<boolean>((resolve) => {
    confirmResolve = resolve
  })
}

function settleConfirm(ok: boolean) {
  confirmResolve?.(ok)
  confirmResolve = null
  confirmState.value.open = false
}

/**
 * The two derived cells of each row: how many keys still work, and the newest
 * `lastUsedAt` across them (the source computes both inline in its render).
 */
const rows = computed(() =>
  agents.value.map((agent) => ({
    agent,
    activeCount: agent.keys.filter((k) => keyState(k) === 'active').length,
    lastUsed:
      agent.keys
        .map((k) => k.lastUsedAt)
        .filter((v): v is string => !!v)
        .sort()
        .pop() ?? null,
  })),
)
</script>

<template>
  <UiCard>
    <UiCardHeader class="flex flex-row items-start justify-between gap-4 space-y-0">
      <div class="min-w-0 flex-1 space-y-1.5">
        <UiCardTitle class="text-base">{{ t('admin.agent.accounts') }}</UiCardTitle>
        <UiCardDescription>
          {{ t('admin.agent.accounts_hint') }}
          <NuxtLink
            to="/admin/roles"
            class="text-primary underline-offset-4 hover:underline"
          >
            {{ t('admin.agent.manage_roles') }}
          </NuxtLink>
        </UiCardDescription>
      </div>
      <UiButton size="sm" class="shrink-0" @click="openEditor('new')">
        <Plus class="size-4" />
        {{ t('admin.agent.create_agent') }}
      </UiButton>
    </UiCardHeader>
    <UiCardContent>
      <div class="overflow-x-auto">
        <UiTable>
          <UiTableHeader>
            <UiTableRow>
              <UiTableHead>{{ t('admin.agent.agent_name') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.agent_roles') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.agent_keys') }}</UiTableHead>
              <UiTableHead>{{ t('admin.agent.agent_last_used') }}</UiTableHead>
              <UiTableHead />
            </UiTableRow>
          </UiTableHeader>
          <UiTableBody>
            <UiTableRow v-for="row in rows" :key="row.agent.id">
              <UiTableCell class="font-medium">{{ row.agent.name }}</UiTableCell>
              <UiTableCell>
                <div class="flex flex-wrap gap-1">
                  <template v-if="row.agent.roles.length">
                    <UiBadge v-for="r in row.agent.roles" :key="r.id" variant="secondary">
                      {{ r.title || r.name }}
                    </UiBadge>
                  </template>
                  <span v-else class="text-muted-foreground text-sm">
                    {{ t('admin.agent.no_roles') }}
                  </span>
                </div>
              </UiTableCell>
              <UiTableCell class="text-muted-foreground text-sm">
                {{ t('admin.agent.active_keys', { count: row.activeCount }) }}
              </UiTableCell>
              <UiTableCell class="text-muted-foreground text-sm">
                {{ row.lastUsed ? formatDateTime(row.lastUsed) : '—' }}
              </UiTableCell>
              <UiTableCell>
                <div class="flex justify-end gap-1">
                  <UiButton variant="outline" size="sm" @click="keysFor = row.agent.id">
                    <KeyRound class="size-3.5" />
                    {{ t('admin.agent.keys') }}
                  </UiButton>
                  <UiButton
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :aria-label="t('admin.agent.edit')"
                    @click="openEditor(row.agent)"
                  >
                    <Pencil class="size-3.5" />
                  </UiButton>
                  <UiButton
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :aria-label="t('admin.agent.delete')"
                    @click="deleting = row.agent"
                  >
                    <Trash2 class="size-3.5" />
                  </UiButton>
                </div>
              </UiTableCell>
            </UiTableRow>
            <UiTableRow v-if="agentsData?.length === 0">
              <UiTableCell colspan="5" class="text-muted-foreground h-20 text-center">
                {{ t('admin.agent.no_agents') }}
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </div>
    </UiCardContent>

    <AdminAgentEditDialog
      :open="!!editing"
      :is-new="editing === 'new'"
      :roles="roles"
      :saving="saving"
      v-model:name="name"
      v-model:roleIds="roleIds"
      @close="editing = null"
      @save="save"
    />

    <AdminAgentKeysDialog
      :open="!!keysFor"
      :keys-agent="keysAgent"
      :created-key="createdKey"
      :creating="creatingKey"
      :revoking="revokingKey"
      v-model:keyName="keyName"
      v-model:expiryDays="expiryDays"
      @close="closeKeys"
      @connect="emit('connect')"
      @create="createKey"
      @revoke="revokeKey"
    />

    <AdminAgentDeleteDialog
      :agent="deleting"
      :deleting="removing"
      @close="deleting = null"
      @delete="confirmDelete"
    />

    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :description="confirmState.description"
      :confirm-label="confirmState.confirmLabel"
      :cancel-label="confirmState.cancelLabel"
      :destructive="confirmState.destructive"
      @confirm="settleConfirm(true)"
      @cancel="settleConfirm(false)"
    />
  </UiCard>
</template>
