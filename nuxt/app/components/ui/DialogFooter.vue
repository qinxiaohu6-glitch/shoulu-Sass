<script setup lang="ts">
/** Source `components/ui/dialog.tsx` — `DialogFooter`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string; showCloseButton?: boolean }>()
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="
      cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
