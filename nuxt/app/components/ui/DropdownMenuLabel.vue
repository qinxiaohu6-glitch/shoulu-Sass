<script setup lang="ts">
/** Source `components/ui/dropdown-menu.tsx` — `DropdownMenuLabel`. */
import { DropdownMenuLabel } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string; inset?: boolean }>()
</script>

<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    :data-inset="props.inset || undefined"
    :class="
      cn(
        'px-2 py-1.5 text-xs font-medium text-muted-foreground data-[inset]:pl-7',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
