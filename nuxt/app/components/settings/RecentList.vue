<script setup lang="ts">
/** Source `routes/settings/-dashboard-widgets.tsx` — `RecentList`. */
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  href: string
  loading: boolean
  empty: string
  /** Number of rows the caller is rendering — `children.length` in the source. */
  count: number
}>()

const { t } = useSettingsI18n()
const localePath = useLocalePath()
</script>

<template>
  <UiCard>
    <UiCardHeader class="flex flex-row items-center justify-between">
      <UiCardTitle class="text-base">{{ props.title }}</UiCardTitle>
      <NuxtLink
        :to="localePath(props.href)"
        class="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
      >
        {{ t('settings.overview.view_all') }}
        <ChevronRight class="size-4" />
      </NuxtLink>
    </UiCardHeader>
    <UiCardContent>
      <div v-if="props.loading" class="space-y-3">
        <UiSkeleton v-for="i in 3" :key="i" class="h-9 w-full" />
      </div>
      <p v-else-if="props.count === 0" class="py-8 text-center text-sm text-muted-foreground">
        {{ props.empty }}
      </p>
      <ul v-else class="divide-y divide-border">
        <slot />
      </ul>
    </UiCardContent>
  </UiCard>
</template>
