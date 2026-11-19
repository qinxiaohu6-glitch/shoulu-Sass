<script setup lang="ts">
/**
 * /admin/spotlights — the Product Spotlight review queue.
 *
 * This is the other half of `/spotlights/submit`. A draft lands here, the owner
 * reads it, and one of three things happens: it publishes, it is turned down
 * with a reason, or it comes back down after being live.
 *
 * The three decisions are not symmetrical, and the UI says so:
 *
 *  - **Approve** can change the URL slug. The generated one is a guess from the
 *    product name, and a published URL is expensive to change later, so this is
 *    the last cheap moment to fix it.
 *  - **Reject** keeps the row and records why. The reason goes into the email,
 *    because a writer who is not told what to fix cannot fix it — and a
 *    Spotlight is part of a paid listing.
 *  - **Unpublish** is reversible: it clears the publish timestamp and keeps the
 *    status, so putting the article back is one click rather than a re-review.
 *    That is why it has no confirmation dialog while the other two do.
 *
 * Authorisation is not here. `server/middleware/admin-token.ts` answers 404 to
 * any request without the owner cookie before this layout runs.
 *
 * The "新建 Spotlight" entry in the header is a `<NuxtLink>`, not a `<UiButton>`
 * with a click handler. `navigateTo` is a script-level auto-import: it is a
 * binding inside `<script setup>` but not something the template compiler can
 * see, so `@click="navigateTo(…)"` compiles to `_ctx.navigateTo` — undefined at
 * runtime — and the click silently does nothing. A link also survives
 * middle-click and the window before hydration.
 *
 * The rationale lives in this comment rather than in a long template comment on
 * purpose: an eight-line comment in the template made Nuxt's page-meta
 * extraction return `{}` for this file, which dropped `layout: 'admin'` and
 * turned the page into a 500 after hydration. Short template comments only.
 */
definePageMeta({ layout: 'admin' })

import { Check, Eye, ExternalLink, Plus, RotateCcw, ThumbsDown, Undo2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { buttonVariants, cn, type DataColumn } from '~/utils/ui'
import type { SpotlightRecord } from '~~/shared/content/spotlights'
import { pageWindow } from '~~/shared/utils/submission-queue'

type PlanInfo = { plan: string; paid: boolean; entitled: boolean }
type Item = SpotlightRecord & { plan: PlanInfo | null }
type Stats = { total: number; pending: number; approved: number; rejected: number; live: number }
type Tab = 'all' | 'pending' | 'approved' | 'rejected'

const COPY = {
  title: { zh: 'Spotlight 审核', en: 'Spotlights' },
  new: { zh: '新建 Spotlight', en: 'New Spotlight' },
  description: {
    zh: '审核用户从 /spotlights/submit 提交的深度文章。通过后文章立即上线并进入 sitemap；拒绝会保留记录并把原因发到作者邮箱；下架不清除审核状态，可以一键重新上线。',
    en: 'Review articles submitted through /spotlights/submit. Approving publishes immediately and adds the URL to the sitemap; rejecting keeps the record and emails the reason; unpublishing is reversible.',
  },
  hint: {
    zh: '待审核 {pending} 篇 · 已上线 {live} 篇 · 累计 {total} 篇',
    en: '{pending} awaiting review · {live} live · {total} total',
  },
  plan_hint: {
    zh: 'Spotlight 是 Featured / Pro 档的权益。提交表单不拦档位，所以下面会给不含该权益的提交打标，由你决定是否放行。',
    en: 'A Spotlight is part of the Featured and Pro tiers. The form does not enforce that, so drafts whose listing is not covered are badged — the decision stays yours.',
  },
  tab_all: { zh: '全部', en: 'All' },
  tab_pending: { zh: '待审核', en: 'Pending' },
  tab_approved: { zh: '已通过', en: 'Approved' },
  tab_rejected: { zh: '已拒绝', en: 'Rejected' },
  status_pending: { zh: '待审核', en: 'Pending' },
  status_approved: { zh: '已通过', en: 'Approved' },
  status_rejected: { zh: '已拒绝', en: 'Rejected' },
  live: { zh: '已上线', en: 'Live' },
  offline: { zh: '已下架', en: 'Offline' },
  plan_missing: { zh: '档位不含', en: 'Not covered' },
  col_product: { zh: '产品 / 文章', en: 'Product' },
  col_status: { zh: '状态', en: 'Status' },
  col_plan: { zh: '档位', en: 'Plan' },
  col_email: { zh: '邮箱', en: 'Email' },
  col_updated: { zh: '更新时间', en: 'Updated' },
  col_actions: { zh: '操作', en: 'Actions' },
  empty: { zh: '暂无 Spotlight', en: 'No spotlights' },
  search: { zh: '搜索产品、slug 或邮箱…', en: 'Search product, slug or email…' },
  words: { zh: '{n} 词', en: '{n} words' },
  view: { zh: '阅读全文', en: 'Read' },
  approve: { zh: '通过并上线', en: 'Approve & publish' },
  reject: { zh: '拒绝', en: 'Reject' },
  unpublish: { zh: '下架（可再上线）', en: 'Unpublish' },
  republish: { zh: '重新上线', en: 'Re-publish' },
  toast_approved: { zh: '已通过，文章已上线', en: 'Approved and published' },
  toast_rejected: { zh: '已拒绝，原因已发到作者邮箱', en: 'Rejected; the reason was emailed' },
  toast_unpublished: { zh: '已下架，记录保留', en: 'Unpublished; record kept' },
  detail_title: { zh: 'Spotlight 详情', en: 'Spotlight details' },
  detail_live: { zh: '查看线上页面', en: 'Open the live page' },
  field_product: { zh: '产品', en: 'Product' },
  field_slug: { zh: '网址后缀', en: 'Slug' },
  field_listing: { zh: '关联条目', en: 'Listing' },
  field_url: { zh: '产品官网', en: 'Product site' },
  field_tagline: { zh: '一句话角度', en: 'Angle' },
  field_author: { zh: '作者', en: 'Author' },
  field_bio: { zh: '作者简介', en: 'Author bio' },
  field_best_for: { zh: '适合谁', en: 'Best for' },
  field_pricing: { zh: '价格概述', en: 'Pricing' },
  field_email: { zh: '联系邮箱', en: 'Email' },
  field_created: { zh: '提交时间', en: 'Submitted' },
  field_reviewed: { zh: '审核时间', en: 'Reviewed' },
  field_notes: { zh: '上次审核备注', en: 'Review notes' },
  body_label: { zh: '正文', en: 'Article' },
  approve_title: { zh: '通过并上线', en: 'Approve and publish' },
  approve_desc: {
    zh: '上线后文章立即可访问并写入 sitemap，作者会收到邮件。网址后缀可以在这里改：发布之后再改会留下死链。',
    en: 'Publishing makes the page live and adds it to the sitemap; the author is emailed. The slug can be changed here — changing it after publication leaves a dead link.',
  },
  slug_label: { zh: '网址后缀', en: 'URL slug' },
  slug_hint: {
    zh: '只能是小写字母、数字和连字符。发布地址：/spotlights/{slug}',
    en: 'Lowercase letters, digits and hyphens only. Publishes at /spotlights/{slug}',
  },
  approve_confirm: { zh: '确认上线', en: 'Publish' },
  approve_notes: { zh: '审核备注（可选，只给你自己看）', en: 'Review note (optional, console only)' },
  approve_notes_ph: {
    zh: '例：已按建议改了标题；第 6 节的事实跟官网核对过。',
    en: 'e.g. retitled as suggested; checked section 6 against their site.',
  },
  reject_title: { zh: '拒绝这篇 Spotlight？', en: 'Reject this Spotlight?' },
  reject_desc: {
    zh: '记录会保留，作者可以修改后重新提交。下面写的原因会原样发到作者邮箱，请写清楚需要改什么。',
    en: 'The record is kept and the author may send a revised draft. The reason below is emailed verbatim, so say what needs to change.',
  },
  reject_notes: { zh: '需要修改什么（会发给作者）', en: 'What needs work (emailed)' },
  reject_notes_ph: {
    zh: '例：第 3 节和第 5 节重复；没有提到产品网址；字数 620，差 180 词。',
    en: 'e.g. sections 3 and 5 repeat each other; the product URL is missing; 620 words, 180 short.',
  },
  reject_confirm: { zh: '确认拒绝', en: 'Reject' },
  cancel: { zh: '取消', en: 'Cancel' },
  close: { zh: '关闭', en: 'Close' },
} as const

/**
 * The console is owner-only and always Chinese. `/admin` resolves to the
 * English locale under `prefix_except_default`, so a bilingual `pick()` renders
 * the English half even for the Chinese site owner. The dictionary stays
 * bilingual because the English strings document intent, but this page always
 * renders `zh`.
 */
function c(key: keyof typeof COPY, params?: Record<string, string | number>): string {
  let out: string = COPY[key].zh
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

const api = useAdminApi()
const TABS: Tab[] = ['all', 'pending', 'approved', 'rejected']
const PAGE_SIZE = 20
const ZERO_STATS: Stats = { total: 0, pending: 0, approved: 0, rejected: 0, live: 0 }

const tab = ref<Tab>('all')
const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const saving = ref(false)

const detail = ref<Item | null>(null)
const approving = ref<Item | null>(null)
const rejecting = ref<Item | null>(null)
const slugDraft = ref('')
const notes = ref('')

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})
watch([debouncedSearch, tab], () => {
  page.value = 1
})

function tabLabel(value: Tab) {
  return c(`tab_${value}` as keyof typeof COPY)
}

/** The endpoint has one filter (`status`); search and paging stay client-side. */
const listUrl = computed(() =>
  pageQuery('/api/admin/spotlights', { status: tab.value === 'all' ? undefined : tab.value }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{
  ok: boolean
  items: Item[]
  stats: Stats
}>('admin-spotlights', () => api.get<{ ok: boolean; items: Item[]; stats: Stats }>(listUrl.value), {
  watch: [listUrl],
  default: () => ({ ok: false, items: [] as Item[], stats: { ...ZERO_STATS } }),
})

const stats = computed(() => data.value?.stats ?? ZERO_STATS)
const allRows = computed(() => data.value?.items ?? [])

const filtered = computed(() => {
  // The request already asks for one status; filtering again keeps a stale
  // payload from painting the previous tab's rows.
  const matched =
    tab.value === 'all' ? allRows.value : allRows.value.filter((row) => row.status === tab.value)
  const needle = debouncedSearch.value.trim().toLowerCase()
  if (!needle) return matched
  return matched.filter((row) =>
    [row.productName, row.slug, row.email, row.listingSlug, row.author].some((value) =>
      String(value ?? '').toLowerCase().includes(needle),
    ),
  )
})

const total = computed(() => filtered.value.length)
const windowed = computed(() => pageWindow(filtered.value.length, page.value, PAGE_SIZE))
const rows = computed(() => filtered.value.slice(windowed.value.start, windowed.value.end))
watch(windowed, (next) => {
  if (page.value !== next.page) page.value = next.page
})
const loading = computed(() => fetchStatus.value === 'pending' && rows.value.length === 0)

const columns = computed<DataColumn[]>(() => [
  { key: 'productName', header: c('col_product') },
  { key: 'status', header: c('col_status'), class: 'w-[130px]' },
  { key: 'plan', header: c('col_plan'), class: 'hidden lg:table-cell w-[130px]' },
  { key: 'email', header: c('col_email'), class: 'hidden md:table-cell' },
  { key: 'updatedAt', header: c('col_updated'), class: 'hidden xl:table-cell w-[170px]' },
  { key: 'actions', header: c('col_actions'), class: 'w-[180px]' },
])

function words(row: Item): number {
  return row.body.trim().split(/\s+/).filter(Boolean).length
}

function isLive(row: Item): boolean {
  return row.publishedAtMs !== null
}

function statusLabel(row: Item): string {
  if (row.status === 'rejected') return c('status_rejected')
  if (row.status === 'approved') return isLive(row) ? c('live') : c('offline')
  return c('status_pending')
}

function badgeVariant(row: Item): 'default' | 'secondary' | 'outline' {
  if (row.status === 'approved') return isLive(row) ? 'default' : 'secondary'
  if (row.status === 'rejected') return 'secondary'
  return 'outline'
}

const detailFields = computed<{ label: string; value: string; wide?: boolean }[]>(() => {
  const row = detail.value
  if (!row) return []
  return [
    { label: c('field_product'), value: row.productName },
    { label: c('field_slug'), value: row.slug },
    { label: c('field_listing'), value: row.listingSlug },
    { label: c('field_url'), value: row.productUrl, wide: true },
    { label: c('field_tagline'), value: row.tagline, wide: true },
    { label: c('field_author'), value: row.author },
    { label: c('field_email'), value: row.email },
    { label: c('field_best_for'), value: row.bestFor || '' },
    { label: c('field_pricing'), value: row.pricingSummary || '' },
    { label: c('field_bio'), value: row.authorBio || '', wide: true },
    { label: c('field_notes'), value: row.reviewNotes || '', wide: true },
    { label: c('field_created'), value: formatDateTime(Number(row.createdAt)) },
    { label: c('field_reviewed'), value: row.reviewedAt ? formatDateTime(Number(row.reviewedAt)) : '' },
  ]
})

function openApprove(row: Item) {
  slugDraft.value = row.slug
  notes.value = row.reviewNotes || ''
  approving.value = row
}

function openReject(row: Item) {
  notes.value = ''
  rejecting.value = row
}

/** One write path for all three decisions the endpoint supports. */
async function review(
  body: { id: string; action: 'approve' | 'reject' | 'unpublish'; slug?: string; notes?: string },
  successKey: keyof typeof COPY,
) {
  if (saving.value) return
  saving.value = true
  try {
    await api.post('/api/admin/spotlights', body)
    toast.success(c(successKey))
    detail.value = null
    approving.value = null
    rejecting.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

function confirmApprove() {
  const row = approving.value
  if (!row) return
  return review(
    { id: row.id, action: 'approve', slug: slugDraft.value.trim(), notes: notes.value },
    'toast_approved',
  )
}

function confirmReject() {
  const row = rejecting.value
  if (!row) return
  return review({ id: row.id, action: 'reject', notes: notes.value }, 'toast_rejected')
}

function unpublish(row: Item) {
  return review({ id: row.id, action: 'unpublish' }, 'toast_unpublished')
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ c('title') }}</h1>
        <p class="text-muted-foreground mt-1">{{ c('description') }}</p>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ c('hint', { pending: stats.pending, live: stats.live, total: stats.total }) }}
          · {{ c('plan_hint') }}
        </p>
      </div>
      <!-- The other door: publish a draft that arrived by email. -->
      <NuxtLink to="/admin/spotlights/new" :class="cn(buttonVariants(), 'gap-1.5')">
        <Plus class="size-3.5" />{{ c('new') }}
      </NuxtLink>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="value in TABS"
        :key="value"
        type="button"
        :class="
          cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === value
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )
        "
        @click="tab = value"
      >
        {{ tabLabel(value) }}
      </button>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          v-model:page="page"
          v-model:search="search"
          :columns="columns"
          :rows="rows"
          :total="total"
          :page-size="PAGE_SIZE"
          :loading="loading"
          :empty-text="c('empty')"
          :search-placeholder="c('search')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-productName="{ row }">
            <div class="min-w-0">
              <button
                type="button"
                class="truncate text-left font-medium hover:underline"
                @click="detail = row"
              >
                {{ row.productName }}
              </button>
              <p class="text-muted-foreground truncate text-xs">
                /spotlights/{{ row.slug }} · {{ c('words', { n: words(row).toLocaleString() }) }}
              </p>
            </div>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="badgeVariant(row)">{{ statusLabel(row) }}</UiBadge>
          </template>

          <template #cell-plan="{ row }">
            <UiBadge v-if="row.plan?.entitled" variant="outline">{{ row.plan.plan }}</UiBadge>
            <UiBadge v-else-if="row.plan" variant="secondary" :title="row.plan.plan">
              {{ c('plan_missing') }}
            </UiBadge>
            <span v-else class="text-muted-foreground text-xs">—</span>
          </template>

          <template #cell-email="{ row }">
            <span class="text-muted-foreground text-sm">{{ row.email || '—' }}</span>
          </template>

          <template #cell-updatedAt="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(Number(row.updatedAt)) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex flex-wrap gap-1">
              <UiButton
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('view')"
                :aria-label="c('view')"
                @click="detail = row"
              >
                <Eye class="size-3" />
              </UiButton>
              <UiButton
                v-if="row.status !== 'approved' || !isLive(row)"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="row.status === 'approved' ? c('republish') : c('approve')"
                :aria-label="row.status === 'approved' ? c('republish') : c('approve')"
                :disabled="saving"
                @click="openApprove(row)"
              >
                <RotateCcw v-if="row.status === 'approved'" class="size-3.5 text-green-600" />
                <Check v-else class="size-3.5 text-green-600" />
              </UiButton>
              <UiButton
                v-if="row.status !== 'rejected'"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('reject')"
                :aria-label="c('reject')"
                :disabled="saving"
                @click="openReject(row)"
              >
                <ThumbsDown class="text-destructive size-3.5" />
              </UiButton>
              <UiButton
                v-if="isLive(row)"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('unpublish')"
                :aria-label="c('unpublish')"
                :disabled="saving"
                @click="unpublish(row)"
              >
                <Undo2 class="size-3.5 text-amber-600" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <!-- Reading the draft is the review. The body renders through the same
         markdown component the public page uses, so what the owner approves is
         what a reader will see — including the nofollow on body links. -->
    <UiDialog :open="!!detail" @update:open="(v: boolean) => !v && (detail = null)">
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ detail?.productName }} · {{ c('detail_title') }}</UiDialogTitle>
          <UiDialogDescription v-if="detail">
            {{ statusLabel(detail) }} · {{ c('words', { n: words(detail).toLocaleString() }) }}
          </UiDialogDescription>
        </UiDialogHeader>

        <dl v-if="detail" class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div v-for="field in detailFields" :key="field.label" :class="field.wide && 'sm:col-span-2'">
            <dt class="text-muted-foreground text-xs">{{ field.label }}</dt>
            <dd class="mt-0.5 break-words whitespace-pre-wrap">{{ field.value || '—' }}</dd>
          </div>
        </dl>

        <section v-if="detail" class="border-border space-y-2 border-t pt-4">
          <UiLabel class="text-sm font-semibold">{{ c('body_label') }}</UiLabel>
          <div class="border-border max-h-[46vh] overflow-y-auto rounded-lg border p-4">
            <MarkdownContent :content="detail.body" />
          </div>
        </section>

        <div v-if="detail" class="flex flex-wrap items-center gap-3">
          <a
            v-if="detail.productUrl"
            :href="detail.productUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            <ExternalLink class="size-3.5" />
            {{ c('field_url') }}
          </a>
          <a
            v-if="isLive(detail)"
            :href="`/spotlights/${detail.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            <ExternalLink class="size-3.5" />
            {{ c('detail_live') }}
          </a>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="detail = null">{{ c('close') }}</UiButton>
          <UiButton
            v-if="detail && (detail.status !== 'approved' || !isLive(detail))"
            :disabled="saving"
            @click="openApprove(detail)"
          >
            {{ detail.status === 'approved' ? c('republish') : c('approve') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Approve: the last cheap moment to change the URL. -->
    <UiDialog :open="!!approving" @update:open="(v: boolean) => !v && (approving = null)">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('approve_title') }} · {{ approving?.productName }}</UiDialogTitle>
          <UiDialogDescription>{{ c('approve_desc') }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="space-y-2">
          <UiLabel>{{ c('slug_label') }}</UiLabel>
          <UiInput v-model="slugDraft" />
          <p class="text-muted-foreground text-xs">
            {{ c('slug_hint', { slug: slugDraft || '…' }) }}
          </p>
        </div>
        <div class="space-y-2">
          <UiLabel>{{ c('approve_notes') }}</UiLabel>
          <UiTextarea v-model="notes" rows="2" :placeholder="c('approve_notes_ph')" />
        </div>
        <UiDialogFooter>
          <UiButton variant="outline" :disabled="saving" @click="approving = null">
            {{ c('cancel') }}
          </UiButton>
          <UiButton :disabled="saving || !slugDraft.trim()" @click="confirmApprove">
            {{ c('approve_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Reject: the notes are the whole value of this dialog. -->
    <UiDialog :open="!!rejecting" @update:open="(v: boolean) => !v && (rejecting = null)">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('reject_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ c('reject_desc') }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="space-y-2">
          <UiLabel>{{ c('reject_notes') }}</UiLabel>
          <UiTextarea v-model="notes" rows="5" :placeholder="c('reject_notes_ph')" />
        </div>
        <UiDialogFooter>
          <UiButton variant="outline" :disabled="saving" @click="rejecting = null">
            {{ c('cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="saving" @click="confirmReject">
            {{ c('reject_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
