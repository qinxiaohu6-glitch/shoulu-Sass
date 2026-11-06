<script setup lang="ts">
/**
 * Source `components/ui/select.tsx` — `SelectValue`.
 *
 * Not a wrapper around reka-ui's `SelectValue`. Two reasons, both visible:
 *
 *  - reka-ui only knows an item's label while the popup is mounted, so a closed
 *    trigger falls back to the placeholder. The source hit the same wall and
 *    solved it by pre-collecting labels (`collectSelectItems`); here the caller
 *    passes the current label as `text`.
 *  - reka-ui's `SelectValue` always emits `data-placeholder` when no label
 *    resolves, which would mute the text through the trigger's
 *    `data-[placeholder]:text-muted-foreground`. A filter showing "All statuses"
 *    has a value selected, so it must not render as a placeholder.
 *
 * The `data-slot="select-value"` attribute is what the trigger's
 * `*:data-[slot=select-value]:line-clamp-1` rules key off, so it stays.
 */
import { cn } from '~/utils/ui'

const props = withDefaults(defineProps<{ class?: string; text?: string; placeholder?: string }>(), {
  text: '',
  placeholder: '',
})
</script>

<template>
  <span data-slot="select-value" :class="cn('flex flex-1 text-left', props.class)">
    <slot>{{ props.text || props.placeholder }}</slot>
  </span>
</template>
