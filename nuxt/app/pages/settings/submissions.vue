<script setup lang="ts">
/**
 * /settings/submissions — source `routes/settings/submissions.tsx`.
 *
 * Header, the two pill actions and the list below them are the source's. The
 * list itself lives in `SettingsSubmissionsList`, which is the port of
 * `components/directory/SubmissionsList.tsx` and does the shape mapping.
 *
 * The source's loader redirects to `/sign-in` when the module reports
 * `unauthorized`. The settings layout already does that before the page runs, so
 * there is no second guard here — it would only be reachable by a redirect race.
 */
import { Megaphone, Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const localePath = useLocalePath()
const { items } = useMySubmissions()

useHead({
  title: computed(() => `${t('directory.settings_submissions_title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ t('directory.settings_submissions_title') }}</h1>
        <p class="mt-1 text-base text-muted-foreground">
          {{ t('directory.settings_submissions_desc') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          :to="localePath('/advertise')"
          class="inline-flex h-7 items-center gap-1 rounded-full border border-input bg-background px-2.5 text-xs font-medium transition hover:bg-accent hover:text-accent-foreground"
        >
          <Megaphone class="size-3.5" />
          <span>{{ t('directory.settings_become_sponsor') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="localePath('/submit')"
          class="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus class="size-3.5" />
          <span>{{ t('directory.settings_submit_short') }}</span>
        </NuxtLink>
      </div>
    </div>

    <SettingsSubmissionsList :items="items" />
  </div>
</template>
