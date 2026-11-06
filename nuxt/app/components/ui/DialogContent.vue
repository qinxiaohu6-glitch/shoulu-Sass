<script setup lang="ts">
/**
 * Source `components/ui/dialog.tsx` — `DialogContent` (portal + overlay +
 * popup + the built-in close button).
 *
 * Class strings are the source's, with Base UI's `data-open:` / `data-closed:`
 * variants rewritten to reka-ui's `data-[state=open]:` / `data-[state=closed]:`.
 * Both mean "the dialog just opened / just closed"; the animation utilities
 * themselves come from `tw-animate-css`, which is what the source imports too.
 *
 * The close button is inlined rather than rendered as a `<UiButton>`: the source
 * renders `Button` inside Base UI's `Close` with `render`, which has no direct
 * Vue equivalent that keeps the button semantics, so the classes are copied.
 */
import { DialogClose, DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const props = withDefaults(defineProps<{ class?: string; showCloseButton?: boolean }>(), {
  showCloseButton: true,
})
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      data-slot="dialog-overlay"
      class="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <DialogContent
      data-slot="dialog-content"
      :class="
        cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        v-if="props.showCloseButton"
        data-slot="dialog-close"
        class="absolute top-2 right-2 inline-flex size-7 shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X class="pointer-events-none size-4 shrink-0" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
