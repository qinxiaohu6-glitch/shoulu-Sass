<script setup lang="ts">
import type { AppPlatform, AppStoreInfo } from '~~/shared/types/app-store'
import type { Tool } from '~~/shared/types/catalog'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
const requestFetch = useRequestFetch()

const { data: payload, error: loadError } = await useAsyncData<{ ok: boolean; app?: Tool; reason?: string }>(
  () => `app:${slug.value}`,
  async () => {
    try {
      return await requestFetch(`/api/apps/${encodeURIComponent(slug.value)}`)
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404) return { ok: false, reason: 'not_found' }
      if (status === 410) return { ok: false, reason: 'removed' }
      throw error
    }
  },
  { watch: [slug] },
)

if (loadError.value) {
  throw createError({ statusCode: 500, statusMessage: pick('暂时无法加载应用资料', 'App details are temporarily unavailable'), fatal: true })
}
if (!payload.value?.ok || !payload.value.app) {
  const removed = payload.value?.reason === 'removed'
  throw createError({ statusCode: removed ? 410 : 404, statusMessage: removed ? pick('这个应用已下架', 'This app has been removed') : pick('没有这个应用', 'No such app'), fatal: true })
}

const app = computed(() => localizeTool(payload.value!.app!, lang.value))
const stores = computed(() => (app.value.app_stores ?? []) as AppStoreInfo[])
const platformLabel = (platform: AppPlatform) => ({ ios: 'iOS', android: 'Android', macos: 'Mac' })[platform]
const screenshots = computed(() => [...new Set(stores.value.flatMap((store) => store.screenshots))].slice(0, 18))
const operatingSystems = computed(() => stores.value.map((store) => platformLabel(store.platform)).join(', '))
const canonical = computed(() => `https://dirtool.com${isZh.value ? '/zh' : ''}/apps/${slug.value}`)
const primaryRating = computed(() => stores.value.find((store) => store.rating !== null && store.ratingCount))

useSeo({
  title: computed(() => `${app.value.name} · ${pick('应用', 'App')} · dirtool`),
  description: computed(() => app.value.short),
  type: 'article',
  zhTwin: false,
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [{
    type: 'application/ld+json',
    innerHTML: computed(() => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: app.value.name,
      description: app.value.short,
      image: app.value.logo,
      url: canonical.value,
      applicationCategory: stores.value.find((store) => store.category)?.category,
      operatingSystem: operatingSystems.value,
      sameAs: stores.value.map((store) => store.storeUrl),
      ...(primaryRating.value && primaryRating.value.ratingCount && primaryRating.value.rating !== null
        ? { aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: primaryRating.value.rating,
            ratingCount: primaryRating.value.ratingCount,
            bestRating: 5,
          } }
        : {}),
    })),
  }],
})
</script>

<template>
  <article class="src-page mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <nav :aria-label="pick('面包屑', 'breadcrumb')" class="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
      <NuxtLink :to="localePath('/')" class="hover:text-foreground">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/apps')" class="hover:text-foreground">{{ pick('应用', 'Apps') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span aria-current="page" class="min-w-0 truncate text-foreground">{{ app.name }}</span>
    </nav>

    <header class="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start">
      <div class="size-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card sm:size-24">
        <ToolLogo :logo="app.logo" :name="app.name" :size="96" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ app.name }}</h1>
          <span class="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{{ pick('应用', 'App') }}</span>
        </div>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ app.short }}</p>
        <p v-if="app.maker" class="mt-2 text-sm">{{ pick('开发者', 'Developer') }}：{{ app.maker }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <a
            v-for="store in stores"
            :key="store.platform"
            :href="store.storeUrl"
            target="_blank"
            rel="nofollow noopener noreferrer"
            class="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {{ pick('前往', 'Get on') }} {{ platformLabel(store.platform) }}
            <Icon name="arrow-up-right" :size="14" />
          </a>
        </div>
      </div>
    </header>

    <dl class="my-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="store in stores" :key="`${store.platform}-facts`" class="col-span-2 grid grid-cols-2 gap-3 bg-card p-4 sm:col-span-3 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-4">
        <div>
          <dt class="text-xs text-muted-foreground">{{ pick('平台', 'Platform') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ platformLabel(store.platform) }}</dd>
        </div>
        <div v-if="store.version">
          <dt class="text-xs text-muted-foreground">{{ pick('版本', 'Version') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.version }}</dd>
        </div>
        <div v-if="store.priceLabel">
          <dt class="text-xs text-muted-foreground">{{ pick('商店价格', 'Store price') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.priceLabel }}</dd>
        </div>
        <div v-if="store.rating !== null">
          <dt class="text-xs text-muted-foreground">{{ pick('商店评分', 'Store rating') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.rating }} <span v-if="store.ratingCount" class="font-normal text-muted-foreground">({{ store.ratingCount.toLocaleString() }})</span></dd>
        </div>
        <div v-if="store.category">
          <dt class="text-xs text-muted-foreground">{{ pick('分类', 'Category') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.category }}</dd>
        </div>
        <div v-if="store.minimumOsVersion">
          <dt class="text-xs text-muted-foreground">{{ pick('系统要求', 'System') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.minimumOsVersion }}</dd>
        </div>
        <div v-if="store.size">
          <dt class="text-xs text-muted-foreground">{{ pick('应用大小', 'App size') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.size }}</dd>
        </div>
        <div v-if="store.updatedAt">
          <dt class="text-xs text-muted-foreground">{{ pick('商店更新', 'Store updated') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.updatedAt }}</dd>
        </div>
        <div v-if="store.releasedAt">
          <dt class="text-xs text-muted-foreground">{{ pick('首次上架', 'First released') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.releasedAt }}</dd>
        </div>
        <div v-if="store.genres.length">
          <dt class="text-xs text-muted-foreground">{{ pick('类型', 'Genres') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.genres.join(' · ') }}</dd>
        </div>
        <div v-if="store.ageRating">
          <dt class="text-xs text-muted-foreground">{{ pick('年龄分级', 'Age rating') }}</dt>
          <dd class="mt-1 text-sm font-medium">{{ store.ageRating }}</dd>
        </div>
      </div>
    </dl>

    <section v-if="app.long" class="max-w-3xl py-3">
      <h2 class="text-lg font-semibold">{{ pick('应用介绍', 'About this app') }}</h2>
      <p class="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{{ app.long }}</p>
    </section>

    <section v-if="screenshots.length" class="mt-8">
      <h2 class="mb-4 text-lg font-semibold">{{ pick('应用截图', 'Screenshots') }}</h2>
      <div class="scrollbar-none flex gap-3 overflow-x-auto pb-3">
        <img
          v-for="(image, index) in screenshots"
          :key="image"
          :src="image"
          :alt="pick(`${app.name} 应用截图 ${index + 1}`, `${app.name} screenshot ${index + 1}`)"
          loading="lazy"
          class="max-h-[560px] max-w-[min(78vw,280px)] shrink-0 rounded-xl border border-border bg-muted object-contain"
        >
      </div>
    </section>

    <p class="mt-8 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
      {{ pick('资料由公开应用商店信息导入，可能因地区、版本或商店更新而变化；请以对应商店页面为准。', 'Details are imported from public store listings and may vary by region, version or store updates. Check the linked store for the latest information.') }}
    </p>
  </article>
</template>
