<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/terms-of-service'), { redirectCode: 301 })
</script>
