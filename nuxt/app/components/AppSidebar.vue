<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/app-sidebar.tsx`.
 *
 * Groups, the exact-match rule for the first item, the collapsible parents and
 * the `localStorage` key that remembers which parents are open are all carried
 * over. The only structural difference is that this component is the *content*
 * of the rail — `AppLayout` owns the provider, the widths and the mobile drawer
 * — so it can be slotted into both the desktop rail and the mobile sheet
 * without duplicating the nav.
 */
import type { Component } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

export type NavSubItem = { href: string; label: string; newTab?: boolean }
export type NavItem = {
  href: string
  label: string
  icon: Component
  group?: string
  newTab?: boolean
  items?: NavSubItem[]
}

const props = withDefaults(
  defineProps<{
    navItems: NavItem[]
    footerNavItems?: NavItem[]
    brandHref?: string
    /** Rendered by the caller (logo + wordmark, or just a wordmark). */
    brandLabel?: string
    /** Set by the mobile sheet so a tap closes the drawer. */
    mobile?: boolean
  }>(),
  { brandHref: '/', footerNavItems: () => [], brandLabel: 'Product Atlas' },
)

const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const localePath = useLocalePath()

/** Locale-free path: zh routes carry a /zh prefix the nav hrefs do not. */
const pathname = computed(() => route.path.replace(/^\/zh(?=\/|$)/, '') || '/')

function isActiveHref(href: string) {
  return href === props.navItems[0]?.href
    ? pathname.value === href
    : pathname.value === href || pathname.value.startsWith(`${href}/`)
}

/** Consecutive items sharing a `group` become one labelled block. */
const groups = computed(() => {
  const out: { label?: string; items: NavItem[] }[] = []
  let current: string | undefined | symbol = Symbol('init')
  for (const item of props.navItems) {
    if (item.group !== current) {
      out.push({ label: item.group, items: [item] })
      current = item.group
    } else {
      out[out.length - 1]!.items.push(item)
    }
  }
  return out
})

const storageKey = computed(() => `sidebar-open:${props.brandHref}`)

const activeParents = computed(
  () =>
    new Set(
      props.navItems
        .filter((item) => item.items?.some((sub) => isActiveHref(sub.href)))
        .map((item) => item.href),
    ),
)

function defaultParents() {
  const first = props.navItems.find((i) => i.items?.length)
  const set = new Set<string>(first ? [first.href] : [])
  for (const href of activeParents.value) set.add(href)
  return set
}

// Seeded with the defaults so SSR and the first client render agree; the
// persisted set replaces it after mount, exactly as the source does.
const openItems = ref<Set<string>>(defaultParents())

onMounted(() => {
  let saved: string[] | null = null
  try {
    saved = JSON.parse(localStorage.getItem(storageKey.value) || 'null')
  } catch {
    saved = null
  }
  const next = saved ? new Set(saved) : defaultParents()
  for (const href of activeParents.value) next.add(href)
  openItems.value = next
})

// Keep the active parent open as the route changes, without touching the rest.
watch(pathname, () => {
  const next = new Set(openItems.value)
  let changed = false
  for (const href of activeParents.value) {
    if (!next.has(href)) {
      next.add(href)
      changed = true
    }
  }
  if (changed) openItems.value = next
})

function toggleItem(href: string) {
  const next = new Set(openItems.value)
  if (next.has(href)) next.delete(href)
  else next.add(href)
  openItems.value = next
  try {
    localStorage.setItem(storageKey.value, JSON.stringify([...next]))
  } catch {
    /* private mode — the open state just will not persist */
  }
}

function footerActive(item: NavItem) {
  if (item.newTab) return false
  if (item.href === '/') return pathname.value === '/'
  return pathname.value.startsWith(item.href)
}
</script>

<template>
  <!-- Same height as the content header (h-14) so the brand centres on the
       sidebar toggle, with equal space above and below. -->
  <div
    data-slot="sidebar-header"
    data-sidebar="header"
    class="flex h-14 shrink-0 flex-col justify-center gap-2 p-2 py-0"
  >
    <ul data-slot="sidebar-menu" data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class="group/menu-item relative">
        <NuxtLink
          :to="localePath(props.brandHref)"
          class="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
          @click="emit('navigate')"
        >
          <slot name="brand">
            <span class="flex-1 font-serif text-lg leading-snug italic">{{ props.brandLabel }}</span>
          </slot>
        </NuxtLink>
      </li>
    </ul>
  </div>

  <div
    data-slot="sidebar-content"
    data-sidebar="content"
    class="no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto"
  >
    <div
      v-for="(group, gi) in groups"
      :key="gi"
      data-slot="sidebar-group"
      data-sidebar="group"
      class="relative flex w-full min-w-0 flex-col p-2"
    >
      <div
        v-if="group.label"
        data-slot="sidebar-group-label"
        data-sidebar="group-label"
        class="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0"
      >
        {{ group.label }}
      </div>
      <div
        data-slot="sidebar-group-content"
        data-sidebar="group-content"
        class="flex w-full flex-col gap-2 text-sm"
      >
        <ul data-slot="sidebar-menu" data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
          <li
            v-for="item in group.items"
            :key="item.href"
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            class="group/menu-item relative"
          >
            <!-- Collapsible parent with sub-items. -->
            <template v-if="item.items?.length">
              <button
                type="button"
                data-slot="sidebar-menu-button"
                data-sidebar="menu-button"
                :data-active="item.items.some((s) => isActiveHref(s.href)) && !openItems.has(item.href) ? '' : undefined"
                :aria-expanded="openItems.has(item.href)"
                :class="
                  cn(
                    'peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
                  )
                "
                @click="toggleItem(item.href)"
              >
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
                <ChevronRight
                  :class="
                    cn(
                      'ml-auto size-4 shrink-0 text-sidebar-foreground/70 transition-transform',
                      openItems.has(item.href) && 'rotate-90',
                    )
                  "
                />
              </button>
              <ul
                v-if="openItems.has(item.href)"
                data-slot="sidebar-menu-sub"
                data-sidebar="menu-sub"
                class="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5"
              >
                <li
                  v-for="sub in item.items"
                  :key="sub.href"
                  data-slot="sidebar-menu-sub-item"
                  data-sidebar="menu-sub-item"
                  class="group/menu-sub-item relative"
                >
                  <NuxtLink
                    :to="localePath(sub.href)"
                    data-slot="sidebar-menu-sub-button"
                    data-sidebar="menu-sub-button"
                    :data-active="isActiveHref(sub.href) ? '' : undefined"
                    :class="
                      cn(
                        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&_svg]:shrink-0',
                      )
                    "
                    @click="emit('navigate')"
                  >
                    <span>{{ sub.label }}</span>
                  </NuxtLink>
                </li>
              </ul>
            </template>

            <!-- Plain link. -->
            <NuxtLink
              v-else
              :to="localePath(item.href)"
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              :data-active="isActiveHref(item.href) ? '' : undefined"
              :class="
                cn(
                  'peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
                )
              "
              @click="emit('navigate')"
            >
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div
    data-slot="sidebar-footer"
    data-sidebar="footer"
    class="flex flex-col gap-2 p-2"
  >
    <ul
      v-if="props.footerNavItems.length"
      data-slot="sidebar-menu"
      data-sidebar="menu"
      class="flex w-full min-w-0 flex-col gap-1"
    >
      <li
        v-for="item in props.footerNavItems"
        :key="item.href"
        data-slot="sidebar-menu-item"
        data-sidebar="menu-item"
        class="group/menu-item relative"
      >
        <a
          v-if="item.newTab"
          :href="localePath(item.href)"
          target="_blank"
          rel="noopener noreferrer"
          data-slot="sidebar-menu-button"
          data-sidebar="menu-button"
          :class="
            cn(
              'peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
            )
          "
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </a>
        <NuxtLink
          v-else
          :to="localePath(item.href)"
          data-slot="sidebar-menu-button"
          data-sidebar="menu-button"
          :data-active="footerActive(item) ? '' : undefined"
          :class="
            cn(
              'peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
            )
          "
          @click="emit('navigate')"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
    <slot name="footer" />
  </div>
</template>
