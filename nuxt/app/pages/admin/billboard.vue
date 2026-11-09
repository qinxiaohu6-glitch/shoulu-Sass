<script setup lang="ts">
/**
 * /admin/billboard — 中文后台。公开榜和这一页读同一张 billboard_placement。
 * 「下架」把 live 改为 removed。「手动补发」只在回调丢失时把已有行标成 live，不新开一笔收款。
 * 「按网址累计」是首页实际用的名次和金额。截图可以手填，也可以从产品首页抓 og:image。
 */
definePageMeta({ layout: 'admin' })

import type { DataColumn } from '~/utils/ui'
import { screenshotSrc } from '~~/shared/utils/screenshot'

type Row = {
  id: string
  tier: string
  name: string
  tagline: string
  url: string
  logo: string
  screenshot: string
  email: string
  status: string
  paidAt: number | null
  createdAt: number
  orderId: string
  amountCents: number
  note: string
}

type Stacked = {
  id: string
  rank: number
  name: string
  url: string
  amountCents: number
  screenshot: string
  logo: string
}

const api = useAdminApi()
const page = ref(1)
const busyId = ref('')
const mediaNote = ref('')
const drafts = reactive<Record<string, { screenshot: string; logo: string }>>({})

const { data, status, refresh } = await useAsyncData(
  'admin-billboard',
  () =>
    api.get<{ items: Row[]; stacked: Stacked[]; stats: { total: number; live: number; pending: number } }>(
      '/api/admin/billboard',
    ),
  {
    default: () => ({
      items: [] as Row[],
      stacked: [] as Stacked[],
      stats: { total: 0, live: 0, pending: 0 },
    }),
  },
)

const rows = computed(() => data.value?.items ?? [])
const stacked = computed(() => data.value?.stacked ?? [])
const loading = computed(() => status.value === 'pending')

watch(
  rows,
  (list) => {
    for (const row of list) {
      if (!drafts[row.id]) drafts[row.id] = { screenshot: row.screenshot || '', logo: row.logo || '' }
    }
  },
  { immediate: true },
)

const columns: DataColumn[] = [
  { key: 'name', header: '名称' },
  { key: 'tier', header: '档位' },
  { key: 'status', header: '状态' },
  { key: 'amount', header: '本笔' },
  { key: 'shot', header: '截图' },
  { key: 'paid', header: '付款时间' },
  { key: 'actions', header: '操作' },
]

function dollars(cents: number) {
  if (!cents) return '—'
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

function when(unix: number | null) {
  if (!unix) return '未付款'
  return new Date(unix * 1000).toLocaleString('zh-CN', { hour12: false })
}

function preview(value: string) {
  return screenshotSrc(value)
}

function draftOf(row: Row) {
  if (!drafts[row.id]) drafts[row.id] = { screenshot: row.screenshot || '', logo: row.logo || '' }
  return drafts[row.id]
}

async function act(row: Row, action: 'remove' | 'fulfill') {
  if (busyId.value) return
  const verb = action === 'remove' ? '下架' : '手动补发'
  if (!window.confirm(`确认${verb}「${row.name || row.url}」？`)) return
  busyId.value = row.id
  mediaNote.value = ''
  try {
    await api.patch('/api/admin/billboard', { id: row.id, action })
    await refresh()
  } finally {
    busyId.value = ''
  }
}

async function saveMedia(row: Row) {
  if (busyId.value) return
  busyId.value = row.id
  mediaNote.value = ''
  try {
    const draft = drafts[row.id] ?? { screenshot: '', logo: '' }
    await api.patch('/api/admin/billboard', {
      id: row.id,
      action: 'media',
      screenshot: draft.screenshot,
      logo: draft.logo,
    })
    mediaNote.value = `已保存「${row.name || row.url}」的截图和 logo。`
    await refresh()
  } catch {
    mediaNote.value = '没保存成。截图要是 https 图片或 screenshots 目录下的文件名，logo 要是 http(s) 地址。'
  } finally {
    busyId.value = ''
  }
}

async function capture(row: Row) {
  if (busyId.value) return
  busyId.value = row.id
  mediaNote.value = ''
  try {
    const res = await api.patch<{ found?: boolean; screenshot?: string }>('/api/admin/billboard', {
      id: row.id,
      action: 'capture',
    })
    if (res?.found && res.screenshot) {
      if (!drafts[row.id]) drafts[row.id] = { screenshot: '', logo: row.logo || '' }
      drafts[row.id].screenshot = res.screenshot
      mediaNote.value = `已从首页抓到图片。`
    } else {
      mediaNote.value = '这个首页没有可用的 og:image。可以手填图片地址。'
    }
    await refresh()
  } catch {
    mediaNote.value = '抓取失败。请稍后再试，或手填图片地址。'
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <div class="space-y-4 p-6">
    <div>
      <h1 class="text-xl font-semibold">Billboard 展位</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        未付款不会出现在首页和 /billboard。同一网址的已付款金额会累加，公开名次看下面的累计表，不看单笔。手动补发只用于支付回调丢失，不会新开收款。
      </p>
      <p class="mt-2 text-sm">
        共 {{ data?.stats.total ?? 0 }} 条 · 已上板 {{ data?.stats.live ?? 0 }} · 未付款 {{ data?.stats.pending ?? 0 }}
      </p>
      <p v-if="mediaNote" class="mt-2 text-sm">{{ mediaNote }}</p>
    </div>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold">按网址累计（公开榜）</h2>
      <p v-if="!stacked.length" class="text-sm text-muted-foreground">还没有已付款的展位。</p>
      <ul v-else class="space-y-2">
        <li v-for="row in stacked" :key="row.id" class="flex items-center gap-3 rounded-lg border p-3 text-sm">
          <span class="w-6 font-semibold">{{ row.rank }}</span>
          <img v-if="row.screenshot" :src="row.screenshot" alt="" class="h-12 w-20 rounded object-cover">
          <span v-else class="text-muted-foreground grid h-12 w-20 place-items-center rounded bg-muted text-xs">无图</span>
          <span class="min-w-0 flex-1">
            <span class="block font-medium">{{ row.name || '（未填名称）' }}</span>
            <span class="block truncate text-xs text-muted-foreground">{{ row.url }}</span>
          </span>
          <span class="font-semibold">{{ dollars(row.amountCents) }}</span>
        </li>
      </ul>
    </section>

    <DataTable
      :columns="columns"
      :rows="rows"
      :total="rows.length"
      :page="page"
      :page-size="Math.max(rows.length, 1)"
      :loading="loading"
      empty-text="还没有 Billboard 记录"
      show-refresh
      @update:page="page = $event"
      @refresh="refresh()"
    >
      <template #cell-name="{ row }">
        <div class="font-medium">{{ row.name || '（未填名称）' }}</div>
        <div class="max-w-xs truncate text-xs text-muted-foreground">{{ row.url }}</div>
        <div v-if="row.tagline" class="max-w-xs truncate text-xs">{{ row.tagline }}</div>
        <div class="max-w-xs truncate text-xs text-muted-foreground">
          {{ row.email || '无邮箱' }} · {{ row.orderId || '无订单' }}
        </div>
        <div v-if="row.note" class="max-w-xs truncate text-xs text-muted-foreground">{{ row.note }}</div>
      </template>
      <template #cell-tier="{ row }">{{ row.tier }}</template>
      <template #cell-status="{ row }">{{ row.status }}</template>
      <template #cell-amount="{ row }">{{ dollars(row.amountCents) }}</template>
      <template #cell-shot="{ row }">
        <img v-if="preview(row.screenshot)" :src="preview(row.screenshot)" alt="" class="h-10 w-16 rounded object-cover">
        <span v-else class="text-xs text-muted-foreground">无</span>
      </template>
      <template #cell-paid="{ row }">{{ when(row.paidAt) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex max-w-xs flex-col gap-2">
          <input
            v-model="draftOf(row).screenshot"
            class="w-full rounded border px-2 py-1 text-xs"
            placeholder="截图 https://… 或 shot.png"
          >
          <input
            v-model="draftOf(row).logo"
            class="w-full rounded border px-2 py-1 text-xs"
            placeholder="logo https://…"
          >
          <div class="flex flex-wrap gap-2">
            <button type="button" class="text-sm underline" :disabled="busyId === row.id" @click="saveMedia(row)">
              保存素材
            </button>
            <button type="button" class="text-sm underline" :disabled="busyId === row.id" @click="capture(row)">
              抓首页图
            </button>
            <button
              v-if="row.status === 'live'"
              type="button"
              class="text-sm underline"
              :disabled="busyId === row.id"
              @click="act(row, 'remove')"
            >
              下架
            </button>
            <button
              v-else-if="row.status !== 'removed'"
              type="button"
              class="text-sm underline"
              :disabled="busyId === row.id"
              @click="act(row, 'fulfill')"
            >
              手动补发
            </button>
            <span v-else class="text-xs text-muted-foreground">已下架</span>
          </div>
        </div>
      </template>
    </DataTable>
  </div>
</template>
