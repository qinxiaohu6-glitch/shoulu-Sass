<script setup lang="ts">
/**
 * Sticky section tabs for the tool detail page.
 *
 * The live stylesheet already ships `.toc` (an inline row of anchor links). This
 * is the sticky variant: it parks under the topbar and highlights whichever
 * section is currently in view, which is what makes a seven-section page
 * navigable instead of a wall of text.
 *
 * Two details that are easy to get wrong:
 *
 *  - The observer's rootMargin has to subtract the *combined* height of the
 *    topbar and this bar. Using just the topbar makes a section register as
 *    "active" while it is still hidden behind the tabs.
 *  - `scroll-padding-top` on `html` covers native hash jumps, but the click
 *    handler scrolls manually, so it subtracts the same offset itself. Without
 *    that, clicking a tab lands the heading underneath the sticky bar.
 */

const props = defineProps<{
  items: { id: string; label: string }[]
}>()

const { pick } = useLang()
const active = ref(props.items[0]?.id ?? '')
const navRef = ref<HTMLElement | null>(null)

/** Topbar height is measured, not assumed: `.topbar__inner` is 56px while
 *  `--header-h` is 52px, and the two are easy to confuse. */
function offsetPx(): number {
  const bar = navRef.value?.offsetHeight || 44
  const header = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 56
  return header + bar
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (props.items.length === 0) return

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) active.value = visible.target.id
    },
    { rootMargin: `-${offsetPx()}px 0px -55% 0px`, threshold: 0 },
  )

  for (const item of props.items) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

function go(event: MouseEvent, id: string) {
  event.preventDefault()
  active.value = id
  const el = document.getElementById(id)
  if (!el) return
  const top = window.scrollY + el.getBoundingClientRect().top - offsetPx() - 8
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  // replaceState, not pushState: a tab click is not a page visit, and pushing
  // would make the browser Back button walk through every section.
  window.history.replaceState(null, '', `#${id}`)
}
</script>

<template>
  <nav
    v-if="items.length > 1"
    ref="navRef"
    class="toc toc--sticky"
    :aria-label="pick('本页目录', 'On this page')"
  >
    <a
      v-for="item in items"
      :key="item.id"
      :href="`#${item.id}`"
      :class="{ 'is-active': active === item.id }"
      :aria-current="active === item.id ? 'location' : undefined"
      @click="go($event, item.id)"
    >{{ item.label }}</a>
  </nav>
</template>
