<script setup lang="ts">
/**
 * Admin shell — source `shipany-dir/src/routes/admin/route.tsx` plus the
 * `AppLayout` it renders.
 *
 * Nav order, the five group blocks, the collapsible parents and the three
 * footer entries are copied from the source verbatim, including the hrefs:
 * the directory pages live under `/admin/directory/*`, not `/admin/*`, because
 * that is where the source puts them.
 *
 * The gate is not here. `server/middleware/admin-token.ts` answers 404 to any
 * request without the owner's cookie, so by the time this layout runs the
 * caller has already been authorised. The source instead asks
 * `useUserPermissions()` for `admin.*` and redirects to `/settings` — that
 * check needs a users/roles table this build does not have, and it would be
 * a second, weaker copy of the gate that already ran on the server.
 */
import {
  Bot,
  Compass,
  CreditCard,
  FolderOpen,
  Home,
  LayoutDashboard,
  Settings,
  Shield,
} from 'lucide-vue-next'
import type { NavItem } from '~/components/AppSidebar.vue'

const { t } = useSettingsI18n()
// The console is Chinese regardless of URL prefix; keep the document language
// in step with the copy it actually renders.
useHead({ htmlAttrs: { lang: 'zh-Hans' } })
// The submissions queue is this site's own addition (the source reviews its
// listings from /admin/directory/tools), so its label is not in the generated
// source copy table. Always Chinese: the console is owner-only, and `/admin`
// resolves to the English locale.

const GROUP = computed(() => t('common.systems.admin'))

const navItems = computed<NavItem[]>(() => [
  {
    href: '/admin',
    label: t('admin.nav.overview'),
    icon: LayoutDashboard,
    group: GROUP.value,
  },
  {
    href: '/admin/directory/tools',
    label: t('admin.nav.directory'),
    icon: Compass,
    group: GROUP.value,
    items: [
      { href: '/admin/directory/tools', label: t('admin.nav.directory_tools') },
      { href: '/admin/submissions', label: '提交审核' },
      { href: '/admin/directory/categories', label: t('admin.nav.directory_categories') },
      { href: '/admin/directory/tags', label: t('admin.nav.directory_tags') },
      { href: '/admin/directory/collections', label: t('admin.nav.directory_collections') },
      { href: '/admin/directory/ads', label: t('admin.nav.directory_ads') },
      { href: '/admin/billboard', label: 'Billboard 展位' },
    ],
  },
  {
    href: '/admin/users',
    label: t('admin.nav.rbac'),
    icon: Shield,
    group: GROUP.value,
    items: [
      { href: '/admin/users', label: t('admin.nav.users') },
      { href: '/admin/invite-codes', label: t('admin.nav.invite_codes') },
      { href: '/admin/roles', label: t('admin.nav.roles') },
      { href: '/admin/permissions', label: t('admin.nav.permissions') },
    ],
  },
  {
    href: '/admin/payments',
    label: t('admin.nav.billing'),
    icon: CreditCard,
    group: GROUP.value,
    items: [
      { href: '/admin/payments', label: t('admin.nav.payments') },
      { href: '/admin/subscriptions', label: t('admin.nav.subscriptions') },
      { href: '/admin/credits', label: t('admin.nav.credits') },
    ],
  },
  {
    href: '/admin/categories',
    label: t('admin.nav.content'),
    icon: FolderOpen,
    group: GROUP.value,
    items: [
      { href: '/admin/categories', label: t('admin.nav.categories') },
      { href: '/admin/posts', label: t('admin.nav.posts') },
      { href: '/admin/guest-posts', label: t('admin.nav.guest_posts') },
      { href: '/admin/tickets', label: t('admin.nav.tickets') },
    ],
  },
])

const footerNavItems = computed<NavItem[]>(() => [
  { href: '/admin/agent', label: t('admin.nav.agent'), icon: Bot },
  { href: '/admin/settings', label: t('admin.nav.settings'), icon: Settings },
  { href: '/', label: t('common.systems.home'), icon: Home, newTab: true },
])
</script>

<template>
  <IconSprite />

  <AppLayout>
    <template #sidebar="{ mobile }">
      <AppSidebar
        :nav-items="navItems"
        :footer-nav-items="footerNavItems"
        brand-href="/admin"
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
