<script setup lang="ts">
import {
  ESTIMATE_CTA,
  FOR_SALE_FACTS,
  FOR_SALE_H1,
  FOR_SALE_HELPER,
  FOR_SALE_META,
  FOR_SALE_PLANNED_FEE,
  FOR_SALE_SUBHEAD,
  FOR_SALE_TITLE,
  SELLER_CTA,
  forSaleEmptyState,
} from '~~/shared/content/for-sale'
import type { PublicForSaleCard } from '~~/shared/utils/for-sale-state'

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const { data } = await useAsyncData(
  'for-sale-list',
  () =>
    requestFetch<{ ok: boolean; sku_ready: boolean; items: PublicForSaleCard[] }>('/api/for-sale').catch(() => ({
      ok: false,
      sku_ready: false,
      items: [] as PublicForSaleCard[],
    })),
  { default: () => ({ ok: true, sku_ready: false, items: [] as PublicForSaleCard[] }) },
)

const ready = computed(() => Boolean(data.value?.sku_ready))
const items = computed(() => data.value?.items ?? [])
const empty = computed(() => forSaleEmptyState(ready.value))

useSeo({
  title: computed(() => pick('待售产品 · Product Atlas', FOR_SALE_TITLE)),
  description: computed(() => pick('创客挂出的待售。不抽佣、不托管。收入为卖家自报。买家登录后联系卖家。', FOR_SALE_META)),
})
</script>

<template>
  <div class="container tool-page">
    <header class="page-head">
      <h1 class="page-title">{{ FOR_SALE_H1 }}</h1>
      <p class="page-sub">{{ FOR_SALE_SUBHEAD }}</p>
    </header>

    <div class="sale-actions">
      <NuxtLink v-if="ready" class="btn btn--primary" :to="localePath('/for-sale/list')">
        {{ SELLER_CTA }}
      </NuxtLink>
      <p v-else class="sale-planned">
        <strong>{{ SELLER_CTA }}</strong>
        {{ FOR_SALE_PLANNED_FEE }}
        <NuxtLink :to="localePath('/for-sale/list')">{{ pick('打开上架表单', 'Open the listing form') }}</NuxtLink>
      </p>
      <NuxtLink :to="localePath('/tools/saas-valuation-calculator')">{{ ESTIMATE_CTA }}</NuxtLink>
    </div>

    <p class="sale-helper">{{ FOR_SALE_HELPER }}</p>
    <ul class="sale-facts">
      <li v-for="fact in FOR_SALE_FACTS" :key="fact">{{ fact }}</li>
    </ul>

    <div v-if="items.length" class="sale-grid">
      <ForSaleCard v-for="card in items" :key="card.id" :card="card">
        <ForSaleContact :listing-id="card.id" />
      </ForSaleCard>
    </div>
    <p v-else class="sale-empty">{{ empty }}</p>
  </div>
</template>

<style scoped>
.sale-actions { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin: 8px 0 16px; }
.sale-planned { margin: 0; max-width: 40rem; line-height: 1.5; }
.sale-helper, .sale-facts, .sale-empty { max-width: 44rem; line-height: 1.55; }
.sale-facts { padding-left: 1.1rem; }
.sale-grid { display: grid; gap: 16px; margin-top: 20px; }
</style>
