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
      '免费工具：Ahrefs DR4 查询、28 项页内 SEO 诊断，以及在浏览器里算的估值区间。',
      'Free tools: an Ahrefs DR4 lookup, a 28-point on-page SEO check, and a valuation range that runs in your browser.',
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
            'DR 和 SEO 诊断会调用真实接口。估值计算在你的浏览器里完成。',
            'DR and the SEO check call a real API. The valuation calculator runs in your browser.',
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
      <NuxtLink class="hub-card" :to="localePath('/tools/saas-valuation-calculator')">
        <p class="hub-card__kicker">VALUATION</p>
        <h2>{{ pick('SaaS 估值计算器', 'SaaS valuation calculator') }}</h2>
        <p>
          {{
            pick(
              '用你填的数字给出低、中、高区间。计算在浏览器里完成。',
              'A low, mid, and high range from figures you enter. It runs in your browser.',
            )
          }}
        </p>
        <span>{{ pick('打开计算器 →', 'Open the calculator →') }}</span>
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
@media (max-width: 960px) {
  .hub-grid { grid-template-columns: 1fr; }
}
</style>
