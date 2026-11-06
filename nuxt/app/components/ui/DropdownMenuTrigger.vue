<script setup lang="ts">
/**
 * Source `components/ui/dropdown-menu.tsx` — `DropdownMenuTrigger`.
 *
 * `asChild` mirrors Base UI's `render`: when false (the default, and what the
 * source's own markup relies on) reka-ui renders its own `<button>` and the
 * slot goes inside it; when true the slot's single root element *becomes* the
 * trigger.
 */
import { DropdownMenuTrigger } from 'reka-ui'

withDefaults(defineProps<{ asChild?: boolean; class?: string; disabled?: boolean }>(), {
  asChild: false,
})
</script>

<template>
  <DropdownMenuTrigger
    :as-child="asChild"
    :disabled="disabled"
    :class="$props.class"
    data-slot="dropdown-menu-trigger"
  >
    <slot />
  </DropdownMenuTrigger>
</template>
