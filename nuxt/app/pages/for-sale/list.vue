<script setup lang="ts">
/**
 * Seller form. Login and ownership are required. The pay call sends a listing
 * id only. The $9.90 charge is decided on the server.
 */
import { CHECKOUT_CLOSED_EN, CHECKOUT_CLOSED_ZH, FOR_SALE_FACTS, FOR_SALE_HELPER, FOR_SALE_PLANNED_FEE, SELLER_CTA } from '~~/shared/content/for-sale'
import { centsLabel } from '~~/shared/content/campaign'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const requestFetch = useRequestFetch()
const { ensure } = useSession()

const me = await ensure()
if (!me) {
  await navigateTo(localePath({ path: '/sign-in', query: { next: route.fullPath } }))
}

type MineListing = {
  id: string
  product_slug: string
  product_name: string
  asking_cents: number
  revenue: string
  profit: string
  team: string
  stack: string
  status: string
  public: boolean
  can_pay: boolean
  can_reprice: boolean
  can_unlist: boolean
  can_relist: boolean
  can_resubmit: boolean
}

const { data, refresh } = await useAsyncData(
  'for-sale-mine',
  () =>
    requestFetch<{
      ok: boolean
      sku_ready: boolean
      products: { slug: string; name: string }[]
      listings: MineListing[]
    }>('/api/for-sale/mine').catch(() => ({
      ok: false,
      sku_ready: false,
      products: [] as { slug: string; name: string }[],
      listings: [] as MineListing[],
    })),
  {
    default: () => ({
      ok: true,
      sku_ready: false,
      products: [] as { slug: string; name: string }[],
      listings: [] as MineListing[],
    }),
  },
)

const ready = computed(() => Boolean(data.value?.sku_ready))
const products = computed(() => data.value?.products ?? [])
const selected = ref(String(route.query.product || ''))
const asking = ref('')
const revenue = ref('')
const profit = ref('')
const team = ref('')
const stack = ref('')
const busy = ref(false)
const notice = ref('')

const current = computed(() => data.value?.listings.find((row) => row.product_slug === selected.value) ?? null)

watch(
  products,
  (rows) => {
    if (!selected.value && rows[0]) selected.value = rows[0].slug
  },
  { immediate: true },
)

watch(current, (row) => {
  if (!row) return
  asking.value = (row.asking_cents / 100).toFixed(2)
  revenue.value = row.revenue
  profit.value = row.profit
  team.value = row.team
  stack.value = row.stack
}, { immediate: true })

function closedLine() {
  return isZh.value ? CHECKOUT_CLOSED_ZH : CHECKOUT_CLOSED_EN
}

function errorLine(err: unknown): string {
  const data = (err as { data?: { reason?: string; message_en?: string; message_zh?: string } }).data
  if (data?.reason === 'unconfigured') return closedLine()
  return (isZh.value ? data?.message_zh : data?.message_en) || closedLine()
}

async function save() {
  const res = await $fetch<{ ok: boolean; listing: MineListing }>('/api/for-sale', {
    method: 'POST',
    body: {
      product_slug: selected.value,
      asking_price: asking.value,
      revenue: revenue.value,
      profit: profit.value,
      team: team.value,
      stack: stack.value,
    },
  })
  return res.listing
}

/** Opens the provider page. The request body is only the listing id. */
async function openCheckout(listingId: string): Promise<boolean> {
  const res = await $fetch<{ ok: boolean; url?: string }>('/api/for-sale/checkout', {
    method: 'POST',
    body: { listing_id: listingId },
  })
  if (res?.url) {
    window.location.href = res.url
    return true
  }
  notice.value = closedLine()
  return false
}

async function pay() {
  if (busy.value || !selected.value) return
  busy.value = true
  notice.value = ''
  try {
    if (current.value && !current.value.can_pay) {
      await save()
      notice.value = pick(
        '已保存。这笔上架费已经付过，改要价不另收费。',
        'Saved. This listing fee is already paid. You can change the asking price at no extra charge.',
      )
      return
    }
    const listing = await save()
    await openCheckout(listing.id)
  } catch (err) {
    notice.value = errorLine(err)
  } finally {
    busy.value = false
    await refresh()
  }
}

async function reprice() {
  if (!current.value) return
  busy.value = true
  notice.value = ''
  try {
    await $fetch('/api/for-sale/price', {
      method: 'POST',
      body: { listing_id: current.value.id, asking_price: asking.value },
    })
    notice.value = pick('要价已更新，没有另收费。', 'Asking price updated, at no extra charge.')
    await refresh()
  } catch (err) {
    notice.value = errorLine(err)
  } finally {
    busy.value = false
  }
}

async function unlist(reason: 'sold' | 'withdrawn') {
  if (!current.value) return
  busy.value = true
  notice.value = ''
  try {
    await $fetch('/api/for-sale/unlist', {
      method: 'POST',
      body: { listing_id: current.value.id, reason },
    })
    notice.value = pick(
      '已从公开列表移除。再次上架需要再付 $9.90。',
      'Removed from the public list. Listing it again costs another $9.90.',
    )
    await refresh()
  } catch (err) {
    notice.value = errorLine(err)
  } finally {
    busy.value = false
  }
}

async function relist() {
  if (busy.value || !current.value) return
  busy.value = true
  notice.value = ''
  try {
    const res = await $fetch<{ listing: MineListing }>('/api/for-sale/relist', {
      method: 'POST',
      body: { listing_id: current.value.id },
    })
    await openCheckout(res.listing.id)
  } catch (err) {
    notice.value = errorLine(err)
  } finally {
    busy.value = false
    await refresh()
  }
}

async function resubmit() {
  if (!current.value) return
  busy.value = true
  notice.value = ''
  try {
    await save()
    await $fetch('/api/for-sale/resubmit', {
      method: 'POST',
      body: { listing_id: current.value.id },
    })
    notice.value = pick(
      '已重新送审。审核通过前不会公开，也不用再付一次。',
      'Sent back for review. It stays private until review passes, and this does not charge again.',
    )
    await refresh()
  } catch (err) {
    notice.value = errorLine(err)
  } finally {
    busy.value = false
  }
}

useSeo({
  title: computed(() => pick('上架待售 · Product Atlas', 'List a product for sale · Product Atlas')),
  description: computed(() => pick(FOR_SALE_PLANNED_FEE, FOR_SALE_HELPER)),
})
</script>

<template>
  <div class="container tool-page">
    <header class="page-head">
      <h1 class="page-title">{{ SELLER_CTA }}</h1>
      <p class="page-sub">{{ FOR_SALE_HELPER }}</p>
      <p v-if="!ready" class="page-sub">{{ FOR_SALE_PLANNED_FEE }}</p>
    </header>

    <ul class="sale-facts">
      <li v-for="fact in FOR_SALE_FACTS" :key="fact">{{ fact }}</li>
    </ul>

    <p v-if="!products.length" class="page-sub">
      {{
        pick(
          '你名下还没有已上线的目录页。先提交产品。',
          'You do not have a live directory page yet. Submit a product first.',
        )
      }}
      <NuxtLink :to="localePath('/submit')">{{ pick('提交产品', 'Submit a product') }}</NuxtLink>
    </p>

    <form v-else class="sale-form" @submit.prevent="pay">
      <label>
        {{ pick('产品', 'Product') }}
        <select v-model="selected" required>
          <option v-for="product in products" :key="product.slug" :value="product.slug">
            {{ product.name }}
          </option>
        </select>
      </label>
      <label>
        {{ pick('要价（美元）', 'Asking price (USD)') }}
        <input v-model="asking" inputmode="decimal" required placeholder="1500" >
      </label>
      <label>
        Seller-reported revenue
        <input v-model="revenue" maxlength="160" >
      </label>
      <label>
        Seller-reported profit
        <input v-model="profit" maxlength="160" >
      </label>
      <label>
        Team
        <input v-model="team" maxlength="160" >
      </label>
      <label>
        Stack
        <input v-model="stack" maxlength="160" >
      </label>
      <p v-if="current">
        {{ pick('当前状态', 'Status') }}: {{ current.status }}
        <template v-if="current.asking_cents"> · {{ centsLabel(current.asking_cents) }}</template>
      </p>
      <div class="sale-form__actions">
        <button v-if="!current?.can_relist" class="btn btn--primary" type="submit" :disabled="busy">
          {{ current && !current.can_pay ? pick('保存修改', 'Save changes') : SELLER_CTA }}
        </button>
        <button v-if="current?.can_reprice" class="btn" type="button" :disabled="busy" @click="reprice">
          {{ pick('只改要价', 'Change asking price') }}
        </button>
        <button v-if="current?.can_unlist" class="btn" type="button" :disabled="busy" @click="unlist('sold')">
          {{ pick('标为已售并下架', 'Unlist as sold') }}
        </button>
        <button v-if="current?.can_unlist" class="btn" type="button" :disabled="busy" @click="unlist('withdrawn')">
          {{ pick('撤回', 'Unlist as withdrawn') }}
        </button>
        <button v-if="current?.can_relist" class="btn" type="button" :disabled="busy" @click="relist">
          {{ pick('再次上架 · $9.90', 'List again · $9.90') }}
        </button>
        <button v-if="current?.can_resubmit" class="btn" type="button" :disabled="busy" @click="resubmit">
          {{ pick('重新送审', 'Send back for review') }}
        </button>
      </div>
    </form>
    <p v-if="notice" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
.sale-facts { max-width: 44rem; line-height: 1.5; }
.sale-form { display: grid; gap: 12px; max-width: 32rem; margin-top: 16px; }
.sale-form label { display: grid; gap: 4px; font-size: 14px; }
.sale-form__actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
