<script setup lang="ts">
import { submissionTagError } from '~~/shared/utils/batch2'
/**
 * Ported from `shipany-dir/src/components/directory/SubmitForm.tsx` and its
 * `SubmitFormParts.tsx`.
 *
 * One page, four blocks: the fields on the left with a live preview card on the
 * right, then the two listing tiers, then the submit button, then the FAQ
 * accordion. The source splits the parts into separate components because React
 * needs props passed down; here they are sections of one file, since the state is
 * shared and nothing else renders them.
 *
 * Payload mapping — the source's server function against this build's
 * `POST /api/submit`:
 *
 *   source          this build
 *   ─────────────   ──────────────────────────────────────────────
 *   `categoryId`    `category`, a **slug** (the API validates against slugs)
 *   `tagline`       `short`
 *   `description`   `long`
 *   `plan`          `'free'`, or one of `standard` / `featured` / `pro`
 *
 * That last line is the one mapping worth spelling out: the source called the
 * paid tier Premium. This site records that choice as `featured` and shows the
 * live Featured charge from `tiers`. The button can still say Premium.
 * `/pricing` has four columns, so it sends `?plan=`; the form keeps the source's
 * two cards and only uses the parameter to choose which real plan is submitted
 * and which price is shown. The amount is never taken from the URL — checkout
 * reads `planAmountCents(plan)` on the server.
 *
 * Payment: the source opens a provider picker after a paid submit. This build
 * configures one provider server-side, so `usePayment().pay(id)` goes straight to
 * it. A missing provider does not store an invoice or show a paid success.
 *
 * Guests can paste a URL and draft a listing. Nothing is written until they
 * sign in and save or pay. The draft sits in sessionStorage across the
 * Google redirect.
 */
import { campaignActive, campaignDeadlineShanghai } from '~~/shared/content/campaign'
import { tiers } from '~~/shared/content/pricing'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { publicProductName } from '~~/shared/utils/public-name'
import type { SubmitFaqItem } from '~/utils/directory-ui'
import { legalLogoUrl } from '~~/shared/utils/logo'
import type { AppPlatform, AppStoreInfo } from '~~/shared/types/app-store'

const props = withDefaults(defineProps<{ listingType?: 'website' | 'app' }>(), { listingType: 'website' })
const isAppListing = computed(() => props.listingType === 'app')
const { lang, pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const t = useDirectoryCopy()
const { user, ensure } = useSession()

/**
 * Reading the session does not bounce a guest. POST /api/submit still refuses
 * a missing session. Sign-in happens on save or pay, after the draft exists
 * only in the browser.
 */
await ensure()
const signInHref = computed(() =>
  localePath({ path: '/sign-in', query: { next: route.fullPath } }),
)

const DRAFT_KEY = props.listingType === 'app' ? 'atlas-app-submit-draft' : 'atlas-submit-draft'
const deadline = campaignDeadlineShanghai()
const promoOn = computed(() => campaignActive())

const { categories: liveCategories, tags: liveTags } = useDirectoryMeta()
const payment = await usePayment()

/**
 * The only paid listing `/pricing` can preselect. Standard, Featured and Pro
 * stay in the price table so an old unpaid submission can still be charged,
 * and they are not offered here.
 */
const PAYABLE_PLANS = ['boost'] as const

/** A new submission is free unless the URL asks for Boost. */
const DEFAULT_PLAN = 'free'

function planFromQuery(raw: unknown): string {
  const value = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim().toLowerCase()
  return (PAYABLE_PLANS as readonly string[]).includes(value) ? value : ''
}

const requestedPlan = ref(planFromQuery(route.query.plan))
/** The plan actually selected in the form — one of `tiers`' ids, free included. */
const plan = ref<string>(requestedPlan.value || DEFAULT_PLAN)

/** Homepage empty-category cards link here with `?category=<slug>`. */
function categoryFromQuery(raw: unknown): string {
  const value = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim()
  if (!value) return ''
  const known = liveCategories.value.some(
    (entry) => entry.slug === value && entry.status !== 'deleted',
  )
  return known ? value : ''
}

const form = reactive({
  name: '',
  website: '',
  tagline: '',
  category: categoryFromQuery(route.query.category),
  intro: '',
  tags: [] as string[],
  features: '',
  pricingLabel: '',
  pricingUrl: '',
  // Receipts still go to an address the submitter types. The Google account
  // is what owns the row; this field is where the mail is sent.
  email: '',
  // Filled by the URL preview only. `submissions` already has both columns;
  // the form never sent them, so an approved listing had no logo and no maker
  // line while a curated one had both.
  logo: '',
  maker: '',
})
const appStores = ref<AppStoreInfo[]>([])
const appStoreUrls = reactive<Record<AppPlatform, string>>({ ios: '', android: '', macos: '' })
const importingPlatforms = reactive<Record<AppPlatform, boolean>>({ ios: false, android: false, macos: false })
const storeImportErrors = reactive<Record<AppPlatform, string>>({ ios: '', android: '', macos: '' })
const storeImportRequests: Record<AppPlatform, number> = { ios: 0, android: 0, macos: 0 }
const lastAutoImportedStoreUrl: Record<AppPlatform, string> = { ios: '', android: '', macos: '' }
const storeAutoImportTimers = new Map<AppPlatform, ReturnType<typeof setTimeout>>()
const currentAppStores = computed(() =>
  appStores.value.filter((store) => normalizeUrl(appStoreUrls[store.platform]) === normalizeUrl(store.storeUrl)),
)
const appPlatforms: { value: AppPlatform; placeholder: string }[] = [
  { value: 'ios', placeholder: 'https://apps.apple.com/…' },
  { value: 'android', placeholder: 'https://play.google.com/store/apps/details?id=…' },
  { value: 'macos', placeholder: 'https://apps.apple.com/…/mac/…' },
]
const submitting = ref(false)
const drafting = ref(false)
const drafted = ref(false)
const draftUrl = ref('')
const fetchNote = ref('')
const error = ref('')
const savedUnpaid = ref(false)
const unpaidId = ref('')
const done = ref<{ id: string; paid: boolean } | null>(null)
const openFaq = ref<number | null>(null)
/** A preview icon that 404s falls back to initials instead of a broken image. */
const logoBroken = ref(false)
watch(
  () => form.logo,
  () => {
    logoBroken.value = false
  },
)

type Preview = {
  ok: boolean
  name?: string
  short?: string
  long?: string
  logo?: string
  maker?: string
  category?: string
  tags?: string[]
}

const unreadPage = computed(() =>
  pick(
    '没能读到那个页面。你仍可以自己填写名称、简介和图标。',
    'We could not read that page. You can still add the name, description, and icon yourself.',
  ),
)

function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  return value.includes('://') ? value : `https://${value}`
}

/** Avoid requests while a store URL is only partially typed. */
function isCompleteAppStoreUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw))
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'apps.apple.com' || host === 'itunes.apple.com') {
      return /(?:^|\/)id\d+(?:\/|$)/i.test(url.pathname)
    }
    if (host === 'play.google.com' && url.pathname === '/store/apps/details') {
      return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(url.searchParams.get('id') || '')
    }
  } catch {
    return false
  }
  return false
}

function clearAutoImportTimers() {
  for (const timer of storeAutoImportTimers.values()) clearTimeout(timer)
  storeAutoImportTimers.clear()
}

watch(
  () => ({ ios: appStoreUrls.ios, android: appStoreUrls.android, macos: appStoreUrls.macos }),
  (urls) => {
    if (!isAppListing.value) return
    for (const platform of ['ios', 'android', 'macos'] as const) {
      const existingTimer = storeAutoImportTimers.get(platform)
      if (existingTimer) clearTimeout(existingTimer)
      storeAutoImportTimers.delete(platform)
      const raw = urls[platform]
      const url = normalizeUrl(raw)
      const current = appStores.value.find((item) => item.platform === platform)

      // Never let a result for the old URL remain attached to this platform.
      // Invalidate an in-flight lookup immediately, before the debounce for the
      // newly pasted URL starts.
      if (current && normalizeUrl(current.storeUrl) !== url) {
        appStores.value = appStores.value.filter((item) => item.platform !== platform)
      }
      if (lastAutoImportedStoreUrl[platform] && url !== lastAutoImportedStoreUrl[platform]) {
        storeImportRequests[platform]++
        importingPlatforms[platform] = false
        storeImportErrors[platform] = ''
        lastAutoImportedStoreUrl[platform] = ''
      }

      if (!isCompleteAppStoreUrl(url) || url === lastAutoImportedStoreUrl[platform]) continue
      if (current && normalizeUrl(current.storeUrl) === url) continue
      const timer = setTimeout(() => {
        if (!isAppListing.value || normalizeUrl(appStoreUrls[platform]) !== url) return
        lastAutoImportedStoreUrl[platform] = url
        void importAppStore(platform, raw)
      }, 650)
      storeAutoImportTimers.set(platform, timer)
    }
  },
)

onBeforeUnmount(clearAutoImportTimers)

function storeFor(platform: AppPlatform): AppStoreInfo | undefined {
  return currentAppStores.value.find((entry) => entry.platform === platform)
}

function storePlatformName(platform: AppPlatform): string {
  return ({
    ios: 'iOS',
    android: 'Android',
    macos: 'Mac',
  })[platform]
}

function storeListingName(platform: AppPlatform): string {
  return ({
    ios: 'App Store',
    android: 'Google Play',
    macos: 'Mac App Store',
  })[platform]
}

function storeImportError(cause: unknown): string {
  const code = String((cause as { data?: { code?: string } })?.data?.code || (cause as Error)?.message || '')
  if (code === 'app_not_found') return pick('没有找到这个应用，请检查链接或地区。', 'We could not find this app. Check the link or store region.')
  if (code === 'rate_limited') return pick('导入次数较多，请稍后再试。', 'Too many imports. Please try again shortly.')
  if (code === 'store_timeout') return pick('商店响应超时，请稍后重试。', 'The store timed out. Please try again shortly.')
  if (code === 'store_unavailable') return pick('暂时无法连接商店，请稍后重试。', 'The store is temporarily unavailable. Please try again shortly.')
  return pick('无法读取这个商店链接，请检查链接是否正确。', 'Could not read this store link. Check that the URL is correct.')
}

function applyAppStore(info: AppStoreInfo) {
  const next = appStores.value.filter((entry) => entry.platform !== info.platform)
  next.push(info)
  const platformOrder: AppPlatform[] = ['ios', 'android', 'macos']
  appStores.value = next.sort((a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform))
  lastAutoImportedStoreUrl[info.platform] = normalizeUrl(info.storeUrl)
  appStoreUrls[info.platform] = info.storeUrl
  storeImportErrors[info.platform] = ''
  if (!form.website || appStores.value.length === 1) form.website = info.storeUrl
  if (!form.name || appStores.value.length === 1) form.name = publicProductName(info.name)
  if (!form.tagline || appStores.value.length === 1) {
    form.tagline = info.description.replace(/https?:\/\/\S+/gi, '').slice(0, 200)
  }
  if (!form.intro || appStores.value.length === 1) form.intro = info.description
  if (!form.logo || appStores.value.length === 1) form.logo = info.icon
  if (!form.maker || appStores.value.length === 1) form.maker = info.developer
  stashDraft()
}

function continueToDetails() {
  if (!currentAppStores.value.length) return
  error.value = ''
  drafted.value = true
  stashDraft()
}

async function importAppStore(platform: AppPlatform, rawUrl: string) {
  const url = normalizeUrl(rawUrl)
  const pendingTimer = storeAutoImportTimers.get(platform)
  if (pendingTimer) clearTimeout(pendingTimer)
  storeAutoImportTimers.delete(platform)
  if (!url) {
    error.value = pick('请先粘贴这个平台的商店链接。', 'Paste this platform’s store link first.')
    return
  }
  const requestId = ++storeImportRequests[platform]
  lastAutoImportedStoreUrl[platform] = url
  storeImportErrors[platform] = ''
  importingPlatforms[platform] = true
  error.value = ''
  try {
    const result = await $fetch<{ ok: boolean; app?: AppStoreInfo; code?: string }>('/api/app-store/lookup', {
      method: 'POST',
      body: { url, platform },
    })
    if (requestId !== storeImportRequests[platform] || normalizeUrl(appStoreUrls[platform]) !== url) return
    if (!result?.ok || !result.app) throw new Error(result?.code || 'metadata_unavailable')
    applyAppStore(result.app)
  } catch (cause) {
    if (requestId !== storeImportRequests[platform]) return
    storeImportErrors[platform] = storeImportError(cause)
    lastAutoImportedStoreUrl[platform] = ''
  } finally {
    if (requestId === storeImportRequests[platform]) importingPlatforms[platform] = false
  }
}

/** Read-only draft. Store imports only fetch public metadata; they do not create a row. */
async function draftListing() {
  const url = normalizeUrl(draftUrl.value)
  if (!url) {
    error.value = isAppListing.value
      ? pick('请粘贴 App Store 或 Google Play 的应用链接。', 'Paste an App Store or Google Play app link.')
      : t('dir.submit.error_invalid_url')
    return
  }
  drafting.value = true
  error.value = ''
  fetchNote.value = ''
  if (!isAppListing.value) form.website = url
  try {
    if (isAppListing.value) {
      try {
        const parsedHost = new URL(url).hostname.toLowerCase()
        const guessedPlatform: AppPlatform = parsedHost === 'play.google.com'
          ? 'android'
          : /\/(?:mac|macos)(?:\/|$)/i.test(new URL(url).pathname)
            ? 'macos'
            : 'ios'
        lastAutoImportedStoreUrl[guessedPlatform] = url
        appStoreUrls[guessedPlatform] = url
      } catch {
        // The endpoint returns the actionable validation error below.
      }
      const result = await $fetch<{ ok: boolean; app?: AppStoreInfo; code?: string }>('/api/app-store/lookup', {
        method: 'POST',
        body: { url },
      })
      if (!result?.ok || !result.app) throw new Error(result?.code || 'metadata_unavailable')
      applyAppStore(result.app)
      draftUrl.value = result.app.storeUrl
    } else {
      const preview = await $fetch<Preview>('/api/fetch-meta', { method: 'POST', body: { url } })
      if (!preview?.ok) {
        fetchNote.value = unreadPage.value
      } else {
        if (preview.name) form.name = publicProductName(preview.name)
        if (preview.short) form.tagline = preview.short
        if (preview.logo) form.logo = preview.logo
      }
    }
  } catch {
    fetchNote.value = isAppListing.value
      ? pick('暂时无法从商店读取资料。仍可先填写名称、简介，并在下方重试导入。', 'Store metadata could not be read. You can still enter the details and retry an import below.')
      : unreadPage.value
  } finally {
    drafting.value = false
    drafted.value = true
  }
}

function stashDraft() {
  if (!import.meta.client) return
  sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      name: form.name,
      website: form.website,
      tagline: form.tagline,
      category: form.category,
      intro: form.intro,
      tags: form.tags,
      email: form.email,
      logo: form.logo,
      maker: form.maker,
      appStores: appStores.value,
      appStoreUrls: { ...appStoreUrls },
      listingType: props.listingType,
      drafted: drafted.value,
      plan: plan.value,
      fetchNote: fetchNote.value,
    }),
  )
}

function restoreDraft() {
  if (!import.meta.client) return
  const raw = sessionStorage.getItem(DRAFT_KEY)
  if (!raw) return
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    form.name = String(data.name || '')
    form.website = String(data.website || '')
    form.tagline = String(data.tagline || '')
    form.category = String(data.category || '')
    form.intro = String(data.intro || '')
    form.tags = Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : []
    form.email = String(data.email || '')
    form.logo = String(data.logo || '')
    form.maker = String(data.maker || '')
    if (props.listingType === 'app') {
      appStores.value = Array.isArray(data.appStores) ? data.appStores as AppStoreInfo[] : []
      const savedUrls = data.appStoreUrls && typeof data.appStoreUrls === 'object'
        ? data.appStoreUrls as Partial<Record<AppPlatform, unknown>>
        : {}
      for (const platform of ['ios', 'android', 'macos'] as const) {
        appStoreUrls[platform] = String(savedUrls[platform] || '')
      }
    }
    const storedPlan = String(data.plan || '')
    if (tiers.some((entry) => entry.id === storedPlan)) plan.value = storedPlan
    fetchNote.value = String(data.fetchNote || '')
    draftUrl.value = form.website
    drafted.value = typeof data.drafted === 'boolean' ? data.drafted : true
  } catch {
    sessionStorage.removeItem(DRAFT_KEY)
  }
}

function clearDraft() {
  if (!import.meta.client) return
  sessionStorage.removeItem(DRAFT_KEY)
}

/**
 * Homepage hero pastes a URL here as `?url=…`. Pre-fill the draft box and run
 * the (read-only) fetch once on mount so "paste → launch" is one step. A saved
 * session draft is restored first, but an explicit ?url= wins.
 */
function urlFromQuery(raw: unknown): string {
  const value = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim()
  return /^https?:\/\//i.test(value) ? value : ''
}

function appPlatformFromUrl(raw: string): AppPlatform | null {
  try {
    const url = new URL(raw)
    if (url.hostname.toLowerCase() === 'play.google.com') return 'android'
    if (url.hostname.toLowerCase() === 'apps.apple.com' || url.hostname.toLowerCase() === 'itunes.apple.com') {
      return /\/(?:mac|macos)(?:\/|$)/i.test(url.pathname) ? 'macos' : 'ios'
    }
  } catch {
    return null
  }
  return null
}

onMounted(() => {
  restoreDraft()
  const incoming = urlFromQuery(route.query.url)
  if (!incoming) return
  reset()
  if (isAppListing.value) {
    const platform = appPlatformFromUrl(incoming)
    if (platform) {
      appStoreUrls[platform] = incoming
      lastAutoImportedStoreUrl[platform] = normalizeUrl(incoming)
      void importAppStore(platform, incoming)
    } else {
      error.value = pick('请粘贴 App Store、Google Play 或 Mac App Store 的链接。', 'Paste an App Store, Google Play or Mac App Store link.')
    }
    return
  }
  draftUrl.value = incoming
  void draftListing()
})

const categoryOptions = computed(() =>
  liveCategories.value
    .filter((entry) => entry.status !== 'deleted')
    .map((entry) => ({ value: entry.slug, label: localizeCategory(entry, lang.value).name })),
)

const currentCategoryLabel = computed(
  () => categoryOptions.value.find((option) => option.value === form.category)?.label ?? '',
)

/** The plan the server will store — the id from `tiers`, never a UI label. */
const selectedPlan = computed(() => plan.value)

/**
 * Free and Boost are the listing plans for sale. Standard, Featured and Pro
 * stay in the price table for an old unpaid row, and they are not offered here.
 * The price on each card comes from `effectiveQuote`, the same charge checkout uses.
 */
const planOptions = computed(() =>
  tiers.filter((entry) => entry.forSale !== false).map((entry) => {
    const quote = effectiveQuote('listing', entry.id)
    const name = isZh.value ? entry.name.zh : entry.name.en
    const label =
      entry.amountCents === 0
        ? pick('免费提交 · $0', 'List for free · $0')
        : isZh.value
          ? `付款 ${quote.priceLabel} · ${name}`
          : `Pay ${quote.priceLabel} · ${name}`
    return {
      id: entry.id,
      name,
      label,
      price: quote.priceLabel,
      strike: quote.strikeLabel,
      unit: isZh.value ? entry.unit.zh : entry.unit.en,
      // Four bullets keep four cards readable; the full list is on `/pricing`.
      features: (isZh.value ? entry.features.zh : entry.features.en).slice(0, 4),
      badge: entry.badge ? (isZh.value ? entry.badge.zh : entry.badge.en) : '',
      paid: entry.amountCents > 0,
    }
  }),
)

const requestedTier = computed(
  () => tiers.find((entry) => entry.id === requestedPlan.value) ?? null,
)
const requestedName = computed(() =>
  requestedTier.value ? (isZh.value ? requestedTier.value.name.zh : requestedTier.value.name.en) : '',
)

const selectedTier = computed(() => tiers.find((entry) => entry.id === plan.value) ?? tiers[0]!)
/**
 * What the selected plan costs *today*, not what it lists at.
 *
 * `tier.price` is the regular price — `effectiveQuote` is what the cards print
 * and what checkout actually charges. Reading the raw field put "$39" on the
 * pay button while the card beside it said "$19" and the charge was $19: the
 * one number a buyer checks before paying was the one number that was wrong.
 */
const paidPrice = computed(
  () => planOptions.value.find((entry) => entry.id === plan.value)?.price ?? selectedTier.value.price,
)
const isFreePlan = computed(() => selectedTier.value.amountCents === 0)

/** The FAQ's `{price}` used to be a constant; it must follow the chosen tier. */
function faqParams(item: SubmitFaqItem) {
  return item.questionKey === 'dir.submit.faq_q2'
    ? { ...item.params, price: paidPrice.value }
    : item.params
}

/** Drop both the in-page choice and the query, so a reload cannot bring it back. */
function clearPlan() {
  requestedPlan.value = ''
  plan.value = DEFAULT_PLAN
  const query = { ...route.query }
  delete query.plan
  router.replace({ path: route.path, query })
}

/** The source's `mapSubmitError()`: the API's code is translated, never shown raw. */
function mapError(code?: string): string {
  if (code === 'missing_fields' || code === 'Missing required fields')
    return t('dir.submit.error_missing_fields')
  if (code === 'invalid_url' || code === 'Invalid website URL')
    return t('dir.submit.error_invalid_url')
  if (code === 'bad_category' || code === 'invalid_category' || code === 'Invalid category')
    return t('dir.submit.error_invalid_category')
  if (code === 'email_required' || code === 'bad_email')
    return t('dir.submit.error_email_required')
  if (code === 'logo_required') return t('dir.submit.error_logo_required')
  if (code === 'bad_logo') return t('dir.submit.error_bad_logo')
  if (code === 'app_store_required') return pick('至少导入一个应用商店链接。', 'Import at least one app store listing.')
  if (code === 'duplicate_app') return pick('这个应用已有收录或正在审核。', 'This app is already listed or awaiting review.')
  if (code === 'invalid_app_store_data' || code === 'unsupported_store_url' || code === 'platform_mismatch')
    return pick('商店链接或平台信息无效，请重新导入。', 'The store link or platform is invalid. Import it again.')
  if (code === 'tags_required') return pick('至少选一个标签。', 'Pick at least one tag.')
  if (code === 'video_tag_required')
    return pick(
      '视频分类必须包含「视频生成」「视频聊天」或「转录」之一。',
      'Video listings must include Video generation, Video chat, or Transcripts.',
    )
  if (code === 'plan_retired')
    return pick('这个方案已停售。请选免费或 Boost。', 'That plan is no longer sold. Choose Free or Boost.')
  return t('dir.submit.error_failed')
}

function toggleTag(name: string) {
  const index = form.tags.indexOf(name)
  if (index >= 0) form.tags.splice(index, 1)
  else if (form.tags.length < 4) form.tags.push(name)
}

async function submit() {
  const stores = currentAppStores.value
  if (!form.name.trim() || !form.tagline.trim()) {
    error.value = t('dir.submit.error_missing_fields')
    return
  }
  if (isAppListing.value ? stores.length === 0 : !form.website.trim()) {
    error.value = isAppListing.value
      ? mapError('app_store_required')
      : t('dir.submit.error_invalid_url')
    return
  }
  if (!isAppListing.value && !form.category) {
    error.value = t('dir.submit.error_invalid_category')
    return
  }
  if (!isAppListing.value) {
    const tagError = submissionTagError(form.category, form.tags)
    if (tagError) {
      error.value = mapError(tagError)
      return
    }
  }
  // Every listing needs a reachable address: it is where the receipt, the
  // review outcome and any refund go. Required on the free tier too, so nobody
  // submits a listing that can never be answered.
  if (!form.email.trim()) {
    error.value = t('dir.submit.error_email_required')
    return
  }
  // Sign-in comes before the logo check, not after it. The icon is uploaded
  // from the browser and `/api/storage/upload-image` requires a session, so a
  // guest has no way to fill that field — asking them for a logo they cannot
  // provide would be a dead end in front of a sign-in they still have to do.
  if (!user.value) {
    stashDraft()
    await navigateTo(signInHref.value)
    return
  }
  // The uploader may fill this in, and a preview can arrive from the URL scan.
  // An empty or non-http value is refused here and again by `validate()` so a
  // direct API call cannot skip it.
  if (!form.logo.trim()) {
    error.value = t('dir.submit.error_logo_required')
    return
  }
  if (!legalLogoUrl(form.logo)) {
    error.value = t('dir.submit.error_bad_logo')
    return
  }
  submitting.value = true
  error.value = ''
  try {
    if (unpaidId.value && !isFreePlan.value) {
      const opened = await payment.pay(unpaidId.value)
      if (!opened) {
        savedUnpaid.value = true
        error.value = pick(
          '暂时打不开付款页面，请稍后再试。',
          'Could not open the payment page — try again in a moment.',
        )
        return
      }
      savedUnpaid.value = false
      done.value = { id: unpaidId.value, paid: true }
      return
    }
    const res = await $fetch<{ ok: boolean; id?: string; next?: string }>('/api/submit', {
      method: 'POST',
      body: {
        listing_type: props.listingType,
        app_stores: isAppListing.value ? stores : undefined,
        url: isAppListing.value ? stores[0]?.storeUrl : form.website,
        name: form.name,
        short: form.tagline,
        long: form.intro,
        category: form.category,
        plan: selectedPlan.value,
        email: form.email.trim(),
        locale: isZh.value ? 'zh' : 'en',
        // Filled by the URL preview; the API keeps only tags the catalogue
        // already knows, so an unknown word is dropped rather than invented.
        // logo + maker are what make the published detail page look like a
        // curated listing instead of an empty placeholder card.
        tags: form.tags,
        features: form.features,
        pricing_label: form.pricingLabel,
        pricing_url: form.pricingUrl,
        logo: form.logo,
        maker: form.maker,
      },
    })

    if (!res?.ok || !res.id) throw new Error('submit failed')

    const paid = res.next === 'paid'
    clearDraft()

    // A paid listing is only in the queue once the money lands, so send the
    // submitter to checkout while the intent is fresh. A missing checkout URL
    // is not a completed order and is not an invoice request.
    if (paid) {
      const opened = await payment.pay(res.id)
      if (!opened) {
        unpaidId.value = res.id
        savedUnpaid.value = true
        error.value = pick(
          '暂时打不开付款页面，请稍后再试。',
          'Could not open the payment page — try again in a moment.',
        )
        return
      }
    }
    done.value = { id: res.id, paid }
  } catch (err) {
    const data = (err as { data?: { message_zh?: string; message_en?: string; code?: string } })?.data
    error.value =
      (isZh.value ? data?.message_zh : data?.message_en) || mapError(data?.code)
  } finally {
    submitting.value = false
  }
}

function reset() {
  done.value = null
  drafted.value = false
  draftUrl.value = ''
  fetchNote.value = ''
  savedUnpaid.value = false
  unpaidId.value = ''
  clearDraft()
  form.name = ''
  form.website = ''
  form.tagline = ''
  form.category = ''
  form.intro = ''
  form.tags = []
  form.features = ''
  form.pricingLabel = ''
  form.pricingUrl = ''
  form.email = ''
  form.logo = ''
  form.maker = ''
  appStores.value = []
  for (const platform of ['ios', 'android', 'macos'] as const) {
    storeImportRequests[platform]++
    importingPlatforms[platform] = false
    storeImportErrors[platform] = ''
    lastAutoImportedStoreUrl[platform] = ''
    appStoreUrls[platform] = ''
  }
  error.value = ''
}
</script>

<template>
  <form v-if="!drafted && !isAppListing" class="max-w-xl space-y-3" @submit.prevent="draftListing">
    <label for="draft-url" class="text-sm leading-none font-medium">{{ pick('产品网址', 'Product URL') }}</label>
    <input
      id="draft-url"
      v-model="draftUrl"
      type="url"
      required
      placeholder="https://"
      class="h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
    <p class="text-xs text-muted-foreground">{{ pick('在你登录并保存之前，什么都不会写入。', 'Nothing is stored until you sign in and save.') }}</p>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <button
      type="submit"
      :disabled="drafting"
      class="inline-flex h-9 cursor-pointer items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
    >
      {{ drafting ? pick('正在读取网页…', 'Reading the page…') : pick('起草收录', 'Draft listing') }}
    </button>
  </form>

  <div v-else-if="!drafted && isAppListing" class="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
    <section aria-labelledby="app-store-import-heading" class="overflow-hidden rounded-2xl border border-border bg-card">
      <div class="border-b border-border px-5 py-5 sm:px-6">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{{ pick('第 1 步 · 添加商店链接', 'STEP 1 · ADD STORE LINKS') }}</p>
        <h2 id="app-store-import-heading" class="mt-2 text-xl font-semibold tracking-tight">{{ pick('应用发布在哪些商店？', 'Where is your app published?') }}</h2>
        <p class="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {{ pick('每个输入框只放对应商店的一个链接。粘贴后会自动读取公开资料；你可以添加一个或多个平台。', 'Paste one matching store link into each field. We will automatically read public details. Add one or more platforms.') }}
        </p>
        <p v-if="error" class="mt-3 text-sm text-destructive" role="alert">{{ error }}</p>
      </div>

      <div class="divide-y divide-border px-5 sm:px-6">
        <article v-for="platform in appPlatforms" :key="platform.value" class="py-5">
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-3">
                <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground">
                  {{ platform.value === 'android' ? 'GP' : platform.value === 'macos' ? 'Mac' : 'iOS' }}
                </span>
                <div class="min-w-0">
                  <label :for="`app-store-${platform.value}`" class="block text-sm font-semibold">
                    {{ storePlatformName(platform.value) }} <span class="font-normal text-muted-foreground">· {{ storeListingName(platform.value) }}</span>
                  </label>
                  <p :id="`app-store-hint-${platform.value}`" class="mt-0.5 text-xs text-muted-foreground">
                    {{ platform.value === 'ios' ? pick('iPhone 和 iPad 应用', 'For iPhone and iPad apps') : platform.value === 'android' ? pick('Android 应用', 'For Android apps') : pick('Mac 桌面应用', 'For Mac desktop apps') }}
                  </p>
                </div>
              </div>
              <input
                :id="`app-store-${platform.value}`"
                v-model="appStoreUrls[platform.value]"
                type="url"
                inputmode="url"
                autocomplete="url"
                :placeholder="platform.placeholder"
                :aria-describedby="`app-store-hint-${platform.value}${storeImportErrors[platform.value] ? ` app-store-error-${platform.value}` : ''}`"
                :aria-invalid="Boolean(storeImportErrors[platform.value])"
                class="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
              <p v-if="storeImportErrors[platform.value]" :id="`app-store-error-${platform.value}`" class="text-xs text-destructive" role="alert">
                {{ storeImportErrors[platform.value] }}
              </p>
              <p v-else-if="importingPlatforms[platform.value]" class="text-xs text-muted-foreground" role="status" aria-live="polite">
                {{ pick('正在连接商店并读取资料…', 'Connecting to the store and reading details…') }}
              </p>
              <p v-else-if="storeFor(platform.value)" class="flex items-center gap-1.5 text-xs text-primary" role="status" aria-live="polite">
                <Icon name="circle-check" :size="14" />
                {{ pick('已读取商店资料', 'Store details imported') }}
                <span v-if="storeFor(platform.value)?.screenshots.length">· {{ pick(`${storeFor(platform.value)?.screenshots.length} 张截图`, `${storeFor(platform.value)?.screenshots.length} screenshots`) }}</span>
              </p>
            </div>
            <button
              type="button"
              :disabled="importingPlatforms[platform.value] || !isCompleteAppStoreUrl(appStoreUrls[platform.value])"
              :aria-label="`${storeFor(platform.value) ? pick('重新读取', 'Refresh') : pick('导入', 'Import')} ${storeListingName(platform.value)}`"
              class="inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
              @click="importAppStore(platform.value, appStoreUrls[platform.value])"
            >
              <span v-if="importingPlatforms[platform.value]" aria-hidden="true" class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
              {{ importingPlatforms[platform.value] ? pick('读取中…', 'Reading…') : storeFor(platform.value) ? pick('重新读取', 'Refresh') : pick('导入资料', 'Import') }}
            </button>
          </div>

          <div v-if="storeFor(platform.value)" class="mt-4 rounded-xl bg-muted/45 p-3 sm:ml-[52px] sm:p-4" aria-live="polite">
            <div class="flex min-w-0 items-start gap-3">
              <img v-if="storeFor(platform.value)?.icon" :src="storeFor(platform.value)?.icon" alt="" aria-hidden="true" loading="lazy" class="size-12 shrink-0 rounded-xl border border-border/60 object-cover">
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-sm font-semibold">{{ storeFor(platform.value)?.name }}</h3>
                <p v-if="storeFor(platform.value)?.developer" class="mt-0.5 truncate text-xs text-muted-foreground">{{ storeFor(platform.value)?.developer }}</p>
                <p class="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span v-if="storeFor(platform.value)?.category">{{ storeFor(platform.value)?.category }}</span>
                  <span v-if="storeFor(platform.value)?.rating !== null && storeFor(platform.value)?.rating !== undefined">
                    {{ pick('评分', 'Rating') }} {{ storeFor(platform.value)?.rating }}<span v-if="storeFor(platform.value)?.ratingCount"> · {{ storeFor(platform.value)?.ratingCount?.toLocaleString() }}</span>
                  </span>
                  <span v-if="storeFor(platform.value)?.version">{{ pick('版本', 'Version') }} {{ storeFor(platform.value)?.version }}</span>
                </p>
              </div>
            </div>
            <p v-if="storeFor(platform.value)?.description" class="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{{ storeFor(platform.value)?.description }}</p>
            <div v-if="storeFor(platform.value)?.screenshots.length" class="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
              <img v-for="(screenshot, index) in storeFor(platform.value)?.screenshots.slice(0, 4)" :key="screenshot" :src="screenshot" :alt="pick(`${storeFor(platform.value)?.name} 应用截图 ${index + 1}`, `${storeFor(platform.value)?.name} screenshot ${index + 1}`)" loading="lazy" class="h-24 max-w-[42%] shrink-0 rounded-lg border border-border bg-background object-contain sm:h-28">
            </div>
          </div>
        </article>
      </div>

      <div class="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p class="text-sm text-muted-foreground" aria-live="polite">
          {{ currentAppStores.length ? pick(`已添加 ${currentAppStores.length} 个商店。可以继续添加其他平台。`, `${currentAppStores.length} store${currentAppStores.length === 1 ? '' : 's'} added. You can add other platforms too.`) : pick('至少导入一个商店后即可继续。', 'Import at least one store listing to continue.') }}
        </p>
        <button
          type="button"
          :disabled="currentAppStores.length === 0 || Object.values(importingPlatforms).some(Boolean)"
          class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
          @click="continueToDetails"
        >
          {{ pick('继续填写资料', 'Continue to details') }}
          <Icon name="arrow-right" :size="16" />
        </button>
      </div>
    </section>

    <aside class="space-y-4 lg:pt-1">
      <section class="rounded-2xl border border-border bg-card p-5">
        <h2 class="text-sm font-semibold">{{ pick('简单三步完成收录', 'Three steps to list your app') }}</h2>
        <ol class="mt-4 space-y-4">
          <li class="flex gap-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
            <div><p class="text-sm font-medium">{{ pick('粘贴商店链接', 'Paste store links') }}</p><p class="mt-0.5 text-xs leading-5 text-muted-foreground">{{ pick('可同时添加 iOS、Android 和 Mac 版本。', 'Add iOS, Android and Mac versions.') }}</p></div>
          </li>
          <li class="flex gap-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">2</span>
            <div><p class="text-sm font-medium">{{ pick('校对导入资料', 'Review imported details') }}</p><p class="mt-0.5 text-xs leading-5 text-muted-foreground">{{ pick('名称、简介、图标和商店信息都能修改。', 'Edit the name, description, icon and store details.') }}</p></div>
          </li>
          <li class="flex gap-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">3</span>
            <div><p class="text-sm font-medium">{{ pick('登录并提交审核', 'Sign in and submit') }}</p><p class="mt-0.5 text-xs leading-5 text-muted-foreground">{{ pick('资料只会在你提交后进入审核队列。', 'Your app enters review only after you submit.') }}</p></div>
          </li>
        </ol>
      </section>
      <p class="rounded-xl bg-muted/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
        {{ pick('我们只读取商店公开提供的信息。不同地区和平台可获取的字段可能不同；抓取失败时可以重试或稍后手动校对。', 'We only read public store details. Available fields vary by platform and region; if import fails, retry or continue with manual edits.') }}
      </p>
    </aside>
  </div>

  <div v-else-if="done" class="flex flex-col items-center gap-3 py-10 text-center">
    <Icon name="circle-check" :size="40" class="text-emerald-500" />
    <h2 class="text-lg font-semibold">{{ t('directory.submit_success_title') }}</h2>
    <p class="max-w-md text-sm text-muted-foreground">
      {{
        done.paid
          ? t('directory.submit_success_desc_fast', { name: form.name, days: 30 })
          : t('directory.submit_success_desc_free', { name: form.name })
      }}
    </p>
    <p class="text-sm">
      <NuxtLink class="underline" :to="localePath('/how-it-works')">
        {{ pick('提交之后会发生什么', 'How it works') }}
      </NuxtLink>
    </p>
    <div class="mt-2 flex flex-wrap justify-center gap-2">
      <NuxtLink
        :to="localePath('/settings/submissions')"
        class="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        {{ t('directory.submit_view_submissions') }}
      </NuxtLink>
      <button
        type="button"
        class="inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium transition hover:bg-muted"
        @click="reset"
      >
        {{ t('directory.submit_another') }}
      </button>
    </div>
  </div>

  <template v-else>
    <!-- `novalidate`: every rule is enforced in `submit()` so the message is
         ours (bilingual, next to the button) instead of the browser's bubble. -->
    <form novalidate @submit.prevent="submit">
      <p v-if="fetchNote" class="mb-6 max-w-2xl text-sm text-muted-foreground">{{ fetchNote }}</p>
      <section v-if="isAppListing" class="mb-8 space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 class="text-sm font-semibold">{{ pick('应用商店链接', 'Store listings') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ pick('可添加 iOS、Android、Mac 链接；导入资料后可以检查并修改。至少保留一个商店链接。', 'Add iOS, Android and Mac links. Imported details can be reviewed and edited. Keep at least one store link.') }}
          </p>
        </div>
        <div v-for="platform in appPlatforms" :key="platform.value" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label class="min-w-0 space-y-1.5">
            <span class="text-xs font-medium">{{ storePlatformName(platform.value) }} · {{ storeListingName(platform.value) }}</span>
            <input
              v-model="appStoreUrls[platform.value]"
              type="url"
              :placeholder="platform.placeholder"
              class="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
          </label>
          <button
            type="button"
            :disabled="importingPlatforms[platform.value]"
            class="self-end inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            @click="importAppStore(platform.value, appStoreUrls[platform.value])"
          >
            {{ importingPlatforms[platform.value] ? pick('读取中…', 'Importing…') : appStores.some((item) => item.platform === platform.value) ? pick('重新导入', 'Refresh') : pick('导入资料', 'Import') }}
          </button>
        </div>
        <div v-if="currentAppStores.length" class="space-y-4 border-t border-border pt-4" aria-live="polite">
          <article v-for="store in currentAppStores" :key="store.platform" class="space-y-3 rounded-lg bg-muted/40 p-3">
            <div class="flex min-w-0 items-start gap-3">
              <img
                v-if="store.icon"
                :src="store.icon"
                :alt="''"
                aria-hidden="true"
                loading="lazy"
                class="size-12 shrink-0 rounded-xl border border-border/60 object-cover"
              >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 class="truncate text-sm font-semibold">{{ store.name }}</h3>
                  <span class="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {{ storeListingName(store.platform) }}
                  </span>
                </div>
                <p v-if="store.developer" class="mt-1 text-xs text-muted-foreground">{{ store.developer }}</p>
                <p v-if="store.rating !== null" class="mt-1 text-xs text-muted-foreground">
                  {{ pick('商店评分', 'Store rating') }}：{{ store.rating }}<span v-if="store.ratingCount">（{{ store.ratingCount.toLocaleString() }}）</span>
                </p>
              </div>
            </div>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
              <div v-if="store.category">
                <dt class="text-muted-foreground">{{ pick('分类', 'Category') }}</dt>
                <dd class="mt-0.5 font-medium">{{ store.category }}</dd>
              </div>
              <div v-if="store.version">
                <dt class="text-muted-foreground">{{ pick('版本', 'Version') }}</dt>
                <dd class="mt-0.5 font-medium">{{ store.version }}</dd>
              </div>
              <div v-if="store.priceLabel">
                <dt class="text-muted-foreground">{{ pick('价格', 'Price') }}</dt>
                <dd class="mt-0.5 font-medium">{{ store.priceLabel }}</dd>
              </div>
              <div v-if="store.updatedAt">
                <dt class="text-muted-foreground">{{ pick('更新日期', 'Updated') }}</dt>
                <dd class="mt-0.5 font-medium">{{ store.updatedAt }}</dd>
              </div>
            </dl>
            <p v-if="store.description" class="line-clamp-3 text-xs leading-5 text-muted-foreground">{{ store.description }}</p>
            <div v-if="store.screenshots.length" class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              <img
                v-for="(screenshot, index) in store.screenshots.slice(0, 5)"
                :key="screenshot"
                :src="screenshot"
                :alt="pick(`${store.name} 应用截图 ${index + 1}`, `${store.name} screenshot ${index + 1}`)"
                loading="lazy"
                class="h-28 max-w-[44%] shrink-0 rounded-md border border-border bg-background object-contain"
              >
            </div>
          </article>
        </div>
      </section>
      <section class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="space-y-5">
          <div class="space-y-2">
            <label for="tool-name" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_name') }}
            </label>
            <input
              id="tool-name"
              v-model="form.name"
              type="text"
              required
              :placeholder="t('dir.submit.field_name_ph')"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
          </div>

          <div v-if="!isAppListing" class="space-y-2">
            <label for="tool-website" class="text-sm leading-none font-medium">
              {{ pick('产品网址', 'Product URL') }}
            </label>
            <input
              id="tool-website"
              v-model="form.website"
              type="url"
              required
              placeholder="https://"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
          </div>

          <div class="space-y-2">
            <label for="tool-tagline" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_tagline') }}
            </label>
            <input
              id="tool-tagline"
              v-model="form.tagline"
              type="text"
              maxlength="200"
              :placeholder="t('dir.submit.field_tagline_ph')"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
          </div>

          <template v-if="!isAppListing">
          <div class="space-y-2">
            <label for="tool-category" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_category') }}
              <span class="text-destructive" aria-hidden="true">*</span>
            </label>
            <UiSelect v-model="form.category" required>
              <UiSelectTrigger
                id="tool-category"
                size="sm"
                class="h-8 w-full"
                :class="form.category ? '' : 'border-destructive/50'"
                :aria-invalid="!form.category"
                :aria-label="t('dir.submit.field_category')"
              >
                <UiSelectValue
                  :text="currentCategoryLabel"
                  :placeholder="t('dir.submit.field_category_ph')"
                />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem
                  v-for="option in categoryOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <fieldset class="space-y-2">
            <legend class="text-sm leading-none font-medium">
              {{ pick('标签', 'Tags') }}
              <span class="text-destructive" aria-hidden="true">*</span>
            </legend>
            <p v-if="form.category === 'video'" class="text-xs text-muted-foreground">
              {{
                pick(
                  '视频分类必须包含「视频生成」「视频聊天」或「转录」之一。',
                  'Video listings must include Video generation, Video chat, or Transcripts.',
                )
              }}
            </p>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="tag in liveTags"
                :key="tag.slug"
                class="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  :checked="form.tags.includes(tag.name_en)"
                  @change="toggleTag(tag.name_en)"
                >
                {{ localizeTag(tag, lang).name }}
              </label>
            </div>
          </fieldset>
          </template>

          <div v-if="!isAppListing" class="space-y-2">
            <label for="tool-features" class="text-sm leading-none font-medium">
              {{ pick('功能要点（可选，一行一条）', 'Features (optional, one per line)') }}
            </label>
            <textarea
              id="tool-features"
              v-model="form.features"
              rows="3"
              class="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
            />
          </div>

          <div v-if="!isAppListing" class="space-y-2">
            <label for="tool-price" class="text-sm leading-none font-medium">
              {{ pick('公开价格（可选）', 'Public price (optional)') }}
            </label>
            <input
              id="tool-price"
              v-model="form.pricingLabel"
              type="text"
              maxlength="80"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
            >
          </div>

          <div v-if="!isAppListing" class="space-y-2">
            <label for="tool-price-url" class="text-sm leading-none font-medium">
              {{ pick('定价页网址（可选）', 'Pricing page URL (optional)') }}
            </label>
            <input
              id="tool-price-url"
              v-model="form.pricingUrl"
              type="url"
              placeholder="https://"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
            >
          </div>

          <div class="space-y-2">
            <label for="tool-intro" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_intro') }}
            </label>
            <textarea
              id="tool-intro"
              v-model="form.intro"
              rows="6"
              :placeholder="t('dir.submit.field_intro_ph')"
              class="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div class="space-y-2">
            <!-- Uploaded from the browser, not pasted as a URL: the person
                 submitting a product has the icon on their disk, and asking
                 them to host it somewhere first is the kind of step that ends
                 a paid submission. `DirectoryImageField` is the same uploader
                 the admin form uses, so both write the same kind of value. -->
            <DirectoryImageField
              v-if="user"
              :label="pick('图标（必填）', 'Icon (required)')"
              :value="form.logo"
              :max-size-m-b="2"
              @change="form.logo = $event"
            />
            <div v-else-if="isAppListing && form.logo" class="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <img :src="form.logo" alt="" aria-hidden="true" loading="lazy" class="size-10 shrink-0 rounded-lg object-cover">
              <p class="text-xs leading-5 text-muted-foreground">
                {{ pick('应用图标已从商店导入；提交时登录即可，无需重复上传。', 'The app icon came from the store. Sign in when submitting; no need to upload it again.') }}
              </p>
            </div>
            <template v-else>
              <UiLabel>{{ pick('图标（必填）', 'Icon (required)') }}</UiLabel>
              <NuxtLink
                :to="signInHref"
                class="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium transition hover:bg-muted"
              >
                {{ pick('用 Google 登录后上传图标', 'Sign in with Google to upload an icon') }}
              </NuxtLink>
            </template>
            <p class="text-xs text-muted-foreground">{{ t('dir.submit.field_logo_hint') }}</p>
          </div>

          <div class="space-y-2">
            <label for="tool-email" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_email') }}
              <span class="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="tool-email"
              v-model="form.email"
              type="email"
              required
              :placeholder="t('dir.submit.field_email_ph')"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
          </div>
        </div>

        <div class="space-y-6">
          <div>
            <h2 class="mb-4 text-lg font-semibold">{{ t('dir.submit.preview_title') }}</h2>
            <div class="pointer-events-none" aria-hidden="true">
              <div class="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition">
                <div class="flex items-start gap-3">
                  <div class="size-11 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50">
                    <!-- The square icon the preview endpoint found. A 404 (a
                         guessed /favicon.ico) falls back to initials. -->
                    <img
                      v-if="form.logo && !logoBroken"
                      :src="form.logo"
                      alt=""
                      class="size-full object-cover"
                      @error="logoBroken = true"
                    >
                    <div
                      v-else
                      class="grid size-full place-items-center bg-gradient-to-br from-primary/15 to-primary/5 text-primary"
                    >
                      <span class="text-sm font-semibold">
                        {{ form.name ? form.name.slice(0, 2).toUpperCase() : 'EG' }}
                      </span>
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <h3 class="min-w-0 truncate text-[15px] leading-tight font-semibold">
                        <span class="after:absolute after:inset-0 after:rounded-xl">
                          {{ form.name || t('dir.submit.field_name_ph') }}
                        </span>
                      </h3>
                    </div>
                    <p class="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">
                      {{ form.tagline || t('dir.submit.field_tagline_ph') }}
                    </p>
                  </div>
                </div>
                <div class="mt-3 flex items-center gap-2" />
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-border p-5">
            <h3 class="mb-3 text-sm font-semibold">{{ t('dir.submit.how_it_works') }}</h3>
            <ol class="space-y-2.5">
              <li
                v-for="(key, index) in SUBMIT_STEP_KEYS"
                :key="key"
                class="flex items-start gap-2.5 text-sm"
              >
                <span
                  class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                >
                  {{ index + 1 }}
                </span>
                <span class="leading-relaxed text-muted-foreground">{{ t(key) }}</span>
              </li>
            </ol>
            <p class="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <Icon name="crown" :size="14" class="mt-0.5 shrink-0 text-amber-500" />
              <span>{{ t('dir.submit.premium_skips_queue') }}</span>
            </p>
          </div>
        </div>
      </section>

      <section class="mt-10">
        <h2 class="mb-4 text-lg font-semibold">{{ t('dir.submit.listing_plan') }}</h2>
        <div
          v-if="requestedTier && plan === requestedPlan"
          class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
        >
          <span>{{ t('dir.submit.plan_from_pricing', { name: requestedName, price: paidPrice }) }}</span>
          <button
            type="button"
            class="cursor-pointer text-xs underline underline-offset-2"
            @click="clearPlan"
          >
            {{ t('dir.submit.plan_clear') }}
          </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="option in planOptions"
            :key="option.id"
            type="button"
            :aria-pressed="plan === option.id"
            class="flex cursor-pointer flex-col rounded-xl border p-4 text-left transition"
            :class="
              plan === option.id
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:border-primary/40'
            "
            @click="plan = option.id"
          >
            <span class="flex items-start justify-between gap-2">
              <span class="flex flex-col gap-0.5">
                <span class="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon v-if="option.id === 'featured'" name="crown" :size="16" class="text-amber-500" />
                  <span>{{ option.label }}</span>
                </span>
                <span v-if="option.badge" class="text-[11px] font-medium text-amber-600">
                  {{ option.badge }}
                </span>
              </span>
              <span class="text-right">
                <s v-if="option.strike" class="block text-xs text-muted-foreground">{{ pick(`此前 ${option.strike}`, `was ${option.strike}`) }}</s>
                <span class="block text-sm font-semibold tabular-nums">{{ option.price }}</span>
                <span class="block text-[11px] font-normal text-muted-foreground">{{ option.unit }}</span>
              </span>
            </span>
            <ul class="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li v-for="feature in option.features" :key="feature" class="flex gap-1.5">
                <Icon name="check" :size="14" class="mt-px shrink-0" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </button>
        </div>
        <p v-if="promoOn" class="mt-3 text-xs text-muted-foreground">
          {{ pick(`黑五优惠截止 ${deadline} Asia/Shanghai。`, `Black Friday pricing ends ${deadline} Asia/Shanghai.`) }}
        </p>
      </section>

      <p class="mt-4 text-xs text-muted-foreground">
        {{ pick('在你登录并保存之前，什么都不会写入。', 'Nothing is stored until you sign in and save.') }}
      </p>
      <p v-if="error" class="mt-4 text-sm text-destructive">
        {{ error }}
        <NuxtLink v-if="savedUnpaid" class="ml-2 underline" :to="localePath('/settings/submissions')">
          {{ t('directory.submit_view_submissions') }}
        </NuxtLink>
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="mt-8 inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-primary bg-clip-padding px-6 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
      >
        {{
          submitting
            ? t('common.pricing.processing')
            : !user
              ? isFreePlan
                ? pick('用 Google 登录以保存这份草稿', 'Sign in with Google to save this draft')
                : pick('用 Google 登录后付款', 'Sign in with Google to pay')
              : isFreePlan
                ? t('dir.submit.btn_review')
                : t('dir.submit.btn_pay', { price: paidPrice })
        }}
      </button>
    </form>

    <section class="mt-16 max-w-3xl pb-4">
      <h2 class="mb-4 text-lg font-semibold">{{ t('dir.submit.faq_title') }}</h2>
      <div class="flex flex-col border-b border-border">
        <div v-for="(item, index) in SUBMIT_FAQ_ITEMS" :key="item.questionKey" class="border-t border-border">
          <h3 class="flex">
            <button
              type="button"
              :aria-expanded="openFaq === index"
              class="relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-4 text-left text-[15px] font-medium transition-all outline-none hover:no-underline"
              @click="openFaq = openFaq === index ? null : index"
            >
              <span>{{ t(item.questionKey) }}</span>
              <Icon
                name="chevron-down"
                :size="16"
                class="ml-auto shrink-0 text-muted-foreground transition-transform duration-200"
                :class="openFaq === index ? 'rotate-180' : ''"
              />
            </button>
          </h3>
          <div
            v-if="openFaq === index"
            class="animate-in fade-in-50 pb-4 text-sm leading-relaxed text-muted-foreground duration-150"
          >
            {{ t(item.answerKey, faqParams(item)) }}
          </div>
        </div>
      </div>
    </section>
  </template>
</template>
