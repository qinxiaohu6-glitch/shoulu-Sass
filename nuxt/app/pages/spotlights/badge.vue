<script setup lang="ts">
/**
 * /spotlights/badge — the embed code for "Featured on Product Atlas".
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
 */
const { lang } = useLang()

if (lang.value === 'zh') {
  await navigateTo('/spotlights/badge', { redirectCode: 301 })
}

const canonical = 'https://dirtool.com/spotlights/badge'
const badgePath = '/assets/img/brand/featured-on-product-atlas.svg'
// The snippets need an absolute URL because they are pasted onto someone
// else's site; the preview on this page must stay relative or it points at
// production from a local dev server and renders as a broken image.
const badgeUrl = `https://dirtool.com${badgePath}`
const listingExample = 'https://dirtool.com/products/your-product'

const htmlSnippet = `<a href="${listingExample}" target="_blank" rel="noopener">
  <img src="${badgeUrl}"
       alt="Featured on Product Atlas"
       width="280" height="64" loading="lazy">
</a>`

const markdownSnippet = `[![Featured on Product Atlas](${badgeUrl})](${listingExample})`

useHead({
  title: 'Featured on Product Atlas badge · Product Atlas',
  meta: [
    {
      name: 'description',
      content:
        'An optional badge for products listed or spotlighted on Product Atlas. Embed code, and why it is never a condition of publication.',
    },
    { property: 'og:title', content: 'Featured on Product Atlas badge' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonical },
  ],
  link: [{ rel: 'canonical', href: canonical }],
})
</script>

<template>
  <div class="container bd-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink to="/">Discover</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink to="/spotlights">Product Spotlights</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>Badge</span>
    </nav>

    <header class="bd-head">
      <p class="bd-kicker">BADGE</p>
      <h1>Featured on Product Atlas</h1>
      <p class="bd-lead">
        A badge for a product that is listed or spotlighted here. Put it wherever it fits — a footer,
        a press page, an about page. It is a convenience, not a requirement.
      </p>
    </header>

    <section aria-labelledby="bd-preview">
      <h2 id="bd-preview">The badge</h2>
      <div class="bd-preview">
        <img
          :src="badgePath"
          alt="Featured on Product Atlas"
          width="280"
          height="64"
        >
      </div>
      <p class="bd-note">
        One file, no script, 280 × 64. It renders on light and dark backgrounds because the badge
        carries its own background.
      </p>
    </section>

    <section aria-labelledby="bd-html">
      <h2 id="bd-html">Embed code</h2>
      <p>Replace the example listing URL with your own product page.</p>
      <pre class="bd-code"><code>{{ htmlSnippet }}</code></pre>
      <p class="bd-note">Markdown, if your site uses it:</p>
      <pre class="bd-code"><code>{{ markdownSnippet }}</code></pre>
      <p class="bd-note">
        Or link the image file directly:
        <a :href="badgeUrl" download>download the SVG</a>.
      </p>
    </section>

    <section aria-labelledby="bd-rules">
      <h2 id="bd-rules">The rules, in full</h2>
      <ul class="bd-list">
        <li>
          <strong>It is optional.</strong> A listing is published, ranked and kept whether or not the
          badge is on your site.
        </li>
        <li>
          <strong>Nothing is held back until it goes up.</strong> No listing is queued behind a badge
          placement.
        </li>
        <li>
          <strong>The link does not have to be dofollow.</strong> Add
          <code>rel="nofollow"</code> if that is your site's policy. We do not check.
        </li>
        <li>
          <strong>You can take it down.</strong> Nothing is unpublished and no link is removed from
          your listing if the badge comes off.
        </li>
        <li>
          <strong>We do not ask twice.</strong> There is no follow-up mail chasing a badge.
        </li>
      </ul>
      <p class="bd-warn">
        The reason for all five: a link that is required in exchange for a listing is a link scheme,
        and both sides lose when search engines treat it as one. The badge is worth having because
        people choose to use it.
      </p>
    </section>

    <p class="bd-foot">
      <NuxtLink to="/spotlights">← All Product Spotlights</NuxtLink>
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
