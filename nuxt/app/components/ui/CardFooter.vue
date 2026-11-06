<script setup lang="ts">
/** Source `components/ui/card.tsx` — `CardFooter`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    data-slot="card-footer"
    :class="
      cn(
        'flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
