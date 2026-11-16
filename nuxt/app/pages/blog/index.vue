<script setup lang="ts">
/**
 * /blog — empty until a Product Atlas note is published.
 * The two ShipAny posts that used to live here are gone; their URLs 404.
 */
import { formatPostDate, getLocalPosts } from '~~/shared/content/blog'
import { BLOG_TEMPLATES, FIRST_ARTICLE } from '~~/shared/content/blog-template'

const { lang, pick } = useLang()
const localePath = useLocalePath()

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
          :to="localePath(`/blog/${post.slug}`)"
          :title="post.title"
          :description="post.description"
          :image="post.image"
          :date="formatPostDate(post.createdAt, lang)"
          :author-name="post.authorName"
          :author-image="post.authorImage"
        />
      </div>

      <section class="mt-10 max-w-3xl border-t border-border pt-8" aria-labelledby="blog-templates">
        <h2 id="blog-templates" class="text-lg font-semibold">{{ pick('模板', 'Templates') }}</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          {{
            pick(
              '三种稿件。这一批只定模板和第一篇大纲，不发布长文。',
              'Three kinds of post. This batch defines the templates and the first outline. The long article is not published.',
            )
          }}
        </p>
        <ul class="mt-4 space-y-3">
          <li v-for="template in BLOG_TEMPLATES" :key="template.kind" class="rounded-xl border border-border px-4 py-3">
            <p class="text-sm font-semibold">{{ pick(template.label_zh, template.label_en) }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ pick(template.purpose_zh, template.purpose_en) }}</p>
          </li>
        </ul>
      </section>

      <section class="mt-8 max-w-3xl" aria-labelledby="blog-outline">
        <h2 id="blog-outline" class="text-lg font-semibold">{{ pick('第一篇大纲', 'First-article outline') }}</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ pick(FIRST_ARTICLE.direction_zh, FIRST_ARTICLE.direction_en) }}
        </p>
        <NuxtLink
          class="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
          :to="localePath(`/blog/${FIRST_ARTICLE.slug}`)"
        >
          {{ FIRST_ARTICLE.title }}
        </NuxtLink>
      </section>
    </div>
  </div>
</template>
