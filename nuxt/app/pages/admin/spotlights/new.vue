<script setup lang="ts">
/**
 * /admin/spotlights/new — the owner writes an article directly.
 *
 * The customer door is `/spotlights/submit`. This is the other one: a Featured
 * customer mails in a draft, and the owner publishes it without asking them to
 * retype 1,000 words into a form. The fields are the same component, so the two
 * doors cannot describe the article differently.
 *
 * Two outcomes, and the difference is worth a button each rather than a
 * checkbox:
 *
 *  - **直接上线** publishes now. Correct when the owner has already read the
 *    draft — which, if it arrived by email, they have.
 *  - **存为草稿** puts it in the queue as pending. Correct when something was
 *    pasted in quickly and still needs a proper read. It then appears in
 *    `/admin/spotlights` like any other draft, so there is one place to look for
 *    "what still needs a decision".
 *
 * The slug field exists only here. A customer does not know what URL they want
 * and should not be asked; the owner does, and this is the last cheap moment to
 * set it — changing it after publication leaves a dead link.
 */
definePageMeta({ layout: 'admin' })

import { toast } from 'vue-sonner'
import {
  SPOTLIGHT_MAX_WORDS,
  SPOTLIGHT_MIN_WORDS,
  emptySpotlightDraft,
  spotlightSlug,
  spotlightWords,
  type SpotlightDraftInput,
} from '~~/shared/content/spotlights'
import { mergeDirectory, orderedTools } from '~~/shared/utils/catalog'
import { buttonVariants, cn } from '~/utils/ui'
import { useSubmittedTools } from '~/composables/useSubmittedTools'

const COPY = {
  title: { zh: '新建 Spotlight', en: 'New Spotlight' },
  description: {
    zh: '客户把稿子发到邮箱时用这里直接上稿，不必让他重新填一遍表单。字段和用户端投稿表单是同一个组件，所以两边的规则不会漂。直接上线会立刻发布并写入 sitemap；存为草稿会进入「待审核」，之后在列表里审。',
    en: 'Publish an article a customer mailed in, without asking them to retype it. Same fields as the public form. Publishing is immediate and adds the URL to the sitemap; saving as a draft puts it in the queue.',
  },
  back: { zh: '返回审核列表', en: 'Back to the queue' },
  legend_publish: { zh: '发布方式', en: 'Publishing' },
  slug: { zh: '网址后缀（可选）', en: 'URL slug (optional)' },
  slug_hint: {
    zh: '留空则按产品名自动生成。发布地址：/spotlights/{slug}。只能是小写字母、数字和连字符；发布之后再改会留下死链。',
    en: 'Leave empty to generate one from the product name. Publishes at /spotlights/{slug}. Lowercase letters, digits and hyphens only; changing it later leaves a dead link.',
  },
  slug_preview: { zh: '将发布到', en: 'Will publish at' },
  publish: { zh: '直接上线', en: 'Publish now' },
  draft: { zh: '存为草稿', en: 'Save as draft' },
  publishing: { zh: '发布中…', en: 'Publishing…' },
  saving: { zh: '保存中…', en: 'Saving…' },
  toast_published: { zh: '已发布上线', en: 'Published' },
  toast_draft: { zh: '已存为草稿，在审核列表里', en: 'Saved as a draft' },
  failure_title: { zh: '没有保存成功', en: 'Not saved' },
  words_short: {
    zh: '正文还差 {n} 词（要求 800–1,500）。',
    en: 'The article is {n} words short of 800.',
  },
  words_long: { zh: '正文超出 {n} 词（要求 800–1,500）。', en: 'The article is {n} words over 1,500.' },
  need_listing: { zh: '先选一个站内条目。', en: 'Pick a listing first.' },
  need_url: { zh: '产品官网和一句话角度都要填。', en: 'The product URL and the angle are both required.' },
} as const

/** The console is owner-only and always Chinese; see `admin/submissions.vue`. */
function c(key: keyof typeof COPY, params?: Record<string, string | number>): string {
  let out: string = COPY[key].zh
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

const api = useAdminApi()
const router = useRouter()
const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { lang } = useLang()

/** Same source the public form and the article page read. */
const listings = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value)
    .map((tool) => ({ slug: tool.slug, name: tool.name, url: tool.url }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const draft = ref<SpotlightDraftInput>(emptySpotlightDraft())
const slug = ref('')
const busy = ref<'publish' | 'draft' | null>(null)
const failure = ref('')

const words = computed(() => spotlightWords(draft.value.body))
const wordsOk = computed(() => words.value >= SPOTLIGHT_MIN_WORDS && words.value <= SPOTLIGHT_MAX_WORDS)

/** What the URL will be, so the owner sees it before committing. */
const effectiveSlug = computed(
  () => slug.value.trim().toLowerCase() || spotlightSlug(draft.value.productName || 'spotlight'),
)

/** Why the buttons are disabled, said out loud rather than left to a grey button. */
const blocker = computed(() => {
  if (!draft.value.listingSlug) return c('need_listing')
  if (!draft.value.productUrl.trim() || !draft.value.tagline.trim()) return c('need_url')
  if (words.value < SPOTLIGHT_MIN_WORDS) return c('words_short', { n: SPOTLIGHT_MIN_WORDS - words.value })
  if (words.value > SPOTLIGHT_MAX_WORDS) return c('words_long', { n: words.value - SPOTLIGHT_MAX_WORDS })
  return ''
})

const ready = computed(() => !blocker.value && !busy.value)

async function create(publish: boolean) {
  if (!ready.value) return
  busy.value = publish ? 'publish' : 'draft'
  failure.value = ''
  try {
    const res = await api.post<{ ok: boolean; item: { slug: string } }>(
      '/api/admin/spotlights/create',
      { ...draft.value, slug: slug.value.trim(), publish },
    )
    toast.success(publish ? c('toast_published') : c('toast_draft'))
    // Publishing lands on the article itself: the owner's next question is
    // always "does it read right", and the answer is the page. A draft goes
    // back to the queue, where it now sits as pending.
    await router.push(publish ? `/spotlights/${res.item.slug}` : '/admin/spotlights')
  } catch (error) {
    failure.value = (error as Error).message
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <!-- One column, capped at the form's own width: with the header left
       full-bleed, the "返回审核列表" button sat 300px to the right of the last
       card and the page read as two unrelated columns. -->
  <div class="mx-auto w-full max-w-[1008px] space-y-6 p-4 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ c('title') }}</h1>
        <p class="text-muted-foreground mt-1 max-w-3xl">{{ c('description') }}</p>
      </div>
      <NuxtLink to="/admin/spotlights" :class="cn(buttonVariants({ variant: 'outline' }))">
        {{ c('back') }}
      </NuxtLink>
    </div>

    <SpotlightDraftFields v-model="draft" :listings="listings" :email-required="false" locale="zh" />

    <UiCard>
      <UiCardContent class="space-y-4">
        <div class="space-y-2">
          <UiLabel>{{ c('slug') }}</UiLabel>
          <UiInput v-model="slug" placeholder="product-name-spotlight" />
          <p class="text-muted-foreground text-xs">
            {{ c('slug_hint', { slug: effectiveSlug }) }}
          </p>
          <p class="text-sm">
            <span class="text-muted-foreground">{{ c('slug_preview') }}</span>
            <code class="bg-muted ml-1 rounded px-1.5 py-0.5 text-xs">/spotlights/{{ effectiveSlug }}</code>
          </p>
        </div>

        <p v-if="failure" class="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm" role="alert">
          <strong>{{ c('failure_title') }}：</strong>{{ failure }}
        </p>

        <div class="border-border flex flex-wrap items-center gap-3 border-t pt-4">
          <UiButton :disabled="!ready" @click="create(true)">
            {{ busy === 'publish' ? c('publishing') : c('publish') }}
          </UiButton>
          <UiButton variant="outline" :disabled="!ready" @click="create(false)">
            {{ busy === 'draft' ? c('saving') : c('draft') }}
          </UiButton>
          <span v-if="blocker" class="text-muted-foreground text-xs">{{ blocker }}</span>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
