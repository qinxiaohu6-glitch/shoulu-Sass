<script setup lang="ts">
/** Source `components/ui/dialog.tsx` — `DialogTitle`. */
import { DialogTitle } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <DialogTitle data-slot="dialog-title" :class="cn('text-base leading-none font-medium', props.class)">
    <slot />
  </DialogTitle>
</template>
