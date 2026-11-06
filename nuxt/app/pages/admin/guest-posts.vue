<script setup lang="ts">
/**
 * /admin/guest-posts — source `shipany-dir/src/routes/admin/guest-posts.tsx`.
 *
 * Six tabs, seven columns, and a review dialog opened from the title, the eye
 * icon, or `?id=` (deep links from bot notifications).
 *
 * This build sells no guest-post packages, so the queue is empty and every
 * write in the review panel says why nothing happened. See
 * `server/api/admin/guest-posts/`.
 */
definePageMeta({ layout: 'admin' })

import { Eye } from 'lucide-vue-next'
import { cn, type DataColumn } from '~/utils/ui'
import {
  GUEST_POST_TABS,
  GUEST_POSTS_PAGE_SIZE,
  type GuestPostInfo,
  type GuestPostRow,
  type GuestPostTab,
} from '~/utils/guest-posts-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const tab = ref<GuestPostTab>('all')
const page = ref(1)
const search = ref('')
const debounced = ref('')
const openId = ref<string | null>(null)

/** `?id=` opens that submission (deep links from bot notifications). */
const deepLinkId = typeof route.query.id === 'string' ? route.query.id : ''
if (deepLinkId) openId.value = deepLinkId

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    debounced.value = value
  }, 300)
})

watch([debounced, tab], () => {
  page.value = 1
})

const { data: info } = await useAsyncData<GuestPostInfo>(
  'guest-post-info',
  () => api.get<GuestPostInfo>('/api/guest-posts/info'),
  { default: () => ({ enabled: false, minWords: 0, packages: [] }) },
)

const listParams = computed(
  () =>
    pageQuery('/api/admin/guest-posts', {
      page: page.value,
      pageSize: GUEST_POSTS_PAGE_SIZE,
      search: debounced.value,
    }) + (tab.value === 'all' ? '' : `&status=${tab.value}`),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: GuestPostRow[]; total: number }>(
  'admin-guest-posts',
  () => api.get<{ items: GuestPostRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'title', header: t('admin.guest_posts.title_col') },
  { key: 'author', header: t('admin.guest_posts.author_col') },
  { key: 'package', header: t('guest_posts.package_col'), class: 'w-[170px]' },
  { key: 'status', header: t('admin.guest_posts.status_col'), class: 'w-[130px]' },
  { key: 'note', header: t('guest_posts.review_note'), class: 'min-w-[220px]' },
  { key: 'updated', header: t('admin.guest_posts.updated_col'), class: 'w-[170px]' },
  { key: 'actions', header: t('admin.guest_posts.actions_col'), class: 'w-[80px]' },
])

function tabLabel(tb: GuestPostTab) {
  return tb === 'all' ? t('admin.guest_posts.tab_all') : t(`guest_posts.status_${tb}`)
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.guest_posts.title') }}</h1>
      <p class="text-muted-foreground">{{ t('admin.guest_posts.description') }}</p>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in GUEST_POST_TABS"
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
        {{ tabLabel(tb) }}
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
          :page-size="GUEST_POSTS_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.guest_posts.empty')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-title="{ row }">
            <div class="min-w-0">
              <button
                type="button"
                class="text-left font-medium hover:underline"
                @click="openId = row.id"
              >
                {{ row.title || '—' }}
              </button>
              <AdminGuestPostArticleUrl :slug="row.slug" :status="row.status" />
            </div>
          </template>

          <template #cell-author="{ row }">
            <AdminUserCell
              v-if="row.userId"
              :user-id="row.userId"
              :name="row.userName"
              :email="row.userEmail"
              :image="row.userAvatar"
            />
            <span v-else>—</span>
          </template>

          <template #cell-package="{ row }">
            <AdminGuestPostPackageCell
              :product-id="row.productId"
              :packages="info?.packages"
            />
          </template>

          <template #cell-status="{ row }">
            <AdminGuestPostStatusBadge :status="row.status" />
          </template>

          <template #cell-note="{ row }">
            <AdminGuestPostReviewNoteCell :status="row.status" :note="row.reviewNote" />
          </template>

          <template #cell-updated="{ row }">
            <span class="text-muted-foreground">{{ formatDateTime(row.updatedAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <UiButton
              variant="ghost"
              size="icon"
              class="size-7"
              :title="t('admin.guest_posts.view')"
              :aria-label="t('admin.guest_posts.view')"
              @click="openId = row.id"
            >
              <Eye class="size-3" />
            </UiButton>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <UiDialog :open="!!openId" @update:open="(v: boolean) => !v && (openId = null)">
      <UiDialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <AdminGuestPostReviewPanel
          v-if="openId"
          :id="openId"
          @changed="refresh"
          @done="openId = null"
        />
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
