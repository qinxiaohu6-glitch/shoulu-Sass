<script setup lang="ts">
/**
 * Dark promo bar. The Prime $49 → $34 pair is the approved banner narrative
 * only. Billboard checkout stays pay-what-you-want from $15, with no campaign cut.
 */
import { CAMPAIGN, campaignActive } from '~~/shared/content/campaign'
import { remainingDayHour } from '~~/shared/utils/directory-window'

const { pick } = useLang()
const localePath = useLocalePath()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const active = computed(() => campaignActive(now.value))
const left = computed(() => remainingDayHour(Date.parse(CAMPAIGN.endsAt), now.value))
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
    <span class="bf-bar__pill">{{ pick('黑色星期五', 'Black Friday') }}</span>
    <span class="bf-bar__copy">
      {{ pick('最高约三折优惠', 'up to ~30% off') }}
      · {{ pick('优先档', 'Prime') }}
      <s>$49</s>
      $34
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
