<script setup lang="ts">
/**
 * /settings/tickets — source `routes/settings/-tickets-page.tsx`.
 *
 * Structure is the source's: a header with a "New Ticket" action, one card
 * holding a `DataTable` (six columns, 20 rows a page, a status filter and a
 * search box), and the two dialogs — create, and one thread.
 *
 * Four mappings, because the two backends disagree on naming and this page is
 * the only place that should know:
 *
 *   source                      this build
 *   ─────────────────────────   ──────────────────────────────
 *   `pageSize` query param      `limit` + `offset` (no `page`)
 *   `createdAt` / `updatedAt`   `created_at` / `updated_at`, Unix seconds
 *   `latestReply`               `latest_reply`
 *   `messages[].userName`       `messages[].author` (no avatar column)
 *
 * `keepPreviousData` — the source's list does not blank while the next page
 * loads. `useAsyncData` with a *static* key behaves the same way: `data` is
 * only replaced once the new response lands, so paging never flashes the
 * skeleton rows.
 */
import { MessageSquare, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DataColumn } from '~/utils/ui'
import {
  PAGE_SIZE,
  STATUS_BADGE,
  type TicketMessageRow,
  type TicketRow,
  type TicketStatus,
} from '~/utils/tickets-ui'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const { isZh } = useLang()

/** The server's `{ reason, message_zh, message_en }` contract, in one place. */
function errorMessage(error: unknown): string {
  const data = (error as { data?: { message_zh?: string; message_en?: string } })?.data
  if (data?.message_zh || data?.message_en) {
    return (isZh.value ? data.message_zh : data.message_en) || t('common.failed')
  }
  return (error as Error)?.message || t('common.failed')
}

/* ── list ─────────────────────────────────────────────────────────────── */

const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')
const status = ref<TicketStatus | 'all'>('all')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})
onBeforeUnmount(() => clearTimeout(debounceTimer))

watch([debouncedSearch, status], () => {
  page.value = 1
})

const requestFetch = useRequestFetch()

function fetchList() {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page.value - 1) * PAGE_SIZE),
  })
  if (debouncedSearch.value) params.set('keyword', debouncedSearch.value)
  if (status.value !== 'all') params.set('status', status.value)
  return requestFetch<{ items: TicketRow[]; total: number }>(`/api/tickets?${params}`).catch((e) => {
    toast.error(errorMessage(e))
    return { items: [] as TicketRow[], total: 0 }
  })
}

const {
  data: listData,
  refresh: refreshList,
  status: listStatus,
} = await useAsyncData('my-tickets', fetchList, { watch: [page, debouncedSearch, status] })

const rows = computed(() => listData.value?.items ?? [])
const total = computed(() => listData.value?.total ?? 0)
const loading = computed(() => listStatus.value === 'pending')

function setStatus(value: string) {
  status.value = (value as TicketStatus) || 'all'
}

const statusLabel = computed(() =>
  status.value === 'all'
    ? t('settings.tickets.status_all')
    : t(`settings.tickets.status_${status.value}`),
)

const statusOptions = ['open', 'replied', 'closed'] as const

/* ── create dialog ────────────────────────────────────────────────────── */

const createOpen = ref(false)
const title = ref('')
const content = ref('')
const attachments = ref<string[]>([])
const uploading = ref(false)
const uploaderKey = ref(0)
const submitting = ref(false)

function onCreateAttachments({ urls, uploading: busy }: { urls: string[]; uploading: boolean }) {
  attachments.value = urls
  uploading.value = busy
}

async function submitCreate() {
  if (!title.value.trim() || !content.value.trim()) {
    toast.error(t('settings.tickets.required'))
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/tickets', {
      method: 'POST',
      body: { title: title.value, content: content.value, attachments: attachments.value },
    })
    toast.success(t('settings.tickets.create_success'))
    createOpen.value = false
    title.value = ''
    content.value = ''
    attachments.value = []
    uploaderKey.value += 1
    page.value = 1
    refreshList()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    submitting.value = false
  }
}

/* ── detail dialog ────────────────────────────────────────────────────── */

const activeTicket = ref<TicketRow | null>(null)
const messages = ref<TicketMessageRow[]>([])
const reply = ref('')
const replyAttachments = ref<string[]>([])
const replyUploading = ref(false)
const replyUploaderKey = ref(0)
const replying = ref(false)

async function openDetail(row: TicketRow) {
  try {
    const data = await $fetch<{ ticket: TicketRow; messages: TicketMessageRow[] }>(
      `/api/tickets/${row.id}`,
    )
    activeTicket.value = data.ticket
    messages.value = data.messages
    replyAttachments.value = []
    replyUploaderKey.value += 1
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function onReplyAttachments({ urls, uploading: busy }: { urls: string[]; uploading: boolean }) {
  replyAttachments.value = urls
  replyUploading.value = busy
}

async function submitReply() {
  if (!activeTicket.value || !reply.value.trim()) return
  replying.value = true
  try {
    await $fetch(`/api/tickets/${activeTicket.value.id}`, {
      method: 'POST',
      body: { content: reply.value, attachments: replyAttachments.value },
    })
    reply.value = ''
    await openDetail(activeTicket.value)
    refreshList()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    replying.value = false
  }
}

async function closeTicket() {
  if (!activeTicket.value) return
  try {
    await $fetch(`/api/tickets/${activeTicket.value.id}`, {
      method: 'PATCH',
      body: { status: 'closed' },
    })
    toast.success(t('settings.tickets.close_success'))
    activeTicket.value = null
    refreshList()
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

/* ── columns ──────────────────────────────────────────────────────────── */

/** `new Date(r.createdAt).toLocaleString()`, from Unix seconds. */
function stamp(seconds: number) {
  return new Date(seconds * 1000).toLocaleString()
}

const columns = computed<DataColumn[]>(() => [
  { key: 'created', header: t('settings.tickets.created_col'), class: 'w-[160px]' },
  { key: 'title', header: t('settings.tickets.title_col') },
  { key: 'latestReply', header: t('settings.tickets.latest_reply_col') },
  { key: 'updated', header: t('settings.tickets.updated_col'), class: 'w-[160px]' },
  { key: 'status', header: t('settings.tickets.status_col'), class: 'w-[120px]' },
  { key: 'actions', header: t('settings.tickets.actions_col'), class: 'w-[80px]' },
])

useHead({
  title: computed(() => `${t('settings.tickets.title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <SettingsFeatureGate feature="tickets">
    <div class="space-y-6 p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ t('settings.tickets.title') }}</h1>
        <p class="text-muted-foreground">{{ t('settings.tickets.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="createOpen = true">
        <Plus class="size-4" />
        {{ t('settings.tickets.create_button') }}
      </UiButton>
    </div>

    <UiCard>
      <UiCardContent>
        <DataTable
          :columns="columns"
          :rows="rows"
          :total="total"
          :page="page"
          :page-size="PAGE_SIZE"
          :search="search"
          :loading="loading"
          :empty-text="t('settings.tickets.empty')"
          show-refresh
          has-toolbar
          @update:page="(p: number) => (page = p)"
          @update:search="(v: string) => (search = v)"
          @refresh="refreshList()"
        >
          <template #toolbar>
            <UiSelect :model-value="status" @update:model-value="setStatus">
              <UiSelectTrigger class="h-9 w-[130px]">
                <UiSelectValue :text="statusLabel" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">{{ t('settings.tickets.status_all') }}</UiSelectItem>
                <UiSelectItem v-for="st in statusOptions" :key="st" :value="st">
                  {{ t(`settings.tickets.status_${st}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </template>

          <template #cell-created="{ row }">
            <span class="text-muted-foreground">{{ stamp(row.created_at) }}</span>
          </template>

          <template #cell-title="{ row }">
            <button class="text-left font-medium hover:underline" @click="openDetail(row)">
              {{ row.title }}
            </button>
          </template>

          <template #cell-latestReply="{ row }">
            <span class="block max-w-[280px] truncate text-muted-foreground">
              {{ row.latest_reply || '—' }}
            </span>
          </template>

          <template #cell-updated="{ row }">
            <span class="text-muted-foreground">{{ stamp(row.updated_at) }}</span>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="STATUS_BADGE[row.status as TicketStatus]">
              {{ t(`settings.tickets.status_${row.status}`) }}
            </UiBadge>
          </template>

          <template #cell-actions="{ row }">
            <UiButton variant="ghost" size="icon" class="size-7" @click="openDetail(row)">
              <MessageSquare class="size-4" />
            </UiButton>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <SettingsTicketsDialogs
      v-model:create-open="createOpen"
      v-model:title="title"
      v-model:content="content"
      v-model:reply="reply"
      :active-ticket="activeTicket"
      :messages="messages"
      :uploader-key="uploaderKey"
      :reply-uploader-key="replyUploaderKey"
      :uploading="uploading"
      :reply-uploading="replyUploading"
      :submitting="submitting"
      :replying="replying"
      @attachments="onCreateAttachments"
      @reply-attachments="onReplyAttachments"
      @submit-create="submitCreate"
      @submit-reply="submitReply"
      @close-ticket="closeTicket"
      @close-detail="activeTicket = null"
    />
    </div>
  </SettingsFeatureGate>
</template>
