<script setup lang="ts">
/** Source `components/ui/table.tsx` — `TableHead`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <th
    data-slot="table-head"
    :class="
      cn(
        'h-12 px-4 text-left align-middle font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0',
        props.class,
      )
    "
  >
    <slot />
  </th>
</template>
