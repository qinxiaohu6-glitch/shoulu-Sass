<script setup lang="ts">
/**
 * Settings shell — source `shipany-dir/src/routes/settings/route.tsx` plus the
 * `AppLayout` it renders.
 *
 * Nav order, group labels and the `show` gates come from the source. The gates
 * read the source's own defaults (`config/user-features.ts`): credits, billing,
 * payments and tickets on; API keys off until the project actually offers an
 * API. There is no admin config endpoint here to change them, so the defaults
 * are the only state — which is also what the source renders on a fresh install.
 *
 * `Guest posts` only appears when the site accepts submissions; `useGuestPostInfo`
 * has no endpoint in this build, so it stays hidden exactly as the source hides
 * it when `/api/guest-posts/info` reports `enabled: false`.
 *
 * Not ported yet: `blocks/support-widget.tsx`, the floating support button the
 * source mounts next to `<Outlet/>`. It opens a ticket-creation dialog and this
 * build has no endpoint to create one from, so mounting it would only produce a
 * button that fails. The page it would duplicate (`/settings/tickets`) is
 * ported.
 */
import {
  Coins,
  CreditCard,
  Home,
  Key,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  PenLine,
  Presentation,
  Receipt,
  User,
} from 'lucide-vue-next'
import type { NavItem } from '~/components/AppSidebar.vue'

const { pick } = useLang()
const route = useRoute()
const localePath = useLocalePath()
const { user, ensure } = useSession()

/**
 * These pages are about one account, so there is nothing to show without one.
 *
 * The old build did this check in a `<script>` in `<head>` against
 * localStorage — which meant the page flashed before the redirect and broke
 * entirely for anyone who signed in on another device. Resolving the session
 * here means the redirect happens before a byte of the page is sent.
 */
const me = await ensure()
if (!me) {
  await navigateTo(localePath({ path: '/sign-in', query: { next: route.fullPath } }))
}

onMounted(() => {
  // `ensure` rather than `refresh`: the page has usually already resolved the
  // session during SSR, and its result is carried over in the payload.
  void ensure()
})

const ACTIVITY = computed(() => pick('活动', 'Activity'))
const ACCOUNT = computed(() => pick('账户', 'Account'))
const CONTENT = computed(() => pick('内容', 'Content'))

/** Source `config/user-features.ts` defaults, via the shared composable so the
 *  nav and `SettingsFeatureGate` cannot disagree. */
const FEATURES = useUserFeatures()
const GUEST_POSTS_ENABLED = false

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { href: '/settings', label: pick('概览', 'Overview'), icon: LayoutDashboard },
    {
      href: '/settings/submissions',
      label: pick('我的提交', 'My Submissions'),
      icon: Megaphone,
      group: ACTIVITY.value,
    },
    {
      href: '/settings/ads',
      label: pick('我的广告', 'My Ads'),
      icon: Presentation,
      group: ACTIVITY.value,
    },
    {
      href: '/settings/profile',
      label: pick('个人资料', 'Profile'),
      icon: User,
      group: ACCOUNT.value,
    },
  ]
  if (FEATURES.credits) {
    items.push({ href: '/settings/credits', label: pick('积分', 'Credits'), icon: Coins, group: ACCOUNT.value })
  }
  if (FEATURES.billing) {
    items.push({ href: '/settings/billing', label: pick('账单', 'Billing'), icon: CreditCard, group: ACCOUNT.value })
  }
  if (FEATURES.payments) {
    items.push({ href: '/settings/payments', label: pick('付款记录', 'Payments'), icon: Receipt, group: ACCOUNT.value })
  }
  if (FEATURES.apikeys) {
    items.push({ href: '/settings/apikeys', label: pick('API 密钥', 'API Keys'), icon: Key, group: ACCOUNT.value })
  }
  if (FEATURES.tickets) {
    items.push({
      href: '/settings/tickets',
      label: pick('工单支持', 'Support Tickets'),
      icon: LifeBuoy,
      group: CONTENT.value,
    })
  }
  if (GUEST_POSTS_ENABLED) {
    items.push({
      href: '/settings/guest-posts',
      label: pick('文章投稿', 'Guest Posts'),
      icon: PenLine,
      group: CONTENT.value,
    })
  }
  return items
})

const footerNavItems = computed<NavItem[]>(() => [
  { href: '/', label: pick('首页', 'Home'), icon: Home, newTab: true },
])
</script>

<template>
  <IconSprite />

  <AppLayout>
    <template #sidebar="{ mobile }">
      <AppSidebar
        :nav-items="navItems"
        :footer-nav-items="footerNavItems"
        brand-href="/settings"
        :mobile="mobile"
      >
        <template #brand>
          <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28" >
          <span class="flex-1 truncate font-serif text-lg leading-none italic">Product Atlas</span>
        </template>
        <template #footer>
          <UserMenu />
        </template>
      </AppSidebar>
    </template>

    <slot />
  </AppLayout>
</template>
