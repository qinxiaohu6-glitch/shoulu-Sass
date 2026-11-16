<script setup lang="ts">
import { LIVE_NUMBERS, freeQueueLine } from '~~/shared/utils/batch2'

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const { data } = await useAsyncData('live-directory-facts', async () => {
  try {
    return await requestFetch<{
      ok: boolean
      products: number
      free_pending: number
      billboard_confirmed: number
      bookable_weeks: number
    }>('/api/stats')
  } catch {
    return null
  }
})

const ready = computed(() => Boolean(data.value?.ok))

function listingsLine(count: number): string {
  return pick(
    `${count} 条在架收录`,
    `${count} live ${count === 1 ? 'listing' : 'listings'}`,
  )
}

function queueLine(count: number): string {
  return pick(`${count} 条免费收录等待审核`, freeQueueLine(count))
}

function billboardLine(count: number): string {
  return pick(
    `${count} 个已确认的 Billboard 展示位`,
    `${count} confirmed Billboard ${count === 1 ? 'slot' : 'slots'}`,
  )
}

function weeksLine(count: number): string {
  return pick(
    `${count} 个可订的右栏周次`,
    `${count} bookable sidebar ${count === 1 ? 'week' : 'weeks'}`,
  )
}
</script>

<template>
  <section v-if="ready" class="live-facts" aria-label="Directory numbers">
    <ul>
      <li>{{ listingsLine(data!.products) }}</li>
      <li>{{ queueLine(data!.free_pending) }}</li>
      <li>{{ billboardLine(data!.billboard_confirmed) }}</li>
      <li>{{ weeksLine(data!.bookable_weeks) }}</li>
    </ul>
    <p>{{ pick('本页这些数字来自正在运行的目录。没有估算访问量，也没有权重。', LIVE_NUMBERS) }}</p>
    <p>
      <NuxtLink :to="localePath('/stats')">{{ pick('查看统计页', 'Directory numbers') }}</NuxtLink>
    </p>
  </section>
  <p v-else class="live-facts">
    <NuxtLink :to="localePath('/stats')">{{ pick('查看统计页上的活数字', 'Live numbers are on the stats page') }}</NuxtLink>
  </p>
</template>

<style scoped>
.live-facts {
  margin: 18px 0 8px;
  font-size: 14px;
  line-height: 1.5;
}
.live-facts ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}
.live-facts a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
