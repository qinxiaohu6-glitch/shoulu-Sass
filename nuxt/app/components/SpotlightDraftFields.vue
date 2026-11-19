<script setup lang="ts">
/**
 * The Spotlight draft fields, shared by the customer form and the console.
 *
 * Two callers, one field list: `/spotlights/submit` (a maker sending a draft)
 * and `/admin/spotlights/new` (the owner writing one up from an email thread).
 * Keeping them in one component is the point — a second copy of these inputs
 * would drift the first time the template changed, and the published standard
 * on `/spotlights/guidelines` describes exactly these fields.
 *
 * What differs between the two callers is *flow*, not fields, and flow stays in
 * the pages: the public one renders a receipt and a "before you start" block,
 * the console one has a slug field and a publish button.
 *
 * The labels are bilingual because the two callers are: the public form is
 * English-only like the article it produces, and the console is Chinese-only
 * (owner-only, and `/admin` resolves to the English locale, so `pick()` would
 * hand the Chinese owner the English half). `locale` is the switch.
 *
 * `v-model` is an object and every input emits a fresh copy. Mutating the prop
 * would work in Vue 2 and break silently in Vue 3 with a readonly proxy, so the
 * patch helper is not ceremony — it is the difference between saving and not.
 */
import {
  SPOTLIGHT_MAX,
  SPOTLIGHT_MAX_WORDS,
  SPOTLIGHT_MIN_WORDS,
  spotlightWords,
  type SpotlightDraftInput,
} from '~~/shared/content/spotlights'

const props = withDefaults(
  defineProps<{
    modelValue: SpotlightDraftInput
    /** Every listing an article could link to, already sorted by name. */
    listings: { slug: string; name: string; url: string }[]
    /**
     * The console may create an article without a reply address — the customer
     * mailed it in. The public form may not: the receipt and the review outcome
     * have nowhere to go.
     */
    emailRequired?: boolean
    /**
     * Follows the page: the public form is bilingual now (`/spotlights/submit`
     * passes the resolved locale), and the console is always `zh`.
     */
    locale?: 'en' | 'zh'
  }>(),
  { emailRequired: true, locale: 'en' },
)

const emit = defineEmits<{ 'update:modelValue': [SpotlightDraftInput] }>()

const COPY = {
  legend_product: { en: '1 · The product', zh: '1 · 产品' },
  listing: { en: 'Listing', zh: '站内条目' },
  listing_ph: { en: 'Choose the product this article is about…', zh: '选择这篇文章写的是哪个产品…' },
  listing_hint: { en: 'Not listed yet?', zh: '还没收录？' },
  listing_link: { en: 'Submit the product first', zh: '先提交产品' },
  listing_hint_tail: {
    en: ' — a draft cannot be reviewed before its listing exists.',
    zh: ' —— 文章要链到站内条目，条目不存在就无处可链。',
  },
  product_name: { en: 'Product name', zh: '产品名' },
  product_url: { en: 'Product website', zh: '产品官网' },
  legend_headline: { en: '2 · The headline', zh: '2 · 标题与正文' },
  tagline: { en: 'One-line angle', zh: '一句话角度' },
  tagline_ph: {
    en: 'What this article argues, in one line — not the listing tagline.',
    zh: '这篇文章的论点，一句话 —— 不要抄目录里的简介。',
  },
  tagline_hint: {
    en: 'Shown under the title and used as the search description.',
    zh: '显示在标题下方，同时作为搜索描述。',
  },
  characters: { en: 'characters.', zh: '字符。' },
  body: { en: 'The article', zh: '正文' },
  body_hint: {
    en: 'Markdown works: ## heading, - list, **bold**, [text](url). Every external link in the body is nofollow; the product’s own link in the card is the one that counts.',
    zh: '支持 Markdown：## 标题、- 列表、**加粗**、[文字](链接)。正文里的外链一律 nofollow，产品卡上那条链接才是 dofollow。',
  },
  body_ph: { en: '## Introduction\n\n…', zh: '## Introduction\n\n…（正文用英文写，这是要发布的文章）' },
  words: { en: 'words', zh: '词' },
  required_range: { en: 'required', zh: '要求' },
  to_go: { en: 'to go', zh: '还差' },
  over: { en: 'over', zh: '超出' },
  sections: { en: 'The eight sections the review checks for', zh: '审核会看的八个小节' },
  legend_card: { en: '3 · The product card details', zh: '3 · 产品卡信息' },
  optional: { en: 'optional', zh: '可选' },
  card_hint: {
    en: 'These render in the card at the top of the article. Empty fields are hidden, not printed blank.',
    zh: '这些显示在文章顶部的产品卡里。留空的分区会隐藏，不会打印成空白。',
  },
  best_for: { en: 'Best for', zh: '适合谁' },
  best_for_ph: { en: 'Solo founders who ship weekly', zh: '每周发版的独立开发者' },
  pricing: { en: 'Pricing summary', zh: '价格概述' },
  pricing_ph: { en: 'Free up to 3 projects, then $12/month', zh: '免费 3 个项目，之后 $12/月' },
  legend_byline: { en: '4 · Byline', zh: '4 · 署名' },
  author: { en: 'Author name', zh: '作者' },
  author_ph: { en: 'Who gets the byline', zh: '署名给谁' },
  email: { en: 'Reply address', zh: '回复邮箱' },
  email_optional: { en: 'Reply address (optional)', zh: '回复邮箱（可选）' },
  email_hint_required: {
    en: 'The receipt and the review outcome go to this address. It is never published.',
    zh: '回执和审核结果都发这个地址。不会公开。',
  },
  email_hint_optional: {
    en: 'Only used to send the author a "your article is live" note. Leave it empty and no mail is sent. Never published either way.',
    zh: '只用来给作者发一封「文章已上线」的通知。留空就不发邮件。两种情况下都不会公开。',
  },
  bio: { en: 'About the author', zh: '作者简介' },
  bio_ph: { en: 'One or two sentences, under 50 words.', zh: '一两句话，50 词以内。' },
} as const

const t = (key: keyof typeof COPY) => COPY[key][props.locale]

const draft = computed(() => props.modelValue)
const words = computed(() => spotlightWords(draft.value.body))
const wordsState = computed(() => {
  if (words.value === 0) return 'empty'
  if (words.value < SPOTLIGHT_MIN_WORDS) return 'short'
  if (words.value > SPOTLIGHT_MAX_WORDS) return 'long'
  return 'ok'
})

const MAX = SPOTLIGHT_MAX

/**
 * One setter for every field.
 *
 * Reads `event.target.value` when handed an event, so the template stays
 * `@input="patch('tagline', $event)"` instead of casting the target in eight
 * places.
 */
function patch(key: keyof SpotlightDraftInput, value: unknown) {
  const next =
    typeof value === 'object' && value !== null && 'target' in value
      ? String((value as { target: HTMLInputElement }).target.value ?? '')
      : String(value ?? '')
  emit('update:modelValue', { ...props.modelValue, [key]: next })
}

/**
 * Picking the product fills in the two fields it already knows.
 *
 * Overwritten rather than merged: switching the picker from product A to
 * product B while A's name stays in the name field would publish B's article
 * under A's title.
 *
 * The tagline is deliberately NOT copied from the listing's short description.
 * It is the article's angle, and a draft that reuses the listing copy is the
 * first thing the review rejects.
 */
function applyListing(slug: string) {
  const hit = props.listings.find((item) => item.slug === slug)
  emit('update:modelValue', {
    ...props.modelValue,
    listingSlug: slug,
    ...(hit ? { productName: hit.name, productUrl: hit.url } : {}),
  })
}

const SECTIONS = [
  { n: '1', title: { en: 'Title', zh: '标题' }, words: '—' },
  { n: '2', title: { en: 'Introduction', zh: '引言' }, words: '100–150' },
  { n: '3', title: { en: 'The problem', zh: '问题' }, words: '150–200' },
  { n: '4', title: { en: 'How it works', zh: '怎么工作' }, words: '200–300' },
  { n: '5', title: { en: 'Key features', zh: '核心功能' }, words: '150–250' },
  { n: '6', title: { en: 'Use cases', zh: '使用场景' }, words: '150–250' },
  { n: '7', title: { en: 'Call to action', zh: '行动号召' }, words: '—' },
  { n: '8', title: { en: 'Optional details', zh: '可选信息' }, words: '—' },
]
</script>

<template>
  <div class="sd-fields">
    <fieldset class="sd-fieldset">
      <legend>{{ t('legend_product') }}</legend>

      <div class="sd-row">
        <label class="sd-label" for="sd-listing">{{ t('listing') }}</label>
        <select
          id="sd-listing"
          class="sd-input"
          :value="draft.listingSlug"
          @change="applyListing(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ t('listing_ph') }}</option>
          <option v-for="item in listings" :key="item.slug" :value="item.slug">
            {{ item.name }}
          </option>
        </select>
        <p class="sd-hint">
          {{ t('listing_hint') }}
          <NuxtLink to="/submit">{{ t('listing_link') }}</NuxtLink>{{ t('listing_hint_tail') }}
        </p>
      </div>

      <div class="sd-row sd-row--split">
        <div>
          <label class="sd-label" for="sd-name">{{ t('product_name') }}</label>
          <input
            id="sd-name"
            class="sd-input"
            :value="draft.productName"
            :maxlength="MAX.productName"
            autocomplete="off"
            @input="patch('productName', $event)"
          >
        </div>
        <div>
          <label class="sd-label" for="sd-url">{{ t('product_url') }}</label>
          <input
            id="sd-url"
            class="sd-input"
            type="url"
            placeholder="https://"
            autocomplete="off"
            :value="draft.productUrl"
            @input="patch('productUrl', $event)"
          >
        </div>
      </div>
    </fieldset>

    <fieldset class="sd-fieldset">
      <legend>{{ t('legend_headline') }}</legend>

      <div class="sd-row">
        <label class="sd-label" for="sd-tagline">{{ t('tagline') }}</label>
        <input
          id="sd-tagline"
          class="sd-input"
          :maxlength="MAX.tagline"
          :placeholder="t('tagline_ph')"
          :value="draft.tagline"
          @input="patch('tagline', $event)"
        >
        <p class="sd-hint">
          {{ t('tagline_hint') }} {{ draft.tagline.length }}/{{ MAX.tagline }}
          {{ t('characters') }}
        </p>
      </div>

      <div class="sd-row">
        <label class="sd-label" for="sd-body">{{ t('body') }}</label>
        <p class="sd-hint sd-hint--top">{{ t('body_hint') }}</p>
        <textarea
          id="sd-body"
          class="sd-input sd-textarea"
          rows="20"
          :maxlength="MAX.body"
          :placeholder="t('body_ph')"
          :value="draft.body"
          @input="patch('body', $event)"
        />
        <div class="sd-count" :data-state="wordsState">
          <strong>{{ words.toLocaleString() }}</strong>
          <span>
            {{ t('words') }} · {{ SPOTLIGHT_MIN_WORDS.toLocaleString() }}–{{
              SPOTLIGHT_MAX_WORDS.toLocaleString()
            }}
            {{ t('required_range') }}
          </span>
          <span v-if="wordsState === 'short'">
            · {{ t('to_go') }} {{ (SPOTLIGHT_MIN_WORDS - words).toLocaleString() }}
          </span>
          <span v-if="wordsState === 'long'">
            · {{ t('over') }} {{ (words - SPOTLIGHT_MAX_WORDS).toLocaleString() }}
          </span>
        </div>
      </div>

      <details class="sd-sections">
        <summary>{{ t('sections') }}</summary>
        <ol class="sd-sections__list">
          <li v-for="section in SECTIONS" :key="section.n">
            <span class="sd-sections__n">{{ section.n }}</span>
            <strong>{{ section.title[locale] }}</strong>
            <span class="sd-sections__w">{{ section.words }}</span>
          </li>
        </ol>
      </details>
    </fieldset>

    <fieldset class="sd-fieldset">
      <legend>
        {{ t('legend_card') }} <span class="sd-optional">{{ t('optional') }}</span>
      </legend>
      <p class="sd-hint sd-hint--top">{{ t('card_hint') }}</p>

      <div class="sd-row sd-row--split">
        <div>
          <label class="sd-label" for="sd-bestfor">{{ t('best_for') }}</label>
          <input
            id="sd-bestfor"
            class="sd-input"
            :maxlength="MAX.bestFor"
            :placeholder="t('best_for_ph')"
            :value="draft.bestFor"
            @input="patch('bestFor', $event)"
          >
        </div>
        <div>
          <label class="sd-label" for="sd-pricing">{{ t('pricing') }}</label>
          <input
            id="sd-pricing"
            class="sd-input"
            :maxlength="MAX.pricingSummary"
            :placeholder="t('pricing_ph')"
            :value="draft.pricingSummary"
            @input="patch('pricingSummary', $event)"
          >
        </div>
      </div>
    </fieldset>

    <fieldset class="sd-fieldset">
      <legend>{{ t('legend_byline') }}</legend>

      <div class="sd-row sd-row--split">
        <div>
          <label class="sd-label" for="sd-author">{{ t('author') }}</label>
          <input
            id="sd-author"
            class="sd-input"
            :maxlength="MAX.author"
            :placeholder="t('author_ph')"
            :value="draft.author"
            @input="patch('author', $event)"
          >
        </div>
        <div>
          <label class="sd-label" for="sd-email">
            {{ emailRequired ? t('email') : t('email_optional') }}
          </label>
          <input
            id="sd-email"
            class="sd-input"
            type="email"
            :maxlength="MAX.email"
            autocomplete="email"
            :value="draft.email"
            @input="patch('email', $event)"
          >
        </div>
      </div>
      <p class="sd-hint">{{ emailRequired ? t('email_hint_required') : t('email_hint_optional') }}</p>

      <div class="sd-row">
        <label class="sd-label" for="sd-bio">{{ t('bio') }}</label>
        <textarea
          id="sd-bio"
          class="sd-input"
          rows="3"
          :maxlength="MAX.authorBio"
          :placeholder="t('bio_ph')"
          :value="draft.authorBio"
          @input="patch('authorBio', $event)"
        />
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
/* ---------------------------------------------------------------------------
   Why every form control is anchored to `#__nuxt`.

   The console renders inside `.src-page`. `app/assets/css/main.css` neutralises
   the legacy element reset there with

     :is(.src-page, body > :not(#__nuxt)) :is(button, input, select, textarea) {
       border: revert-layer; background: revert-layer; padding: revert-layer;
     }

   That selector carries `#__nuxt` inside `:not()`, so it scores an ID and
   outranks any plain class — the inputs rendered as bare 17px text boxes in the
   console with no border and no padding, while the public form (which is not a
   `.src-page`) looked correct. The same rule strips `outline` on focus and
   `padding`/`list-style` from lists, which is why the focus ring and the
   section list are anchored too.

   `#__nuxt` is the app root and therefore the one ancestor both callers share,
   so `:is(#__nuxt)` puts these declarations back in front without an
   `!important` and without touching the global file.
--------------------------------------------------------------------------- */
.sd-fields { display: grid; gap: 26px; max-width: 960px; }

.sd-fieldset {
  margin: 0;
  padding: 22px 24px 24px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}
.sd-fieldset legend { padding: 0 10px; font-size: 13px; font-weight: 800; letter-spacing: 0.02em; }
.sd-optional { font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-foreground); }

.sd-row { margin-top: 18px; }
.sd-row:first-of-type { margin-top: 0; }
.sd-row--split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.sd-row--split > * { min-width: 0; }

.sd-label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 600; }

:is(#__nuxt) .sd-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: var(--foreground);
  /* `--card`, not `--background`: the fieldset is already `--card`, and the
     page background is only 3% darker, so a filled field read as a hole in the
     card. White on white with a border is the shape people expect. */
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}
:is(#__nuxt) .sd-input:focus {
  outline: 2px solid #d9a03a;
  outline-offset: 1px;
  border-color: #d9a03a;
}
:is(#__nuxt) .sd-textarea { line-height: 1.7; resize: vertical; min-height: 320px; }

/* A native `<select>` ignores `background` and paints its own chrome, so the
   one dropdown in this form was the only beige field among white ones. Draw the
   arrow and let the shared `.sd-input` styling show through. */
:is(#__nuxt) select.sd-input {
  appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%2378716c' stroke-width='1.6'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 11px 8px;
}

.sd-hint { margin: 7px 0 0; font-size: 12px; line-height: 1.6; color: var(--muted-foreground); }
.sd-hint--top { margin: 0 0 9px; }
:is(#__nuxt) .sd-hint a { color: #b45309; }

.sd-count { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 9px; font-size: 12px; color: var(--muted-foreground); }
.sd-count strong { font-size: 15px; font-variant-numeric: tabular-nums; }
.sd-count[data-state='ok'] strong { color: #15803d; }
.sd-count[data-state='short'] strong,
.sd-count[data-state='long'] strong { color: #b91c1c; }

.sd-sections { margin-top: 16px; border-top: 1px dashed var(--border); padding-top: 14px; }
.sd-sections summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--muted-foreground); }
:is(#__nuxt) .sd-sections__list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
.sd-sections__list li { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
.sd-sections__n { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--muted); font-size: 10px; font-weight: 800; flex: none; }
.sd-sections__w { margin-left: auto; color: var(--muted-foreground); font-size: 12px; }

@media (max-width: 640px) {
  .sd-row--split { grid-template-columns: 1fr; gap: 16px; }
  .sd-fieldset { padding: 18px; }
}
</style>
