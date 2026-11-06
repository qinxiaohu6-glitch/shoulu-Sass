<script setup lang="ts">
/**
 * Source `routes/admin/-agent-logs.tsx` — the "Logs" tab.
 *
 * Every call an agent made with its admin key, newest first: who, which key,
 * what, on which record, and the outcome. Six columns, a per-agent filter and
 * the source's paging (20 rows).
 *
 * The filter reuses the accounts endpoint — the source shares its react-query
 * cache for exactly this reason (it only needs id + name). Here the tab is
 * mounted on its own, so it makes its own call to the same route.
 *
 * This build has no audit store: the table is the source's own empty state.
 */
import type { DataColumn } from '~/utils/ui'
import {
  AGENT_LOGS_ALL,
  AGENT_LOGS_PAGE_SIZE,
  agentDuration,
  agentLogStatusKey,
  agentLogStatusVariant,
  type AgentExecution,
} from '~/utils/admin-agent-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const agentId = ref<string>(AGENT_LOGS_ALL)

// Same cache as the accounts tab — just names for the filter.
const { data: agentsData } = await useAsyncData<{ id: string; name: string }[]>(
  'admin-agent-log-agents',
  () => api.get<{ id: string; name: string }[]>('/api/admin/agent/accounts'),
  { default: () => [] },
)
const agents = computed(() => agentsData.value ?? [])

const listParams = computed(() =>
  pageQuery('/api/admin/agent/audit', {
    page: page.value,
    pageSize: AGENT_LOGS_PAGE_SIZE,
    userId: agentId.value === AGENT_LOGS_ALL ? undefined : agentId.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AgentExecution[]; total: number }>(
  'admin-agent-logs',
  () => api.get<{ items: AgentExecution[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'time', header: t('admin.agent.log_time') },
  { key: 'agent', header: t('admin.agent.log_agent') },
  { key: 'operation', header: t('admin.agent.log_operation') },
  { key: 'target', header: t('admin.agent.log_target') },
  { key: 'status', header: t('admin.agent.log_status') },
  { key: 'duration', header: t('admin.agent.log_duration') },
])

const agentItems = computed(() => [
  { value: AGENT_LOGS_ALL, label: t('admin.agent.log_all_agents') },
  ...agents.value.map((a) => ({ value: a.id, label: a.name })),
])

const agentText = computed(
  () => agentItems.value.find((i) => i.value === agentId.value)?.label ?? '',
)

watch(agentId, () => {
  page.value = 1
})
</script>

<template>
  <UiCard>
    <UiCardHeader>
      <UiCardTitle class="text-base">{{ t('admin.agent.logs') }}</UiCardTitle>
      <UiCardDescription>{{ t('admin.agent.logs_hint') }}</UiCardDescription>
    </UiCardHeader>
    <UiCardContent>
      <DataTable
        v-model:page="page"
        :columns="columns"
        :rows="rows"
        :total="total"
        :page-size="AGENT_LOGS_PAGE_SIZE"
        :loading="loading"
        :empty-text="t('admin.agent.no_logs')"
        show-refresh
        @refresh="refresh"
      >
        <template #toolbar>
          <UiSelect v-model="agentId">
            <UiSelectTrigger class="w-48">
              <UiSelectValue :text="agentText" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="item in agentItems" :key="item.value" :value="item.value">
                {{ item.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </template>

        <template #cell-time="{ row }">
          <span class="text-muted-foreground text-sm whitespace-nowrap">
            {{ formatDateTime(row.createdAt) }}
          </span>
        </template>

        <template #cell-agent="{ row }">
          <div class="text-sm">
            <div class="font-medium">
              <template v-if="row.userName">{{ row.userName }}</template>
              <span v-else class="text-muted-foreground">
                {{ t('admin.agent.log_deleted_agent') }}
              </span>
            </div>
            <div v-if="row.keyName" class="text-muted-foreground text-xs">
              {{ row.keyName }}
              <code v-if="row.keyPrefix" class="ml-1">{{ row.keyPrefix }}…</code>
            </div>
          </div>
        </template>

        <template #cell-operation="{ row }">
          <code class="text-xs">{{ row.operation }}</code>
        </template>

        <template #cell-target="{ row }">
          <code v-if="row.targetId" class="text-muted-foreground text-xs">{{ row.targetId }}</code>
          <span v-else class="text-muted-foreground">—</span>
        </template>

        <template #cell-status="{ row }">
          <UiBadge :variant="agentLogStatusVariant(row.status)">
            {{ t(agentLogStatusKey(row.status)) }}
          </UiBadge>
        </template>

        <template #cell-duration="{ row }">
          <span class="text-muted-foreground text-sm tabular-nums">
            {{ agentDuration(row) }}
          </span>
        </template>
      </DataTable>
    </UiCardContent>
  </UiCard>
</template>
