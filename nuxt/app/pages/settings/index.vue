<script setup lang="ts">
/**
 * /settings — source `routes/settings/-dashboard-page.tsx`.
 *
 * Card set, order, icons and copy follow the source. What differs is where the
 * numbers come from, because three of the source's data sources do not exist in
 * this build:
 *
 *  - **Submissions / ads** — the source asks its directory module for
 *    `{ submissions, ads }`. This build has `/api/my/submissions` only, so
 *    submissions is that list's length and ads is 0 (there is no sponsor
 *    booking, which is also why `/advertise` cannot complete a booking).
 *  - **Tickets** — real: `/api/tickets?limit=1` returns `total`.
 *  - **Plan, credits, payments** — no subscription, credit-ledger or order API
 *    exists here. The source renders `Free` for "no subscription" and `—` for a
 *    balance it could not read, and both are the truthful answer, so they are
 *    rendered directly instead of faking a request. The two "recent" lists fall
 *    back to the source's own empty strings.
 *
 * `FEATURES` is the source's `config/user-features.ts` default set — the same
 * flags the settings nav reads, so a card never points at a page the nav hides.
 */
import { Coins, Layers, LifeBuoy, Megaphone, Sparkles } from 'lucide-vue-next'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const { user } = useSession()
const localePath = useLocalePath()

const FEATURES = { credits: true, billing: true, payments: true, apikeys: false, tickets: true }
const GUEST_POSTS_ENABLED = false

const requestFetch = useRequestFetch()

type Page = { items: unknown[]; total: number }

const [{ data: tickets }, { data: replied }, { data: submissions }] = await Promise.all([
  useAsyncData('settings-tickets-count', () =>
    requestFetch<Page>('/api/tickets?limit=1').catch(() => ({ items: [], total: 0 })),
  ),
  useAsyncData('settings-tickets-replied', () =>
    requestFetch<Page>('/api/tickets?status=replied&limit=1').catch(() => ({ items: [], total: 0 })),
  ),
  useAsyncData('settings-submissions-count', () =>
    requestFetch<{ items: unknown[] }>('/api/my/submissions').catch(() => ({ items: [] })),
  ),
])

const ticketTotal = computed(() => tickets.value?.total ?? 0)
const repliedTotal = computed(() => replied.value?.total ?? 0)
const submissionCount = computed(() => submissions.value?.items?.length ?? 0)
const adCount = 0

const name = computed(() => user.value?.name || user.value?.email || '')

const planValue = t('settings.overview.plan_free')
const planHint = t('settings.overview.plan_free_description')

const statCards = computed(
  () =>
    [FEATURES.billing, FEATURES.credits, FEATURES.apikeys, FEATURES.tickets, GUEST_POSTS_ENABLED].filter(
      Boolean,
    ).length,
)

const hasRecent = computed(() => FEATURES.payments || FEATURES.credits)

useHead({
  title: computed(() => `${t('settings.nav.overview')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <div class="space-y-6 p-4 md:p-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('settings.nav.overview') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ name ? t('settings.welcome', { name }) : ' ' }}
      </p>
    </div>

    <div v-if="statCards > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SettingsStatCard
        v-if="FEATURES.billing"
        href="/settings/billing"
        :title="t('settings.overview.plan')"
        :icon="Sparkles"
        :hint="planHint"
      >
        <template #value>{{ planValue }}</template>
        <template #action>
          <UiButton as="a" variant="outline" size="xs" :href="localePath('/pricing')">
            {{ t('settings.overview.upgrade') }}
          </UiButton>
        </template>
      </SettingsStatCard>

      <SettingsStatCard
        v-if="FEATURES.credits"
        href="/settings/credits"
        :title="t('settings.credits.balance')"
        :icon="Coins"
        :hint="t('settings.billing.credits_description')"
      >
        <template #value>—</template>
        <template #action>
          <UiButton as="a" variant="outline" size="xs" :href="localePath('/pricing')">
            {{ t('settings.credits.purchase') }}
          </UiButton>
        </template>
      </SettingsStatCard>

      <SettingsStatCard
        v-if="FEATURES.tickets"
        href="/settings/tickets"
        :title="t('settings.nav.tickets')"
        :icon="LifeBuoy"
        :hint="
          repliedTotal > 0
            ? t('settings.overview.tickets_replied', { count: repliedTotal })
            : t('settings.overview.tickets_none')
        "
      >
        <template #value>{{ ticketTotal }}</template>
      </SettingsStatCard>

      <SettingsStatCard
        href="/settings/submissions"
        :title="t('directory.settings_submissions_title')"
        :icon="Layers"
        :hint="t('directory.settings_submissions_desc')"
      >
        <template #value>{{ submissionCount }}</template>
        <template #action>
          <UiButton as="a" variant="outline" size="xs" :href="localePath('/submit')">
            {{ t('directory.submit') }}
          </UiButton>
        </template>
      </SettingsStatCard>

      <SettingsStatCard
        href="/settings/ads"
        :title="t('directory.settings_ads_title')"
        :icon="Megaphone"
        :hint="t('directory.settings_ads_desc')"
      >
        <template #value>{{ adCount }}</template>
        <template #action>
          <UiButton as="a" variant="outline" size="xs" :href="localePath('/advertise')">
            {{ t('directory.for_makers') }}
          </UiButton>
        </template>
      </SettingsStatCard>
    </div>

    <div
      v-if="hasRecent"
      class="grid gap-4"
      :class="FEATURES.payments && FEATURES.credits && 'lg:grid-cols-2'"
    >
      <SettingsRecentList
        v-if="FEATURES.payments"
        :title="t('settings.overview.recent_payments')"
        href="/settings/payments"
        :loading="false"
        :empty="t('settings.payments.no_payments')"
        :count="0"
      />
      <SettingsRecentList
        v-if="FEATURES.credits"
        :title="t('settings.overview.recent_credits')"
        href="/settings/credits"
        :loading="false"
        :empty="t('settings.credits.no_records')"
        :count="0"
      />
    </div>
  </div>
</template>
