<script setup lang="ts">
/**
 * Flippa comparison outline. The long-form body is reserved for a later
 * SEO-GEO draft and a separate review. Do not paste an unsanctioned article here.
 */
import {
  FLIPPA_ACCESS_NOTE,
  FLIPPA_FACTS,
  FLIPPA_H1,
  FLIPPA_LEAD,
  FLIPPA_META,
  FLIPPA_OFFICIAL_URL,
  FLIPPA_TITLE,
  FOR_SALE_PLANNED_FEE,
  SELLER_CTA,
} from '~~/shared/content/for-sale'

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const { data: config } = await useAsyncData(
  'for-sale-sku-flippa',
  () => requestFetch<{ ready?: boolean }>('/api/for-sale/config').catch(() => ({ ready: false })),
  { default: () => ({ ready: false }) },
)
const skuReady = computed(() => Boolean(config.value?.ready))

useSeo({
  title: computed(() => pick('小产品可以挂在哪里 · Product Atlas', FLIPPA_TITLE)),
  description: computed(() => pick('卖小产品时，上架费、买家如何联系、有没有人托管资金，比市场品牌名更重要。', FLIPPA_META)),
})
</script>

<template>
  <div class="container tool-page">
    <header class="page-head">
      <h1 class="page-title">{{ FLIPPA_H1 }}</h1>
      <p class="page-sub">{{ FLIPPA_LEAD }}</p>
    </header>

    <section>
      <h2>{{ pick('我方事实', 'Our facts') }}</h2>
      <ul>
        <li v-for="fact in FLIPPA_FACTS" :key="fact">{{ fact }}</li>
      </ul>
    </section>

    <section>
      <h2>{{ pick('机制差在哪里', 'How the mechanisms differ') }}</h2>
      <p>
        A marketplace can charge a one-time listing fee, take a commission when a sale closes, hold the money, or leave the buyer and seller to deal with each other directly.
      </p>
      <p>
        Product Atlas charges a one-time listing fee. It does not take a commission. This page has no escrow. Buyer and seller settle payment and handover themselves.
      </p>
      <p>
        <a :href="FLIPPA_OFFICIAL_URL" rel="noopener noreferrer">Flippa</a>
        is a different marketplace.
        {{ FLIPPA_ACCESS_NOTE }}
        Read their current terms on that site. We do not copy their fee table.
      </p>
    </section>

    <section>
      <h2>{{ pick('适合谁', 'Who it is for') }}</h2>
      <p>
        This fits a small product that already has a Product Atlas directory page, or whose maker will submit one, when the buyer and seller will arrange payment and handover themselves.
      </p>
      <p>
        This does not fit a sale that needs the platform to hold the funds, or a listing that can go up only after someone else verifies the income.
      </p>
    </section>

    <section>
      <h2>{{ pick('估值', 'A range, not a guarantee') }}</h2>
      <p>
        The
        <NuxtLink :to="localePath('/tools/saas-valuation-calculator')">valuation calculator</NuxtLink>
        shows a low, mid, and high range from the multiples disclosed on that page. Those figures are Product Atlas assumptions, not an industry guarantee.
      </p>
    </section>

    <section>
      <h2>{{ pick('下一步', 'Next step') }}</h2>
      <p v-if="skuReady">
        <NuxtLink class="btn btn--primary" :to="localePath('/for-sale/list')">{{ SELLER_CTA }}</NuxtLink>
      </p>
      <p v-else>
        <strong>{{ SELLER_CTA }}</strong>
        {{ FOR_SALE_PLANNED_FEE }}
      </p>
      <p>
        <NuxtLink :to="localePath('/submit')">{{ pick('提交产品', 'Submit a product') }}</NuxtLink>
      </p>
    </section>

    <section>
      <h2>{{ pick('免责', 'Disclaimer') }}</h2>
      <p>
        Product Atlas does not guarantee a sale, does not hold funds, and does not verify income.
      </p>
    </section>

    <!-- SEO-GEO long-form comparison body is not in this PR. Leave this section empty until that draft is reviewed. -->
    <section aria-labelledby="flippa-longform">
      <h2 id="flippa-longform">{{ pick('长文对比', 'Long-form comparison') }}</h2>
      <p>
        Reserved for a separately reviewed article. This section is empty on purpose.
      </p>
    </section>
  </div>
</template>

<style scoped>
section { max-width: 44rem; margin-top: 28px; }
h2 { font-size: 22px; margin-bottom: 8px; }
p, li { line-height: 1.55; }
</style>
