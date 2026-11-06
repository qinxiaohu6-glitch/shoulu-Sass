<script setup lang="ts">
/** Source `components/ui/sheet.tsx` — root. */
import { DialogRoot } from 'reka-ui'

defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <DialogRoot
    :open="open"
    data-slot="sheet"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <slot />
  </DialogRoot>
</template>
