<script setup lang="ts">
/**
 * The public top bar on auth pages.
 *
 * Those pages opt out of the default layout so the two-column sign-in shell
 * can fill the screen. The links here are the same row the rest of the site
 * shows: Discover, Products, Weekly, Billboard, Pricing, Submit, Sign in.
 */
const { locale, pick, setLocale } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const open = ref(false)

const links = computed(() => [
  { label: pick('发现', 'Discover'), to: '/' },
  { label: pick('产品', 'Products'), to: '/products' },
  { label: pick('工具', 'Tools'), to: '/tools' },
  { label: pick('周榜', 'Weekly'), to: '/weekly' },
  { label: 'Billboard', to: '/billboard' },
  { label: pick('定价', 'Pricing'), to: '/pricing' },
])

const barePath = computed(() => route.path.replace(/^\/zh(?=\/|$)/, '') || '/')

function isActive(to: string) {
  if (to === '/') return barePath.value === '/'
  return barePath.value === to || barePath.value.startsWith(`${to}/`)
}

const onSignIn = computed(
  () => barePath.value === '/sign-in' || barePath.value.startsWith('/sign-in/'),
)

const signInTo = computed(() => {
  const next = route.query.next
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return localePath({ path: '/sign-in', query: { next } })
  }
  return localePath('/sign-in')
})

watch(() => route.fullPath, () => {
  open.value = false
})

async function switchLang() {
  await setLocale(locale.value === 'zh' ? 'en' : 'zh')
}
</script>

<template>
  <header class="auth-topnav topbar">
    <div class="topbar__inner">
      <button
        class="icon-btn auth-topnav__toggle"
        type="button"
        :aria-expanded="open"
        :aria-label="pick('打开菜单', 'Open menu')"
        @click="open = !open"
      >
        <Icon name="panel-left" :size="20" />
      </button>

      <div class="topbar__logo">
        <NuxtLink class="brand" :to="localePath('/')">
          <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28">
          <span>Product Atlas</span>
        </NuxtLink>
      </div>

      <nav class="topbar__nav" :class="{ 'is-open': open }" :aria-label="pick('主导航', 'Primary')">
        <NuxtLink
          v-for="item in links"
          :key="item.to"
          class="topbar__link"
          :class="{ 'topbar__link--billboard': item.to === '/billboard', 'is-active': isActive(item.to) }"
          :to="localePath(item.to)"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="topbar__actions">
        <NuxtLink class="btn btn--primary topbar__submit" :to="localePath('/submit')">
          <Icon name="plus" />
          {{ pick('提交', 'Submit') }}
        </NuxtLink>
        <button class="auth-topnav__lang" type="button" @click="switchLang">
          {{ locale === 'zh' ? 'English' : '中文' }}
        </button>
        <NuxtLink
          class="btn btn--ghost"
          :to="signInTo"
          :aria-current="onSignIn ? 'page' : undefined"
        >
          {{ pick('登录', 'Sign In') }}
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<style>
.auth-topnav.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in oklab, var(--background) 92%, transparent);
}
.auth-topnav .topbar__logo {
  display: flex;
}
.auth-topnav .topbar__nav {
  display: none;
}
.auth-topnav .topbar__link {
  display: inline-flex;
}
.auth-topnav .topbar__link.is-active {
  color: var(--foreground);
  font-weight: 650;
}
.auth-topnav__lang {
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.auth-topnav__lang:hover {
  color: var(--foreground);
}
.auth-topnav__toggle {
  display: grid;
}
@media (min-width: 900px) {
  .auth-topnav .topbar__nav {
    display: flex;
  }
  .auth-topnav__toggle {
    display: none;
  }
}
@media (max-width: 899px) {
  .auth-topnav .topbar__inner {
    flex-wrap: wrap;
    height: auto;
    min-height: 56px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .auth-topnav .topbar__nav.is-open {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    order: 5;
    flex: 1 0 100%;
    gap: 2px;
    padding: 6px 0 4px;
  }
  .auth-topnav .topbar__nav.is-open .topbar__link {
    display: flex;
    padding: 8px 10px;
  }
}
</style>
