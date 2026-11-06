<script setup lang="ts">
/**
 * /blog — ported from `shipany-dir/src/routes/blog/index.tsx`.
 *
 * Same section order and copy. The source's `DirectoryLayout` supplies the
 * sidebar/topbar/footer and the `max-w-[1320px]` content column; that shell is
 * this project's `default.vue`, so the page only renders the column itself.
 *
 * `guestPostsOpen` gates the "Write for us" link. In the source it reads the
 * `guest_post_enabled` config row and returns `false` when the config store is
 * unreachable — this build has no config store and no guest-post pipeline, so
 * the flag is `false` and the link does not render. That is the source's own
 * off-state, not a hidden feature.
 */
import { getLocalPosts, formatPostDate } from '~~/shared/content/blog'

const { lang, pick } = useLang()

const posts = computed(() => getLocalPosts(lang.value))

/** No config store on this build — see the header note. */
const guestPostsOpen = false

useSeo({
  // `directory.meta.blog`: "Blog — AI Tool Guides & Updates | {brand}".
  title: computed(() =>
    pick(
      '博客 — AI 工具指南与动态 | Product Atlas',
      'Blog — AI Tool Guides & Updates | Product Atlas',
    ),
  ),
  description: computed(() =>
    pick(
      '来自团队的产品动态、使用指南与工程笔记。',
      'Product updates, guides, and engineering notes from the team.',
    ),
  ),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <div>
      <div class="mb-8">
        <h1 class="text-3xl font-semibold tracking-tight">{{ pick('博客', 'Blog') }}</h1>
        <p class="mt-3 max-w-2xl text-muted-foreground">
          {{ pick(
            '来自团队的产品动态、使用指南与工程笔记。',
            'Product updates, guides, and engineering notes from the team.',
          ) }}
        </p>
        <NuxtLink
          v-if="guestPostsOpen"
          :to="localePath('/guest-post')"
          class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {{ pick('客座文章投稿', 'Write for us') }}
          <Icon name="arrow-right" :size="14" />
        </NuxtLink>
      </div>

      <p v-if="posts.length === 0" class="text-center text-muted-foreground">
        {{ pick('暂无文章,敬请期待。', 'No posts yet — check back soon.') }}
      </p>

      <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <BlogCard
          v-for="post in posts"
          :key="post.slug"
          :to="`/blog/${post.slug}`"
          :title="post.title"
          :description="post.description"
          :image="post.image"
          :date="formatPostDate(post.createdAt, lang)"
          :author-name="post.authorName"
          :author-image="post.authorImage"
          :badge="post.sponsored ? pick('赞助内容', 'Sponsored') : undefined"
        />
      </div>
    </div>
  </div>
</template>
