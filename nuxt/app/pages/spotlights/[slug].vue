<script setup lang="ts">
/**
 * /spotlights/<slug> — one long-form article about one listing.
 *
 * Three things make this page different from a blog post, and all three are
 * load-bearing:
 *
 *  - **The product card is the only dofollow link.** The body renders through
 *    `renderMarkdown`, which forces `nofollow noopener` on every external link.
 *    The card's "Visit website" is written directly, so the paid benefit is one
 *    declared link and not a paragraph of them.
 *  - **One canonical URL per article.** The record carries no `locale`, so the
 *    article is published once, in whatever language it was written, and
 *    `/zh/spotlights/...` 301s to that one URL instead of serving the same
 *    bytes twice. (The four pages around it are bilingual; this one cannot be
 *    until an article knows its own language.)
 *  - **The listing must exist.** A Spotlight without a live listing is a dead
 *    internal link, so a missing listing is a 404, not a page with an empty card.
 *
 * The article is read from `/api/spotlights/<slug>` rather than a module
 * constant. A draft is only reachable once the owner has approved it, and the
 * endpoint answers the same 404 to a pending draft, a rejected one and a slug
 * that never existed — so the URL cannot be used to probe the queue.
 */
import type { Spotlight } from '~~/shared/content/spotlights'
import { breadcrumbSchema } from '~~/shared/utils/schema'
import { mergeDirectory, orderedTools } from '~~/shared/utils/catalog'
import { useSubmittedTools } from '~/composables/useSubmittedTools'

const route = useRoute()
const { lang } = useLang()
const submitted = await useSubmittedTools()
const overrides = useOverrides()

const slug = String(route.params.slug ?? '')

// One article, one language, one canonical. A `/zh` twin would be the same
// bytes under a second URL, which is the duplicate this redirect prevents.
if (lang.value === 'zh') {
  await navigateTo(`/spotlights/${slug}`, { redirectCode: 301 })
}

const requestFetch = useRequestFetch()
type OnePayload = { ok: boolean; item: Spotlight }
type ListPayload = { ok: boolean; items: Spotlight[] }

const [{ data: one }, { data: list }] = await Promise.all([
  useAsyncData<OnePayload | null>(`spotlight-${slug}`, async () => {
    try {
      return await requestFetch<OnePayload>(`/api/spotlights/${encodeURIComponent(slug)}`)
    } catch {
      return null
    }
  }, { default: () => null }),
  useAsyncData<ListPayload>('spotlights-index', async () => {
    try {
      const res = await requestFetch<ListPayload>('/api/spotlights')
      return { ok: Boolean(res?.ok), items: res?.items ?? [] }
    } catch {
      return { ok: false, items: [] as Spotlight[] }
    }
  }, { default: (): ListPayload => ({ ok: false, items: [] }) }),
])

const spotlight = one.value?.item
if (!spotlight) {
  throw createError({
    statusCode: 404,
    statusMessage: 'No spotlight with that name',
    fatal: true,
  })
}

// Resolved once at setup, not a computed: everything it reads is already
// awaited above, and a plain value is what lets the template narrow it.
const listing = mergeDirectory(
  orderedTools(lang.value, overrides.value),
  submitted.value,
  overrides.value,
).find((tool) => tool.slug === spotlight.listingSlug)

if (!listing) {
  throw createError({
    statusCode: 404,
    statusMessage: 'The listing this spotlight belongs to is not published',
    fatal: true,
  })
}

const canonical = `https://dirtool.com/spotlights/${spotlight.slug}`
const published = new Date(`${spotlight.publishedAt}T00:00:00Z`)
const publishedLabel = published.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const more = computed(() =>
  (list.value?.items ?? []).filter((item) => item.slug !== spotlight.slug).slice(0, 3),
)

useHead({
  title: `${spotlight.productName} spotlight: ${spotlight.tagline} · Product Atlas`,
  meta: [
    { name: 'description', content: spotlight.tagline },
    { property: 'og:title', content: `${spotlight.productName} spotlight: ${spotlight.tagline}` },
    { property: 'og:description', content: spotlight.tagline },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: canonical },
    { property: 'article:published_time', content: published.toISOString() },
  ],
  link: [{ rel: 'canonical', href: canonical }],
})

useHead({
  script: computed(() => {
    const scripts: { type: 'application/ld+json'; innerHTML: string }[] = [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: `${spotlight.productName} spotlight: ${spotlight.tagline}`,
          description: spotlight.tagline,
          url: canonical,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          datePublished: published.toISOString(),
          dateModified: published.toISOString(),
          author: { '@type': 'Person', name: spotlight.author },
          publisher: {
            '@type': 'Organization',
            name: 'Product Atlas',
            url: 'https://dirtool.com/',
          },
          // What the article is about, so the product and the article are
          // connected in the graph rather than only by a hyperlink.
          about: { '@type': 'SoftwareApplication', name: spotlight.productName, url: spotlight.productUrl },
          mentions: { '@type': 'SoftwareApplication', name: spotlight.productName, url: spotlight.productUrl },
        }),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          breadcrumbSchema([
            { name: 'Discover', path: '/' },
            { name: 'Product Spotlights', path: '/spotlights' },
            { name: spotlight.productName, path: `/spotlights/${spotlight.slug}` },
          ]),
        ),
      },
    ]
    return scripts
  }),
})
</script>

<template>
  <div class="container sp-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink to="/">Discover</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink to="/spotlights">Product Spotlights</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ spotlight.productName }}</span>
    </nav>

    <article class="sp-article">
      <header class="sp-head">
        <p class="sp-kicker">PRODUCT SPOTLIGHT</p>
        <h1>{{ spotlight.productName }}: {{ spotlight.tagline }}</h1>
        <p class="sp-meta">
          <time :datetime="spotlight.publishedAt">{{ publishedLabel }}</time>
          <span aria-hidden="true">·</span>
          <span>{{ spotlight.author }}</span>
        </p>
      </header>

      <!-- The only dofollow link on the page. Everything in the body is
           nofollow, enforced by the markdown renderer. -->
      <aside class="sp-card">
        <ToolLogo :logo="listing.logo" :name="listing.name" :size="52" decorative />
        <div class="sp-card__body">
          <strong>{{ listing.name }}</strong>
          <span>{{ listing.short }}</span>
          <ul v-if="spotlight.bestFor || spotlight.pricingSummary" class="sp-card__facts">
            <li v-if="spotlight.bestFor"><em>Best for</em> {{ spotlight.bestFor }}</li>
            <li v-if="spotlight.pricingSummary"><em>Pricing</em> {{ spotlight.pricingSummary }}</li>
          </ul>
        </div>
        <div class="sp-card__actions">
          <a class="sp-btn sp-btn--primary" :href="spotlight.productUrl" target="_blank" rel="noopener">
            Visit website ↗
          </a>
          <NuxtLink class="sp-btn" :to="`/products/${listing.slug}`">View listing</NuxtLink>
        </div>
      </aside>

      <MarkdownContent
        class="sp-body"
        :content="spotlight.body"
        :utm="{ source: 'product-atlas', medium: 'spotlight' }"
      />

      <footer class="sp-foot">
        <div v-if="spotlight.authorBio" class="sp-bio">
          <p class="sp-bio__label">About the author</p>
          <p>{{ spotlight.authorBio }}</p>
        </div>
        <div class="sp-cta">
          <p class="sp-cta__title">Try {{ listing.name }}</p>
          <p class="sp-cta__note">
            Listing on Product Atlas, or reading this for the first time? The product page has the
            full profile, category and current rank.
          </p>
          <div class="sp-cta__btns">
            <a class="sp-btn sp-btn--primary" :href="spotlight.productUrl" target="_blank" rel="noopener">
              Visit {{ listing.name }} ↗
            </a>
            <NuxtLink class="sp-btn" :to="`/products/${listing.slug}`">View listing</NuxtLink>
          </div>
        </div>
        <p class="sp-disclosure">
          This article is part of a paid listing on Product Atlas. The product's own link is
          dofollow; every other external link in the body is nofollow. Nothing here was written to
          order by the product's team.
        </p>
      </footer>
    </article>

    <section v-if="more.length" class="sp-more" aria-labelledby="sp-more-title">
      <h2 id="sp-more-title">More spotlights</h2>
      <div class="sp-more__grid">
        <NuxtLink
          v-for="item in more"
          :key="item.slug"
          class="sp-more__item"
          :to="`/spotlights/${item.slug}`"
        >
          <strong>{{ item.productName }}</strong>
          <span>{{ item.tagline }}</span>
        </NuxtLink>
      </div>
    </section>

    <p class="sp-back">
      <NuxtLink to="/spotlights">← All Product Spotlights</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.sp-page { padding-top: 28px; padding-bottom: 64px; }
.sp-article { max-width: 760px; margin: 0 auto; }
.sp-head { margin: 12px 0 26px; }
.sp-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.sp-head h1 { margin: 8px 0 12px; font-size: 34px; line-height: 1.2; letter-spacing: -0.03em; }
.sp-meta { margin: 0; font-size: 13px; color: var(--muted-foreground); display: flex; gap: 8px; align-items: center; }
.sp-card { display: flex; gap: 16px; align-items: flex-start; padding: 18px; border: 1px solid #f0d48a; background: #fff8e8; border-radius: 16px; margin-bottom: 30px; }
.sp-card__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sp-card__body strong { font-size: 16px; }
.sp-card__body > span { font-size: 13px; color: var(--muted-foreground); }
.sp-card__facts { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 3px; font-size: 12px; color: var(--muted-foreground); }
.sp-card__facts em { font-style: normal; font-weight: 700; color: var(--foreground); margin-right: 6px; }
.sp-card__actions { display: flex; flex-direction: column; gap: 8px; flex: none; }
.sp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); font-size: 13px; font-weight: 600; text-decoration: none; color: inherit; white-space: nowrap; }
.sp-btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
.sp-body { font-size: 16px; line-height: 1.75; }
.sp-foot { margin-top: 40px; }
.sp-bio { padding: 18px; border: 1px solid var(--border); border-radius: 14px; margin-bottom: 20px; }
.sp-bio__label { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; color: var(--muted-foreground); }
.sp-bio p:last-child { margin: 0; font-size: 14px; line-height: 1.7; }
.sp-cta { padding: 24px; border-radius: 18px; background: #fff7e6; border: 1px solid #f0d48a; }
.sp-cta__title { margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.sp-cta__note { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b531f; }
.sp-cta__btns { display: flex; flex-wrap: wrap; gap: 10px; }
.sp-disclosure { margin: 20px 0 0; font-size: 12px; line-height: 1.7; color: var(--muted-foreground); }
.sp-more { max-width: 760px; margin: 48px auto 0; }
.sp-more h2 { margin: 0 0 14px; font-size: 20px; letter-spacing: -0.02em; }
.sp-more__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.sp-more__item { display: flex; flex-direction: column; gap: 5px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); text-decoration: none; color: inherit; }
.sp-more__item:hover { border-color: #d9a03a; }
.sp-more__item strong { font-size: 15px; }
.sp-more__item span { font-size: 13px; line-height: 1.5; color: var(--muted-foreground); }
.sp-back { max-width: 760px; margin: 32px auto 0; font-size: 13px; }
.sp-back a { color: var(--muted-foreground); text-decoration: none; }
.sp-back a:hover { color: #b45309; }
@media (max-width: 640px) {
  .sp-head h1 { font-size: 26px; }
  .sp-card { flex-wrap: wrap; }
  .sp-card__actions { flex-direction: row; width: 100%; }
}
</style>
