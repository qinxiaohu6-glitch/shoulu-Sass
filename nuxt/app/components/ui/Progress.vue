<script setup lang="ts">
/**
 * Source `components/ui/progress.tsx`.
 *
 * Base UI's `Progress.Root` renders the track and the indicator itself; reka-ui
 * exports only `ProgressRoot` and `ProgressIndicator` — there is no
 * `ProgressTrack`, so the track is the root element here. The class list is the
 * source's track (`h-1`, `bg-muted`, `rounded-full`, clipped) with the
 * indicator inside it, which is the same two-box structure the source produces.
 */
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ modelValue?: number | null; max?: number; class?: string }>()
</script>

<template>
  <ProgressRoot
    :model-value="props.modelValue ?? undefined"
    :max="props.max ?? 100"
    data-slot="progress"
    :class="
      cn(
        'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted',
        props.class,
      )
    "
  >
    <slot />
    <ProgressIndicator data-slot="progress-indicator" class="h-full bg-primary transition-all" />
  </ProgressRoot>
</template>
