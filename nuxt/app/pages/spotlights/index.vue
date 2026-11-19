<script setup lang="ts">
/**
 * /spotlights — the index for Product Spotlights.
 *
 * The page has two jobs and the order matters: first explain what a Spotlight
 * is (most visitors arrive from the pricing page and have never seen one),
 * then show the published ones. While the pilot has no articles the second half
 * is an honest empty state rather than a placeholder, because a fake article
 * would be the one thing that discredits the whole feature.
 *
 * The list comes from `/api/spotlights`, not from a module constant. An article
 * only exists once the owner has approved it, so a build-time array would mean
 * a redeploy per article — which is exactly the workflow the review queue was
 * added to remove.
 *
 * Bilingual: the section shipped English-only, and every one of its five pages
 * carried a `if (lang === 'zh') navigateTo('/spotlights')` guard that 301'd the
 * Chinese URL straight back to English. That guard is gone — `/zh/spotlights`
 * is a real page now — so copy goes through `pick()` and every internal link
 * through `localePath()`, otherwise a Chinese reader lands back in English on
 * the first click.
 */
import { SPOTLIGHT_PLANS, type Spotlight } from '~~/shared/content/spotlights'
import { breadcrumbSchema, itemListSchema } from '~~/shared/utils/schema'

const { pick } = useLang()
const localePath = useLocalePath()

// `useRequestFetch`, not `$fetch`: during SSR a bare `$fetch` starts a new
// request that cannot resolve a relative URL on Workers, and the list would
// silently render empty on the live site while looking complete locally.
const requestFetch = useRequestFetch()
type Payload = { ok: boolean; items: Spotlight[] }
const { data } = await useAsyncData<Payload>(
  'spotlights-index',
  async () => {
    try {
      const res = await requestFetch<Payload>('/api/spotlights')
      return { ok: Boolean(res?.ok), items: res?.items ?? [] }
    } catch {
      // An empty list renders the honest empty state; a thrown error would
      // replace the whole page — including the explanation of what a Spotlight
      // is — over a failed read.
      return { ok: false, items: [] as Spotlight[] }
    }
  },
  { default: (): Payload => ({ ok: false, items: [] }) },
)

const items = computed(() => data.value?.items ?? [])

const planNames = computed(() =>
  pick(
    SPOTLIGHT_PLANS.map((plan) => (plan === 'pro' ? '专业' : '精选')).join('和专业'),
    SPOTLIGHT_PLANS.map((plan) => (plan === 'pro' ? 'Pro' : 'Featured')).join(' and '),
  ),
)

// `useSeo` owns title/description/OG/canonical/hreflang and derives the two
// canonical URLs from the route. The hand-rolled `useHead` this replaced pinned
// `canonical` to the English URL, which would have pointed the Chinese page at
// its English twin.
useSeo({
  title: computed(() =>
    pick(
      '产品聚光灯：为收录产品写的长文 · Product Atlas',
      'Product Spotlights: long-form articles about listed products · Product Atlas',
    ),
  ),
  description: computed(() =>
    pick(
      '聚光灯是一篇只讲一个产品的长文，有自己独立的网址。包含在精选与专业两档收录权益里。',
      'A Product Spotlight is a long-form article about one listed product, published at its own URL. Included with the Featured and Pro listings.',
    ),
  ),
})

useHead({
  script: computed(() => {
    const scripts: { type: 'application/ld+json'; innerHTML: string }[] = [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          breadcrumbSchema([
            { name: pick('发现', 'Discover'), path: '/' },
            { name: pick('产品聚光灯', 'Product Spotlights'), path: '/spotlights' },
          ]),
        ),
      },
    ]
    if (items.value.length) {
      scripts.push({
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          itemListSchema(
            pick('产品聚光灯', 'Product Spotlights'),
            items.value.map((item) => ({ name: item.productName, path: `/spotlights/${item.slug}` })),
          ),
        ),
      })
    }
    return scripts
  }),
})
</script>

<template>
  <div class="container spx-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('产品聚光灯', 'Product Spotlights') }}</span>
    </nav>

    <header class="spx-head">
      <p class="spx-kicker">{{ pick('产品聚光灯', 'PRODUCT SPOTLIGHTS') }}</p>
      <h1>{{ pick('为站内收录的产品写一篇长文', 'Long-form articles about the products listed here') }}</h1>
      <p class="spx-lead">
        {{ pick(
          '聚光灯是一篇只讲一个产品的长文：它做什么、给谁用、在同类里站在什么位置。它有自己独立的网址，正文链到收录页和产品官网，收录在多久它就挂多久。',
          'A Spotlight is a written piece about one product — what it does, who it is for, and where it fits. It lives at its own URL, links to the listing and to the product\'s site, and stays up as long as the listing does.',
        ) }}
      </p>
      <p class="spx-note">
        {{ pick('包含在', 'Included with the') }} <strong>{{ planNames }}</strong>
        {{ pick(
          '两档收录权益里，不单独售卖，也不影响产品排名——榜单只由投票决定。',
          "listings. It is not sold separately and it does not change a product's rank — the board is decided by votes only.",
        ) }}
      </p>
    </header>

    <section v-if="items.length" class="spx-list" aria-labelledby="spx-list-title">
      <h2 id="spx-list-title">{{ pick('已发布', 'Published') }}</h2>
      <div class="spx-grid">
        <NuxtLink
          v-for="item in items"
          :key="item.slug"
          class="spx-item"
          :to="localePath(`/spotlights/${item.slug}`)"
        >
          <span class="spx-item__date">{{ item.publishedAt }}</span>
          <strong>{{ item.productName }}</strong>
          <span class="spx-item__tagline">{{ item.tagline }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="spx-empty" aria-labelledby="spx-empty-title">
      <h2 id="spx-empty-title">{{ pick('第一批聚光灯正在审核中', 'The first spotlights are in review') }}</h2>
      <p>
        {{ pick('聚光灯是一篇一篇写的，发布前还要过一遍审核，所以这个列表一开始会很短。', 'Spotlights are written one product at a time and reviewed before they go up, so this list starts short.') }}
        {{ pick('如果你的收录在精选或专业档，想让我们下一篇就写你的，', 'If your listing is on the Featured or Pro plan and you want yours written next,') }}
        <NuxtLink :to="localePath('/spotlights/submit')">{{ pick('填一下投稿表单', 'fill in the form') }}</NuxtLink>
        {{ pick('——下面的模板是最快的起点。', '— the template below is the fastest way to start.') }}
      </p>
    </section>

    <section class="spx-how" aria-labelledby="spx-how-title">
      <h2 id="spx-how-title">{{ pick('聚光灯怎么发布', 'How a Spotlight gets published') }}</h2>
      <ol class="spx-steps">
        <li>
          <strong>{{ pick('你来起草。', 'You draft it.') }}</strong>
          {{ pick(
            '按模板填，800 到 1,500 字，写给一个从没听过这个产品的读者。直接抄官网首页是过不了审核的。',
            "Fill in the template — 800 to 1,500 words, written for a reader who has never heard of the product. Copying the site's own homepage does not pass review.",
          ) }}
        </li>
        <li>
          <strong>{{ pick('我们审一遍。', 'We review it.') }}</strong>
          {{ pick(
            '一次看准确性，一次看结构。错别字和注水段落我们直接改，但不重写你的论点，也不替你加没说过的话。',
            'One pass for accuracy and one for structure. We fix typos and trim padding; we do not rewrite the argument or add claims you did not make.',
          ) }}
        </li>
        <li>
          <strong>{{ pick('上线，有独立网址。', 'It goes live at its own URL.') }}</strong>
          {{ pick(
            '文章里链到你的收录页和官网，当天就进 sitemap。',
            'The article links to your listing and to your site, and it is added to the sitemap the same day.',
          ) }}
        </li>
        <li>
          <strong>{{ pick('送你一枚徽章。', 'You get a badge.') }}</strong>
          {{ pick(
            '可选，永远不是发布的前提条件——嵌入代码见徽章页。',
            'Optional, and never a condition of publication — see the badge page for the embed code.',
          ) }}
        </li>
      </ol>
      <div class="spx-actions">
        <NuxtLink class="spx-btn spx-btn--primary" :to="localePath('/spotlights/submit')">
          {{ pick('提交你的草稿', 'Submit your draft') }}
        </NuxtLink>
        <NuxtLink class="spx-btn" :to="localePath('/spotlights/guidelines')">
          {{ pick('看模板与审核标准', 'Read the template and review standards') }}
        </NuxtLink>
        <NuxtLink class="spx-btn" :to="localePath('/spotlights/badge')">{{ pick('领取徽章', 'Get the badge') }}</NuxtLink>
        <NuxtLink class="spx-btn" :to="localePath('/pricing')">{{ pick('看哪些档位包含', 'See which plans include it') }}</NuxtLink>
      </div>
    </section>

    <p class="spx-foot">
      {{ pick(
        '聚光灯是编辑内容，不是软文：产品自己的链接是 dofollow，正文里其它外链一律 nofollow，页面上也会写明它随付费收录一起提供。',
        'A Spotlight is editorial, not an advertorial: the product\'s own link is dofollow, every other external link in the body is nofollow, and the article says on the page that it comes with a paid listing.',
      ) }}
    </p>
  </div>
</template>

<style scoped>
.spx-page { padding-top: 28px; padding-bottom: 64px; max-width: 820px; }
.spx-head { margin: 12px 0 36px; }
.spx-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.spx-head h1 { margin: 8px 0 14px; font-size: 34px; line-height: 1.2; letter-spacing: -0.03em; }
.spx-lead { margin: 0 0 12px; font-size: 17px; line-height: 1.65; }
.spx-note { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.spx-list h2, .spx-empty h2, .spx-how h2 { margin: 0 0 14px; font-size: 22px; letter-spacing: -0.02em; }
.spx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.spx-item { display: flex; flex-direction: column; gap: 5px; padding: 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); text-decoration: none; color: inherit; }
.spx-item:hover { border-color: #d9a03a; }
.spx-item__date { font-size: 11px; letter-spacing: 0.06em; color: var(--muted-foreground); }
.spx-item strong { font-size: 16px; }
.spx-item__tagline { font-size: 13px; line-height: 1.55; color: var(--muted-foreground); }
.spx-empty { padding: 22px; border: 1px dashed var(--border); border-radius: 16px; background: var(--card); }
.spx-empty p { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.spx-how { margin-top: 40px; }
.spx-steps { list-style: none; margin: 0 0 20px; padding: 0; display: grid; gap: 12px; counter-reset: spx; }
.spx-steps li { position: relative; padding: 16px 16px 16px 52px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); font-size: 14px; line-height: 1.7; }
.spx-steps li::before { counter-increment: spx; content: counter(spx); position: absolute; left: 16px; top: 15px; width: 24px; height: 24px; border-radius: 50%; background: #14161a; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.spx-steps strong { display: block; margin-bottom: 2px; }
.spx-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.spx-btn { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); font-size: 14px; font-weight: 600; text-decoration: none; color: inherit; }
.spx-btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
.spx-foot { margin: 36px 0 0; font-size: 12px; line-height: 1.7; color: var(--muted-foreground); }
@media (max-width: 640px) {
  .spx-head h1 { font-size: 26px; }
}
</style>
