<script setup lang="ts">
/**
 * Dark promo bar. Launch pricing: Featured at the live charge, and Billboard
 * from the bid floor. No Prime pair, and no percent-off line.
 */
import { CAMPAIGN, campaignActive, centsLabel } from '~~/shared/content/campaign'
import { remainingDayHour } from '~~/shared/utils/directory-window'
import { BILLBOARD_FLOOR_CENTS } from '~~/shared/utils/billboard-bid'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick } = useLang()
const localePath = useLocalePath()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const active = computed(() => campaignActive(now.value))
const left = computed(() => remainingDayHour(Date.parse(CAMPAIGN.endsAt), now.value))
const featured = computed(() => effectiveQuote('listing', 'featured', now.value))
const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)
const href = computed(() => `${localePath('/pricing')}#black-friday`)

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <NuxtLink v-if="active" class="bf-bar" :to="href">
    <span class="bf-bar__pill">{{ pick('上线定价', 'LAUNCH PRICING') }}</span>
    <span class="bf-bar__copy">
      {{ pick('精选', 'Featured') }}
      <s v-if="featured.strikeLabel">{{ featured.strikeLabel }}</s>
      {{ featured.priceLabel }}
      · {{ pick(`Billboard 从 ${floorLabel} 起`, `Billboard from ${floorLabel}`) }}
      · {{ pick(`剩余 ${left.d}天 ${left.h}小时`, `ends in ${left.d}d ${left.h}h`) }}
    </span>
    <span class="bf-bar__go" aria-hidden="true">→</span>
  </NuxtLink>
</template>

<style scoped>
.bf-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 8px 16px;
  background: #1c1408;
  color: #f8f1e3;
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.bf-bar__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f5c451;
  color: #1c1408;
  font-size: 12px;
  font-weight: 800;
}
.bf-bar__pill::before {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1.5px solid #1c1408;
}
.bf-bar s {
  opacity: 0.55;
  margin-right: 4px;
  font-weight: 500;
}
.bf-bar__go {
  font-size: 16px;
}
@media (max-width: 720px) {
  .bf-bar {
    font-size: 12px;
    text-align: center;
  }
  .bf-bar__copy {
    line-height: 1.35;
  }
}
</style>
