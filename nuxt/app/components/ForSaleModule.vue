<script setup lang="ts">
/**
 * For sale block on an existing product page.
 * Renders only when a public listing exists or the signed-in viewer owns the product.
 */
import {
  FOR_SALE_PLANNED_FEE,
  SELLER_CTA,
} from '~~/shared/content/for-sale'
import type { PublicForSaleCard } from '~~/shared/utils/for-sale-state'

const props = defineProps<{ slug: string }>()

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

type Mine = { id: string; status: string; public: boolean }
type Payload = {
  ok: boolean
  sku_ready: boolean
  card: PublicForSaleCard | null
  can_list: boolean
  mine: Mine | null
}

const { data } = await useAsyncData(
  () => `for-sale:${props.slug}`,
  async () => {
    try {
      return await requestFetch<Payload>(`/api/for-sale/product/${encodeURIComponent(props.slug)}`)
    } catch {
      return { ok: false, sku_ready: false, card: null, can_list: false, mine: null }
    }
  },
  { watch: [() => props.slug] },
)

const show = computed(() => Boolean(data.value?.card || data.value?.can_list || data.value?.mine))
const ready = computed(() => Boolean(data.value?.sku_ready))
</script>

<template>
  <section v-if="show" class="for-sale-module" aria-labelledby="for-sale-heading">
    <h2 id="for-sale-heading">{{ pick('待售', 'For sale') }}</h2>
    <ForSaleCard v-if="data?.card" :card="data.card">
      <ForSaleContact :listing-id="data.card.id" />
    </ForSaleCard>
    <div v-else-if="data?.mine && !data.mine.public" class="for-sale-module__private">
      <p>
        {{
          pick(
            '你的待售还没有公开。付款成功并通过审核后才会出现在待售列表。',
            'Your for-sale listing is not public. It goes on the list only after payment succeeds and it passes review.',
          )
        }}
      </p>
      <NuxtLink :to="localePath({ path: '/for-sale/list', query: { product: slug } })">
        {{ SELLER_CTA }}
      </NuxtLink>
      <p v-if="!ready">{{ FOR_SALE_PLANNED_FEE }}</p>
    </div>
    <div v-else-if="data?.can_list">
      <NuxtLink :to="localePath({ path: '/for-sale/list', query: { product: slug } })">
        {{ SELLER_CTA }}
      </NuxtLink>
      <p v-if="!ready">{{ FOR_SALE_PLANNED_FEE }}</p>
    </div>
  </section>
</template>

<style scoped>
.for-sale-module {
  margin: 0 0 28px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
}
.for-sale-module h2 { margin: 0 0 12px; font-size: 18px; }
.for-sale-module p { margin: 8px 0 0; color: var(--muted-foreground); font-size: 13px; line-height: 1.5; }
.for-sale-module a { font-weight: 750; }
</style>
