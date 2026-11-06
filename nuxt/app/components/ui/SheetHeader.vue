<script setup lang="ts">
/** Source `components/ui/sheet.tsx` — `SheetHeader`. */
import { cn } from '~/utils/ui'

defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="sheet-header" :class="cn('flex flex-col gap-0.5 p-4', $props.class)">
    <slot />
  </div>
</template>
