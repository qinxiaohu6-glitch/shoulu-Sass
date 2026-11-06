<script setup lang="ts">
/**
 * /admin/agent — source `shipany-dir/src/routes/admin/agent.tsx`.
 *
 * Three tabs: the agent accounts, the connect snippets, and the call log.
 * `?tab=` carries the active one (the source keeps `accounts` out of the URL),
 * so a link can point straight at the quick-start card.
 *
 * The source shows the tabs only to an owner and drops everyone else on
 * "connect". Here `/admin` is already gated by the owner token
 * (`server/middleware/admin-token.ts`) before this page runs, so every caller
 * is the owner and the tabs are always there — the same conclusion the layout
 * documents for its own permission check.
 *
 * The snippets are built from the origin the agent must call: the request's
 * origin for the server render, the browser's after mount (the source does the
 * same with `envConfigs.app_url` then `window.location.origin`).
 */
definePageMeta({ layout: 'admin' })

import { cn } from '~/utils/ui'
import {
  AGENT_APP_NAME,
  AGENT_PAGE_TABS,
  projectSlug,
  type AgentPageTab,
} from '~/utils/admin-agent-ui'

const { t } = useSettingsI18n()
const route = useRoute()

const tab = computed<AgentPageTab>(() => {
  const value = route.query.tab
  return value === 'connect' || value === 'logs' ? value : 'accounts'
})

function setTab(next: AgentPageTab) {
  return navigateTo(
    // `accounts` is the default, so it stays out of the URL — same as the
    // source's `tab: next === 'accounts' ? undefined : next`.
    { query: { tab: next === 'accounts' ? undefined : next } },
    { replace: true },
  )
}

const tabs = computed(() =>
  AGENT_PAGE_TABS.map((value) => ({
    value,
    label: t(
      value === 'accounts'
        ? 'admin.agent.tab_accounts'
        : value === 'connect'
          ? 'admin.agent.tab_connect'
          : 'admin.agent.tab_logs',
    ),
  })),
)

const requestUrl = useRequestURL()
const origin = ref(requestUrl.origin)
onMounted(() => {
  origin.value = window.location.origin
})

const mcpUrl = computed(() => `${origin.value}/api/admin/agent/mcp`)

// One name per site, so several projects can sit side by side in an agent's
// skill store and MCP config without overwriting each other.
const project = computed(() => projectSlug(AGENT_APP_NAME, origin.value))

const snippets = computed(() => ({
  claude: `claude mcp add --transport http ${project.value} ${mcpUrl.value} \\
  --header "Authorization: Bearer sa_admin_..."`,
  mcpJson: JSON.stringify(
    {
      mcpServers: {
        [project.value]: {
          type: 'http',
          url: mcpUrl.value,
          headers: { Authorization: 'Bearer sa_admin_...' },
        },
      },
    },
    null,
    2,
  ),
  // A prompt to paste to the agent: it installs the skill from this site and
  // saves this project's URL + key (sent separately) under `project`.
  skill: t('admin.agent.skill_prompt', {
    app: AGENT_APP_NAME,
    url: origin.value,
    name: project.value,
  }),
}))

const connectTab = ref('skill')
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.agent.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.agent.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="item in tabs"
        :key="item.value"
        type="button"
        :class="
          cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === item.value
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )
        "
        @click="setTab(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <AdminAgentAccounts v-if="tab === 'accounts'" @connect="setTab('connect')" />

    <AdminAgentLogs v-else-if="tab === 'logs'" />

    <UiCard v-else>
      <UiCardHeader>
        <UiCardTitle class="text-base">{{ t('admin.agent.quickstart') }}</UiCardTitle>
        <UiCardDescription>{{ t('admin.agent.quickstart_hint') }}</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <UiTabs v-model="connectTab">
          <UiTabsList>
            <UiTabsTrigger value="skill">Skill</UiTabsTrigger>
            <UiTabsTrigger value="mcp">MCP</UiTabsTrigger>
          </UiTabsList>
          <UiTabsContent value="skill" class="space-y-3 pt-3">
            <p class="text-muted-foreground text-sm">{{ t('admin.agent.skill_hint') }}</p>
            <AdminAgentCodeBlock :code="snippets.skill" wrap />
          </UiTabsContent>
          <UiTabsContent value="mcp" class="space-y-3 pt-3">
            <AdminAgentUrlRow :label="t('admin.agent.mcp_url')" :url="mcpUrl" />
            <p class="text-muted-foreground text-sm">{{ t('admin.agent.mcp_claude') }}</p>
            <AdminAgentCodeBlock :code="snippets.claude" />
            <p class="text-muted-foreground text-sm">{{ t('admin.agent.mcp_json') }}</p>
            <AdminAgentCodeBlock :code="snippets.mcpJson" />
          </UiTabsContent>
        </UiTabs>
        <p class="text-muted-foreground mt-4 text-xs">{{ t('admin.agent.full_docs') }}</p>
      </UiCardContent>
    </UiCard>
  </div>
</template>
