<script setup lang="ts">
/**
 * /how-it-works and /zh/how-it-works.
 * English facts are the approved L2 sentence plus the rules in plan §7.3.
 * Chinese lines that are not the approved L2 sentence are plain restatements.
 */
import { BADGE_OPTIONAL, HOW_FREE_LINK, HOW_WEEKLY, L2, L2_ZH } from '~~/shared/utils/batch2'

const { pick } = useLang()
const localePath = useLocalePath()

const facts = computed(() => [
  pick(L2_ZH, L2),
  pick(
    '免费收录的链接是 nofollow。付费收录带一条永久 dofollow 链接。',
    HOW_FREE_LINK,
  ),
  pick('不要求展示徽章。', 'A badge is not required.'),
  pick(
    '徽章是可选的。付费收录已经包含 dofollow 链接；不展示徽章也不会失去这条链接。',
    BADGE_OPTIONAL,
  ),
  pick('付费收录不改变周榜。周榜按投票排名。', HOW_WEEKLY),
])

useSeo({
  title: computed(() => pick('提交之后会发生什么 · dirtool', 'How it works · dirtool')),
  description: computed(() => pick(L2_ZH, L2)),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
    <h1 class="font-serif text-4xl font-normal tracking-tight">
      {{ pick('提交之后会发生什么', 'How it works') }}
    </h1>
    <ul class="mt-8 space-y-4 text-sm leading-relaxed">
      <li v-for="fact in facts" :key="fact">{{ fact }}</li>
    </ul>
    <p class="mt-8 text-sm">
      <a class="underline" href="/badge.svg" download="product-atlas-badge.svg">
        {{ pick('下载可选徽章（SVG）', 'Download the optional badge (SVG)') }}
      </a>
    </p>
    <p class="mt-6 text-sm text-muted-foreground">
      <NuxtLink class="underline" :to="localePath('/stats')">{{ pick('统计页', 'Stats') }}</NuxtLink>
      ·
      <NuxtLink class="underline" :to="localePath('/rules')">{{ pick('规则', 'Rules') }}</NuxtLink>
      ·
      <NuxtLink class="underline" :to="localePath('/faq')">{{ pick('常见问答', 'Questions') }}</NuxtLink>
    </p>
  </div>
</template>
