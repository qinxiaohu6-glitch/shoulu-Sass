<script setup lang="ts">
/** Source `components/ui/table.tsx` — `TableCell`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <td
    data-slot="table-cell"
    :class="cn('px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', props.class)"
  >
    <slot />
  </td>
</template>
