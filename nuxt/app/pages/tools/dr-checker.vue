<script setup lang="ts">
/**
 * /tools/dr-checker — Ahrefs DR4. Same POST /api/dr the old seo-check panel used.
 */
const { pick } = useLang()
const localePath = useLocalePath()

useSeo({
  title: computed(() => pick('Domain Rating（DR4）· Product Atlas', 'Domain Rating (DR4) · Product Atlas')),
  description: computed(() =>
    pick(
      '用 Ahrefs 官方免费接口查询 DR4。输入、查询和结果都留在本页。不是 Google 排名。',
      'Look up DR4 through the official free Ahrefs endpoint. Input, lookup, and answer stay on this page. Not a Google rank.',
    ),
  ),
})
</script>

<template>
  <div class="container tool-page">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/tools')">{{ pick('工具', 'Tools') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>Domain Rating (DR4)</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">Domain Rating (DR4)</h1>
      <p class="page-sub">
        {{
          pick(
            'DR 是 Ahrefs 的指标，0–100，衡量有多少个不同域名链向你；DR4 是它当前最新的版本。本站直接调用 Ahrefs 官方免费接口。输入、查询、结果都留在这一页，不会把你送去别的网站。它不是 Google 排名。',
            'DR is an Ahrefs 0–100 metric for referring domains. DR4 is current. We call the free official endpoint. Input, lookup, and answer stay on this page. Not a Google rank.',
          )
        }}
      </p>
    </header>

    <DrLookup />
  </div>
</template>
