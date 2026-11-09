<script setup lang="ts">
/**
 * The three columns under the Billboard: real directory counts, newest
 * listings, and paid featured rows. Vote order is not used here.
 */
export type HomeLaunch = {
  slug: string
  name: string
  short: string
  logo: string
  votes: number
  category: string
  badges: string[]
}

export type HomeStat = { value: string; label: string }
export type HomeCat = { slug: string; name: string; count: number }

defineProps<{
  stats: HomeStat[]
  categories: HomeCat[]
  launches: HomeLaunch[]
  monthLabel: string
  featured: HomeLaunch[]
  featuredPrice: string
  sidebarPrice: string
}>()

const { pick } = useLang()
const localePath = useLocalePath()
</script>

<template>
  <div class="home-cols">
    <aside>
      <p class="home-cols__kicker">ALL TIME</p>
      <h2 class="home-cols__title">{{ pick('统计', 'Statistics') }}</h2>
      <div v-for="stat in stats" :key="stat.label" class="home-cols__stat">
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </div>
      <p class="home-cols__kicker home-cols__kicker--gap">{{ pick('分类', 'CATEGORIES') }}</p>
      <ul class="home-cols__cats">
        <li v-for="cat in categories" :key="cat.slug">
          <NuxtLink :to="localePath(`/categories/${cat.slug}`)">{{ cat.name }}</NuxtLink>
          <em>{{ cat.count }}</em>
        </li>
      </ul>
    </aside>

    <section aria-labelledby="just-launched-title">
      <div class="home-cols__head">
        <div>
          <p class="home-cols__kicker">LIVE DIRECTORY</p>
          <h2 id="just-launched-title" class="home-cols__title">{{ pick('刚刚上线', 'Just launched') }}</h2>
        </div>
        <NuxtLink class="more" :to="localePath('/just-added')">
          {{ pick('查看全部', 'View all') }}
        </NuxtLink>
      </div>
      <p class="home-cols__month">{{ monthLabel }}</p>
      <ol class="home-cols__feed">
        <li v-for="(item, index) in launches" :key="item.slug">
          <NuxtLink class="launch-row" :to="localePath(`/tools/${item.slug}`)">
            <span class="launch-row__rank">{{ index + 1 }}</span>
            <span class="launch-row__logo">
              <ToolLogo :logo="item.logo" :name="item.name" :size="40" decorative />
            </span>
            <span class="launch-row__body">
              <strong>
                {{ item.name }}
                <em v-for="badge in item.badges" :key="badge" class="launch-row__badge">{{ badge }}</em>
              </strong>
              <span>{{ item.short }}</span>
              <span v-if="item.category" class="launch-row__cat">{{ item.category }}</span>
            </span>
            <span class="launch-row__votes">▲ {{ item.votes }}<small>{{ pick('票', 'votes') }}</small></span>
          </NuxtLink>
        </li>
      </ol>
      <p v-if="!launches.length" class="home-cols__empty">
        {{ pick('还没有公开收录。', 'No public listings yet.') }}
      </p>
    </section>

    <aside aria-labelledby="featured-col-title">
      <p class="home-cols__kicker">HAND-PICKED</p>
      <h2 id="featured-col-title" class="home-cols__title">{{ pick('精选', 'Featured') }}</h2>
      <div class="feat-promo">
        <span class="launch-row__badge">FEATURED</span>
        <h3>{{ pick('排在目录前面', 'Pinned in the directory') }}</h3>
        <p>{{ pick('精选是收录档，不是订阅。', 'Featured is a listing tier, not a subscription.') }}</p>
        <p class="feat-promo__price">
          <b>{{ featuredPrice }}</b>
          <span>{{ pick('一次性', 'one-time') }}</span>
        </p>
        <NuxtLink class="btn btn--primary btn--block" :to="localePath({ path: '/submit', query: { plan: 'featured' } })">
          {{ pick('看精选档', 'See Featured') }}
        </NuxtLink>
      </div>
      <ul class="feat-list">
        <li v-for="item in featured" :key="item.slug">
          <NuxtLink :to="localePath(`/tools/${item.slug}`)">
            <ToolLogo :logo="item.logo" :name="item.name" :size="32" decorative />
            <span>
              <strong>{{ item.name }}</strong>
              <em v-for="badge in item.badges" :key="badge">{{ badge }}</em>
            </span>
          </NuxtLink>
        </li>
      </ul>
      <NuxtLink
        v-if="!featured.length"
        class="bb-empty feat-empty"
        :to="localePath('/pricing')"
      >
        <span>{{ pick('投放广告', 'Advertise') }}</span>
        <strong>{{ pick('这里还没有付费精选', 'No paid Featured placement yet') }}</strong>
      </NuxtLink>
      <NuxtLink class="sidebar-rent" :to="`${localePath('/book-ad')}?slot=sidebar&weeks=1`">
        <span>SIDEBAR</span>
        <strong>{{ pick('右栏仍按周', 'Sidebar is still weekly') }}</strong>
        <b>{{ sidebarPrice }}</b>
      </NuxtLink>
    </aside>
  </div>
</template>
