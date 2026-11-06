<script setup lang="ts">
/**
 * Source `components/ui/dropdown-menu.tsx` — root.
 *
 * reka-ui's `DropdownMenuRoot` decides controlled vs uncontrolled by
 * `props.open === undefined`. A plain `defineProps<{ open?: boolean }>()`
 * breaks that: Vue casts an absent Boolean prop to `false`, so the root sees a
 * controlled `open: false`, ignores `onOpenToggle`, and the menu never opens
 * (every `DropdownMenu` in the app was dead). Declaring the default as
 * `undefined` keeps "absent" absent, which is exactly what reka checks.
 */
import { DropdownMenuRoot } from 'reka-ui'

withDefaults(defineProps<{ open?: boolean }>(), { open: undefined })
const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <DropdownMenuRoot
    :open="open"
    data-slot="dropdown-menu"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <slot />
  </DropdownMenuRoot>
</template>
