<script setup lang="ts">
/**
 * Source `components/ui/button.tsx`.
 *
 * `as` replaces React's `render={<X/>}`: the source swaps the rendered element
 * for a router link while keeping the button's classes. Vue's dynamic component
 * does the same job, so `<UiButton as="a">` / `<UiButton :as="NuxtLink">` cover
 * every call site in the ported pages.
 */
import type { Component } from 'vue'
import { computed } from 'vue'
import { buttonVariants, cn, type ButtonSize, type ButtonVariant } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    as?: string | Component
    type?: 'button' | 'submit' | 'reset'
    class?: string
  }>(),
  {
    variant: 'default',
    size: 'default',
    as: 'button',
  },
)

const tag = computed(() => props.as ?? 'button')
/**
 * `cn(...)` around `buttonVariants(...)`, not `className` passed into `cva`.
 *
 * cva concatenates its base, the variant and `className` without resolving
 * conflicts, so the base's `border-transparent` stayed in the class list
 * alongside the outline variant's `border-border`. Both rules then matched and
 * stylesheet order picked the winner — transparent — which is why every
 * `variant="outline"` button in the port rendered with no border at all.
 * shadcn's own `cn(buttonVariants(...), className)` is exactly this merge, so
 * this is the source's composition, spelled the Vue way.
 */
const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class))
// A native button defaults to type=submit inside a form, which would make every
// icon button in a card submit it. The source's Base UI Button already defaults
// to `type="button"`; match that unless the caller says otherwise.
const typeAttr = computed(() => (tag.value === 'button' ? (props.type ?? 'button') : undefined))
</script>

<template>
  <component :is="tag" data-slot="button" :type="typeAttr" :class="classes">
    <slot />
  </component>
</template>
