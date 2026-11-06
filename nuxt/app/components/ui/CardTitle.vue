<script setup lang="ts">
/** Source `components/ui/card.tsx` — `CardTitle`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    data-slot="card-title"
    :class="
      cn(
        'text-base leading-snug font-medium group-data-[size=sm]/card:text-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
