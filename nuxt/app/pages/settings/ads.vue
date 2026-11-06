<script setup lang="ts">
/**
 * /settings/ads — source `routes/settings/ads.tsx`.
 *
 * Header, the two pill actions and the footnote are the source's; the list
 * below them is `SettingsAdsList`, the port of `components/directory/AdsList`.
 *
 * The list is always empty here, and that is a data-model fact rather than a
 * stub: the source's "my ads" query reads `sponsor_ad.owner_id`, while this
 * build's `ads` table is a slot booking with no owner column at all
 * (`server/database/schema.sql`). There is no account to filter by, so there is
 * nothing to list. The source's own empty state — "You haven't booked any ads
 * yet" plus a "Become a sponsor" button — is exactly what a user with no
 * bookings sees, so the page is honest rather than broken.
 *
 * Wiring this up later means one column (`owner_sub`) on `ads`, one
 * `GET /api/my/ads`, and passing the result to `SettingsAdsList`; nothing in
 * the markup changes.
 */
import { Plus } from 'lucide-vue-next'
import type { SponsorAdRow } from '~/components/settings/AdsList.vue'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const localePath = useLocalePath()

/** No owner column on `ads` — see the header. */
const items: SponsorAdRow[] = []

useHead({
  title: computed(() => `${t('directory.settings_ads_title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ t('directory.settings_ads_title') }}</h1>
        <p class="mt-1 text-base text-muted-foreground">
          {{ t('directory.settings_ads_desc') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          :to="localePath('/settings/billing')"
          class="inline-flex h-7 items-center rounded-full border border-input bg-background px-2.5 text-xs font-medium transition hover:bg-accent hover:text-accent-foreground"
        >
          <span>{{ t('directory.settings_ads_manage_sub') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="localePath({ path: '/advertise', hash: '#sponsors' })"
          class="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus class="size-3.5" />
          <span>{{ t('directory.settings_book_ad') }}</span>
        </NuxtLink>
      </div>
    </div>

    <SettingsAdsList :items="items" />

    <p class="text-xs text-muted-foreground">{{ t('directory.settings_ads_footnote') }}</p>
  </div>
</template>
