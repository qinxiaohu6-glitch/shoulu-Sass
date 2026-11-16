<script setup lang="ts">
/**
 * /community — profiles first. This version has no public feed.
 * Counts come from the live directory. Nothing on this page invents a scale.
 */
const { isZh, pick } = useLang()
const localePath = useLocalePath()

const submitted = await useSubmittedTools()
const overrides = useOverrides()

const counts = computed(() =>
  liveDirectoryCounts(
    [...tools.map((tool) => localizeTool(tool, 'en')), ...submitted.value].map((tool) => ({
      slug: tool.slug,
      makerSlug: tool.makerSlug,
    })),
    overrides.value.hidden,
  ),
)

const countLine = computed(() =>
  isZh.value
    ? communityCountLineZh(counts.value.makers, counts.value.products)
    : communityCountLine(counts.value.makers, counts.value.products),
)

useSeo({
  title: computed(() => pick('社区 · Product Atlas', 'Community · Product Atlas')),
  description: computed(() =>
    pick(
      '认识目录产品背后的创客。先做档案。本页没有公开 Feed。',
      'Meet the makers behind the products in the directory. Profiles first. This page has no public feed.',
    ),
  ),
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ pick('社区', 'Community') }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ pick('收录背后的人', 'The people behind the listings') }}</h1>
      <p class="page-sub">
        {{
          pick(
            '每有一款在架产品，对应创客就有公开档案。可以按做出产品的人来浏览目录。',
            'Every maker with a live product gets a public profile. Browse the directory through the people who shipped it.',
          )
        }}
      </p>
      <p class="community-counts">{{ countLine }}</p>
      <div class="community-actions">
        <NuxtLink class="btn btn--primary" :to="localePath('/community/makers')">
          {{ pick('浏览创客', 'Browse makers') }}
        </NuxtLink>
        <NuxtLink class="btn btn--outline" :to="localePath('/submit')">
          {{ pick('提交产品', 'Submit a product') }}
        </NuxtLink>
      </div>
    </header>

    <p class="community-note">
      {{
        pick(
          '本页没有公开 Feed、评论或留言墙。如果希望被收录，请提交产品。',
          'This page has no public feed, comments, or messaging wall. If you want to be listed, submit a product.',
        )
      }}
    </p>

    <section class="community-guidelines" aria-labelledby="community-guidelines-title">
      <h2 id="community-guidelines-title">{{ pick('社区说明', 'Community guidelines') }}</h2>
      <ul>
        <li>
          {{
            pick(
              '只有你的产品已经在架，你才会出现在这里。',
              'You appear here only after one of your products is live.',
            )
          }}
        </li>
        <li>
          {{
            pick(
              '垃圾内容和成人内容不会被收录。这与目录的现行规则相同。',
              'Spam and adult content are not listed. That is the same rule as the rest of the directory.',
            )
          }}
        </li>
      </ul>
    </section>
  </div>
</template>
