<script setup lang="ts">
/** Source `components/ui/dialog.tsx` — `DialogDescription`. */
import { DialogDescription } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <DialogDescription
    data-slot="dialog-description"
    :class="
      cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        props.class,
      )
    "
  >
    <slot />
  </DialogDescription>
</template>
