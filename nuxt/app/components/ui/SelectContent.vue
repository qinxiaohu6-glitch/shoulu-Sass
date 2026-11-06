<script setup lang="ts">
/**
 * Source `components/ui/select.tsx` — `SelectContent`.
 *
 * reka-ui splits Base UI's `Positioner` + `Popup` into Portal → Content →
 * Viewport; the class strings from the source's popup live on `SelectContent`
 * and the viewport is unstyled (`p-0`), so the popup's own padding is the only
 * padding.
 *
 * One deliberate difference: the source passes `alignItemWithTrigger` (its
 * default `true`), which overlays the popup on the trigger so the trigger's own
 * text lines up with the selected row. reka-ui's equivalent is
 * `position="item-aligned"`, and in this build it renders the popup at the
 * bottom of the document with no anchor — the list existed in the DOM but was
 * never visible. `position="popper"` anchors to the trigger with floating-ui
 * and is the structure reka-ui documents for `SelectViewport`, so the popup
 * drops below the trigger instead of over it. Everything else — width, height
 * cap, animation, ring — is unchanged.
 */
import { SelectContent, SelectPortal, SelectViewport } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    class?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    sideOffset?: number
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
  }>(),
  { side: 'bottom', sideOffset: 4, align: 'start', alignOffset: 0 },
)
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      position="popper"
      :side="props.side"
      :side-offset="props.sideOffset"
      :align="props.align"
      :align-offset="props.alignOffset"
      :class="
        cn(
          'relative isolate z-50 max-h-(--reka-select-content-available-height) w-(--reka-select-trigger-width) min-w-36 origin-(--reka-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.class,
        )
      "
    >
      <SelectViewport class="p-0">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
