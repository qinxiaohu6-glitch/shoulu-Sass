<script setup lang="ts">
/**
 * Source `components/ui/sheet.tsx` — `SheetContent`.
 *
 * `left` and `right` are implemented. `left` is the mobile sidebar; `right` is
 * every admin form drawer (`routes/admin/directory/-form-ui.tsx`), which is why
 * the side is a prop here rather than hard-coded. `top` / `bottom` have no call
 * site in either build and are omitted rather than stubbed.
 *
 * Base UI's `data-starting-style` / `data-ending-style` (enter/exit keyframes)
 * map onto reka-ui's `data-[state=open]` / `data-[state=closed]`.
 */
import { DialogClose, DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ class?: string; side?: 'left' | 'right'; showCloseButton?: boolean }>(),
  { side: 'left', showCloseButton: true },
)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      data-slot="sheet-overlay"
      class="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
    />
    <DialogContent
      data-slot="sheet-content"
      :data-side="props.side"
      :class="
        cn(
          'fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
          'data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:sm:max-w-sm',
          'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        v-if="props.showCloseButton"
        data-slot="sheet-close"
        class="absolute top-3 right-3 inline-flex size-7 shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X class="pointer-events-none size-4 shrink-0" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
