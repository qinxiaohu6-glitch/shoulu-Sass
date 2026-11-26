<script setup lang="ts">
import type { DirectorySortValue } from '~/utils/directory-ui'
import type { AppPlatform } from '~~/shared/types/app-store'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const apps = await useSubmittedApps()

const platformOptions: { value: AppPlatform | ''; label: string }[] = [
  { value: '', label: pick('全部应用', 'All apps') },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'macos', label: 'Mac' },
]
const platform = computed(() => {
  const value = String(route.query.platform ?? '')
  return ['ios', 'android', 'macos'].includes(value) ? value as AppPlatform : ''
})
const sort = computed(() => parseSort(route.query.sort))
const page = computed(() => parsePage(route.query.page))
const filtered = computed(() => platform.value
  ? apps.value.filter((app) => app.app_stores?.some((store) => store.platform === platform.value))
  : apps.value,
)
const sorted = computed(() => sortTools(filtered.value, sort.value, lang.value))
const totalPages = computed(() => Math.ceil(sorted.value.length / DIRECTORY_PAGE_SIZE))
const items = computed(() => pageSlice(sorted.value, page.value))

function patchQuery(patch: Record<string, string | number | undefined>) {
  const next: Record<string, string> = { ...(route.query as Record<string, string>) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key]
    else next[key] = String(value)
  }
  if (next.page === '1') delete next.page
  return { path: '/apps', query: next }
}
function choosePlatform(value: AppPlatform | '') {
  router.push(patchQuery({ platform: value || undefined, page: undefined }))
}
function chooseSort(value: DirectorySortValue) {
  router.push(patchQuery({ sort: value === 'recommended' ? undefined : value, page: undefined }))
}
function goPage(value: number) {
  router.push(patchQuery({ page: value > 1 ? value : undefined }))
}

useSeo({
  title: computed(() => pick('应用目录：iOS、Android 与 Mac 应用 · dirtool', 'App directory: iOS, Android and Mac apps · dirtool')),
  description: computed(() => pick(
    '发现并比较 iOS、Android 与 Mac 应用。应用资料来自公开应用商店页面，并经本站审核收录。',
    'Discover iOS, Android and Mac apps. Store details are imported from public listings and reviewed before publication.',
  )),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <nav :aria-label="pick('面包屑', 'breadcrumb')" class="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
      <NuxtLink :to="localePath('/')" class="hover:text-foreground">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span aria-current="page" class="text-foreground">{{ pick('应用', 'Apps') }}</span>
    </nav>

    <header class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ pick('应用目录', 'App directory') }}</h1>
        <p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {{ pick('发现 iOS、Android 与 Mac 应用。商店公开资料可自动导入，发布前由本站审核。', 'Discover apps for iOS, Android and Mac. Public store details can be imported, then reviewed before listing.') }}
        </p>
      </div>
      <NuxtLink :to="localePath('/apps/submit')" class="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
        {{ pick('提交应用', 'Submit an app') }}
      </NuxtLink>
    </header>

    <nav class="scrollbar-none mb-5 flex gap-2 overflow-x-auto" :aria-label="pick('按平台筛选', 'Filter by platform')">
      <button
        v-for="option in platformOptions"
        :key="option.value"
        type="button"
        :aria-pressed="platform === option.value"
        class="inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition"
        :class="platform === option.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'"
        @click="choosePlatform(option.value)"
      >
        {{ option.value ? option.label : pick('全部应用', 'All apps') }}
      </button>
    </nav>

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">{{ pick(`共 ${sorted.length} 个应用`, `${sorted.length} apps`) }}</p>
      <DirectorySortSelect :value="sort" @change="chooseSort" />
    </div>

    <div v-if="!items.length" class="rounded-xl border border-dashed border-border py-16 text-center">
      <p class="text-sm text-muted-foreground">{{ pick('这个平台暂时还没有已审核的应用。', 'No reviewed apps on this platform yet.') }}</p>
      <NuxtLink :to="localePath('/apps/submit')" class="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-4">
        {{ pick('提交第一个应用', 'Submit the first app') }}
      </NuxtLink>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <DirectoryToolCard v-for="app in items" :key="app.slug" :tool="app" />
    </div>

    <div v-if="totalPages > 1" class="mt-8 flex justify-center">
      <DirectoryPagination :current-page="page" :total-pages="totalPages" @change="goPage" />
    </div>
  </div>
</template>
