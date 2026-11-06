<script setup lang="ts">
/** Source `components/ui/table.tsx` — `TableHeader`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <thead data-slot="table-header" :class="cn('[&_tr]:border-b', props.class)">
    <slot />
  </thead>
</template>
