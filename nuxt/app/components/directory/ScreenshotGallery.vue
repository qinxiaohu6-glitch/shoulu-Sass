<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/ScreenshotGallery.tsx`.
 *
 * A 16:10 hero shot with arrow buttons, a `1 / n` counter, a thumbnail strip, and
 * a lightbox on click. Arrow keys step the gallery while it has focus.
 *
 * The source keys the gallery off `tool.screenshots`; this build stores the same
 * thing as `shots` (bare file names under `assets/img/screenshots`), so the page
 * resolves the URLs and passes them in.
 */
const props = defineProps<{ toolName: string; screenshots: string[] }>()

const t = useDirectoryCopy()

const activeIndex = ref(0)
const open = ref(false)

const total = computed(() => props.screenshots.length)
const safeIndex = computed(() => Math.min(activeIndex.value, Math.max(0, total.value - 1)))
const current = computed(() => props.screenshots[safeIndex.value])

function step(delta: number) {
  if (total.value <= 1) return
  activeIndex.value = (activeIndex.value + delta + total.value) % total.value
}

function onKeydown(event: KeyboardEvent) {
  if (total.value <= 1) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
  }
}
</script>

<template>
  <div
    v-if="total"
    tabindex="0"
    :aria-label="`${toolName} screenshots gallery`"
    class="mb-8 space-y-3 outline-none"
    @keydown="onKeydown"
  >
    <div class="group relative overflow-hidden rounded-xl border border-border bg-muted">
      <button
        type="button"
        :aria-label="t('directory.detail.view_full_size')"
        class="block w-full cursor-zoom-in text-left focus:outline-none"
        @click="open = true"
      >
        <img
          :src="current"
          :alt="`${toolName} screenshot ${safeIndex + 1}`"
          width="1440"
          height="900"
          class="aspect-[16/10] w-full object-cover object-top"
        >
      </button>

      <template v-if="total > 1">
        <button
          type="button"
          :aria-label="t('directory.screenshot_prev')"
          class="absolute top-1/2 left-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/85 shadow-sm backdrop-blur transition hover:bg-background"
          @click.stop="step(-1)"
        >
          <Icon name="chevron-left" :size="16" />
        </button>
        <button
          type="button"
          :aria-label="t('directory.screenshot_next')"
          class="absolute top-1/2 right-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/85 shadow-sm backdrop-blur transition hover:bg-background"
          @click.stop="step(1)"
        >
          <Icon name="chevron-right" :size="16" />
        </button>
        <span
          class="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full border bg-background/85 px-2 py-0.5 text-xs tabular-nums backdrop-blur"
        >
          {{ safeIndex + 1 }} / {{ total }}
        </span>
      </template>
    </div>

    <div v-if="total > 1" class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="(shot, index) in screenshots"
        :key="`${shot}-${index}`"
        type="button"
        :aria-label="`${toolName} screenshot ${index + 1}`"
        :aria-current="index === safeIndex"
        class="shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition"
        :class="
          index === safeIndex
            ? 'border-primary'
            : 'border-transparent opacity-60 hover:opacity-100'
        "
        @click.stop="activeIndex = index"
      >
        <img :src="shot" alt="" loading="lazy" class="aspect-[16/10] w-28 object-cover object-top">
      </button>
    </div>

    <UiDialog :open="open" @update:open="(next: boolean) => (open = next)">
      <UiDialogContent class="max-w-[min(1200px,95vw)] p-2 sm:max-w-[min(1200px,95vw)]">
        <UiDialogTitle class="sr-only">
          {{ `${toolName} screenshot ${safeIndex + 1}` }}
        </UiDialogTitle>
        <div class="relative">
          <img
            :src="current"
            :alt="`${toolName} screenshot ${safeIndex + 1}`"
            class="max-h-[85vh] w-full rounded-md object-contain"
          >
          <template v-if="total > 1">
            <button
              type="button"
              :aria-label="t('directory.screenshot_prev')"
              class="absolute top-1/2 left-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/85 shadow-sm backdrop-blur transition hover:bg-background"
              @click.stop="step(-1)"
            >
              <Icon name="chevron-left" :size="16" />
            </button>
            <button
              type="button"
              :aria-label="t('directory.screenshot_next')"
              class="absolute top-1/2 right-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-background/85 shadow-sm backdrop-blur transition hover:bg-background"
              @click.stop="step(1)"
            >
              <Icon name="chevron-right" :size="16" />
            </button>
          </template>
        </div>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
