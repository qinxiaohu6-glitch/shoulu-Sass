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
 *    article is published once, in whatever language it was written. Both the
 *    `/spotlights/...` and `/zh/spotlights/...` paths serve it — the 301 that
 *    used to bounce the Chinese path back to English turned "switch language"
 *    into a dead click (and, when the redirect landed mid-navigation, a 404),
 *    and an article you cannot open is worse than a duplicate URL. The
 *    canonical tag pins both paths to the default-locale URL, so the search
 *    engine still sees one page. The chrome around the body is bilingual; the
 *    body itself is the author's, in the language they wrote it in.
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
import { findSpotlightListing } from '~~/shared/utils/spotlight-listing'
import { useSubmittedTools } from '~/composables/useSubmittedTools'

const route = useRoute()
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const submitted = await useSubmittedTools()
const overrides = useOverrides()

const slug = String(route.params.slug ?? '')

const requestFetch = useRequestFetch()
type OnePayload = { ok: boolean; item: Spotlight }
type ListPayload = { ok: boolean; items: Spotlight[] }

const [{ data: one }, { data: list }] = await Promise.all([
  useAsyncData<OnePayload | null>(`spotlight-${slug}`, async () => {
    try {
      return await requestFetch<OnePayload>(`/api/spotlights/${encodeURIComponent(slug)}`)
    } catch (err) {
      // Only a real 404 means "no such article". Anything else — a dropped
      // request, a 5xx — used to be swallowed into `null` and rendered as a
      // 404, which tells the reader the article does not exist when the truth
      // is that we could not read it.
      const status = (err as { statusCode?: number; response?: { status?: number } })?.statusCode
        ?? (err as { response?: { status?: number } })?.response?.status
      if (status === 404) return null
      throw err
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
const merged = mergeDirectory(
  orderedTools(lang.value, overrides.value),
  submitted.value,
  overrides.value,
)

/**
 * The article outlives the listing's slug.
 *
 * `listing_slug` is a snapshot taken the day the article was submitted. When a
 * product is deleted and re-added its slug changes, and this page used to
 * answer 404 for a published, paid-for article — while the sitemap kept
 * advertising it. The host is the stable identifier, so it is tried second; and
 * a listing that is genuinely gone no longer kills the page, it only drops the
 * internal link to it (and the dofollow claim that came with it).
 */
const listing = findSpotlightListing(spotlight.listingSlug, spotlight.productUrl, merged)

const productName = listing?.name ?? spotlight.productName
const productShort = listing?.short ?? spotlight.tagline
const productLogo = listing?.logo ?? ''
const listingPath = computed(() => (listing ? localePath(`/products/${listing.slug}`) : ''))

const canonical = `https://dirtool.com/spotlights/${spotlight.slug}`
const published = new Date(`${spotlight.publishedAt}T00:00:00Z`)
const publishedLabel = published.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const more = computed(() =>
  (list.value?.items ?? [])
    .filter((item) => item.slug !== spotlight.slug)
    // A "More spotlights" card that leads to a 404 is worse than one card fewer.
    .filter((item) => findSpotlightListing(item.listingSlug, item.productUrl, merged) !== null)
    .slice(0, 3),
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
            { name: pick('发现', 'Discover'), path: '/' },
            { name: pick('产品聚光灯', 'Product Spotlights'), path: '/spotlights' },
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
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/spotlights')">{{ pick('产品聚光灯', 'Product Spotlights') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ spotlight.productName }}</span>
    </nav>

    <article class="sp-article">
      <header class="sp-head">
        <p class="sp-kicker">{{ pick('产品聚光灯', 'PRODUCT SPOTLIGHT') }}</p>
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
        <ToolLogo :logo="productLogo" :name="productName" :size="52" decorative />
        <div class="sp-card__body">
          <strong>{{ productName }}</strong>
          <span>{{ productShort }}</span>
          <ul v-if="spotlight.bestFor || spotlight.pricingSummary" class="sp-card__facts">
            <li v-if="spotlight.bestFor"><em>{{ pick('适合', 'Best for') }}</em> {{ spotlight.bestFor }}</li>
            <li v-if="spotlight.pricingSummary"><em>{{ pick('价格', 'Pricing') }}</em> {{ spotlight.pricingSummary }}</li>
          </ul>
        </div>
        <div class="sp-card__actions">
          <!-- dofollow only while the listing is live: it is the paid benefit,
               and an article whose listing has left the directory must not keep
               handing it out. -->
          <a
            class="sp-btn sp-btn--primary"
            :href="spotlight.productUrl"
            target="_blank"
            :rel="listing ? 'noopener' : 'nofollow noopener'"
          >
            {{ pick('访问官网', 'Visit website') }} ↗
          </a>
          <NuxtLink v-if="listingPath" class="sp-btn" :to="listingPath">{{ pick('查看收录页', 'View listing') }}</NuxtLink>
        </div>
      </aside>

      <MarkdownContent
        class="sp-body"
        :content="spotlight.body"
        :utm="{ source: 'product-atlas', medium: 'spotlight' }"
      />

      <footer class="sp-foot">
        <div v-if="spotlight.authorBio" class="sp-bio">
          <p class="sp-bio__label">{{ pick('关于作者', 'About the author') }}</p>
          <p>{{ spotlight.authorBio }}</p>
        </div>
        <div class="sp-cta">
          <p class="sp-cta__title">{{ pick('试用', 'Try') }} {{ productName }}</p>
          <p class="sp-cta__note">
            {{ pick(
              '产品页里有完整介绍、所属分类和当前排名。',
              'The product page has the full profile, category and current ranking.',
            ) }}
          </p>
          <div class="sp-cta__btns">
            <a
              class="sp-btn sp-btn--primary"
              :href="spotlight.productUrl"
              target="_blank"
              :rel="listing ? 'noopener' : 'nofollow noopener'"
            >
              {{ pick('访问', 'Visit') }} {{ productName }} ↗
            </a>
            <NuxtLink v-if="listingPath" class="sp-btn" :to="listingPath">{{ pick('查看收录页', 'View listing') }}</NuxtLink>
          </div>
        </div>
        <p class="sp-disclosure">
          {{
            listing
              ? pick(
                  '本文随付费收录一起提供。产品官网链接是 dofollow，正文其它外链一律 nofollow；内容不因付费而改写。',
                  'This article accompanies a paid listing on Product Atlas. The product\'s own link is dofollow; all other outbound links in the body are nofollow. Nothing here was written to order by the product\'s team.',
                )
              : pick(
                  '这篇聚光灯原先随付费收录一起提供，那条收录目前不在目录里，因此官网链接暂时改为 nofollow。正文内容没有改动。',
                  'This spotlight accompanied a paid listing that is no longer in the directory, so the product link is temporarily nofollow. The article itself is unchanged.',
                )
          }}
        </p>
      </footer>
    </article>

    <section v-if="more.length" class="sp-more" aria-labelledby="sp-more-title">
      <h2 id="sp-more-title">{{ pick('更多聚光灯', 'More spotlights') }}</h2>
      <div class="sp-more__grid">
        <NuxtLink
          v-for="item in more"
          :key="item.slug"
          class="sp-more__item"
          :to="localePath(`/spotlights/${item.slug}`)"
        >
          <strong>{{ item.productName }}</strong>
          <span>{{ item.tagline }}</span>
        </NuxtLink>
      </div>
    </section>

    <p class="sp-back">
      <NuxtLink :to="localePath('/spotlights')">← {{ pick('全部产品聚光灯', 'All Product Spotlights') }}</NuxtLink>
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
