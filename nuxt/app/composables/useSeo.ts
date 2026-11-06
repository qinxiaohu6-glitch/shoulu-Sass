/**
 * One place that owns everything <head> needs for a page: title, description,
 * Open Graph, canonical and hreflang.
 *
 * The two locales are the same page at two paths — `/tools/chatgpt` and
 * `/zh/tools/chatgpt` — so the canonical and the alternates are derived from
 * the route rather than passed in by each page. That way a new page cannot
 * ship with a wrong or missing hreflang.
 */

const SITE = 'https://dirtool.com'
const SITE_NAME = 'Product Atlas'

type SeoInput = {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /** 'article' for tool detail pages, 'website' for everything else. */
  type?: 'website' | 'article'
  /** Absolute or root-relative image; defaults to the locale's OG card. */
  image?: string
}

export function useSeo(input: SeoInput) {
  const { locale } = useI18n()
  const route = useRoute()

  const isZh = computed(() => locale.value === 'zh')

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
  const canonical = computed(() => (isZh.value ? zhUrl.value : enUrl.value))

  // There are two hand-made OG cards in /assets/img/brand, one per language,
  // so a shared link previews in the reader's language.
  const image = computed(() => {
    const raw = input.image || `/assets/img/brand/og-${isZh.value ? 'zh' : 'en'}.jpg`
    return raw.startsWith('http') ? raw : `${SITE}${raw}`
  })

  useHead({
    link: [
      { rel: 'canonical', href: canonical },
      { rel: 'alternate', hreflang: 'en', href: enUrl },
      { rel: 'alternate', hreflang: 'zh-Hans', href: zhUrl },
      { rel: 'alternate', hreflang: 'x-default', href: enUrl },
    ],
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
