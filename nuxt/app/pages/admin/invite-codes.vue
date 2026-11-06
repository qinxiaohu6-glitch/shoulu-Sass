<script setup lang="ts">
/**
 * /admin/invite-codes — source `shipany-dir/src/routes/admin/-invite-codes-page.tsx`.
 *
 * Three tabs, seven columns, a create dialog and a delete confirmation.
 *
 * This build has no invite table and no invite gate — sign-up is Google-only,
 * so `invite_code_required` is false and `/redeem-invite` rejects every code
 * (see `server/api/admin/invite-codes/index.get.ts`). The page is therefore the
 * source's own empty state, and both writes report why nothing happened instead
 * of inventing a store.
 */
definePageMeta({ layout: 'admin' })

import { Copy, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn, type DataColumn } from '~/utils/ui'
import {
  emptyInviteForm,
  INVITE_PAGE_SIZE,
  INVITE_TABS,
  isInviteFormValid,
  toInvitePayload,
  type InviteCodeForm,
  type InviteCodeRow,
  type InviteTab,
} from '~/utils/admin-invite-codes-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()

const page = ref(1)
const tab = ref<InviteTab>('all')
const search = ref('')
const debouncedSearch = ref('')

const createOpen = ref(false)
const creating = ref(false)
const form = ref<InviteCodeForm>(emptyInviteForm())

const deletingId = ref<string | null>(null)
const deleting = ref(false)

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([debouncedSearch, tab], () => {
  page.value = 1
})

const listParams = computed(() =>
  pageQuery('/api/admin/invite-codes', {
    page: page.value,
    pageSize: INVITE_PAGE_SIZE,
    status: tab.value === 'all' ? undefined : tab.value,
    search: debouncedSearch.value,
  }),
)

const { data, status: fetchStatus, refresh } = await useAsyncData<{ items: InviteCodeRow[]; total: number }>(
  'admin-invite-codes',
  () => api.get<{ items: InviteCodeRow[]; total: number }>(listParams.value),
  { watch: [listParams], default: () => ({ items: [], total: 0 }) },
)

const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const loading = computed(() => fetchStatus.value === 'pending')

const columns = computed<DataColumn[]>(() => [
  { key: 'code', header: t('admin.invite_codes.code_col') },
  { key: 'usage', header: t('admin.invite_codes.usage_col'), class: 'w-[120px]' },
  { key: 'trial', header: t('admin.invite_codes.trial_days_col'), class: 'w-[100px]' },
  { key: 'note', header: t('admin.invite_codes.note_col') },
  { key: 'expires', header: t('admin.invite_codes.expires_col') },
  { key: 'created', header: t('admin.invite_codes.created_col') },
  { key: 'actions', header: t('admin.invite_codes.actions_col'), class: 'w-[80px]' },
])

function openCreate() {
  form.value = emptyInviteForm()
  createOpen.value = true
}

function onDialogToggle(open: boolean) {
  createOpen.value = open
  if (!open) form.value = emptyInviteForm()
}

async function submitCreate() {
  if (!isInviteFormValid(form.value)) {
    toast.error(t('admin.invite_codes.invalid_input'))
    return
  }
  creating.value = true
  try {
    await api.post('/api/admin/invite-codes', toInvitePayload(form.value))
    toast.success(t('admin.invite_codes.create_success'))
    createOpen.value = false
    form.value = emptyInviteForm()
    page.value = 1
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    creating.value = false
  }
}

async function confirmDelete() {
  const id = deletingId.value
  if (!id) return
  deleting.value = true
  try {
    await api.del(`/api/admin/invite-codes?id=${encodeURIComponent(id)}`)
    toast.success(t('admin.invite_codes.delete_success'))
    deletingId.value = null
    await refresh()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    deleting.value = false
  }
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(
    () => toast.success(t('admin.invite_codes.copied')),
    () => toast.error(t('common.failed')),
  )
}
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ t('admin.invite_codes.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.invite_codes.description') }}</p>
      </div>
      <UiButton class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        {{ t('admin.invite_codes.create_button') }}
      </UiButton>
    </div>

    <div class="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      <button
        v-for="tb in INVITE_TABS"
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
        {{ t(`admin.invite_codes.tab_${tb}`) }}
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
          :page-size="INVITE_PAGE_SIZE"
          :loading="loading"
          :empty-text="t('admin.invite_codes.empty')"
          :search-placeholder="t('admin.invite_codes.search_placeholder')"
          show-refresh
          @refresh="refresh"
        >
          <template #cell-code="{ row }">
            <div class="flex items-center gap-2">
              <code class="font-mono text-sm">{{ row.code }}</code>
              <UiButton variant="ghost" size="icon" class="size-6" @click="copyCode(row.code)">
                <Copy class="size-3" />
              </UiButton>
            </div>
          </template>

          <template #cell-usage="{ row }">
            <span class="tabular-nums">{{ row.usedCount }} / {{ row.maxUses }}</span>
          </template>

          <template #cell-trial="{ row }">
            <span class="tabular-nums">{{ row.trialDays }}</span>
          </template>

          <template #cell-note="{ row }">
            <span class="text-muted-foreground">{{ row.note || '—' }}</span>
          </template>

          <template #cell-expires="{ row }">
            <span class="text-muted-foreground">
              {{ row.expiresAt ? formatDateTime(row.expiresAt) : '—' }}
            </span>
          </template>

          <template #cell-created="{ row }">
            <span class="text-muted-foreground">{{ formatDateTime(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <UiButton variant="ghost" size="icon" class="size-7" @click="deletingId = row.id">
              <Trash2 class="size-4 text-destructive" />
            </UiButton>
          </template>
        </DataTable>
      </UiCardContent>
    </UiCard>

    <!-- Create -->
    <UiDialog :open="createOpen" @update:open="onDialogToggle">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.invite_codes.create_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.invite_codes.create_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <form @submit.prevent.stop="submitCreate">
          <div class="space-y-4 py-2">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <UiLabel>{{ t('admin.invite_codes.count_label') }}</UiLabel>
                <UiInput v-model="form.count" type="number" min="1" max="100" />
              </div>
              <div class="space-y-1.5">
                <UiLabel>{{ t('admin.invite_codes.max_uses_label') }}</UiLabel>
                <UiInput v-model="form.maxUses" type="number" min="1" />
              </div>
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.invite_codes.trial_days_label') }}</UiLabel>
              <UiInput v-model="form.trialDays" type="number" min="1" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.invite_codes.expires_label') }}</UiLabel>
              <UiInput v-model="form.expiresAt" type="date" />
            </div>
            <div class="space-y-1.5">
              <UiLabel>{{ t('admin.invite_codes.note_label') }}</UiLabel>
              <UiInput
                v-model="form.note"
                :placeholder="t('admin.invite_codes.note_placeholder')"
              />
            </div>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" @click="onDialogToggle(false)">
              {{ t('admin.invite_codes.cancel') }}
            </UiButton>
            <UiButton type="submit" :disabled="creating">
              {{
                creating
                  ? t('admin.invite_codes.creating')
                  : t('admin.invite_codes.create_submit')
              }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete -->
    <UiDialog :open="!!deletingId" @update:open="(v: boolean) => !v && (deletingId = null)">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.invite_codes.delete_title') }}</UiDialogTitle>
          <UiDialogDescription>{{ t('admin.invite_codes.delete_description') }}</UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter>
          <UiButton variant="outline" @click="deletingId = null">
            {{ t('admin.invite_codes.cancel') }}
          </UiButton>
          <UiButton variant="destructive" :disabled="deleting" @click="confirmDelete">
            {{ t('admin.invite_codes.delete_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
