<script setup lang="ts">
/**
 * Source `components/ui/tooltip.tsx` — `TooltipContent` (+ the arrow, which the
 * source renders inside the popup).
 */
import { TooltipArrow, TooltipContent, TooltipPortal } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    class?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    sideOffset?: number
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
  }>(),
  { side: 'top', sideOffset: 4, align: 'center', alignOffset: 0 },
)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      :side="props.side"
      :side-offset="props.sideOffset"
      :align="props.align"
      :align-offset="props.alignOffset"
      :class="
        cn(
          'isolate z-50 inline-flex w-fit max-w-xs origin-(--reka-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.class,
        )
      "
    >
      <slot />
      <TooltipArrow
        class="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:-right-1 data-[side=left]:top-1/2 data-[side=left]:-translate-y-1/2 data-[side=right]:-left-1 data-[side=right]:top-1/2 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5"
      />
    </TooltipContent>
  </TooltipPortal>
</template>
