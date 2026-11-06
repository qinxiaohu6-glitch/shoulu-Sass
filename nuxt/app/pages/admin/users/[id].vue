<script setup lang="ts">
/**
 * /admin/users/:id — source `shipany-dir/src/routes/admin/users_.$id.tsx`.
 *
 * Profile header, four totals, the sign-up attribution card, then the three
 * ledgers. The URL is unchanged from the source; the file moved into a folder
 * because Nuxt only nests `users/[id].vue` under `users/index.vue` — TanStack's
 * `users_.$id` opt-out has no Nuxt spelling.
 *
 * What this build can actually fill in: the identity (Google `sub` / name /
 * email), the join date (first recorded activity), and the ticket timeline.
 * Everything else — attribution, IP, country, locale, roles, credits, orders —
 * has no source in this schema and comes back empty, so the page shows the
 * source's own "Direct / unknown", "—" and "No roles" rather than inventing
 * values. See `server/utils/admin-users.ts`.
 */
definePageMeta({ layout: 'admin' })

import { ArrowLeft, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { formatOrderAmount, type AdminUserDetail } from '~/utils/admin-user-detail-ui'

const { t } = useSettingsI18n()
const api = useAdminApi()
const route = useRoute()

const id = computed(() => String(route.params.id ?? ''))

const { data, status, error } = await useAsyncData<AdminUserDetail | null>(
  `admin-user-${id.value}`,
  () => api.get<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id.value)}`),
  { watch: [id], default: () => null },
)

const detail = computed(() => data.value)
const loading = computed(() => status.value === 'pending')
const failure = computed(() =>
  error.value ? (error.value as Error).message || t('admin.user_detail.not_found') : '',
)

const FIELD_ROW = 'grid grid-cols-[140px_1fr] gap-3 py-2 text-sm'

const utmFields = computed<[string, string][]>(() => {
  const user = detail.value?.user
  if (!user) return []
  return [
    ['utm_source', user.utmSource],
    ['utm_medium', user.utmMedium],
    ['utm_campaign', user.utmCampaign],
    ['utm_term', user.utmTerm],
    ['utm_content', user.utmContent],
  ]
})

const paidValue = computed(() => {
  const amounts = detail.value?.stats.paidAmounts ?? []
  return amounts.length > 0
    ? amounts.map((p) => formatOrderAmount(p.amount, p.currency)).join(' + ')
    : formatOrderAmount(0, 'USD')
})

const statCards = computed(() => {
  const s = detail.value?.stats
  return [
    { label: t('admin.user_detail.stat_balance'), value: (s?.creditBalance ?? 0).toLocaleString(), hint: '' },
    { label: t('admin.user_detail.stat_granted'), value: (s?.creditsGranted ?? 0).toLocaleString(), hint: '' },
    { label: t('admin.user_detail.stat_consumed'), value: (s?.creditsConsumed ?? 0).toLocaleString(), hint: '' },
    {
      label: t('admin.user_detail.stat_paid'),
      value: paidValue.value,
      hint: t('admin.user_detail.stat_orders', {
        paid: s?.paidOrderCount ?? 0,
        total: s?.orderCount ?? 0,
      }),
    },
  ]
})

function copyEmail() {
  const email = detail.value?.user.email
  if (!email) return
  navigator.clipboard.writeText(email).then(() => toast.success(t('admin.user_detail.copied')))
}
</script>

<template>
  <div v-if="loading" class="space-y-6 p-6">
    <UiSkeleton class="h-16 w-72" />
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiSkeleton v-for="i in 4" :key="i" class="h-24" />
    </div>
    <UiSkeleton class="h-64" />
  </div>

  <div v-else-if="detail" class="space-y-6 p-6">
    <NuxtLink
      to="/admin/users"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-4" />
      {{ t('admin.user_detail.back') }}
    </NuxtLink>

    <div class="flex flex-wrap items-center gap-4">
      <UiAvatar class="size-14">
        <UiAvatarImage
          :src="detail.user.image"
          :fallback="(detail.user.name || detail.user.email).charAt(0).toUpperCase()"
        />
      </UiAvatar>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-bold">{{ detail.user.name || '—' }}</h1>
        <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span class="truncate">{{ detail.user.email }}</span>
          <UiBadge :variant="detail.user.emailVerified ? 'default' : 'secondary'">
            {{
              detail.user.emailVerified
                ? t('admin.user_detail.email_verified')
                : t('admin.user_detail.email_unverified')
            }}
          </UiBadge>
          <span>
            {{ t('admin.user_detail.joined', { date: formatDateTime(detail.user.createdAt) }) }}
          </span>
        </div>
      </div>
      <UiButton variant="outline" size="sm" @click="copyEmail">
        <Copy class="size-4" />
        {{ t('admin.user_detail.copy_email') }}
      </UiButton>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiCard v-for="card in statCards" :key="card.label">
        <UiCardContent class="space-y-1">
          <p class="text-muted-foreground text-sm">{{ card.label }}</p>
          <p class="text-2xl font-semibold tabular-nums">{{ card.value }}</p>
          <p v-if="card.hint" class="text-muted-foreground text-xs">{{ card.hint }}</p>
        </UiCardContent>
      </UiCard>
    </div>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>{{ t('admin.user_detail.attribution_title') }}</UiCardTitle>
        <UiCardDescription>{{ t('admin.user_detail.attribution_desc') }}</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <dl class="grid gap-x-8 md:grid-cols-2">
          <div class="divide-y">
            <div :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ t('admin.user_detail.referrer') }}</dt>
              <dd class="min-w-0 break-words">
                <a
                  v-if="detail.user.referrer"
                  :href="detail.user.referrer"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="font-mono text-xs underline-offset-4 hover:underline"
                >
                  {{ detail.user.referrer }}
                </a>
                <span v-else class="text-muted-foreground">{{ t('admin.user_detail.direct') }}</span>
              </dd>
            </div>
            <div v-for="[label, value] in utmFields" :key="label" :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ label }}</dt>
              <dd class="min-w-0 break-words">
                <span
                  v-if="value"
                  class="bg-muted inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                >
                  {{ value }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </dd>
            </div>
          </div>

          <div class="divide-y">
            <div :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ t('admin.user_detail.ip') }}</dt>
              <dd class="min-w-0 break-words">
                <span v-if="detail.user.ip" class="font-mono text-xs">{{ detail.user.ip }}</span>
                <span v-else class="text-muted-foreground">—</span>
              </dd>
            </div>
            <div :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ t('admin.user_detail.country') }}</dt>
              <dd class="min-w-0 break-words">{{ detail.user.country || '—' }}</dd>
            </div>
            <div :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ t('admin.user_detail.locale') }}</dt>
              <dd class="min-w-0 break-words">{{ detail.user.locale || '—' }}</dd>
            </div>
            <div :class="FIELD_ROW">
              <dt class="text-muted-foreground">{{ t('admin.user_detail.roles') }}</dt>
              <dd class="min-w-0 break-words">
                <div v-if="detail.roles.length > 0" class="flex flex-wrap gap-1">
                  <UiBadge v-for="r in detail.roles" :key="r.roleId" variant="outline">
                    {{ r.roleTitle || r.roleName }}
                  </UiBadge>
                </div>
                <span v-else class="text-muted-foreground">
                  {{ t('admin.user_detail.no_roles') }}
                </span>
              </dd>
            </div>
          </div>
        </dl>
      </UiCardContent>
    </UiCard>

    <AdminUserTimeline :user-id="detail.user.id" />
    <AdminUserOrders :user-id="detail.user.id" />
    <AdminUserCredits :user-id="detail.user.id" />
  </div>

  <div v-else class="space-y-4 p-6">
    <NuxtLink
      to="/admin/users"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-4" />
      {{ t('admin.user_detail.back') }}
    </NuxtLink>
    <p class="text-muted-foreground">{{ failure || t('admin.user_detail.not_found') }}</p>
  </div>
</template>
