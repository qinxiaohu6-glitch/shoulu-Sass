<script setup lang="ts">
/**
 * /tools — utility hub. Product listings live at /products.
 * Keyword research is not on this page.
 */
const { pick } = useLang()
const localePath = useLocalePath()

useSeo({
  title: computed(() => pick('工具 · Product Atlas', 'Tools · Product Atlas')),
  description: computed(() =>
    pick(
      '免费工具：Ahrefs DR4 查询，以及 28 项页内 SEO 诊断。没有假分数。',
      'Free tools: an Ahrefs DR4 lookup and a 28-point on-page SEO check. No invented scores.',
    ),
  ),
})
</script>

<template>
  <div class="container tool-page">
    <header class="page-head">
      <p class="tool-kicker">TOOLS</p>
      <h1 class="page-title">{{ pick('工具', 'Tools') }}</h1>
      <p class="page-sub">
        {{
          pick(
            '这里只放已经接通真实接口的检查。查不到就说查不到。',
            'Only checks that call a real API. If we cannot get a number, we say so.',
          )
        }}
      </p>
    </header>

    <div class="hub-grid">
      <NuxtLink class="hub-card" :to="localePath('/tools/dr-checker')">
        <p class="hub-card__kicker">AHREFS</p>
        <h2>Domain Rating (DR4)</h2>
        <p>
          {{
            pick(
              '官方免费接口返回的 0–100。不是 Google 排名，也不是估出来的数。',
              'A 0–100 score from the official free endpoint. Not a Google rank, and not an estimate.',
            )
          }}
        </p>
        <span>{{ pick('打开 DR 查询', 'Open DR checker') }} →</span>
      </NuxtLink>
      <NuxtLink class="hub-card" :to="localePath('/seo-check')">
        <p class="hub-card__kicker">ON-PAGE</p>
        <h2>{{ pick('SEO 诊断', 'SEO check') }}</h2>
        <p>
          {{
            pick(
              '28 项页内检查，五个维度。成功后可以下载当次 PDF。',
              '28 on-page checks across five areas. A successful check can be downloaded as a PDF.',
            )
          }}
        </p>
        <span>{{ pick('打开 SEO 诊断', 'Open SEO check') }} →</span>
      </NuxtLink>
    </div>

    <p class="hub-note">
      {{
        pick(
          '我们不做 AI 起名、交换链打分，也不编造搜索量。产品目录在「产品」里。',
          'We do not ship AI name generators, link-exchange scorers, or invented keyword scores. The product directory is under Products.',
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.tool-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--muted-foreground);
}
.hub-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 8px;
}
.hub-card {
  display: block;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card);
  color: inherit;
  text-decoration: none;
}
.hub-card h2 { margin: 8px 0; font-size: 22px; }
.hub-card p { margin: 0; color: var(--muted-foreground); font-size: 14px; line-height: 1.5; }
.hub-card span { display: inline-block; margin-top: 16px; font-weight: 750; }
.hub-card__kicker {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
}
.hub-note { margin-top: 18px; color: var(--muted-foreground); font-size: 13px; }
@media (max-width: 720px) {
  .hub-grid { grid-template-columns: 1fr; }
}
</style>
