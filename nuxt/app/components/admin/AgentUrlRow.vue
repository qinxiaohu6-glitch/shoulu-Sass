<script setup lang="ts">
/**
 * Source `routes/admin/agent.tsx` — the local `UrlRow`.
 *
 * A labelled URL with a copy button, and an "open" link when the endpoint
 * accepts the session cookie (the GET endpoints do; the MCP POST does not, so
 * the connect tab passes no `href`).
 */
import { ExternalLink } from 'lucide-vue-next'

const props = defineProps<{ label: string; url: string; href?: string }>()

const { t } = useSettingsI18n()
</script>

<template>
  <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
    <span class="text-muted-foreground shrink-0 text-sm">{{ props.label }}</span>
    <div class="bg-muted flex min-w-0 flex-1 items-center rounded-md pl-3">
      <code class="min-w-0 flex-1 truncate py-1.5 text-xs">{{ props.url }}</code>
      <a
        v-if="props.href"
        :href="props.href"
        target="_blank"
        rel="noreferrer"
        :aria-label="t('admin.agent.open')"
        class="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center"
      >
        <ExternalLink class="size-3.5" />
      </a>
      <AdminCopyButton :value="props.url" />
    </div>
  </div>
</template>
