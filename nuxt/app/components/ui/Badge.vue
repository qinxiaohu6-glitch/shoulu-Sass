<script setup lang="ts">
/**
 * Source `components/ui/badge.tsx`.
 *
 * The source renders through Base UI's `useRender` so a badge can become a link.
 * `as` covers the same need here.
 */
import type { Component } from 'vue'
import { computed } from 'vue'
import { badgeVariants, cn, type BadgeVariant } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ variant?: BadgeVariant; as?: string | Component; class?: string }>(),
  { variant: 'default', as: 'span' },
)

const tag = computed(() => props.as ?? 'span')
const classes = computed(() => cn(badgeVariants({ variant: props.variant }), props.class))
</script>

<template>
  <component :is="tag" data-slot="badge" :data-variant="props.variant" :class="classes">
    <slot />
  </component>
</template>
