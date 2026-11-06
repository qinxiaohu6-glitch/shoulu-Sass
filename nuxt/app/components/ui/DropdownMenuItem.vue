<script setup lang="ts">
/**
 * Source `components/ui/dropdown-menu.tsx` — `DropdownMenuItem`.
 *
 * `focus:bg-accent` is kept verbatim: reka-ui moves real DOM focus onto the
 * highlighted item, so `:focus` is the correct selector here — no `data-
 * highlighted` translation needed.
 */
import { DropdownMenuItem } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    class?: string
    inset?: boolean
    variant?: 'default' | 'destructive'
    disabled?: boolean
  }>(),
  { variant: 'default' },
)
const emit = defineEmits<{ select: [Event] }>()
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="props.inset || undefined"
    :data-variant="props.variant"
    :disabled="props.disabled"
    :class="
      cn(
        'group/dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm font-normal outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[inset]:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive',
        props.class,
      )
    "
    @select="(e: Event) => emit('select', e)"
  >
    <slot />
  </DropdownMenuItem>
</template>
