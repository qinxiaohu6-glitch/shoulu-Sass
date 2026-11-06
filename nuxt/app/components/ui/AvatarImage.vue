<script setup lang="ts">
/**
 * Source `components/ui/avatar.tsx` — `AvatarImage` + `AvatarFallback`.
 *
 * One component instead of two: the source renders both and lets the browser
 * hide the image when the URL 404s, which is exactly what `@error` does here.
 * Keeping the fallback in the same element means a caller cannot accidentally
 * render both at once.
 */
import { computed, ref, watch } from 'vue'
import { cn } from '~/utils/ui'

const props = defineProps<{
  src?: string | null
  alt?: string
  /** Initials / short text shown when there is no image, or it fails. */
  fallback?: string
  imageClass?: string
  fallbackClass?: string
}>()

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => !!props.src && !failed.value)
</script>

<template>
  <img
    v-if="showImage"
    data-slot="avatar-image"
    :src="props.src ?? undefined"
    :alt="props.alt ?? ''"
    :class="cn('aspect-square size-full rounded-full object-cover', props.imageClass)"
    @error="failed = true"
  >
  <span
    v-else
    data-slot="avatar-fallback"
    :class="
      cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        props.fallbackClass,
      )
    "
  >
    <slot name="fallback">{{ props.fallback }}</slot>
  </span>
</template>
