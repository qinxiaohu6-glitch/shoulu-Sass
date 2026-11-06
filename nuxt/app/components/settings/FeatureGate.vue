<script setup lang="ts">
/**
 * Source `routes/settings/-feature-gate.tsx`.
 *
 * Renders a user-centre page only while an admin has it switched on; otherwise
 * it sends the user to the overview. A redirect rather than a notice, because
 * payment flows land on these pages (success → payments, cancel → billing) and
 * a notice in the middle of a redirect chain is just a dead end.
 */
import type { UserFeatureKey } from '~/composables/useUserFeatures'

const props = defineProps<{ feature: UserFeatureKey }>()

const localePath = useLocalePath()
const features = useUserFeatures()

const allowed = features[props.feature]

if (!allowed) {
  await navigateTo(localePath('/settings'), { replace: true })
}
</script>

<template>
  <slot v-if="allowed" />
</template>
