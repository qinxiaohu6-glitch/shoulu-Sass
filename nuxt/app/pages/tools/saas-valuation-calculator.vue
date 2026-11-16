<script setup lang="ts">
/**
 * The range is computed in the browser. This page does not post the inputs.
 */
import { FOR_SALE_PLANNED_FEE } from '~~/shared/content/for-sale'
import {
  VALUATION_ASSUMPTIONS,
  VALUATION_CTA,
  VALUATION_FOOTER,
  VALUATION_H1,
  VALUATION_META,
  VALUATION_NOT_UPLOADED,
  VALUATION_RESULT,
  VALUATION_SUBHEAD,
  VALUATION_TITLE,
  calculateValuation,
  type ValuationOutput,
} from '~~/shared/utils/valuation'

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const period = ref<'month' | 'year'>('month')
const revenue = ref('')
const margin = ref('')
const growth = ref('')
const churn = ref('')
const result = ref<ValuationOutput | null>(null)

const { data: config } = await useAsyncData(
  'for-sale-sku',
  () => requestFetch<{ ready?: boolean }>('/api/for-sale/config').catch(() => ({ ready: false })),
  { default: () => ({ ready: false }) },
)
const skuReady = computed(() => Boolean(config.value?.ready))

function onCalculate() {
  result.value = calculateValuation({
    period: period.value,
    revenue: Number(revenue.value),
    marginPercent: Number(margin.value),
    growthPercent: Number(growth.value),
    churnPercent: Number(churn.value),
  })
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

useSeo({
  title: computed(() => pick('SaaS 估值计算器 · Product Atlas', VALUATION_TITLE)),
  description: computed(() => pick('根据收入、利润率、增长和流失，在浏览器里算出低、中、高区间。区间是起点，不是出价。', VALUATION_META)),
})
</script>

<template>
  <div class="container tool-page">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/tools')">{{ pick('工具', 'Tools') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ VALUATION_H1 }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ VALUATION_H1 }}</h1>
      <p class="page-sub">{{ VALUATION_SUBHEAD }}</p>
      <p>{{ VALUATION_NOT_UPLOADED }}</p>
    </header>

    <form class="val-form" @submit.prevent="onCalculate">
      <label>
        {{ pick('收入周期', 'Revenue period') }}
        <select v-model="period">
          <option value="month">{{ pick('月', 'Month') }}</option>
          <option value="year">{{ pick('年', 'Year') }}</option>
        </select>
      </label>
      <label>
        {{ pick('收入金额', 'Revenue amount') }}
        <input v-model="revenue" inputmode="decimal" required >
      </label>
      <label>
        {{ pick('利润率（%）', 'Profit margin (%)') }}
        <input v-model="margin" inputmode="decimal" required >
      </label>
      <label>
        {{ pick('年增长（%）', 'Annual growth (%)') }}
        <input v-model="growth" inputmode="decimal" required >
      </label>
      <label>
        {{ pick('月流失（%）', 'Monthly churn (%)') }}
        <input v-model="churn" inputmode="decimal" required >
      </label>
      <button class="btn btn--primary" type="submit">{{ VALUATION_CTA }}</button>
    </form>

    <section v-if="result" class="val-result" aria-live="polite">
      <template v-if="result.showMultiple">
        <p>{{ VALUATION_RESULT }}</p>
        <dl>
          <div><dt>Low</dt><dd>{{ money(result.low) }} · {{ result.lowMultiple }}×</dd></div>
          <div><dt>Mid</dt><dd>{{ money(result.mid) }} · {{ result.midMultiple }}×</dd></div>
          <div><dt>High</dt><dd>{{ money(result.high) }} · {{ result.highMultiple }}×</dd></div>
        </dl>
      </template>
      <p v-else-if="result.reason === 'non_positive_profit'">
        If profit is zero or negative, we do not show a profit multiple, and we do not substitute a revenue multiple to invent a price-like number.
      </p>
      <p v-else>
        {{ pick('请填入收入、利润率、增长和流失。', 'Enter revenue, margin, growth, and churn.') }}
      </p>
      <ul>
        <li v-for="line in VALUATION_ASSUMPTIONS" :key="line">{{ line }}</li>
      </ul>
    </section>

    <footer class="val-foot">
      <p>{{ VALUATION_FOOTER }}</p>
      <p v-if="!skuReady">{{ FOR_SALE_PLANNED_FEE }}</p>
      <p>
        <NuxtLink :to="localePath('/for-sale')">{{ pick('待售', 'Products for sale') }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/alternatives/flippa')">Flippa alternatives</NuxtLink>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.val-form, .val-result, .val-foot { max-width: 40rem; }
.val-form { display: grid; gap: 12px; }
.val-form label { display: grid; gap: 4px; }
.val-result { margin-top: 20px; line-height: 1.5; }
.val-result dt { color: var(--muted-foreground); }
.val-foot { margin-top: 28px; color: var(--muted-foreground); font-size: 14px; line-height: 1.5; }
</style>
