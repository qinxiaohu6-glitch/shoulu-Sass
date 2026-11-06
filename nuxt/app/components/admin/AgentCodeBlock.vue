<script setup lang="ts">
/**
 * Source `routes/admin/agent.tsx` — the local `CodeBlock`.
 *
 * `wrap` is for prose (a prompt) rather than code, so long lines stay visible
 * instead of scrolling out of a `<pre>`.
 */
import { cn } from '~/utils/ui'

const props = defineProps<{ code: string; wrap?: boolean }>()
</script>

<template>
  <div class="bg-muted relative rounded-lg">
    <pre
      :class="
        cn(
          'overflow-x-auto p-4 pr-12 font-mono text-xs leading-relaxed',
          props.wrap && 'break-words whitespace-pre-wrap',
        )
      "
    >{{ props.code }}</pre>
    <AdminCopyButton :value="props.code" class="absolute top-2 right-2" />
  </div>
</template>
