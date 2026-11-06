<script setup lang="ts">
/**
 * /admin/submissions — the review queue behind `/submit`.
 *
 * This is NOT a port of a source page. The source reviews community listings in
 * `/admin/directory/tools`, which reads `dir_tool`; this build's `/submit`
 * still writes the older `submissions` table, so the two never meet. This page
 * is the UI for that queue:
 *
 *   GET  /api/admin/submissions           queue + stats
 *   POST /api/admin/review                approve / reject / payment
 *   POST /api/admin/submission-detail     the operator's editorial copy
 *
 * The detail editor is the only added write path, and it touches only editorial
 * columns — not status, payment, mail or "My submissions". The shared source
 * copy table
 * (`shared/content/settings-i18n.ts`) is left untouched too: the strings this
 * queue needs do not exist in the source, so they live in the local `COPY`
 * dictionary below rather than being added to a generated mirror.
 *
 * Authorisation is the same as every other console page: the server middleware
 * answers 404 to any request without the owner cookie before this layout runs.
 */
definePageMeta({ layout: 'admin' })

import { Check, Eye, ExternalLink, Minus, Pencil, Plus, ThumbsDown, Wallet } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import type { DetailBlock } from '~~/shared/types/catalog'

type Row = {
  id: string
  slug: string
  name: string
  url: string
  domain: string
  short: string
  category: string
  tags: string[]
  email: string
  maker: string
  logo: string
  long_desc: string
  plan: string
  slot: string
  status: 'pending' | 'approved' | 'rejected'
  awaiting_payment: boolean
  paid_at: number | null
  created_at: number
  updated_at: number
  notes: string
  detail_en: DetailBlock
  detail_zh: DetailBlock
  shots: string[]
}

type Stats = {
  total: number
  pending: number
  approved: number
  rejected: number
  awaiting_payment: number
}

type Tab = 'all' | 'pending' | 'approved' | 'rejected'

const COPY = {
  title: { zh: '提交审核', en: 'Submissions' },
  description: {
    zh: '审核用户从 /submit 提交的应用。通过后前台立即可见；拒绝会保留记录并通知提交者。',
    en: 'Review listings submitted through /submit. Approving publishes them immediately; rejecting keeps the record and emails the submitter.',
  },
  hint: {
    zh: '待审核 {pending} 条 · 待确认收款 {awaiting} 条',
    en: '{pending} awaiting review · {awaiting} awaiting payment confirmation',
  },
  paid_hint: {
    zh: '付费档必须确认收款后才能上线，直接点「通过」会被拒绝。',
    en: 'Paid tiers can only be published by confirming payment; approving one outright is refused.',
  },
  tab_all: { zh: '全部', en: 'All' },
  tab_pending: { zh: '待审核', en: 'Pending' },
  tab_approved: { zh: '已通过', en: 'Approved' },
  tab_rejected: { zh: '已拒绝', en: 'Rejected' },
  status_pending: { zh: '待审核', en: 'Pending' },
  status_approved: { zh: '已上线', en: 'Published' },
  status_rejected: { zh: '已拒绝', en: 'Rejected' },
  status_awaiting_payment: { zh: '待收款', en: 'Awaiting payment' },
  col_name: { zh: '应用', en: 'Tool' },
  col_plan: { zh: '方案', en: 'Plan' },
  col_status: { zh: '状态', en: 'Status' },
  col_email: { zh: '邮箱', en: 'Email' },
  col_created: { zh: '提交时间', en: 'Submitted' },
  col_actions: { zh: '操作', en: 'Actions' },
  empty: { zh: '暂无提交', en: 'No submissions' },
  search: { zh: '搜索名称、网址或邮箱…', en: 'Search name, URL or email…' },
  view: { zh: '查看详情', en: 'View details' },
  approve: { zh: '通过并上线', en: 'Approve & publish' },
  reject: { zh: '拒绝', en: 'Reject' },
  confirm_payment: { zh: '确认收款并上线', en: 'Confirm payment' },
  toast_approved: { zh: '已通过，条目已上线', en: 'Approved and published' },
  toast_rejected: { zh: '已拒绝，记录已保留', en: 'Rejected; record kept' },
  toast_payment: { zh: '已确认收款并上线', en: 'Payment confirmed; listing published' },
  detail_title: { zh: '提交详情', en: 'Submission details' },
  reject_title: { zh: '拒绝这条提交？', en: 'Reject this submission?' },
  reject_desc: {
    zh: '记录会保留，同域名不能静默重复提交。填写的原因会随拒绝邮件发给提交者。',
    en: 'The record is kept and the same domain cannot silently re-submit. A reason, if you write one, goes into the rejection email.',
  },
  reject_notes: { zh: '拒绝原因（可选）', en: 'Reason (optional)' },
  reject_notes_ph: { zh: '告诉提交者需要修改什么', en: 'Tell the submitter what to fix' },
  reject_confirm: { zh: '确认拒绝', en: 'Reject' },
  payment_title: { zh: '确认已收款', en: 'Confirm payment received' },
  payment_desc: {
    zh: '只在钱确实到账后操作。这一步会直接上线并给提交者发收款确认邮件，不经过编辑审核。',
    en: 'Only after the money has actually arrived. This publishes the listing immediately and emails a payment receipt, skipping editorial review.',
  },
  payment_ref: { zh: '收款参考号（可选）', en: 'Payment reference (optional)' },
  payment_ref_ph: { zh: '发票号 / 交易号', en: 'Invoice or transaction id' },
  payment_confirm: { zh: '确认收款', en: 'Confirm payment' },
  cancel: { zh: '取消', en: 'Cancel' },
  close: { zh: '关闭', en: 'Close' },
  visit_website: { zh: '打开网站', en: 'Open website' },
  field_name: { zh: '名称', en: 'Name' },
  field_website: { zh: '网址', en: 'Website' },
  field_domain: { zh: '域名', en: 'Domain' },
  field_category: { zh: '分类', en: 'Category' },
  field_tags: { zh: '标签', en: 'Tags' },
  field_email: { zh: '联系邮箱', en: 'Contact email' },
  field_maker: { zh: '提交者 / 团队', en: 'Maker' },
  field_plan: { zh: '方案', en: 'Plan' },
  field_slot: { zh: '广告位', en: 'Ad slot' },
  field_short: { zh: '简介', en: 'Tagline' },
  field_long: { zh: '详细介绍', en: 'Description' },
  field_notes: { zh: '审核备注', en: 'Review notes' },
  field_created: { zh: '提交时间', en: 'Submitted at' },
  field_paid: { zh: '收款时间', en: 'Paid at' },
  edit_detail: { zh: '编辑详情', en: 'Edit details' },
  detail_editor_title: { zh: '编辑产品详情', en: 'Edit listing details' },
  detail_editor_desc: {
    zh: '这里的内容会显示在产品详情页，留空的分区自动隐藏。保存不会改变审核状态，也不会发邮件。',
    en: 'This copy appears on the public detail page; empty sections are hidden. Saving does not change the review status or send mail.',
  },
  detail_lang_zh: { zh: '中文', en: 'Chinese' },
  detail_lang_en: { zh: '英文', en: 'English' },
  detail_lang_note: {
    zh: '没填中文时，中文页回退显示英文内容。',
    en: 'An empty Chinese block falls back to the English copy.',
  },
  shots_label: { zh: '产品截图', en: 'Screenshots' },
  shots_hint: {
    zh: '一行一张：填完整图片网址（https://…），或 public/assets/img/screenshots 下的文件名。最多 8 张。',
    en: 'One per row: an absolute image URL or a filename under public/assets/img/screenshots. Up to 8.',
  },
  shots_ph: { zh: 'https://… 或 screenshot-1.png', en: 'https://… or screenshot-1.png' },
  add_shot: { zh: '添加一张截图', en: 'Add a screenshot' },
  save_detail: { zh: '保存详情', en: 'Save details' },
  toast_detail_saved: { zh: '详情已保存', en: 'Details saved' },
} as const

/**
 * The console is owner-only and always Chinese. `/admin` resolves to the
 * English locale under `prefix_except_default`, so `pick()` rendered the
 * English half even for the Chinese site owner. The dictionary stays bilingual
 * (the English strings document intent), but this page always renders `zh`.
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
const SUBMISSIONS_PAGE_SIZE = 20
const ZERO_STATS: Stats = { total: 0, pending: 0, approved: 0, rejected: 0, awaiting_payment: 0 }

const tab = ref<Tab>('all')
const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const saving = ref(false)

const detail = ref<Row | null>(null)
const rejecting = ref<Row | null>(null)
const paying = ref<Row | null>(null)
const notes = ref('')
const paymentRef = ref('')

const EMPTY_DETAIL: DetailBlock = {
  how_to_use: [],
  features: [],
  use_cases: [],
  pros: [],
  cons: [],
  faqs: [],
}

type DetailDraft = { detail_en: DetailBlock; detail_zh: DetailBlock; shots: string[] }

const editing = ref<Row | null>(null)
const editLang = ref<'zh' | 'en'>('zh')
const editSaving = ref(false)
const draft = ref<DetailDraft>({
  detail_en: { ...EMPTY_DETAIL },
  detail_zh: { ...EMPTY_DETAIL },
  shots: [],
})

function openDetailEditor(row: Row) {
  // Structured clone: editing must not mutate the row the table is rendering.
  draft.value = JSON.parse(
    JSON.stringify({
      detail_en: row.detail_en ?? EMPTY_DETAIL,
      detail_zh: row.detail_zh ?? EMPTY_DETAIL,
      shots: row.shots ?? [],
    }),
  ) as DetailDraft
  editLang.value = 'zh'
  editing.value = row
}

/** Editorial copy is its own write path; save never approves, rejects or mails. */
async function saveDetail() {
  const row = editing.value
  if (!row || editSaving.value) return
  editSaving.value = true
  try {
    await api.post('/api/admin/submission-detail', {
      id: row.id,
      detail_en: draft.value.detail_en,
      detail_zh: draft.value.detail_zh,
      shots: draft.value.shots,
    })
    toast.success(c('toast_detail_saved'))
    editing.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    editSaving.value = false
  }
}

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
  pageQuery('/api/admin/submissions', { status: tab.value === 'all' ? undefined : tab.value }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{
  ok: boolean
  items: Row[]
  stats: Stats
}>(
  'admin-submissions',
  () => api.get<{ ok: boolean; items: Row[]; stats: Stats }>(listUrl.value),
  {
    watch: [listUrl],
    default: () => ({ ok: false, items: [] as Row[], stats: { ...ZERO_STATS } }),
  },
)

const stats = computed(() => data.value?.stats ?? ZERO_STATS)
const allRows = computed(() => data.value?.items ?? [])
const filtered = computed(() => {
  const needle = debouncedSearch.value.trim().toLowerCase()
  if (!needle) return allRows.value
  return allRows.value.filter((row) =>
    [row.name, row.slug, row.url, row.domain, row.email].some((value) =>
      String(value ?? '').toLowerCase().includes(needle),
    ),
  )
})
const total = computed(() => filtered.value.length)
const rows = computed(() =>
  filtered.value.slice(
    (page.value - 1) * SUBMISSIONS_PAGE_SIZE,
    page.value * SUBMISSIONS_PAGE_SIZE,
  ),
)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'name', header: c('col_name') },
  { key: 'plan', header: c('col_plan'), class: 'w-[110px]' },
  { key: 'status', header: c('col_status'), class: 'w-[130px]' },
  { key: 'email', header: c('col_email'), class: 'hidden md:table-cell' },
  { key: 'created_at', header: c('col_created'), class: 'hidden xl:table-cell w-[170px]' },
  { key: 'actions', header: c('col_actions'), class: 'w-[190px]' },
])

function statusKey(row: Row): keyof typeof COPY {
  if (row.status === 'approved') return 'status_approved'
  if (row.status === 'rejected') return 'status_rejected'
  if (row.awaiting_payment) return 'status_awaiting_payment'
  return 'status_pending'
}

function badgeVariant(row: Row): 'default' | 'secondary' | 'outline' {
  if (row.status === 'approved') return 'default'
  if (row.status === 'rejected') return 'secondary'
  return 'outline'
}

const detailFields = computed<{ label: string; value: string; wide?: boolean }[]>(() => {
  const row = detail.value
  if (!row) return []
  return [
    { label: c('field_name'), value: row.name },
    { label: c('field_website'), value: row.url, wide: true },
    { label: c('field_domain'), value: row.domain },
    { label: c('field_category'), value: row.category },
    { label: c('field_tags'), value: (row.tags ?? []).join(', ') },
    { label: c('field_plan'), value: row.plan },
    { label: c('field_slot'), value: row.slot },
    { label: c('field_email'), value: row.email },
    { label: c('field_maker'), value: row.maker },
    { label: c('field_short'), value: row.short, wide: true },
    { label: c('field_long'), value: row.long_desc, wide: true },
    { label: c('field_notes'), value: row.notes, wide: true },
    { label: c('field_created'), value: formatDateTime(Number(row.created_at)) },
    { label: c('field_paid'), value: row.paid_at ? formatDateTime(Number(row.paid_at)) : '' },
  ]
})

function openReject(row: Row) {
  notes.value = ''
  rejecting.value = row
}

function openPayment(row: Row) {
  paymentRef.value = ''
  paying.value = row
}

/** One write path for all three actions the review endpoint already supports. */
async function review(
  body: { id: string; action: 'approve' | 'reject' | 'payment'; notes?: string; ref?: string },
  successKey: keyof typeof COPY,
) {
  if (saving.value) return
  saving.value = true
  try {
    await api.post('/api/admin/review', body)
    toast.success(c(successKey))
    detail.value = null
    rejecting.value = null
    paying.value = null
    notes.value = ''
    paymentRef.value = ''
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

function approve(row: Row) {
  return review({ id: row.id, action: 'approve' }, 'toast_approved')
}

function confirmReject() {
  const row = rejecting.value
  if (!row) return
  return review({ id: row.id, action: 'reject', notes: notes.value }, 'toast_rejected')
}

function confirmPayment() {
  const row = paying.value
  if (!row) return
  return review({ id: row.id, action: 'payment', ref: paymentRef.value }, 'toast_payment')
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ c('title') }}</h1>
      <p class="text-muted-foreground mt-1">{{ c('description') }}</p>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ c('hint', { pending: stats.pending, awaiting: stats.awaiting_payment }) }}
        · {{ c('paid_hint') }}
      </p>
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
          :page-size="SUBMISSIONS_PAGE_SIZE"
          :loading="loading"
          :empty-text="c('empty')"
          :search-placeholder="c('search')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-name="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <SettingsListIcon :src="row.logo" :alt="row.name" :size="28" />
              <div class="min-w-0">
                <button
                  type="button"
                  class="truncate text-left font-medium hover:underline"
                  @click="detail = row"
                >
                  {{ row.name }}
                </button>
                <p class="text-muted-foreground truncate text-xs">{{ row.slug }}</p>
              </div>
            </div>
          </template>

          <template #cell-plan="{ row }">
            <UiBadge variant="outline">{{ row.plan }}</UiBadge>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="badgeVariant(row)">{{ c(statusKey(row)) }}</UiBadge>
          </template>

          <template #cell-email="{ row }">
            <span class="text-muted-foreground text-sm">{{ row.email || '—' }}</span>
          </template>

          <template #cell-created_at="{ row }">
            <span class="text-muted-foreground text-sm">{{ formatDateTime(Number(row.created_at)) }}</span>
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
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('edit_detail')"
                :aria-label="c('edit_detail')"
                @click="openDetailEditor(row)"
              >
                <Pencil class="size-3.5" />
              </UiButton>
              <UiButton
                v-if="row.status === 'pending' && !row.awaiting_payment"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('approve')"
                :aria-label="c('approve')"
                :disabled="saving"
                @click="approve(row)"
              >
                <Check class="size-3.5 text-green-600" />
              </UiButton>
              <UiButton
                v-if="row.status === 'pending'"
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
                v-if="row.awaiting_payment && !row.paid_at"
                variant="ghost"
                size="icon"
                class="size-7"
                :title="c('confirm_payment')"
                :aria-label="c('confirm_payment')"
                :disabled="saving"
                @click="openPayment(row)"
              >
                <Wallet class="size-3.5 text-amber-600" />
              </UiButton>
            </div>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <!-- Details: everything the admin payload carries, nothing invented. -->
    <UiDialog :open="!!detail" @update:open="(v: boolean) => !v && (detail = null)">
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('detail_title') }}</UiDialogTitle>
        </UiDialogHeader>
        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div v-for="field in detailFields" :key="field.label" :class="field.wide && 'sm:col-span-2'">
            <dt class="text-muted-foreground text-xs">{{ field.label }}</dt>
            <dd class="mt-0.5 break-words whitespace-pre-wrap">{{ field.value || '—' }}</dd>
          </div>
        </dl>
        <a
          v-if="detail?.url"
          :href="detail.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <ExternalLink class="size-3.5" />
          {{ c('visit_website') }}
        </a>
        <UiDialogFooter>
          <UiButton variant="outline" @click="detail = null">{{ c('close') }}</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Editorial copy: six sections per language plus the screenshot list.
         The dialog is the only way this page writes to the listing. -->
    <UiDialog :open="!!editing" @update:open="(v: boolean) => !v && (editing = null)">
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('detail_editor_title') }} · {{ editing?.name }}</UiDialogTitle>
          <UiDialogDescription>{{ c('detail_editor_desc') }}</UiDialogDescription>
        </UiDialogHeader>

        <div class="flex flex-wrap items-center gap-2">
          <UiButton
            :variant="editLang === 'zh' ? 'default' : 'outline'"
            size="sm"
            type="button"
            @click="editLang = 'zh'"
          >
            {{ c('detail_lang_zh') }}
          </UiButton>
          <UiButton
            :variant="editLang === 'en' ? 'default' : 'outline'"
            size="sm"
            type="button"
            @click="editLang = 'en'"
          >
            {{ c('detail_lang_en') }}
          </UiButton>
          <span class="text-muted-foreground ml-auto text-xs">{{ c('detail_lang_note') }}</span>
        </div>

        <AdminSubmissionDetailEditor v-if="editLang === 'zh'" v-model="draft.detail_zh" />
        <AdminSubmissionDetailEditor v-else v-model="draft.detail_en" />

        <section class="space-y-2 border-t border-border pt-4">
          <UiLabel class="text-sm font-semibold">{{ c('shots_label') }}</UiLabel>
          <p class="text-muted-foreground text-xs">{{ c('shots_hint') }}</p>
          <div v-for="(_shot, index) in draft.shots" :key="index" class="flex items-start gap-2">
            <UiInput v-model="draft.shots[index]" :placeholder="c('shots_ph')" class="flex-1" />
            <UiButton
              variant="ghost"
              size="icon"
              class="size-8 shrink-0"
              type="button"
              :aria-label="`删除第 ${index + 1} 张截图`"
              @click="draft.shots.splice(index, 1)"
            >
              <Minus class="size-3.5" />
            </UiButton>
          </div>
          <UiButton
            variant="outline"
            size="sm"
            type="button"
            :disabled="draft.shots.length >= 8"
            @click="draft.shots.push('')"
          >
            <Plus class="mr-1 size-3.5" />{{ c('add_shot') }}
          </UiButton>
        </section>

        <UiDialogFooter>
          <UiButton variant="outline" :disabled="editSaving" @click="editing = null">
            {{ c('cancel') }}
          </UiButton>
          <UiButton :disabled="editSaving" @click="saveDetail">
            {{ c('save_detail') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Reject: notes are optional but are what the rejection email carries. -->
    <UiDialog :open="!!rejecting" @update:open="(v: boolean) => !v && (rejecting = null)">
      <UiDialogContent class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('reject_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ c('reject_desc') }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="space-y-2">
          <UiLabel>{{ c('reject_notes') }}</UiLabel>
          <UiTextarea v-model="notes" rows="4" :placeholder="c('reject_notes_ph')" />
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

    <!-- Payment: the only way a paid tier goes live in this build. -->
    <UiDialog :open="!!paying" @update:open="(v: boolean) => !v && (paying = null)">
      <UiDialogContent class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>{{ c('payment_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ c('payment_desc') }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="space-y-2">
          <UiLabel>{{ c('payment_ref') }}</UiLabel>
          <UiInput v-model="paymentRef" :placeholder="c('payment_ref_ph')" />
        </div>
        <UiDialogFooter>
          <UiButton variant="outline" :disabled="saving" @click="paying = null">
            {{ c('cancel') }}
          </UiButton>
          <UiButton :disabled="saving" @click="confirmPayment">
            {{ c('payment_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
