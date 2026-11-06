<script setup lang="ts">
/**
 * Source `components/directory/DirectoryListIcon.tsx` — a 40×40 list thumb.
 *
 * One substitution: the source falls back to `/directory-icon-fallback.svg`,
 * an asset this build does not ship. A monogram is used instead — the same
 * choice `ToolLogo.vue` already makes elsewhere, and a better one than a
 * placeholder glyph, because it says which row the icon belongs to.
 */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ src?: string | null; alt: string; size?: number; class?: string }>(),
  { size: 40 },
)

const broken = ref(false)
watch(
  () => props.src,
  () => {
    broken.value = false
  },
)

const showSrc = computed(() => !!props.src?.trim() && !broken.value)
</script>

<template>
  <div
    :class="cn('shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50', props.class)"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  >
    <img
      v-if="showSrc"
      :src="props.src!.trim()"
      :alt="props.alt"
      class="size-full object-cover"
      @error="broken = true"
    >
    <span
      v-else
      class="flex size-full items-center justify-center text-sm font-bold text-muted-foreground"
      aria-hidden="true"
    >
      {{ props.alt.slice(0, 1).toUpperCase() }}
    </span>
  </div>
</template>
