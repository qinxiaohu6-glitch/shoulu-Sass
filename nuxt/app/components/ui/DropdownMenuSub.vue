<script setup lang="ts">
/** Source `components/ui/dropdown-menu.tsx` — `DropdownMenuSub`. */
import { DropdownMenuSub } from 'reka-ui'

defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <DropdownMenuSub
    :open="open"
    data-slot="dropdown-menu-sub"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <slot />
  </DropdownMenuSub>
</template>
