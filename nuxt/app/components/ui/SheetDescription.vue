<script setup lang="ts">
/** Source `components/ui/sheet.tsx` — `SheetDescription`. */
import { DialogDescription } from 'reka-ui'
import { cn } from '~/utils/ui'

defineProps<{ class?: string }>()
</script>

<template>
  <DialogDescription data-slot="sheet-description" :class="cn('text-sm text-muted-foreground', $props.class)">
    <slot />
  </DialogDescription>
</template>
