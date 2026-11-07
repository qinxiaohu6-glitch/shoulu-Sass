<script setup lang="ts">
import {
  CONTACT_EMAIL,
  SOCIAL_X_HANDLE,
  SOCIAL_X_URL,
  contactHref,
} from '~~/shared/content/site-contact'

const { locale, setLocale, pick } = useLang()

/**
 * The footer is where Waffo's reviewer looks for a real reporting channel.
 * With no mailbox configured we render nothing rather than a made-up address;
 * the legal documents fall back to the support ticket system until then.
 * The X account is a second monitored channel, not six unmonitored placeholders
 * — the Waffo TOS template explicitly prefers fewer real channels.
 */
const contactMail = contactHref()
const contactLabel = CONTACT_EMAIL
const socialXUrl = SOCIAL_X_URL
const socialXHandle = SOCIAL_X_HANDLE

const colorMode = useColorMode()
const route = useRoute()
const switchLocalePath = useSwitchLocalePath()

/**
 * Every internal link on this layout goes through `localePath`.
 *
 * The zh pages are a real mirror at `/zh/...`, and `detectBrowserLanguage` is
 * off — so a bare `to="/tools"` on a zh page sends the reader to the English
 * catalogue with no way back. That was true of the whole layout: the sidebar,
 * the footer and the drawer all dropped the prefix, which made the Chinese
 * build navigable only by editing the URL.
 */
const localePath = useLocalePath()

/**
 * Landing back where you were is the whole point of `next`.
 *
 * The topbar and the drawer both linked to a bare `/sign-in`, so every
 * sign-in dropped the reader on the homepage. On the zh mirror that meant
 * the *English* homepage — the one place a Chinese reader has no way back
 * from without editing the URL. Carry `route.fullPath` instead, and when the
 * reader is already on the sign-in page, send them to the homepage in the
 * language they are reading.
 */
const signInLink = computed(() => {
  const here = route.fullPath
  const onSignIn = here === '/sign-in' || here.startsWith('/sign-in?') || here === '/zh/sign-in' || here.startsWith('/zh/sign-in?')
  return localePath({ path: '/sign-in', query: { next: onSignIn ? localePath('/') : here } })
})

/**
 * Markup mirrors the live site one-for-one: `shell` > `sidebar` + `main` >
 * `topbar` + content + `footer`. The class names are the original ones, and
 * the rules that style them come from legacy.css — so the rail width, the
 * 56px topbar, the 15.5rem sidebar and the sticky behaviour are the site's
 * own numbers rather than re-derived Tailwind approximations.
 */
const navGroups = computed(() => [
  {
    label: pick('浏览', 'Browse'),
    items: [
      { label: pick('发现', 'Discover'), to: '/', icon: 'compass' },
      { label: pick('产品', 'Products'), to: '/tools', icon: 'layout-grid' },
      { label: pick('分类', 'Categories'), to: '/categories', icon: 'shapes' },
      { label: pick('合集', 'Collections'), to: '/collections', icon: 'sparkles' },
      { label: pick('开发者', 'Makers'), to: '/makers', icon: 'user' },
      { label: pick('定价', 'Pricing'), to: '/pricing', icon: 'credit-card' },
      { label: pick('SEO 诊断', 'SEO check'), to: '/seo-check', icon: 'gauge' },
      { label: pick('周榜', 'Weekly'), to: '/weekly', icon: 'trophy' },
      { label: pick('最新收录', 'Just added'), to: '/just-added', icon: 'activity' },
    ],
  },
  {
    label: pick('更多', 'More'),
    items: [
      // Blog is deliberately not linked: the source's two posts are demo
      // content, not this site's writing. The page still exists at /blog so it
      // can be switched on once there is something real to publish.
      { label: pick('提交产品', 'Submit a product'), to: '/submit', icon: 'plus' },
      { label: pick('我的提交', 'My submissions'), to: '/settings/submissions', icon: 'inbox' },
    ],
  },
])

/**
 * Compare against the locale-less path: under `prefix_except_default` the zh
 * routes carry a /zh prefix, and the raw `route.path` would never match the
 * `to` values above — which silently dropped the active state on every zh page.
 */
function isActive(to: string) {
  const path = locale.value === 'zh'
    ? (route.path.replace(/^\/zh(?=\/|$)/, '') || '/')
    : route.path
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

const drawerOpen = ref(false)
const searchOpen = ref(false)

watch(() => route.fullPath, () => {
  drawerOpen.value = false
  searchOpen.value = false
})

const isDark = computed(() => colorMode.value === 'dark')

/**
 * The footer's category column.
 *
 * The eight slugs are an editorial choice and stay fixed — this is not "list
 * every category". What changes is where the *labels* come from: they used to
 * be eight hard-coded `pick()` pairs, which meant a renamed category left a
 * stale name here and a tombstoned one left a link to a 404. Reading the live
 * list fixes both, and a slug the operator removed simply drops out instead of
 * pointing at a page that no longer exists.
 */
const { categories: liveCategories } = useDirectoryMeta()
const FOOTER_CATS = ['chatbots', 'coding', 'image', 'video', 'audio', 'writing', 'productivity', 'research']
const footerCats = computed(() =>
  FOOTER_CATS.map((slug) => categoryBySlug(slug, liveCategories.value))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      label: localizeCategory(c, locale.value).name,
      to: `/categories/${c.slug}`,
    })),
)

type FooterLink = { label: string; to: string; hash?: string }

const footerCols = computed<{ title: string; links: FooterLink[] }[]>(() => [
  {
    title: pick('目录', 'Directory'),
    links: [
      { label: pick('产品', 'Products'), to: '/tools' },
      { label: pick('分类', 'Categories'), to: '/categories' },
      { label: pick('合集', 'Collections'), to: '/collections' },
      { label: pick('开发者', 'Makers'), to: '/makers' },
      { label: pick('SEO 诊断', 'SEO check'), to: '/seo-check' },
      { label: pick('标签', 'Tags'), to: '/tags' },
      { label: pick('周榜', 'Weekly'), to: '/weekly' },
      { label: pick('最新收录', 'Just added'), to: '/just-added' },
    ],
  },
  {
    title: pick('资源', 'Resources'),
    links: [
      { label: pick('定价', 'Pricing'), to: '/pricing' },
      { label: pick('提交产品', 'Submit a product'), to: '/submit' },
      { label: pick('我的提交', 'My submissions'), to: '/settings/submissions' },
      { label: pick('隐私政策', 'Privacy Policy'), to: '/privacy-policy' },
      { label: pick('服务条款', 'Terms of Service'), to: '/terms-of-service' },
      { label: pick('可接受使用政策', 'Acceptable Use Policy'), to: '/terms-of-service', hash: 'acceptable-use' },
      { label: pick('举报与申诉', 'Report & appeal'), to: '/terms-of-service', hash: 'reporting' },
      { label: pick('非生成平台声明', 'Not a generation platform'), to: '/terms-of-service', hash: 'no-generative-features' },
    ],
  },
  {
    title: pick('热门分类', 'Popular categories'),
    links: footerCats.value,
  },
  {
    title: pick('热门产品', 'Popular products'),
    links: [
      { label: 'Claude', to: '/tools/claude' },
      { label: 'Consensus', to: '/tools/consensus' },
      { label: 'Perplexity', to: '/tools/perplexity' },
      { label: 'Replit', to: '/tools/replit' },
      { label: 'Jasper', to: '/tools/jasper' },
      { label: 'Pika', to: '/tools/pika' },
    ],
  },
])

/**
 * The AUP anchors live on the terms page instead of on new routes: no new
 * URL, no sitemap change, and the policy stays one document that cannot drift
 * out of sync with the terms it belongs to. localePath() adds the /zh prefix,
 * then the hash is appended to the resolved path.
 */
function linkHref(link: FooterLink): string {
  const path = localePath(link.to)
  return link.hash ? `${path}#${link.hash}` : String(path)
}

/**
 * Resolved during SSR, not after hydration.
 *
 * This used to run in `onMounted` on the theory that the two states rendered
 * the same markup and only the label changed. They do not: signed out is a
 * `Sign In` link, signed in is an account button with a menu. Waiting until
 * hydration meant a signed-in visitor was shown "Sign In" on first paint and
 * then had it swapped out — a visible flash of the wrong state, on every page.
 *
 * The lookup is an internal `useRequestFetch` call, not a network round trip,
 * so it costs a cookie read and an HMAC verify. The settings layout already
 * resolves its session this way for the same reason.
 */
const { user: me, ensure: ensureSession, signOut } = useSession()
await ensureSession()

/**
 * The account menu in the topbar.
 *
 * The live site had no signed-in state at all — it was static — so this is new
 * surface rather than a port. Three decisions worth keeping:
 *
 * - It is a real `<button aria-expanded>` plus a menu, not a `<details>`, so
 *   screen readers announce "expanded/collapsed" instead of "group".
 * - A document listener closes it. Without one the menu survives a click on the
 *   page behind it, which reads as a stuck overlay.
 * - The initial is a fallback, not a placeholder: Google avatar URLs 404 often
 *   enough that a letter beats a broken image.
 */
const userMenuOpen = ref(false)
const userMenuRoot = ref<HTMLElement | null>(null)
const avatarBroken = ref(false)

const initial = computed(() =>
  (me.value?.name || me.value?.email || 'U').trim().charAt(0).toUpperCase() || 'U',
)

const avatarUrl = computed(() => (avatarBroken.value ? '' : me.value?.picture || ''))
watch(avatarUrl, () => {
  avatarBroken.value = false
})

function onDocumentClick(event: MouseEvent) {
  if (!userMenuOpen.value) return
  const root = userMenuRoot.value
  if (root && !root.contains(event.target as Node)) userMenuOpen.value = false
}

function onDocumentKey(event: KeyboardEvent) {
  if (event.key === 'Escape') userMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKey)
})

function onSignOut() {
  userMenuOpen.value = false
  if (!window.confirm(pick('确定要退出登录吗？', 'Sign out of your account?'))) return
  signOut(localePath('/'))
}

/** A menu left open across a navigation would hover over the new page. */
watch(() => route.fullPath, () => {
  userMenuOpen.value = false
})
</script>

<template>
  <IconSprite />

  <div class="shell">
    <!-- ── Left rail ─────────────────────────────────────────────────────── -->
    <aside class="sidebar">
      <div class="sidebar__brand">
        <NuxtLink class="brand" :to="localePath('/')">
          <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28" >
          <span>Product Atlas</span>
        </NuxtLink>
      </div>

      <div class="sidebar__body">
        <nav class="sidebar__nav">
          <div v-for="group in navGroups" :key="group.label" class="nav-group">
            <p class="nav-group__label">{{ group.label }}</p>
            <ul class="nav-list">
              <li v-for="item in group.items" :key="item.to">
                <NuxtLink
                  class="nav-item"
                  :class="{ 'is-active': isActive(item.to) }"
                  :to="localePath(item.to)"
                  :aria-current="isActive(item.to) ? 'page' : undefined"
                >
                  <Icon :name="item.icon" />
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>

        <div class="sidebar__promo">
          <p>{{ pick('做了个好东西？', 'Built something great?') }}</p>
          <p>{{ pick('提交你的产品，触达正在寻找它的人。', 'Submit your product and reach people looking for it.') }}</p>
          <NuxtLink class="btn btn--primary" :to="localePath('/submit')">
            <Icon name="plus" />
            {{ pick('提交', 'Submit') }}
          </NuxtLink>
        </div>
      </div>
    </aside>

    <!-- ── Main column ───────────────────────────────────────────────────── -->
    <div class="main">
      <header class="topbar">
        <div class="topbar__inner">
          <button
            class="icon-btn topbar__toggle"
            type="button"
            :aria-label="pick('打开菜单', 'Toggle sidebar')"
            :title="pick('打开菜单', 'Toggle sidebar')"
            @click="drawerOpen = true"
          >
            <Icon name="panel-left" :size="20" />
          </button>

          <div class="topbar__logo">
            <NuxtLink class="brand" :to="localePath('/')">
              <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28" >
              <span>Product Atlas</span>
            </NuxtLink>
          </div>

          <div class="topbar__search-wrap">
            <button
              class="search-trigger"
              type="button"
              :aria-label="pick('搜索产品…', 'Search products…')"
              @click="searchOpen = true"
            >
              <Icon name="search" />
              <span>{{ pick('搜索产品…', 'Search products…') }}</span>
              <kbd>⌘K</kbd>
            </button>
          </div>

          <div class="topbar__actions">
            <NuxtLink class="topbar__link" :to="localePath('/pricing')">{{ pick('定价', 'Pricing') }}</NuxtLink>

            <NuxtLink class="btn btn--ghost topbar__submit" :to="localePath('/submit')">
              <Icon name="plus" />
              {{ pick('提交', 'Submit') }}
            </NuxtLink>

            <div class="topbar__extras">
              <NuxtLink
                class="icon-btn"
                :to="switchLocalePath(locale === 'zh' ? 'en' : 'zh')"
                :hreflang="locale === 'zh' ? 'en' : 'zh-Hans'"
                :aria-label="pick('切换语言', 'Switch language')"
                :title="locale === 'zh' ? 'English' : '中文'"
                @click.prevent="setLocale(locale === 'zh' ? 'en' : 'zh')"
              >
                <Icon name="globe" :size="16" />
                <span class="sr-only">{{ pick('切换语言', 'Switch language') }}</span>
              </NuxtLink>

              <ClientOnly>
                <button
                  class="icon-btn"
                  type="button"
                  :aria-label="pick('切换主题', 'Toggle theme')"
                  @click="colorMode.preference = isDark ? 'light' : 'dark'"
                >
                  <!-- Both icons ship in the DOM; `.dark` in legacy.css swaps them. -->
                  <span class="theme-sun"><Icon name="sun" :size="16" /></span>
                  <span class="theme-moon"><Icon name="moon" :size="16" /></span>
                  <span class="sr-only">{{ pick('切换主题', 'Toggle theme') }}</span>
                </button>
                <template #fallback>
                  <button class="icon-btn" type="button" aria-hidden="true" tabindex="-1">
                    <span class="theme-sun"><Icon name="sun" :size="16" /></span>
                    <span class="theme-moon"><Icon name="moon" :size="16" /></span>
                  </button>
                </template>
              </ClientOnly>
            </div>

            <div v-if="me" ref="userMenuRoot" class="topbar-user-wrap">
              <button
                class="topbar-user"
                type="button"
                aria-haspopup="menu"
                :aria-expanded="userMenuOpen"
                :aria-label="pick('账户菜单', 'Account menu')"
                @click="userMenuOpen = !userMenuOpen"
              >
                <span class="user-chip__avatar">
                  <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    alt=""
                    @error="avatarBroken = true"
                  >
                  <template v-else>{{ initial }}</template>
                </span>
                <b>{{ me.name || me.email }}</b>
                <Icon name="chevron-down" :size="14" />
              </button>

              <div v-if="userMenuOpen" class="user-menu user-menu--top" role="menu" @click.stop>
                <NuxtLink role="menuitem" :to="localePath('/settings')">
                  {{ pick('概览', 'Overview') }}
                </NuxtLink>
                <NuxtLink role="menuitem" :to="localePath('/settings/submissions')">
                  {{ pick('我的提交', 'My submissions') }}
                </NuxtLink>
                <NuxtLink role="menuitem" :to="localePath('/settings/profile')">
                  {{ pick('个人资料', 'Profile') }}
                </NuxtLink>
                <button type="button" role="menuitem" @click="onSignOut">
                  {{ pick('退出登录', 'Sign out') }}
                </button>
              </div>
            </div>
            <NuxtLink v-else class="btn btn--primary" :to="signInLink">
              {{ pick('登录', 'Sign In') }}
            </NuxtLink>
          </div>
        </div>
      </header>

      <main>
        <slot />
      </main>

      <footer class="footer">
        <div class="footer__inner">
          <p class="footer__tagline">{{ pick('发布你的产品，反链永久保留。', 'Launch your product. Keep the backlink.') }}</p>
          <!-- Site-wide disambiguation. Waffo's site check reads category labels
               such as "Image Generation" / "Text to Speech" / "Video Generation"
               as if they were features of this site. Stating the nature of the
               service in the shared footer puts the correction on every page a
               reviewer (or crawler) can open, without touching the catalogue. -->
          <p style="margin: 6px 0 0; font-size: 12px; line-height: 1.6; opacity: .72">
            {{ pick('Product Atlas 是第三方工具目录站，不提供任何内容生成功能，也不调用底层 AI 模型；站内「图像生成」「语音合成」「视频生成」等词均为第三方产品的分类标签。', 'Product Atlas is a directory of third-party tools. We provide no generation features and call no underlying AI model; labels such as "Image Generation", "Text to Speech" and "Video Generation" are third-party product categories, not features of this site.') }}
          </p>
          <div class="footer__cols">
            <nav v-for="col in footerCols" :key="col.title" :aria-label="col.title">
              <h3>{{ col.title }}</h3>
              <ul>
                <li v-for="link in col.links" :key="link.to + link.label">
                  <NuxtLink :to="linkHref(link)">{{ link.label }}</NuxtLink>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div class="footer__bottom">
          <div class="footer__bottom-inner">
            <span>{{ pick('© 2026 Product Atlas 保留所有权利。', '© 2026 Product Atlas. All rights reserved.') }}</span>
            <!-- Both channels are independent: clearing the mailbox must not
                 silently remove the X contact from the footer as well. -->
            <span v-if="contactMail || socialXUrl">
              {{ pick('联系与举报：', 'Contact & report:') }}
              <a v-if="contactMail" :href="contactMail">{{ contactLabel }}</a>
              <template v-if="contactMail && socialXUrl"> · </template>
              <a v-if="socialXUrl" :href="socialXUrl" target="_blank" rel="noopener noreferrer">{{ socialXHandle }}</a>
            </span>
            <span v-else>{{ pick('免费提交 · 付费置顶', 'Free to submit · Paid to feature') }}</span>
          </div>
        </div>
      </footer>
    </div>

    <!-- ── Mobile drawer ─────────────────────────────────────────────────── -->
    <div
      id="drawer-root"
      class="drawer-root"
      :class="{ 'is-open': drawerOpen }"
      role="dialog"
      aria-modal="true"
      :aria-label="pick('菜单', 'Menu')"
    >
      <div class="modal-overlay" @click="drawerOpen = false" />
      <div class="drawer">
        <div class="sidebar__brand">
          <NuxtLink class="brand" :to="localePath('/')">
            <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28" >
            <span>Product Atlas</span>
          </NuxtLink>
        </div>
        <nav class="sidebar__nav">
          <div v-for="group in navGroups" :key="group.label" class="nav-group">
            <p class="nav-group__label">{{ group.label }}</p>
            <ul class="nav-list">
              <li v-for="item in group.items" :key="item.to">
                <NuxtLink
                  class="nav-item"
                  :class="{ 'is-active': isActive(item.to) }"
                  :to="localePath(item.to)"
                  @click="drawerOpen = false"
                >
                  <Icon :name="item.icon" />
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
        <div class="drawer__foot">
          <NuxtLink class="icon-btn" :to="switchLocalePath(locale === 'zh' ? 'en' : 'zh')" :aria-label="pick('切换语言', 'Switch language')">
            <Icon name="globe" :size="16" />
          </NuxtLink>
          <button class="icon-btn" type="button" @click="colorMode.preference = isDark ? 'light' : 'dark'">
            <Icon :name="isDark ? 'sun' : 'moon'" :size="16" />
            <span class="sr-only">{{ pick('切换主题', 'Toggle theme') }}</span>
          </button>
          <!--
            Session-aware: the drawer used to show the sign-in CTA to everyone,
            so a signed-in visitor on a phone had no way to reach their account
            and was invited to sign in again.
          -->
          <NuxtLink v-if="me" class="btn btn--primary" style="margin-left: auto" :to="localePath('/settings')">
            {{ pick('我的账户', 'My account') }}
          </NuxtLink>
          <NuxtLink v-else class="btn btn--primary" style="margin-left: auto" :to="signInLink">
            {{ pick('登录', 'Sign In') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <SearchDialog v-model:open="searchOpen" />
  </div>
</template>
