<script setup lang="ts">
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
 * it — and when no provider is configured yet, the receipt keeps the manual
 * instructions instead of showing a button that cannot work.
 */
import { tiers } from '~~/shared/content/pricing'
import type { SubmitFaqItem } from '~/utils/directory-ui'
import { legalLogoUrl } from '~~/shared/utils/logo'

const { lang, pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const t = useDirectoryCopy()
const { user, ensure } = useSession()

/**
 * Submitting is a signed-in action. The form is not rendered until Google
 * login has come back to this page, and POST /api/submit refuses a missing
 * session on its own.
 */
await ensure()
const signInHref = computed(() =>
  localePath({ path: '/sign-in', query: { next: route.fullPath } }),
)
if (!user.value) {
  await navigateTo(signInHref.value)
}

const { categories: liveCategories } = useDirectoryMeta()
const payment = await usePayment()

/**
 * The three one-time tiers `/pricing` can preselect. `ad` is deliberately not
 * here: those weekly slots are sold on `/book-ad` with their own week picker,
 * and `planAmountCents('ad')` is the legacy Billboard Standard label, not a sidebar week.
 */
const PAYABLE_PLANS = ['standard', 'featured', 'pro'] as const

/** Featured. Every new submission starts here unless the URL says otherwise. */
const DEFAULT_PLAN = 'featured'

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
  // Receipts still go to an address the submitter types. The Google account
  // is what owns the row; this field is where the mail is sent.
  email: '',
  // Filled by the URL preview only. `submissions` already has both columns;
  // the form never sent them, so an approved listing had no logo and no maker
  // line while a curated one had both.
  logo: '',
  maker: '',
})
const submitting = ref(false)
const enriching = ref(false)
const error = ref('')
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

/**
 * Paste a link, fill what is still empty.
 *
 * Only blank fields are written: someone who typed their own tagline and then
 * pasted the URL must not watch the page overwrite it. Everything the preview
 * returns lands in a visible field, so a wrong guess is one edit away.
 */
async function enrich() {
  const url = form.website.trim()
  if (!url || enriching.value) return
  enriching.value = true
  try {
    const preview = await $fetch<Preview>('/api/tools/preview', {
      method: 'POST',
      body: { url },
    })
    if (!preview?.ok) return
    if (!form.name && preview.name) form.name = preview.name
    if (!form.tagline && preview.short) form.tagline = preview.short
    if (!form.intro && preview.long) form.intro = preview.long
    if (!form.category && preview.category) form.category = preview.category
    if (preview.tags?.length) form.tags = preview.tags
    if (preview.logo) form.logo = preview.logo
    if (preview.maker) form.maker = preview.maker
  } catch {
    // A page that refuses to be read is not worth blocking the form over —
    // the submitter can still type everything by hand.
  } finally {
    enriching.value = false
  }
}

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
 * Every tier is shown, not just the two the source shipped. A buyer who lands
 * on `/submit` should be able to pick Standard, Featured, Pro (or free) without going
 * back to `/pricing` — and the price on each card comes from `tiers`, so the
 * button can never quote an amount the server will not charge.
 */
const planOptions = computed(() =>
  tiers.map((entry) => ({
    id: entry.id,
    name: isZh.value ? entry.name.zh : entry.name.en,
    price: entry.price,
    unit: isZh.value ? entry.unit.zh : entry.unit.en,
    // Four bullets keep four cards readable; the full list is on `/pricing`.
    features: (isZh.value ? entry.features.zh : entry.features.en).slice(0, 4),
    badge: entry.badge ? (isZh.value ? entry.badge.zh : entry.badge.en) : '',
    paid: entry.amountCents > 0,
  })),
)

const requestedTier = computed(
  () => tiers.find((entry) => entry.id === requestedPlan.value) ?? null,
)
const requestedName = computed(() =>
  requestedTier.value ? (isZh.value ? requestedTier.value.name.zh : requestedTier.value.name.en) : '',
)

const selectedTier = computed(() => tiers.find((entry) => entry.id === plan.value) ?? tiers[0]!)
const paidPrice = computed(() => selectedTier.value.price)
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
  return t('dir.submit.error_failed')
}

async function submit() {
  if (!user.value) {
    await navigateTo(signInHref.value)
    return
  }
  // Paste-then-submit never blurs the URL field, so fill first, validate after.
  // Category counts too: it is a required select, and a link-only submission
  // has no other way to get one.
  if (form.website && (!form.name || !form.tagline || !form.category)) await enrich()

  if (!form.name.trim() || !form.tagline.trim()) {
    error.value = t('dir.submit.error_missing_fields')
    return
  }
  if (!form.website.trim()) {
    error.value = t('dir.submit.error_invalid_url')
    return
  }
  if (!form.category) {
    error.value = t('dir.submit.error_invalid_category')
    return
  }
  // Every listing needs a reachable address: it is where the receipt, the
  // review outcome and any refund go. Required on the free tier too, so nobody
  // submits a listing that can never be answered.
  if (!form.email.trim()) {
    error.value = t('dir.submit.error_email_required')
    return
  }
  // The preview may fill this in. An empty or non-http value is refused here
  // and again by `validate()` so a direct API call cannot skip it.
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
    const res = await $fetch<{ ok: boolean; id?: string; next?: string }>('/api/submit', {
      method: 'POST',
      body: {
        url: form.website,
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
        logo: form.logo,
        maker: form.maker,
      },
    })

    if (!res?.ok || !res.id) throw new Error('submit failed')

    const paid = res.next === 'paid'
    done.value = { id: res.id, paid }

    // A paid listing is only in the queue once the money lands, so send the
    // submitter to checkout while the intent is fresh.
    if (paid && payment.ready.value) await payment.pay(res.id)
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
  form.name = ''
  form.website = ''
  form.tagline = ''
  form.category = ''
  form.intro = ''
  form.tags = []
  form.email = ''
  form.logo = ''
  form.maker = ''
}
</script>

<template>
  <div v-if="!user" class="flex max-w-md flex-col items-start gap-3 py-6">
    <h2 class="text-lg font-semibold">
      {{ pick('提交产品需要先用 Google 登录', 'Sign in with Google to submit a product') }}
    </h2>
    <p class="text-sm text-muted-foreground">
      {{ pick('登录后会回到这个页面。未登录不能填写或提交。', 'You will come back to this page. The form stays closed until you are signed in.') }}
    </p>
    <NuxtLink
      :to="signInHref"
      class="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
    >
      {{ pick('使用 Google 登录', 'Sign in with Google') }}
    </NuxtLink>
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

          <div class="space-y-2">
            <label
              for="tool-website"
              class="flex items-center justify-between gap-2 text-sm leading-none font-medium"
            >
              <span>{{ t('dir.submit.field_website') }}</span>
              <span v-if="enriching" class="text-xs font-normal text-muted-foreground">
                {{ pick('正在读取网页…', 'Reading the page…') }}
              </span>
            </label>
            <input
              id="tool-website"
              v-model="form.website"
              type="url"
              required
              :placeholder="t('dir.submit.field_website_ph')"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              @blur="enrich"
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
            <label for="tool-logo" class="text-sm leading-none font-medium">
              {{ t('dir.submit.field_logo') }}
              <span class="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="tool-logo"
              v-model="form.logo"
              type="url"
              required
              :placeholder="t('dir.submit.field_logo_ph')"
              class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
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
                  <span>{{ option.name }}</span>
                </span>
                <span v-if="option.badge" class="text-[11px] font-medium text-amber-600">
                  {{ option.badge }}
                </span>
              </span>
              <span class="text-right">
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
      </section>

      <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="mt-8 inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-primary bg-clip-padding px-6 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
      >
        {{
          submitting
            ? t('common.pricing.processing')
            : isFreePlan
              ? t('dir.submit.btn_review')
              : t('dir.submit.btn_pay', { price: selectedTier.price })
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
