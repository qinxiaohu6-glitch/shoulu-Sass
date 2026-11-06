<script setup lang="ts">
/**
 * Source `components/ui/dropdown-menu.tsx` — `DropdownMenuContent`.
 *
 * `data-open` / `data-closed` and the `slide-in-from-*` enter styles are Base UI
 * spellings; reka-ui reports `data-[state=open|closed]` and puts the resolved
 * side on `data-side`, so the per-side slide classes translate one for one.
 *
 * `align`/`side` default to the source's own (`start` / `bottom`) — the source
 * sets them on `Menu.Positioner`, which is what reka-ui's Content does itself.
 */
import { DropdownMenuContent, DropdownMenuPortal } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    class?: string
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'right' | 'bottom' | 'left'
    alignOffset?: number
    sideOffset?: number
  }>(),
  { align: 'start', side: 'bottom', alignOffset: 0, sideOffset: 4 },
)
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      :align="props.align"
      :side="props.side"
      :align-offset="props.alignOffset"
      :side-offset="props.sideOffset"
      :class="
        cn(
          'isolate z-50 max-h-(--reka-dropdown-menu-content-available-height) min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:overflow-hidden data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.class,
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
