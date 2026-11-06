<script setup lang="ts">
/**
 * The one error page the site has.
 *
 * Nuxt's default error screen is a framework page: it names Nuxt, links to
 * Nuxt's docs, and looks nothing like the rest of this site. The live site's
 * 404 is four elements on a centred page, so this reproduces that instead.
 *
 * The locale is read from the URL rather than from `useI18n()`: an error can
 * be thrown before the i18n module has resolved, and a 404 must never be the
 * thing that 500s.
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isZh = computed(() => {
  const path = useRequestURL().pathname
  return path === '/zh' || path.startsWith('/zh/')
})

const status = computed(() => Number(props.error?.statusCode) || 500)
const title = computed(() => (status.value === 404 ? '404' : String(status.value)))
const message = computed(() => {
  if (status.value === 404) return isZh.value ? '页面不存在' : 'Page not found'
  return isZh.value ? '出了点问题，请稍后再试。' : 'Something went wrong. Please try again.'
})

useHead({
  htmlAttrs: { lang: computed(() => (isZh.value ? 'zh-Hans' : 'en')) },
  title: computed(() => `${title.value} | Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex' }],
})

function goHome() {
  clearError({ redirect: isZh.value ? '/zh' : '/' })
}
</script>

<template>
  <div class="center-page">
    <div>
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>
      <button class="btn btn--primary" type="button" @click="goHome">
        {{ isZh ? '返回首页' : 'Back to home' }}
      </button>
    </div>
  </div>
</template>
