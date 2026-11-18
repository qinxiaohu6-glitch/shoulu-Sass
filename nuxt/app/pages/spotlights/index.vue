<script setup lang="ts">
/**
 * /spotlights — the index for Product Spotlights.
 *
 * The page has two jobs and the order matters: first explain what a Spotlight
 * is (most visitors arrive from the pricing page and have never seen one),
 * then show the published ones. While the pilot has no articles the second half
 * is an honest empty state rather than a placeholder, because a fake article
 * would be the one thing that discredits the whole feature.
 */
import { SPOTLIGHT_PLANS, publishedSpotlights } from '~~/shared/content/spotlights'
import { breadcrumbSchema, itemListSchema } from '~~/shared/utils/schema'

const { lang } = useLang()

if (lang.value === 'zh') {
  await navigateTo('/spotlights', { redirectCode: 301 })
}

const items = publishedSpotlights()
const canonical = 'https://dirtool.com/spotlights'

const planNames = computed(() =>
  SPOTLIGHT_PLANS.map((plan) => (plan === 'pro' ? 'Pro' : 'Featured')).join(' and '),
)

useHead({
  title: 'Product Spotlights: long-form articles about listed products · Product Atlas',
  meta: [
    {
      name: 'description',
      content:
        'A Product Spotlight is a long-form article about one listed product, published at its own URL. Included with the Featured and Pro listings.',
    },
    { property: 'og:title', content: 'Product Spotlights · Product Atlas' },
    {
      property: 'og:description',
      content:
        'A long-form article about one listed product, at its own URL. Included with Featured and Pro.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonical },
  ],
  link: [{ rel: 'canonical', href: canonical }],
})

useHead({
  script: computed(() => {
    const scripts: { type: 'application/ld+json'; innerHTML: string }[] = [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          breadcrumbSchema([
            { name: 'Discover', path: '/' },
            { name: 'Product Spotlights', path: '/spotlights' },
          ]),
        ),
      },
    ]
    if (items.length) {
      scripts.push({
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          itemListSchema(
            'Product Spotlights',
            items.map((item) => ({ name: item.productName, path: `/spotlights/${item.slug}` })),
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
      <NuxtLink to="/">Discover</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>Product Spotlights</span>
    </nav>

    <header class="spx-head">
      <p class="spx-kicker">PRODUCT SPOTLIGHTS</p>
      <h1>Long-form articles about the products listed here</h1>
      <p class="spx-lead">
        A Spotlight is a written piece about one product — what it does, who it is for, and where it
        fits. It lives at its own URL, links to the listing and to the product's site, and stays up
        as long as the listing does.
      </p>
      <p class="spx-note">
        Included with the <strong>{{ planNames }}</strong> listings. It is not sold separately and it
        does not change a product's rank — the board is decided by votes only.
      </p>
    </header>

    <section v-if="items.length" class="spx-list" aria-labelledby="spx-list-title">
      <h2 id="spx-list-title">Published</h2>
      <div class="spx-grid">
        <NuxtLink v-for="item in items" :key="item.slug" class="spx-item" :to="`/spotlights/${item.slug}`">
          <span class="spx-item__date">{{ item.publishedAt }}</span>
          <strong>{{ item.productName }}</strong>
          <span class="spx-item__tagline">{{ item.tagline }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="spx-empty" aria-labelledby="spx-empty-title">
      <h2 id="spx-empty-title">The first spotlights are in review</h2>
      <p>
        Spotlights are written one product at a time and reviewed before they go up, so this list
        starts short. If your listing is on the Featured or Pro plan and you want yours written
        next, the template below is the fastest way to start.
      </p>
    </section>

    <section class="spx-how" aria-labelledby="spx-how-title">
      <h2 id="spx-how-title">How a Spotlight gets published</h2>
      <ol class="spx-steps">
        <li>
          <strong>You draft it.</strong> Fill in the template — 800 to 1,500 words, written for a
          reader who has never heard of the product. Copying the site's own homepage does not pass
          review.
        </li>
        <li>
          <strong>We review it.</strong> One pass for accuracy and one for structure. We fix typos
          and trim padding; we do not rewrite the argument or add claims you did not make.
        </li>
        <li>
          <strong>It goes live at its own URL.</strong> The article links to your listing and to
          your site, and it is added to the sitemap the same day.
        </li>
        <li>
          <strong>You get a badge.</strong> Optional, and never a condition of publication — see the
          badge page for the embed code.
        </li>
      </ol>
      <div class="spx-actions">
        <NuxtLink class="spx-btn spx-btn--primary" to="/spotlights/guidelines">
          Read the template and review standards
        </NuxtLink>
        <NuxtLink class="spx-btn" to="/spotlights/badge">Get the badge</NuxtLink>
        <NuxtLink class="spx-btn" to="/pricing">See which plans include it</NuxtLink>
      </div>
    </section>

    <p class="spx-foot">
      A Spotlight is editorial, not an advertorial: the product's own link is dofollow, every other
      external link in the body is nofollow, and the article says on the page that it comes with a
      paid listing.
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
