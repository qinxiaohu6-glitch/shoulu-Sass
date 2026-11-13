<script setup lang="ts">
/**
 * Dismissible campaign chip. It only renders while the campaign clock is on,
 * and it only links to the pricing anchor. Dismissal is local to this browser.
 */
import { campaignActive, campaignDeadlineShanghai } from '~~/shared/content/billboard'

const { pick } = useLang()
const localePath = useLocalePath()
const hidden = ref(true)

onMounted(() => {
  hidden.value = window.localStorage.getItem('campaign-float-dismissed') === '1'
})

function dismiss() {
  hidden.value = true
  window.localStorage.setItem('campaign-float-dismissed', '1')
}
</script>

<template>
  <aside v-if="campaignActive() && !hidden" class="campaign-float">
    <NuxtLink :to="`${localePath('/pricing')}#black-friday`">
      <strong>{{ pick('黑五', 'Black Friday') }}</strong>
      <span>{{ pick(`截止 ${campaignDeadlineShanghai()}`, `ends ${campaignDeadlineShanghai()}`) }}</span>
    </NuxtLink>
    <button type="button" :aria-label="pick('关闭', 'Dismiss')" @click="dismiss">×</button>
  </aside>
</template>

<style scoped>
.campaign-float {
  position: fixed;
  z-index: 40;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(320px, calc(100vw - 32px));
  padding: 10px 10px 10px 14px;
  border-radius: 16px;
  background: #111;
  color: #fff;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
}
.campaign-float a {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #fff;
  text-decoration: none;
}
.campaign-float strong { font-size: 13px; color: #fde68a; }
.campaign-float span { font-size: 12px; line-height: 1.35; }
.campaign-float button {
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
}
</style>
