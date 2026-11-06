<script setup lang="ts">
/**
 * Source `components/ui/sonner.tsx`.
 *
 * The source's toaster is `sonner` (React); this is `vue-sonner`, its Vue port —
 * same DOM, same `data-sonner-*` attributes, same `toast.success/error` API, so
 * every ported page calls `toast.*` exactly as the source does.
 *
 * Two differences, both forced by this build:
 *
 *   · `theme` — the source reads it from `next-themes`. There is no theme
 *     provider here, so it reads the `.dark` class that `legacy.css` toggles.
 *   · `richColors` — the source passes `!analytics?.appearanceEnabled`, i.e.
 *     `true` unless the appearance switch is on. This build has no appearance
 *     switch, so it is always `true`, which is the source's default look.
 *
 * Mounted once in `app.vue`; nothing else needs to render it.
 */
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from 'lucide-vue-next'
import { Toaster } from 'vue-sonner'

const theme = ref<'light' | 'dark'>('light')

onMounted(() => {
  const read = () =>
    (theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  read()
  const observer = new MutationObserver(read)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onBeforeUnmount(() => observer.disconnect())
})

/** Sonner's CSS custom properties, pointed at the theme's popover surface. */
const tokens = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',
}
</script>

<template>
  <Toaster
    position="top-center"
    :theme="theme"
    :rich-colors="true"
    :icons="{
      success: CircleCheck,
      info: Info,
      warning: TriangleAlert,
      error: OctagonX,
      loading: Loader2,
    }"
    :style="tokens"
    :toast-options="{ classes: { toast: 'cn-toast' } }"
  />
</template>
