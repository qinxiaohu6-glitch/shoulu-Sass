<script setup lang="ts">
/**
 * Source `components/ui/avatar.tsx` — `Avatar`.
 *
 * The image/fallback swap is done here rather than with Base UI's Avatar
 * primitive: reka-ui ships no avatar root, and the behaviour the source relies
 * on is just "show the image, fall back to initials if it fails to load".
 */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ size?: 'default' | 'sm' | 'lg'; class?: string }>(),
  { size: 'default' },
)
</script>

<template>
  <div
    data-slot="avatar"
    :data-size="props.size"
    :class="
      cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
