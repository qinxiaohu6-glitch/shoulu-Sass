<script setup lang="ts">
/**
 * Source `components/ui/dialog.tsx` — root.
 *
 * Base UI's `Dialog.Root` and reka-ui's `DialogRoot` take the same
 * `open` / `onOpenChange` pair; `v-model:open` is the Vue spelling.
 */
import { DialogRoot } from 'reka-ui'

defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <DialogRoot
    :open="open"
    data-slot="dialog"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <slot />
  </DialogRoot>
</template>
