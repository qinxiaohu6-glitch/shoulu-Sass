<script setup lang="ts">
import { termsOfService } from '~~/shared/content/legal'

const { isZh } = useLang()

useSeo({
  title: computed(() =>
    isZh.value ? '服务条款 · dirtool' : 'Terms of Service · dirtool',
  ),
  description: computed(() =>
    isZh.value
      ? '使用本站及其服务的规则。'
      : 'The rules for using this site and its services.',
  ),
})
</script>

<template>
  <LegalDocument :doc="termsOfService" />
</template>
