<script setup lang="ts">
/**
 * /leaderboard is retired. /weekly already shows the current board and every
 * archived week, so a second "Hall of fame" page only split the same votes
 * across two URLs. Keep the old address alive as a 301 so existing links and
 * search results land on the one canonical ranking page.
 */
const localePath = useLocalePath()
await navigateTo(localePath('/weekly'), { redirectCode: 301, replace: true })
</script>

<template>
  <div class="container leaderboard-redirect" aria-hidden="true" />
</template>

<style scoped>
.leaderboard-redirect { min-height: 40vh; }
</style>
