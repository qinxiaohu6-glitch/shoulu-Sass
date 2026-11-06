<script setup lang="ts">
import { privacyPolicy } from '~~/shared/content/legal'

const { isZh } = useLang()

useSeo({
  title: computed(() =>
    isZh.value ? '隐私政策 · Product Atlas' : 'Privacy Policy · Product Atlas',
  ),
  description: computed(() =>
    isZh.value
      ? '我们如何收集、使用与保护你的个人信息。'
      : 'How we collect, use and protect your personal information.',
  ),
})
</script>

<template>
  <LegalDocument :doc="privacyPolicy" />
</template>
