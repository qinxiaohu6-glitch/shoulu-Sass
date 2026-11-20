<script setup lang="ts">
/**
 * One product icon, in whichever form the record happens to have it.
 *
 * Catalogue logos are repo-relative and always present; a submitted listing
 * carries an absolute URL and may carry nothing at all. A missing logo used to
 * render a broken <img>, which reads as "this site is broken" — a monogram is
 * honest about the fact that no icon was supplied. A URL that 404s is treated
 * the same way: on error we swap to the initial rather than show a broken image.
 *
 * `error` alone is not enough. A request that never answers — a third-party host
 * that is unreachable from the visitor's network — fires neither `load` nor
 * `error`, and the icon slot stays an empty box forever. So the image also gives
 * up after a few seconds and falls back to the monogram.
 */
const props = withDefaults(
  defineProps<{
    logo: string
    name: string
    /** Intrinsic size in px; the CSS box around it sets the rendered size. */
    size: number
    lazy?: boolean
    /** Rails and lists already name the tool next to the icon. */
    decorative?: boolean
  }>(),
  { lazy: false, decorative: false },
)

/** Long enough for a slow icon, short enough that nobody stares at an empty box. */
const GIVE_UP_MS = 4000

const failed = ref(false)
const image = ref<HTMLImageElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function stopWaiting() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

function startWaiting() {
  stopWaiting()
  if (!props.logo || failed.value) return
  timer = setTimeout(() => {
    failed.value = true
  }, GIVE_UP_MS)
}

function onLoad() {
  stopWaiting()
}

function onError() {
  stopWaiting()
  failed.value = true
}

onMounted(() => {
  const node = image.value
  // An icon already in the browser cache finishes before hydration runs, so
  // `load` never fires on the hydrated node. The element itself knows.
  if (node?.complete) {
    if (node.naturalWidth > 0) return
    failed.value = true
    return
  }
  startWaiting()
})

watch(
  () => props.logo,
  () => {
    failed.value = false
    nextTick(startWaiting)
  },
)

onBeforeUnmount(stopWaiting)

</script>

<template>
  <img
    v-if="logo && !failed"
    ref="image"
    :src="logoSrc(logo)"
    :alt="decorative ? '' : `${name} logo`"
    :width="size"
    :height="size"
    :loading="lazy ? 'lazy' : undefined"
    @load="onLoad"
    @error="onError"
  >
  <span
    v-else
    class="tool-logo__initial"
    :style="{ fontSize: `${Math.round(size * 0.42)}px` }"
    aria-hidden="true"
  >{{ name.slice(0, 1).toUpperCase() }}</span>
</template>

<style scoped>
/* Fills whatever `.tool-icon` / `.detail-icon` box it sits in. */
.tool-logo__initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: 700;
  line-height: 1;
  color: var(--muted-foreground);
}
</style>
