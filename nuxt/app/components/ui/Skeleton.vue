<script setup lang="ts">
/** Source `components/ui/skeleton.tsx`. */
import { cn } from '~/utils/ui'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="skeleton" :class="cn('animate-pulse rounded-md bg-muted', props.class)" />
</template>
