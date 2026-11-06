<script setup lang="ts">
/**
 * Source `components/user-cell.tsx` — avatar + name + email, linking to the
 * user's detail page. `newTab` defaults to true there; the users list passes
 * false so a click stays in the same tab.
 */
const props = withDefaults(
  defineProps<{
    userId: string
    name?: string | null
    email?: string | null
    image?: string | null
    newTab?: boolean
  }>(),
  { newTab: true, name: '', email: '', image: null },
)

const initial = computed(() => (props.name || props.email || '?').charAt(0).toUpperCase())
</script>

<template>
  <NuxtLink
    :to="`/admin/users/${props.userId}`"
    :target="props.newTab ? '_blank' : undefined"
    :rel="props.newTab ? 'noopener noreferrer' : undefined"
    class="flex min-w-0 items-center gap-3 rounded-md hover:opacity-80"
  >
    <UiAvatar class="size-8">
      <UiAvatarImage :src="props.image" :fallback="initial" fallback-class="text-xs" />
    </UiAvatar>
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-sm font-medium">{{ props.name || '—' }}</span>
      <span class="text-muted-foreground truncate text-xs">
        {{ props.email || props.userId }}
      </span>
    </div>
  </NuxtLink>
</template>
