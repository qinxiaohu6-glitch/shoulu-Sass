<script setup lang="ts">
/** Source `components/ui/card.tsx` — `CardDescription`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="card-description" :class="cn('text-sm text-muted-foreground', props.class)">
    <slot />
  </div>
</template>
