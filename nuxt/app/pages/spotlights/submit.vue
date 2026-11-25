<script setup lang="ts">
/**
 * /spotlights/submit — the draft form, and the only public write for a Spotlight.
 *
 * Three decisions shape this page:
 *
 *  - **The product is picked from the directory, not typed.** `listingSlug` is
 *    the article's one internal link; a free-text slug would let a draft point
 *    at a product that does not exist, which is a 404 baked into a paid page.
 *    The picker is built from the same `mergeDirectory` the article page uses,
 *    so what the form offers is exactly what the article can link to.
 *  - **The word count is live.** 800–1,500 is enforced on submit, and a writer
 *    who only learns that at the end has already lost the work. The counter
 *    turns red before the button refuses.
 *  - **The template is one click away.** Asking someone to write 1,000 words
 *    straight into a textarea is how you get 300, so the download link and the
 *    section list sit beside the field they apply to.
 *
 * The fields themselves live in `SpotlightDraftFields`, because the console
 * writes the same article from `/admin/spotlights/new`. This page owns only
 * what is specific to a customer: the explanation, the receipt, and the rule
 * that a reply address is required.
 *
 * Bilingual: the section shipped English-only, and this page 301'd `/zh/...`
 * back to English. The refusal body already carries `message_zh` beside
 * `message_en`, so a Chinese writer now reads the server's reason in Chinese
 * instead of the generic fallback.
 */
import {
  SPOTLIGHT_MAX_WORDS,
  SPOTLIGHT_MIN_WORDS,
  emptySpotlightDraft,
  spotlightWords,
  type SpotlightDraftInput,
} from '~~/shared/content/spotlights'
import { mergeDirectory, orderedTools } from '~~/shared/utils/catalog'
import { useSubmittedTools } from '~/composables/useSubmittedTools'
import { pageScrollBehavior } from '~/utils/motion'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

const route = useRoute()
const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { user, ensure: ensureSession } = useSession()
await ensureSession()

useSeo({
  title: computed(() => pick('提交产品聚光灯草稿 · dirtool', 'Submit a Product Spotlight draft · dirtool')),
  description: computed(() =>
    pick(
      '提交一篇产品聚光灯草稿等待审核：选定收录页，按八个小节写完，800 到 1,500 字。已经付款的精选和专业档仍包含这篇。这两档已停售。',
      'Submit a Product Spotlight draft for review. Pick your listing, fill in the eight sections, and 800 to 1,500 words. A Featured or Pro listing already paid for still includes one. Those plans are no longer sold.',
    ),
  ),
})
// A submission form has nothing to rank for; keep it out of the index but let
// the crawler follow the links back into the section.
useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })

/** Every listing an article could point at, alphabetical so the picker scans. */
const listings = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value)
    .map((tool) => ({ slug: tool.slug, name: tool.name, url: tool.url }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const form = ref<SpotlightDraftInput>(emptySpotlightDraft())

// Pre-select from `?listing=` so the link from a product page (and the link in
// a rejection mail) lands on a form that is already about the right product.
const preset = String(route.query.listing ?? '').trim()
if (preset) {
  const hit = listings.value.find((item) => item.slug === preset)
  if (hit) form.value = { ...form.value, listingSlug: hit.slug, productName: hit.name, productUrl: hit.url }
}

// The address the reply goes to is usually the signed-in one. Only filled when
// empty, so a writer who typed a different address keeps it.
if (user.value?.email && !form.value.email) form.value = { ...form.value, email: user.value.email }

const words = computed(() => spotlightWords(form.value.body))
const wordsOk = computed(() => words.value >= SPOTLIGHT_MIN_WORDS && words.value <= SPOTLIGHT_MAX_WORDS)

const submitting = ref(false)
const failure = ref('')
const done = ref<{ slug: string; productName: string; words: number } | null>(null)

const canSubmit = computed(
  () =>
    !submitting.value &&
    Boolean(form.value.listingSlug) &&
    Boolean(form.value.productName.trim()) &&
    Boolean(form.value.productUrl.trim()) &&
    Boolean(form.value.tagline.trim()) &&
    wordsOk.value &&
    Boolean(form.value.email.trim()),
)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  failure.value = ''
  try {
    const res = await $fetch<{ ok: boolean; slug: string; productName: string; words: number }>(
      '/api/spotlights/submit',
      { method: 'POST', body: { ...form.value } },
    )
    done.value = { slug: res.slug, productName: res.productName, words: res.words }
    window.scrollTo({ top: 0, behavior: pageScrollBehavior() })
  } catch (error) {
    // The refusal body carries `message_zh` and `message_en` verbatim (see
    // `sendSubmitError`). ofetch puts a non-2xx JSON body on `error.data`, and a
    // `createError` wrapper would nest it one level deeper — read both, because
    // showing the generic fallback when the server said "too short: 800 words
    // minimum" turns a fixable draft into a mystery.
    const err = error as { data?: { data?: Record<string, unknown> } & Record<string, unknown> }
    const payload = err?.data?.data ?? err?.data ?? {}
    const zh = String(payload.message_zh || '')
    const en = String(payload.message_en || '')
    failure.value =
      (isZh.value ? zh : en) ||
      en ||
      zh ||
      pick(
        '我们这边出了问题，草稿没有保存——请再试一次。',
        'Something went wrong on our side. Your draft was not saved — try again.',
      )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="container sb-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/spotlights')">{{ pick('产品聚光灯', 'Product Spotlights') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('投稿草稿', 'Submit a draft') }}</span>
    </nav>

    <!-- Receipt. Replaces the form rather than sitting above it: a second
         submission of the same product is refused by design, so leaving the
         form open would be an invitation to a 409. -->
    <section v-if="done" class="sb-done">
      <p class="sb-kicker">{{ pick('已收到', 'RECEIVED') }}</p>
      <h1>{{ pick(`《${done.productName}》的草稿已进审核队列`, `Your ${done.productName} draft is in the queue`) }}</h1>
      <p class="sb-done__lead">
        {{ pick(
          `${done.words.toLocaleString()} 字，审核两遍：一遍看准确性，一遍看结构。发布后会发邮件通知你；没通过也会写明哪里需要改。`,
          `${done.words.toLocaleString()} words, one review pass for accuracy and one for structure. You will get an email when it is published, and a note saying what needs work if it is not.`,
        ) }}
      </p>
      <p class="sb-done__meta">
        {{ pick('它会上线在', 'It will publish at') }}
        <code>/spotlights/{{ done.slug }}</code>
        {{ pick('——这个地址是按产品名给的建议，编辑可能会微调。', '— the address is a suggestion from the product name and the editor may adjust it.') }}
      </p>
      <div class="sb-actions">
        <NuxtLink class="sb-btn sb-btn--primary" :to="localePath('/spotlights')">{{ pick('返回全部聚光灯', 'Back to all Spotlights') }}</NuxtLink>
        <NuxtLink class="sb-btn" :to="localePath('/spotlights/guidelines')">{{ pick('看审核标准', 'Read the review standards') }}</NuxtLink>
      </div>
    </section>

    <template v-else>
      <header class="sb-head">
        <p class="sb-kicker">{{ pick('投稿草稿', 'SUBMIT A DRAFT') }}</p>
        <h1>{{ pick('先把文章写完，再提交审核', 'Write the article, then send it for review') }}</h1>
        <p class="sb-lead">
          {{ pick(
            '八个小节，800 到 1,500 字。产品必须已经收录——文章要链到它的页面，得先有页面可链。',
            'Eight sections, 800 to 1,500 words. The product must already be listed — the article links to its page, so there has to be a page to link to.',
          ) }}
        </p>
        <p class="sb-note">
          {{ pick('已经付款的', 'A') }} <strong>{{ pick('精选', 'Featured') }}</strong>
          {{ pick('或', 'or') }} <strong>{{ pick('专业', 'Pro') }}</strong>
          {{ pick('收录仍包含一篇。这两档已停售。一个产品一篇。没读过之前不会发布任何内容。', 'listing already paid for still includes one. Those plans are no longer sold. One article per product. Nothing is published until it has been read.') }}
        </p>
      </header>

      <div class="sb-help">
        <div>
          <p class="sb-help__title">{{ pick('开始之前', 'Before you start') }}</p>
          <p class="sb-help__body">
            {{ pick(
              '在浏览器标签页里硬写一千字不划算——先下载模板，在你顺手的地方写完，再粘回来。',
              'Writing 1,000 words in a browser tab is a bad trade — download the template, fill it in where you are comfortable, then paste it back.',
            ) }}
          </p>
        </div>
        <div class="sb-help__links">
          <a class="sb-btn" href="/spotlight-template.md" download>{{ pick('下载模板（.md）', 'Download the template (.md)') }}</a>
          <NuxtLink class="sb-btn" :to="localePath('/spotlights/guidelines')">{{ pick('完整模板与标准', 'Full template and standards') }}</NuxtLink>
        </div>
      </div>

      <form class="sb-form" novalidate @submit.prevent="submit">
        <SpotlightDraftFields v-model="form" :listings="listings" :locale="lang" email-required />

        <p v-if="failure" class="sb-failure" role="alert">{{ failure }}</p>

        <div class="sb-submit">
          <button class="sb-btn sb-btn--primary sb-btn--lg" type="submit" :disabled="!canSubmit">
            {{ submitting ? pick('发送中…', 'Sending…') : pick('发送审核', 'Send for review') }}
          </button>
          <p class="sb-submit__note">
            {{ pick('不会自动发布。无论结果如何都会发邮件给你。', 'Nothing publishes automatically. You will get an email either way.') }}
          </p>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.sb-page { padding-top: 28px; padding-bottom: 64px; max-width: 820px; }
.sb-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.sb-head { margin: 12px 0 28px; }
.sb-head h1 { margin: 8px 0 14px; font-size: 34px; line-height: 1.2; letter-spacing: -0.03em; }
.sb-lead { margin: 0 0 10px; font-size: 17px; line-height: 1.65; }
.sb-note { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }

.sb-help { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; justify-content: space-between; padding: 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); margin-bottom: 26px; }
.sb-help__title { margin: 0 0 4px; font-size: 14px; font-weight: 700; }
.sb-help__body { margin: 0; font-size: 13px; line-height: 1.65; color: var(--muted-foreground); max-width: 42ch; }
.sb-help__links { display: flex; flex-wrap: wrap; gap: 8px; }

.sb-form { display: grid; gap: 22px; }
.sb-failure { margin: 0; padding: 12px 14px; border-radius: 10px; border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; font-size: 13px; line-height: 1.6; }
.sb-submit { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.sb-submit__note { margin: 0; font-size: 12px; color: var(--muted-foreground); }

.sb-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); font-size: 14px; font-weight: 600; text-decoration: none; color: inherit; cursor: pointer; font-family: inherit; }
.sb-btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
.sb-btn--lg { padding: 12px 24px; font-size: 15px; }
.sb-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.sb-done { padding: 28px; border: 1px solid #f0d48a; background: #fff8e8; border-radius: 18px; }
.sb-done h1 { margin: 8px 0 12px; font-size: 28px; line-height: 1.25; letter-spacing: -0.02em; }
.sb-done__lead { margin: 0 0 10px; font-size: 15px; line-height: 1.7; }
.sb-done__meta { margin: 0 0 18px; font-size: 13px; line-height: 1.7; color: #6b531f; }
.sb-done__meta code { padding: 2px 6px; border-radius: 5px; background: #fff; border: 1px solid #f0d48a; font-size: 12px; }
.sb-actions { display: flex; flex-wrap: wrap; gap: 10px; }

@media (max-width: 640px) {
  .sb-head h1 { font-size: 26px; }
}
</style>
