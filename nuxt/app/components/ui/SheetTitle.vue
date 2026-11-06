<script setup lang="ts">
/** Source `components/ui/sheet.tsx` — `SheetTitle` (a reka-ui DialogTitle). */
import { DialogTitle } from 'reka-ui'
import { cn } from '~/utils/ui'

defineProps<{ class?: string }>()
</script>

<template>
  <DialogTitle data-slot="sheet-title" :class="cn('text-base font-medium text-foreground', $props.class)">
    <slot />
  </DialogTitle>
</template>
