<script setup lang="ts">
/**
 * Source `components/ui/tooltip.tsx` — root.
 *
 * reka-ui requires a `TooltipProvider` above every tooltip (it owns the shared
 * open/delay coordination); the source's provider is mounted once at the app
 * root. Rather than make every call site remember, the provider is created here
 * and deduplicated by reka-ui, which allows nesting.
 */
import { TooltipProvider, TooltipRoot } from 'reka-ui'

defineProps<{ open?: boolean; delayDuration?: number }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration ?? 0">
    <TooltipRoot
      :open="open"
      data-slot="tooltip"
      @update:open="(v: boolean) => emit('update:open', v)"
    >
      <slot />
    </TooltipRoot>
  </TooltipProvider>
</template>
