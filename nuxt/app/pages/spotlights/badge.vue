<script setup lang="ts">
/**
 * /spotlights/badge — the embed code for "Featured on dirtool".
 *
 * The page exists because the badge has to be genuinely optional, and the only
 * way to make that credible is to say it plainly, on its own page, in the same
 * place the code is handed out: nothing is unpublished if it comes down, no
 * listing is held back until it goes up, and the link does not have to be
 * dofollow. Asking for a link as a condition of a listing is a link scheme, and
 * the whole point of the badge is that it is not one.
 *
 * Both snippets point at the listing page rather than the article, because a
 * listing is permanent and an article URL can be re-slugged.
 *
 * Bilingual: the section shipped English-only and this page 301'd `/zh/...`
 * back to English. Copy goes through `pick()`, links through `localePath()`.
 */
const { pick } = useLang()
const localePath = useLocalePath()

const badgePath = '/assets/img/brand/featured-on-product-atlas.svg'
// The snippets need an absolute URL because they are pasted onto someone
// else's site; the preview on this page must stay relative or it points at
// production from a local dev server and renders as a broken image.
const badgeUrl = `https://dirtool.com${badgePath}`
const listingExample = 'https://dirtool.com/products/your-product'

const htmlSnippet = `<a href="${listingExample}" target="_blank" rel="noopener">
  <img src="${badgeUrl}"
       alt="Featured on dirtool"
       width="280" height="64" loading="lazy">
</a>`

const markdownSnippet = `[![Featured on dirtool](${badgeUrl})](${listingExample})`

useSeo({
  title: computed(() =>
    pick('收录徽章 Featured on dirtool · dirtool', 'Featured on dirtool badge · dirtool'),
  ),
  description: computed(() =>
    pick(
      '给已收录或做过聚光灯的产品用的可选徽章：嵌入代码，以及为什么它永远不是发布的前提条件。',
      'An optional badge for products listed or spotlighted on dirtool. Embed code, and why it is never a condition of publication.',
    ),
  ),
})
</script>

<template>
  <div class="container bd-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/spotlights')">{{ pick('产品聚光灯', 'Product Spotlights') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('徽章', 'Badge') }}</span>
    </nav>

    <header class="bd-head">
      <p class="bd-kicker">{{ pick('徽章', 'BADGE') }}</p>
      <h1>{{ pick('收录于 dirtool', 'Featured on dirtool') }}</h1>
      <p class="bd-lead">
        {{ pick(
          '给已经收录、或者做过聚光灯的产品用的一枚徽章。放哪儿都行——页脚、媒体页、关于页。它是个方便，不是义务。',
          'A badge for a product that is listed or spotlighted here. Put it wherever it fits — a footer, a press page, an about page. It is a convenience, not a requirement.',
        ) }}
      </p>
    </header>

    <section aria-labelledby="bd-preview">
      <h2 id="bd-preview">{{ pick('徽章长这样', 'The badge') }}</h2>
      <div class="bd-preview">
        <img
          :src="badgePath"
          alt="Featured on dirtool"
          width="280"
          height="64"
        >
      </div>
      <p class="bd-note">
        {{ pick(
          '一个文件，没有脚本，280 × 64。自带底色，深浅背景上都能看清。',
          'One file, no script, 280 × 64. It renders on light and dark backgrounds because the badge carries its own background.',
        ) }}
      </p>
    </section>

    <section aria-labelledby="bd-html">
      <h2 id="bd-html">{{ pick('嵌入代码', 'Embed code') }}</h2>
      <p>{{ pick('把示例里的收录地址换成你自己的产品页。', 'Replace the example listing URL with your own product page.') }}</p>
      <pre class="bd-code"><code>{{ htmlSnippet }}</code></pre>
      <p class="bd-note">{{ pick('如果站点用 Markdown：', 'Markdown, if your site uses it:') }}</p>
      <pre class="bd-code"><code>{{ markdownSnippet }}</code></pre>
      <p class="bd-note">
        {{ pick('或者直接链图片文件：', 'Or link the image file directly:') }}
        <a :href="badgeUrl" download>{{ pick('下载 SVG', 'download the SVG') }}</a>。
      </p>
    </section>

    <section aria-labelledby="bd-rules">
      <h2 id="bd-rules">{{ pick('完整规则', 'The rules, in full') }}</h2>
      <ul class="bd-list">
        <li>
          <strong>{{ pick('它是可选的。', 'It is optional.') }}</strong>
          {{ pick(
            '收录页有没有这枚徽章，都照常发布、照常排名、照常保留。',
            'A listing is published, ranked and kept whether or not the badge is on your site.',
          ) }}
        </li>
        <li>
          <strong>{{ pick('不会因为没挂就压着不放。', 'Nothing is held back until it goes up.') }}</strong>
          {{ pick('没有任何收录排在徽章后面等着。', 'No listing is queued behind a badge placement.') }}
        </li>
        <li>
          <strong>{{ pick('链接不必是 dofollow。', 'The link does not have to be dofollow.') }}</strong>
          {{ pick('站点政策要求 nofollow 就加', 'Add') }}
          <code>rel="nofollow"</code>{{ pick('，我们不检查。', ' if that is your site\'s policy. We do not check.') }}
        </li>
        <li>
          <strong>{{ pick('随时可以撤。', 'You can take it down.') }}</strong>
          {{ pick('撤掉徽章不会下架内容，也不会从收录页移除链接。', 'Nothing is unpublished and no link is removed from your listing if the badge comes off.') }}
        </li>
        <li>
          <strong>{{ pick('我们不会催第二次。', 'We do not ask twice.') }}</strong>
          {{ pick('不会为了徽章发跟进邮件。', 'There is no follow-up mail chasing a badge.') }}
        </li>
      </ul>
      <p class="bd-warn">
        {{ pick(
          '这五条的原因只有一个：拿链接换收录就是链接买卖，一旦被搜索引擎这么判定，两边都吃亏。徽章值得挂，是因为人自己愿意挂。',
          'The reason for all five: a link that is required in exchange for a listing is a link scheme, and both sides lose when search engines treat it as one. The badge is worth having because people choose to use it.',
        ) }}
      </p>
    </section>

    <p class="bd-foot">
      <NuxtLink :to="localePath('/spotlights')">{{ pick('← 全部产品聚光灯', '← All Product Spotlights') }}</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.bd-page { padding-top: 28px; padding-bottom: 64px; max-width: 780px; }
.bd-head { margin: 12px 0 32px; }
.bd-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.bd-head h1 { margin: 8px 0 12px; font-size: 34px; line-height: 1.2; letter-spacing: -0.03em; }
.bd-lead { margin: 0; font-size: 17px; line-height: 1.65; }
h2 { margin: 34px 0 12px; font-size: 22px; letter-spacing: -0.02em; }
p { font-size: 15px; line-height: 1.75; margin: 0 0 12px; }
code { font-size: 0.88em; padding: 1px 5px; border-radius: 5px; background: var(--muted, #f4f4f2); }
.bd-preview { padding: 26px; border: 1px solid var(--border); border-radius: 16px; background: var(--card); display: flex; justify-content: center; }
.bd-note { font-size: 13px; line-height: 1.7; color: var(--muted-foreground); }
.bd-code { margin: 0 0 14px; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: #14161a; color: #e6e8ec; overflow-x: auto; font-size: 12.5px; line-height: 1.6; }
.bd-code code { background: none; padding: 0; color: inherit; white-space: pre; }
.bd-list { margin: 0 0 14px; padding: 0 0 0 22px; display: grid; gap: 8px; }
.bd-list li { font-size: 14px; line-height: 1.7; }
.bd-warn { padding: 14px 16px; border-left: 3px solid #d9a03a; background: #fff8e8; border-radius: 0 10px 10px 0; font-size: 13px; line-height: 1.7; color: #6b531f; }
.bd-foot { margin-top: 40px; font-size: 13px; }
.bd-foot a { color: var(--muted-foreground); text-decoration: none; }
.bd-foot a:hover { color: #b45309; }
@media (max-width: 640px) {
  .bd-head h1 { font-size: 26px; }
}
</style>
