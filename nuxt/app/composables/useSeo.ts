/**
 * One place that owns everything <head> needs for a page: title, description,
 * Open Graph, canonical and hreflang.
 *
 * The two locales are the same page at two paths — `/tools/chatgpt` and
 * `/zh/tools/chatgpt` — so the canonical and the alternates are derived from
 * the route rather than passed in by each page. That way a new page cannot
 * ship with a wrong or missing hreflang.
 *
 * The one exception is a page that has no translated twin, which a product
 * listing without Chinese copy is: see `zhTwin` below.
 */

import { SCHEMA_SITE, SCHEMA_SITE_NAME } from '~~/shared/utils/schema'

// Aliased rather than repeated: the host and the brand are also in the
// homepage's Organization/WebSite markup, and two copies of a brand name is
// exactly how a site ends up telling Google two different things.
const SITE = SCHEMA_SITE
const SITE_NAME = SCHEMA_SITE_NAME

type SeoInput = {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /** 'article' for tool detail pages, 'website' for everything else. */
  type?: 'website' | 'article'
  /** Absolute or root-relative image; defaults to the locale's OG card. */
  image?: string
  /**
   * Whether this page exists in both languages. Defaults to `true`, which is
   * right for every page whose copy is written twice.
   *
   * `false` for a product listing with no Chinese copy: `/zh/products/<slug>`
   * then points its canonical at the English URL and claims no `hreflang`
   * alternate. A page that translates its own buttons around an English body
   * is not a translation, and telling Google it is one is how a directory ends
   * up with 79 near-duplicate URLs.
   */
  zhTwin?: MaybeRefOrGetter<boolean>
}

export function useSeo(input: SeoInput) {
  const { locale } = useI18n()
  const route = useRoute()

  const isZh = computed(() => locale.value === 'zh')
  const zhTwin = computed(() => (input.zhTwin === undefined ? true : Boolean(toValue(input.zhTwin))))

  /**
   * Route path with the `/zh` prefix stripped, so both locales collapse onto
   * the same key: `/zh/tools/x` -> `/tools/x`, `/zh` -> `/`.
   */
  const barePath = computed(() => {
    const path = route.path
    if (path === '/zh') return '/'
    return path.replace(/^\/zh(?=\/)/, '')
  })

  const suffix = computed(() => (barePath.value === '/' ? '/' : barePath.value))

  const enUrl = computed(() => `${SITE}${suffix.value}`)
  const zhUrl = computed(() => `${SITE}/zh${suffix.value}`)
  // One document, one canonical. A zh URL with no zh content canonicalises to
  // the English page instead of claiming to be its own original.
  const canonical = computed(() => (isZh.value && zhTwin.value ? zhUrl.value : enUrl.value))

  // There are two hand-made OG cards in /assets/img/brand, one per language,
  // so a shared link previews in the reader's language.
  const image = computed(() => {
    const raw = input.image || `/assets/img/brand/og-${isZh.value ? 'zh' : 'en'}.jpg`
    return raw.startsWith('http') ? raw : `${SITE}${raw}`
  })

  useHead({
    link: computed(() =>
      zhTwin.value
        ? [
            { rel: 'canonical', href: canonical.value },
            { rel: 'alternate', hreflang: 'en', href: enUrl.value },
            { rel: 'alternate', hreflang: 'zh-Hans', href: zhUrl.value },
            { rel: 'alternate', hreflang: 'x-default', href: enUrl.value },
          ]
        : // No alternates at all: an hreflang set of one is not a set, and
          // pointing a second language at a page that has no second language
          // is the contradiction this branch exists to avoid.
          [{ rel: 'canonical', href: canonical.value }],
    ),
  })

  useSeoMeta({
    title: computed(() => toValue(input.title)),
    description: computed(() => toValue(input.description)),
    ogTitle: computed(() => toValue(input.title)),
    ogDescription: computed(() => toValue(input.description)),
    ogType: input.type ?? 'website',
    ogUrl: canonical,
    ogSiteName: SITE_NAME,
    ogImage: image,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogLocale: computed(() => (isZh.value ? 'zh_CN' : 'en_US')),
    ogLocaleAlternate: computed(() => (isZh.value ? 'en_US' : 'zh_CN')),
    twitterCard: 'summary_large_image',
    twitterImage: image,
  })
}
