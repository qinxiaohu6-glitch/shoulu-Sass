<script setup lang="ts">
/** Source `components/ui/dropdown-menu.tsx` — `DropdownMenuSeparator`. */
import { DropdownMenuSeparator } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <DropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
  />
</template>
