<script setup lang="ts">
/**
 * /community/makers/:slug — one person or team, and the products that are live.
 * Bio, avatar, site and X render only when the directory actually has them.
 */
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const slug = computed(() => String(route.params.slug || ''))

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const maker = computed(() => makerBySlug(slug.value, lang.value, submitted.value, overrides.value))

if (!maker.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个创客' : 'No such maker',
    fatal: true,
  })
}

const profile = computed(() => makerPublicProfile({ name: maker.value?.name || '' }))
const avatarBroken = ref(false)
watch(
  () => profile.value.avatarUrl,
  () => {
    avatarBroken.value = false
  },
)
const showAvatar = computed(() => Boolean(profile.value.avatarUrl) && !avatarBroken.value)

const products = computed(() => {
  const rows = [...(maker.value?.tools ?? [])]
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  return rows
})

const firstListed = computed(() => earliestListingDate((maker.value?.tools ?? []).map((tool) => tool.created_at)))

const intro = computed(() => {
  if (!maker.value) return ''
  const n = maker.value.tools.length
  return isZh.value ? makerLiveIntroZh(maker.value.name, n) : makerLiveIntro(maker.value.name, n)
})

const cats = computed(() => (maker.value ? makerCategories(maker.value, lang.value, liveCategories.value) : []))
const catSlugs = computed(() => new Set(cats.value.map((cat) => cat.slug)))

const siblings = computed(() =>
  allMakers(lang.value, submitted.value, overrides.value)
    .filter((entry) => entry.slug !== slug.value)
    .filter((entry) => entry.tools.some((tool) => catSlugs.value.has(tool.category)))
    .slice(0, 4)
    .map((entry) => ({
      ...entry,
      hue: makerHue(entry.name),
      initial: makerInitial(entry.name),
      cats: makerCategories(entry, lang.value, liveCategories.value).slice(0, 1),
    })),
)

function categoryName(categorySlug: string): string {
  const hit = categoryBySlug(categorySlug, liveCategories.value)
  return hit ? localizeCategory(hit, lang.value).name : ''
}

function listedOn(value: string): string {
  return listingDate(value) || ''
}

useSeo({
  title: computed(() => (maker.value ? `${maker.value.name} · Product Atlas` : 'Product Atlas')),
  description: intro,
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/community')">{{ pick('社区', 'Community') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/community/makers')">{{ pick('创客', 'Makers') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ maker!.name }}</span>
    </nav>

    <header class="maker-head">
      <span
        class="maker-av"
        :style="{ width: '64px', height: '64px', '--h': makerHue(maker!.name) }"
      >
        <img
          v-if="showAvatar"
          class="maker-av__img"
          :src="profile.avatarUrl || undefined"
          alt=""
          width="64"
          height="64"
          @error="avatarBroken = true"
        >
        <template v-else>{{ makerInitial(maker!.name) }}</template>
      </span>
      <div class="maker-head__body">
        <h1 class="page-title">{{ maker!.name }}</h1>
        <p v-if="profile.bio" class="maker-bio">{{ profile.bio }}</p>
        <p v-if="profile.siteUrl || profile.xUrl" class="maker-links">
          <a v-if="profile.siteUrl" :href="profile.siteUrl" target="_blank" rel="noopener noreferrer">
            {{ pick('网站', 'Website') }}
          </a>
          <a v-if="profile.xUrl" :href="profile.xUrl" target="_blank" rel="noopener noreferrer">X</a>
        </p>
        <p v-if="firstListed" class="maker-since">
          <span>{{ pick('最早在架收录', 'First live listing') }}</span>
          <time :datetime="firstListed">{{ firstListed }}</time>
        </p>
        <p v-if="firstListed" class="community-note">
          {{
            pick(
              '这是最早一条在架产品的收录日期，不是加入社区的日期。',
              'The date of the earliest product that is live on Product Atlas. This is not a date they joined a community.',
            )
          }}
        </p>
      </div>
    </header>

    <p class="maker-intro">{{ intro }}</p>

    <section>
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('在架产品', 'Live products') }}</h2>
        </div>
      </div>

      <ul class="maker-products">
        <li v-for="tool in products" :key="tool.slug" class="maker-product">
          <h3 class="maker-product__name">
            <NuxtLink :to="localePath(`/products/${tool.slug}`)">{{ tool.name }}</NuxtLink>
          </h3>
          <p v-if="tool.short" class="maker-product__line">{{ tool.short }}</p>
          <p class="maker-product__facts">
            <NuxtLink
              v-if="categoryName(tool.category)"
              class="chip"
              :to="localePath(`/categories/${tool.category}`)"
            >
              {{ categoryName(tool.category) }}
            </NuxtLink>
            <span v-if="listedOn(tool.created_at)">
              {{ pick('收录于', 'Listed on') }}
              <time :datetime="listedOn(tool.created_at)">{{ listedOn(tool.created_at) }}</time>
            </span>
          </p>
          <p class="maker-product__actions">
            <NuxtLink class="btn btn--primary" :to="localePath(`/products/${tool.slug}`)">
              {{ pick('查看产品', 'View product') }}
            </NuxtLink>
            <a
              v-if="tool.url"
              class="btn btn--outline"
              :href="withDirectoryUtm(tool.url)"
              target="_blank"
              :rel="tool.is_paid ? 'noopener noreferrer' : 'nofollow noopener noreferrer'"
            >
              {{ pick('访问官网', 'Visit website') }}
            </a>
          </p>
        </li>
      </ul>
    </section>

    <section v-if="siblings.length" class="maker-siblings">
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('同分类的其他创客', 'Other makers in the same categories') }}</h2>
          <p>{{ pick('他们在同一分类里也有在架产品。', 'They have a live product in a category this profile also lists.') }}</p>
        </div>
      </div>
      <div class="maker-grid">
        <NuxtLink
          v-for="entry in siblings"
          :key="entry.slug"
          class="maker-card"
          :to="localePath(`/community/makers/${entry.slug}`)"
        >
          <span class="maker-av" :style="{ width: '40px', height: '40px', '--h': entry.hue }" aria-hidden="true">{{ entry.initial }}</span>
          <span class="maker-card__body">
            <span class="maker-card__name">{{ entry.name }}</span>
            <span class="maker-card__meta">
              {{
                isZh
                  ? `${entry.tools.length} 款在架产品`
                  : `${entry.tools.length} live ${entry.tools.length === 1 ? 'product' : 'products'}`
              }}
            </span>
          </span>
          <span class="maker-card__cats">
            <span v-for="cat in entry.cats" :key="cat.slug" class="chip">{{ cat.name }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
