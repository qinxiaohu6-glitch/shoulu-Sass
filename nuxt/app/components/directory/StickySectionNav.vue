<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/StickySectionNav.tsx`.
 *
 * The tab strip above a tool's long-form sections. Three behaviours carry over
 * unchanged:
 *
 *  - **Sticky under the header.** The source's `HEADER_OFFSET_PX = 56` matches this
 *    site's topbar exactly (`legacy.css` `.topbar__inner { height: 56px }`, and the
 *    topbar itself is `position: sticky`), so the offset needs no re-derivation.
 *  - **Scroll spy.** An IntersectionObserver with `-offset` top margin and `-55%`
 *    bottom margin marks whichever section occupies the upper band.
 *  - **Click scrolls with an offset**, then rewrites the hash with `replaceState`
 *    so the URL follows the reader without adding history entries.
 *
 * Hidden when there is only one tab — a nav pointing at a single section is noise.
 */
import type { SectionTabItem } from '~/utils/directory-ui'

const props = defineProps<{ tabs: SectionTabItem[] }>()

const HEADER_OFFSET_PX = 56

const activeTab = ref(props.tabs[0]?.id ?? '')
const navRef = ref<HTMLElement | null>(null)

function stickyOffsetPx() {
  return HEADER_OFFSET_PX + (navRef.value?.offsetHeight || 48)
}

let observer: IntersectionObserver | null = null

function connect() {
  observer?.disconnect()
  if (!props.tabs.length || typeof window === 'undefined') return

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) activeTab.value = visible.target.id
    },
    { rootMargin: `-${stickyOffsetPx()}px 0px -55% 0px`, threshold: 0 },
  )

  for (const tab of props.tabs) {
    const el = document.getElementById(tab.id)
    if (el) observer.observe(el)
  }
}

onMounted(connect)
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.tabs.map((tab) => tab.id).join(','), connect, { flush: 'post' })

function goTo(event: MouseEvent, id: string) {
  event.preventDefault()
  activeTab.value = id
  const el = document.getElementById(id)
  if (!el) return
  const top = window.scrollY + el.getBoundingClientRect().top - stickyOffsetPx()
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  window.history.replaceState(null, '', `#${id}`)
}
</script>

<template>
  <nav
    v-if="tabs.length > 1"
    ref="navRef"
    class="scrollbar-none sticky top-14 z-20 -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 backdrop-blur sm:mx-0 sm:px-0"
  >
    <a
      v-for="tab in tabs"
      :key="tab.id"
      :href="`#${tab.id}`"
      :aria-current="activeTab === tab.id ? 'location' : undefined"
      class="relative shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors"
      :class="
        activeTab === tab.id
          ? 'font-semibold text-primary after:bg-primary'
          : 'text-muted-foreground after:bg-transparent hover:text-foreground'
      "
      @click="goTo($event, tab.id)"
    >
      {{ tab.label }}
    </a>
  </nav>
</template>
