<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/privacy-policy'), { redirectCode: 301 })
</script>
