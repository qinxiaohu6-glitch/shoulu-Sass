<script setup lang="ts">
/**
 * Source `components/directory/AdsList.tsx`.
 *
 * What is ported: the card shell, the empty state with its "Become a sponsor"
 * action, and the per-row layout — icon, name link, tier badge, status badge,
 * tagline, and the date range on the right.
 *
 * What is not: the `pending_payment` actions (cancel payment / continue
 * payment) and the `expired` rebook link. All three exist only for a row this
 * build can never produce — `ads` has no owner column, so there is no "my ads"
 * query to begin with (see the page header). Porting a checkout flow that
 * cannot be reached would be a button that always fails, which is worse than
 * its absence.
 */
import { ExternalLink } from 'lucide-vue-next'

export type SponsorAdRow = {
  id: string
  name: string
  tagline: string
  url: string
  iconUrl?: string | null
  tier: string
  status: 'active' | 'pending_payment' | 'expired' | string
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
}

const props = defineProps<{ items: SponsorAdRow[] }>()

const { t } = useSettingsI18n()
const localePath = useLocalePath()

/** Source's card class string, unchanged. */
const CARD =
  'group/card bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1'

function tierLabel(tier: string) {
  return t(`dir.sponsor.tier_${tier.replace('-', '_')}`)
}

function statusLabel(ad: SponsorAdRow) {
  if (ad.status === 'active') return t('dir.sponsor.status_active')
  if (ad.status === 'pending_payment') return t('directory.settings_status_pending_payment')
  return t('dir.sponsor.status_inactive')
}

/** `startsAt`/`endsAt` are `YYYY-MM-DD…`; the list only ever shows the day. */
function range(ad: SponsorAdRow) {
  return ad.startsAt && ad.endsAt
    ? `${ad.startsAt.slice(0, 10)} — ${ad.endsAt.slice(0, 10)}`
    : ad.createdAt.slice(0, 10)
}
</script>

<template>
  <div v-if="props.items.length === 0" :class="CARD">
    <div class="py-12 text-center">
      <p class="text-sm text-muted-foreground">{{ t('directory.settings_no_ads_desc') }}</p>
      <NuxtLink
        :to="localePath({ path: '/advertise', hash: '#sponsors' })"
        class="mt-4 inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <span>{{ t('directory.settings_become_sponsor') }}</span>
      </NuxtLink>
    </div>
  </div>

  <div v-else :class="CARD">
    <div class="divide-y divide-border px-6">
      <div
        v-for="ad in props.items"
        :key="ad.id"
        class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <SettingsListIcon :src="ad.iconUrl" :alt="ad.name" />

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <a
                :href="ad.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 truncate text-sm leading-none font-medium hover:underline"
              >
                <span>{{ ad.name }}</span>
                <ExternalLink class="size-3 text-muted-foreground" />
              </a>

              <span
                class="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] leading-none font-medium"
              >
                {{ tierLabel(ad.tier) }}
              </span>

              <span
                class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium"
                :class="
                  ad.status === 'active'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                "
              >
                {{ statusLabel(ad) }}
              </span>
            </div>

            <p class="mt-1 truncate text-xs text-muted-foreground">{{ ad.tagline }}</p>
          </div>
        </div>

        <div class="flex shrink-0 flex-col items-end gap-2">
          <p class="text-xs text-muted-foreground tabular-nums">{{ range(ad) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
