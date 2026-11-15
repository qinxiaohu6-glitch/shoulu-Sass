<script setup lang="ts">
/**
 * /blog — empty until a Product Atlas note is published.
 * The two ShipAny posts that used to live here are gone; their URLs 404.
 */
import { formatPostDate, getLocalPosts } from '~~/shared/content/blog'

const { lang, pick } = useLang()

const posts = computed(() => getLocalPosts(lang.value))

useSeo({
  title: computed(() => pick('博客 · Product Atlas', 'Blog · Product Atlas')),
  description: computed(() =>
    pick(
      'Product Atlas 的笔记。新文章会出现在这里。',
      'Notes from Product Atlas. New posts will show up here.',
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
            'Product Atlas 的笔记。新文章会出现在这里。',
            'Notes from Product Atlas. New posts will show up here.',
          ) }}
        </p>
      </div>

      <p v-if="posts.length === 0" class="text-center text-muted-foreground">
        {{ pick('还没有文章。之后这里会放产品笔记和收录说明。', 'No posts yet. Check back here for product notes and listing guides.') }}
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
        />
      </div>
    </div>
  </div>
</template>
