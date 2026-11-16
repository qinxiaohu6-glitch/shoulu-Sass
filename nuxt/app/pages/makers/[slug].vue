<script setup lang="ts">
/**
 * Old maker profile. The directory now lives at /community/makers/{slug}.
 */
const route = useRoute()
const target = makerLegacyRedirect(route.path)
if (!target) {
  throw createError({ statusCode: 404, statusMessage: 'No such maker', fatal: true })
}
await navigateTo(target, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
