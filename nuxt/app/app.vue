<script setup lang="ts">
// `<html lang>` has to follow the active locale, otherwise /zh is announced as
// English to screen readers and to search engines. nuxt.config sets no static
// lang on purpose — this is the single source of truth.
const { locale } = useI18n()

useHead({
  htmlAttrs: {
    // `zh-Hans` is what the live site emits, and legacy.css scopes the serif
    // headline voice to `html[lang="en"]` — so the exact tag matters.
    lang: computed(() => (locale.value === 'zh' ? 'zh-Hans' : 'en')),
  },
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Source mounts the toaster once in `routes/__root.tsx`; same place here. -->
    <UiSonner />
  </UApp>
</template>
