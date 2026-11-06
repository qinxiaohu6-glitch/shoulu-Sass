<script setup lang="ts">
/**
 * Source `components/ui/select.tsx` — `SelectTrigger`.
 *
 * `data-placeholder:` is Base UI's empty-state hook and reka-ui emits the same
 * attribute, so that part carries over untouched.
 */
import { SelectTrigger } from 'reka-ui'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const props = withDefaults(defineProps<{ class?: string; size?: 'sm' | 'default' }>(), {
  size: 'default',
})
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="props.size"
    :class="
      cn(
        'flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        props.class,
      )
    "
  >
    <slot />
    <ChevronDown class="pointer-events-none size-4 text-muted-foreground" />
  </SelectTrigger>
</template>
