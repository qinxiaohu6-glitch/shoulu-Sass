<script setup lang="ts">
/**
 * The signed-in shell, ported from `shipany-dir/src/components/app-layout.tsx`
 * and `components/ui/sidebar.tsx`.
 *
 * Only the two paths this deployment can actually reach are implemented:
 * `variant="inset"` + `collapsible="offcanvas"`. Those are the source's
 * `DEFAULT_APPEARANCE` values, and the admin switch that would change them
 * (`APPEARANCE_ENABLED_KEY`) is off — `useAppearance` returns the defaults until
 * an admin turns it on, and there is no admin config here to turn it on. The
 * `floating` / `sidebar` variants and the `icon` collapse are therefore omitted
 * rather than stubbed, so nothing renders a state it cannot reach.
 *
 * Widths, class strings and the cookie that remembers the open state are the
 * source's. The cookie is read on the server too, so the rail does not flash
 * open before hydration.
 */
import { PanelLeft } from 'lucide-vue-next'

const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'

const cookie = useCookie<'true' | 'false'>('sidebar_state', {
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
  sameSite: 'lax',
})

const open = ref(cookie.value !== 'false')
const openMobile = ref(false)
const isMobile = ref(false)

let mql: MediaQueryList | null = null
function syncMobile() {
  isMobile.value = !!mql?.matches
}

onMounted(() => {
  mql = window.matchMedia('(max-width: 767px)')
  syncMobile()
  mql.addEventListener('change', syncMobile)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  mql?.removeEventListener('change', syncMobile)
  window.removeEventListener('keydown', onKeydown)
})

/** ⌘B / Ctrl+B, same shortcut the source binds. */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    toggle()
  }
}

function toggle() {
  if (isMobile.value) {
    openMobile.value = !openMobile.value
    return
  }
  open.value = !open.value
  cookie.value = open.value ? 'true' : 'false'
}

const state = computed(() => (open.value ? 'expanded' : 'collapsed'))
const collapsible = computed(() => (open.value ? '' : 'offcanvas'))

// A tap on a nav link inside the mobile drawer should reveal the page it just
// navigated to. The source keeps the Sheet open (its nav links are React Router
// links, which do not know about the drawer); closing on navigation is the one
// behaviour difference, and it only affects the drawer.
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    openMobile.value = false
  },
)
</script>

<template>
  <div
    class="group/sidebar-wrapper src-page flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar"
    :style="{
      '--sidebar-width': SIDEBAR_WIDTH,
      '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE,
      '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
    }"
  >
    <!-- Desktop rail. `peer` is what the inset below keys its margin and
         rounding off (`md:peer-data-[variant=inset]:m-2`). -->
    <div
      class="group peer hidden text-sidebar-foreground md:block"
      :data-state="state"
      :data-collapsible="collapsible"
      data-variant="inset"
      data-side="left"
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        class="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0"
      />
      <div
        data-slot="sidebar-container"
        data-side="left"
        class="fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) p-2 transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] md:flex"
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          class="flex size-full flex-col bg-sidebar"
        >
          <slot name="sidebar" />
        </div>
      </div>
    </div>

    <!-- Mobile drawer. The source renders the same tree inside a Sheet; this
         keeps one copy of the nav by slotting it into both. -->
    <UiSheet v-model:open="openMobile">
      <UiSheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        :show-close-button="false"
        class="w-(--sidebar-width-mobile) bg-sidebar p-0 text-sidebar-foreground"
      >
        <div class="flex h-full w-full flex-col">
          <slot name="sidebar" :mobile="true" />
        </div>
      </UiSheetContent>
    </UiSheet>

    <main
      data-slot="sidebar-inset"
      class="relative flex w-full min-w-0 flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2"
    >
      <header class="flex h-14 shrink-0 items-center gap-2">
        <div class="flex items-center gap-2 px-4">
          <UiButton
            variant="ghost"
            size="icon-sm"
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            class="-ml-1"
            @click="toggle"
          >
            <PanelLeft />
            <span class="sr-only">Toggle Sidebar</span>
          </UiButton>
        </div>
        <div class="flex-1" />
        <div v-if="$slots.headerExtra" class="flex items-center gap-1 px-4">
          <slot name="headerExtra" />
        </div>
      </header>
      <div class="min-w-0 flex-1 overflow-x-clip">
        <slot />
      </div>
    </main>
  </div>
</template>
