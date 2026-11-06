<script setup lang="ts">
/** Source `components/ui/dialog.tsx` — `DialogHeader`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="dialog-header" :class="cn('flex flex-col gap-2', props.class)">
    <slot />
  </div>
</template>
