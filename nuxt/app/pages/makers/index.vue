<script setup lang="ts">
/**
 * Old maker index. The directory now lives at /community/makers.
 * Server middleware answers a 301 first; this covers client-side navigation.
 */
const route = useRoute()
const target = makerLegacyRedirect(route.path) || '/community/makers'
await navigateTo(target, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
