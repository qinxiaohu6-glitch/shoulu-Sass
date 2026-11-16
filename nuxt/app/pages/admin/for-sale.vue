<script setup lang="ts">
/**
 * 待售审核。只看是否已付款、是否仍拥有该在架产品、以及垃圾信息。
 * 不核实卖家填写的收入或利润。
 */
definePageMeta({ layout: 'admin' })

type Row = {
  id: string
  product_slug: string
  product_name: string
  asking_cents: number
  revenue: string
  profit: string
  team: string
  stack: string
  status: string
  paid: boolean
  owns: boolean
  spam: string[]
}

const api = useAdminApi()
const notice = ref('')

const { data, refresh } = await useAsyncData(
  'admin-for-sale',
  () => api.get<{ ok: boolean; items: Row[] }>('/api/admin/for-sale'),
  { default: () => ({ ok: true, items: [] as Row[] }) },
)

async function review(id: string, action: 'approve' | 'reject') {
  notice.value = ''
  try {
    await api.post('/api/admin/for-sale/review', { id, action })
    notice.value = action === 'approve' ? '已通过，现在可以公开。' : '已拒绝，不会公开。'
    await refresh()
  } catch (err) {
    notice.value = err instanceof Error ? err.message : '没有完成。'
  }
}
</script>

<template>
  <div class="p-6">
    <h1 class="mb-2 text-xl font-semibold">待售审核</h1>
    <p class="mb-4 text-sm text-muted-foreground">
      审核只确认所有权和反垃圾。不核实收入，也不把未付款或未通过的行公开。
    </p>
    <p v-if="notice" class="mb-4 text-sm">{{ notice }}</p>
    <div v-if="!data?.items.length" class="text-sm text-muted-foreground">队列是空的。</div>
    <article v-for="row in data?.items" :key="row.id" class="mb-4 rounded-xl border border-border p-4">
      <h2 class="font-medium">{{ row.product_name || row.product_slug }}</h2>
      <p class="text-sm text-muted-foreground">
        {{ row.status }} · {{ row.paid ? '已付款' : '未付款' }} · {{ row.owns ? '所有权吻合' : '所有权不吻合' }}
        · 要价 ${{ (row.asking_cents / 100).toFixed(2) }}
      </p>
      <p v-if="row.revenue" class="text-sm">卖家自报收入：{{ row.revenue }}</p>
      <p v-if="row.profit" class="text-sm">卖家自报利润：{{ row.profit }}</p>
      <p v-if="row.spam.length" class="text-sm">垃圾标记：{{ row.spam.join(', ') }}</p>
      <div v-if="row.status === 'paid_pending_review'" class="mt-3 flex gap-2">
        <button type="button" class="btn btn--primary" @click="review(row.id, 'approve')">通过</button>
        <button type="button" class="btn" @click="review(row.id, 'reject')">拒绝</button>
      </div>
    </article>
  </div>
</template>
