<script setup lang="ts">
/** Source `components/ui/separator.tsx`. */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ orientation?: 'horizontal' | 'vertical'; class?: string }>(),
  { orientation: 'horizontal' },
)
</script>

<template>
  <div
    data-slot="separator"
    role="separator"
    :aria-orientation="props.orientation"
    :data-orientation="props.orientation"
    :class="
      cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        props.class,
      )
    "
  />
</template>
