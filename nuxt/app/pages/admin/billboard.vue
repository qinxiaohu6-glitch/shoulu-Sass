<script setup lang="ts">
/**
 * /admin/billboard — 中文后台。公开榜和这一页读同一张 billboard_placement。
 * 「下架」把 live 改为 removed。「手动补发」只在回调丢失时把已有行标成 live，不新开一笔收款。
 */
definePageMeta({ layout: 'admin' })

import type { DataColumn } from '~/utils/ui'

type Row = {
  id: string
  tier: string
  name: string
  url: string
  email: string
  status: string
  paidAt: number | null
  createdAt: number
  orderId: string
  amountCents: number
  note: string
}

const api = useAdminApi()
const page = ref(1)
const busyId = ref('')

const { data, status, refresh } = await useAsyncData(
  'admin-billboard',
  () => api.get<{ items: Row[]; stats: { total: number; live: number; pending: number } }>('/api/admin/billboard'),
  { default: () => ({ items: [] as Row[], stats: { total: 0, live: 0, pending: 0 } }) },
)

const rows = computed(() => data.value?.items ?? [])
const loading = computed(() => status.value === 'pending')

const columns: DataColumn[] = [
  { key: 'name', header: '名称' },
  { key: 'tier', header: '档位' },
  { key: 'status', header: '状态' },
  { key: 'amount', header: '实付' },
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

async function act(row: Row, action: 'remove' | 'fulfill') {
  if (busyId.value) return
  const verb = action === 'remove' ? '下架' : '手动补发'
  if (!window.confirm(`确认${verb}「${row.name || row.url}」？`)) return
  busyId.value = row.id
  try {
    await api.patch('/api/admin/billboard', { id: row.id, action })
    await refresh()
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
        未付款不会出现在首页和 /billboard。手动补发只用于支付回调丢失，不会新开收款。
      </p>
      <p class="mt-2 text-sm">
        共 {{ data?.stats.total ?? 0 }} 条 · 已上板 {{ data?.stats.live ?? 0 }} · 未付款 {{ data?.stats.pending ?? 0 }}
      </p>
    </div>

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
      </template>
      <template #cell-tier="{ row }">{{ row.tier }}</template>
      <template #cell-status="{ row }">{{ row.status }}</template>
      <template #cell-amount="{ row }">{{ dollars(row.amountCents) }}</template>
      <template #cell-paid="{ row }">{{ when(row.paidAt) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex gap-2">
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
      </template>
    </DataTable>
  </div>
</template>
