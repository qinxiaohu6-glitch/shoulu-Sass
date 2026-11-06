<script setup lang="ts">
/**
 * /admin/tickets — source `shipany-dir/src/routes/admin/-tickets-page.tsx`.
 *
 * Four tabs, seven columns, and a detail dialog with the whole thread, a reply
 * box (with image attachments) and the close / reopen switch.
 *
 * The data is real: `ticket` and `ticket_message` exist in this build, so the
 * endpoints map this schema onto the source's camelCase rows rather than
 * answering empty. `?id=` opens a ticket directly, because that is the link the
 * "new ticket" notification mails.
 */
definePageMeta({ layout: 'admin' })

import { MessageSquare } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import { uploaderState } from '~/utils/tickets-ui'
import type { ImageUploaderValue } from '~/utils/image-upload'
import {
  ADMIN_TICKETS_PAGE_SIZE,
  ADMIN_TICKET_TABS,
  ticketStatusVariant,
  type AdminTicketMessageRow,
  type AdminTicketRow,
  type AdminTicketTab,
  type TicketStatus,
} from '~/utils/admin-tickets-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const page = ref(1)
const tab = ref<AdminTicketTab>('all')
const search = ref('')
const debouncedSearch = ref('')

const activeTicket = ref<AdminTicketRow | null>(null)
const messages = ref<AdminTicketMessageRow[]>([])
const reply = ref('')
const replyAttachments = ref<string[]>([])
const replyUploading = ref(false)
const replyUploaderKey = ref(0)
const replying = ref(false)

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

const listParams = computed(() =>
  pageQuery('/api/admin/tickets', {
    page: page.value,
    pageSize: ADMIN_TICKETS_PAGE_SIZE,
    status: tab.value === 'all' ? undefined : tab.value,
    keyword: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: AdminTicketRow[]; total: number }>(
  'admin-tickets',
  () => api.get<{ items: AdminTicketRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'created', header: t('admin.tickets.created_col'), class: 'w-[160px]' },
  { key: 'title', header: t('admin.tickets.title_col') },
  { key: 'user', header: t('admin.tickets.user_col') },
  { key: 'latest', header: t('admin.tickets.latest_reply_col') },
  { key: 'updated', header: t('admin.tickets.updated_col'), class: 'w-[160px]' },
  { key: 'status', header: t('admin.tickets.status_col'), class: 'w-[120px]' },
  { key: 'actions', header: t('admin.tickets.actions_col'), class: 'w-[80px]' },
])

async function openDetail(row: Pick<AdminTicketRow, 'id'>) {
  try {
    const data = await api.get<{ ticket: AdminTicketRow; messages: AdminTicketMessageRow[] }>(
      `/api/admin/tickets/${row.id}`,
    )
    activeTicket.value = { ...(row as AdminTicketRow), ...data.ticket }
    messages.value = data.messages
    replyAttachments.value = []
    replyUploaderKey.value += 1
  } catch (error) {
    toast.error((error as Error).message)
  }
}

// `?id=` opens that ticket's detail dialog (deep links from notifications).
const deepLinkId = typeof route.query.id === 'string' ? route.query.id : ''
if (deepLinkId) await openDetail({ id: deepLinkId })

async function submitReply() {
  const ticket = activeTicket.value
  if (!ticket || !reply.value.trim()) return
  replying.value = true
  try {
    await api.post(`/api/admin/tickets/${ticket.id}`, {
      content: reply.value,
      attachments: replyAttachments.value,
    })
    toast.success(t('admin.tickets.reply_success'))
    reply.value = ''
    await openDetail(ticket)
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    replying.value = false
  }
}

async function setStatus(status: TicketStatus) {
  const ticket = activeTicket.value
  if (!ticket) return
  try {
    await api.patch(`/api/admin/tickets/${ticket.id}`, { status })
    toast.success(t('admin.tickets.status_updated'))
    activeTicket.value = { ...ticket, status }
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  }
}

function onAttachments(items: ImageUploaderValue[]) {
  const { urls, uploading } = uploaderState(items)
  replyAttachments.value = urls
  replyUploading.value = uploading
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.tickets.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.tickets.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in ADMIN_TICKET_TABS"
        :key="tb"
        type="button"
        :class="
          cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === tb
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )
        "
        @click="tab = tb"
      >
        {{ t(`admin.tickets.tab_${tb}`) }}
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
          :page-size="ADMIN_TICKETS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.tickets.empty')"
          :search-placeholder="t('admin.tickets.search_placeholder')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-created="{ row }">
            <span class="text-muted-foreground">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-title="{ row }">
            <button
              type="button"
              class="text-left font-medium hover:underline"
              @click="openDetail(row)"
            >
              {{ row.title }}
            </button>
          </template>

          <template #cell-user="{ row }">
            <AdminUserCell
              :user-id="row.userId"
              :name="row.userName"
              :email="row.userEmail"
              :image="row.userAvatar"
            />
          </template>

          <template #cell-latest="{ row }">
            <span class="text-muted-foreground block max-w-[280px] truncate">
              {{ row.latestReply || '—' }}
            </span>
          </template>

          <template #cell-updated="{ row }">
            <span class="text-muted-foreground">{{ formatDateTime(row.updatedAt) }}</span>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :variant="ticketStatusVariant(row.status)">
              {{ t(`admin.tickets.status_${row.status}`) }}
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

    <!-- Detail -->
    <UiDialog :open="!!activeTicket" @update:open="(v: boolean) => !v && (activeTicket = null)">
      <UiDialogContent class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle class="flex items-center gap-2">
            {{ activeTicket?.title }}
            <UiBadge v-if="activeTicket" :variant="ticketStatusVariant(activeTicket.status)">
              {{ t(`admin.tickets.status_${activeTicket.status}`) }}
            </UiBadge>
          </UiDialogTitle>
          <NuxtLink
            v-if="activeTicket"
            :to="`/admin/users/${activeTicket.userId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="text-muted-foreground flex w-fit items-center gap-1.5 text-sm hover:underline"
          >
            <UiAvatar class="size-5">
              <UiAvatarImage :src="activeTicket.userAvatar || undefined" :fallback="(activeTicket.userName || 'U').charAt(0).toUpperCase()" fallback-class="text-[10px]" />
            </UiAvatar>
            {{ activeTicket.userName || '—' }} · {{ activeTicket.userEmail }}
          </NuxtLink>
        </UiDialogHeader>

        <div class="max-h-[50vh] space-y-3 overflow-y-auto py-2">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="
              cn(
                'rounded-lg p-3 text-sm',
                msg.role === 'admin' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8',
              )
            "
          >
            <div class="mb-1 flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-xs font-medium">
                <UiAvatar v-if="msg.role === 'user'" class="size-5">
                  <UiAvatarImage :src="msg.userAvatar || undefined" :fallback="(msg.userName || 'U').charAt(0).toUpperCase()" fallback-class="text-[10px]" />
                </UiAvatar>
                {{ msg.userName || (msg.role === 'admin' ? t('admin.tickets.admin') : '—') }}
                <UiBadge v-if="msg.role === 'admin'" variant="secondary" class="px-1 py-0 text-[10px]">
                  {{ t('admin.tickets.admin') }}
                </UiBadge>
              </span>
              <span class="text-muted-foreground text-xs">{{ formatDateTime(msg.createdAt) }}</span>
            </div>
            <p class="whitespace-pre-wrap">{{ msg.content }}</p>
            <div v-if="msg.attachments.length" class="mt-2 flex flex-wrap gap-2">
              <a
                v-for="(url, i) in msg.attachments"
                :key="`${url}-${i}`"
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  :src="url"
                  alt=""
                  class="border-border size-16 rounded-md border object-cover transition-opacity hover:opacity-80"
                />
              </a>
            </div>
          </div>
        </div>

        <form class="space-y-3" @submit.prevent.stop="submitReply">
          <template v-if="activeTicket?.status !== 'closed'">
            <UiTextarea
              v-model="reply"
              :maxlength="5000"
              :rows="3"
              :placeholder="t('admin.tickets.reply_placeholder')"
            />
            <ImageUploader
              :key="replyUploaderKey"
              allow-multiple
              :max-images="9"
              @change="onAttachments"
            />
          </template>
          <UiDialogFooter>
            <template v-if="activeTicket?.status !== 'closed'">
              <UiButton type="button" variant="outline" @click="setStatus('closed')">
                {{ t('admin.tickets.close_ticket') }}
              </UiButton>
              <UiButton
                type="submit"
                :disabled="replying || replyUploading || !reply.trim()"
              >
                {{ replying ? t('admin.tickets.replying') : t('admin.tickets.reply_submit') }}
              </UiButton>
            </template>
            <UiButton v-else type="button" variant="outline" @click="setStatus('open')">
              {{ t('admin.tickets.reopen_ticket') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
