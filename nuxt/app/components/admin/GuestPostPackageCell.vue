<script setup lang="ts">
/**
 * Source `routes/settings/guest-posts/-shared.tsx` — `PackageCell`.
 *
 * Package name and price, with what it includes underneath.
 */
import { packageLabel, type GuestPostPackage } from '~/utils/guest-posts-ui'

const props = defineProps<{
  productId: string
  packages: GuestPostPackage[] | undefined
}>()

const { t } = useSettingsI18n()

const pkg = computed(() => props.packages?.find((p) => p.productId === props.productId))
</script>

<template>
  <div class="text-muted-foreground">
    <span>{{ packageLabel(props.productId, props.packages) }}</span>
    <span v-if="pkg" class="block text-xs">
      {{ t('guest_posts.package_links', { count: pkg.maxLinks }) }}
    </span>
  </div>
</template>
