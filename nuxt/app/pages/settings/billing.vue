<script setup lang="ts">
/**
 * /settings/billing — source `routes/settings/-billing-page.tsx`.
 *
 * Header, the "Active subscriptions" block with its empty card, the seven
 * status tabs and the nine-column subscription table are the source's.
 *
 * Every list is empty because this build sells listings, not subscriptions:
 * there is no subscription table, no renewal job and no cancel endpoint. The
 * source renders exactly this for an account that has never subscribed — one
 * "No active subscription" card and an empty table — so the page is a true
 * empty state.
 *
 * Not ported: `-billing-dialogs.tsx` (the view / cancel-confirm dialogs). Both
 * are only reachable from a row's action menu, and with no rows there is
 * nothing to open them from. Porting them would be two dialogs no click can
 * reach.
 */
import { MoreHorizontal, Plus, XCircle, Eye } from 'lucide-vue-next'
import { buttonVariants, cn, type DataColumn } from '~/utils/ui'
import {
  PAGE_SIZE,
  TABS,
  formatAmount,
  formatInterval,
  isCancellable,
  statusLabel,
  statusVariant,
  subscriptionTitle,
  type Subscription,
  type Tab,
} from '~/utils/billing-ui'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const localePath = useLocalePath()

const tab = ref<Tab>('all')
const page = ref(1)
const search = ref('')

/** No subscription table in this build — see the header. */
const activeRows = computed<Subscription[]>(() => [])
const rows = computed<Subscription[]>(() => [])
const total = 0

const columns = computed<DataColumn[]>(() => [
  { key: 'no', header: t('settings.billing.subscription_no') },
  { key: 'plan', header: t('settings.billing.plan') },
  { key: 'interval', header: t('settings.billing.interval') },
  { key: 'status', header: t('settings.billing.status') },
  { key: 'amount', header: t('settings.billing.amount') },
  { key: 'period', header: t('settings.billing.current_period') },
  { key: 'end', header: t('settings.billing.end_time') },
  { key: 'date', header: t('settings.billing.date') },
  { key: 'actions', header: t('settings.billing.actions_col'), class: 'w-[80px]' },
])

useHead({
  title: computed(() => `${t('settings.billing.title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <SettingsFeatureGate feature="billing">
    <div class="space-y-6 p-6">
      <div>
        <h1 class="text-2xl font-bold">{{ t('settings.billing.title') }}</h1>
        <p class="text-muted-foreground">{{ t('settings.billing.description') }}</p>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold">
            {{ t('settings.billing.active_subscriptions') }}
          </h2>
          <NuxtLink
            :to="localePath('/advertise')"
            :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')"
          >
            <Plus class="size-3.5" />
            {{ t('settings.billing.book_sponsor') }}
          </NuxtLink>
        </div>

        <UiCard v-if="activeRows.length === 0" class="max-w-lg">
          <UiCardContent class="py-6 text-sm text-muted-foreground">
            {{ t('settings.billing.no_subscription') }}
          </UiCardContent>
        </UiCard>

        <div v-else class="grid gap-3">
          <UiCard v-for="sub in activeRows" :key="sub.id">
            <UiCardHeader class="pb-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <UiCardTitle class="text-lg">{{ subscriptionTitle(sub) }}</UiCardTitle>
                    <UiBadge variant="outline">{{ t('settings.billing.kind_plan') }}</UiBadge>
                    <UiBadge :variant="statusVariant(sub.status)">
                      {{ statusLabel(t, sub.status) }}
                    </UiBadge>
                  </div>
                  <p v-if="sub.amount && sub.currency" class="text-sm text-muted-foreground">
                    {{ formatAmount(sub.amount, sub.currency) }}
                    <template v-if="sub.interval">
                      / {{ formatInterval(t, sub.interval, sub.intervalCount) }}
                    </template>
                  </p>
                </div>
                <UiButton
                  v-if="isCancellable(sub.status)"
                  variant="destructive"
                  size="sm"
                  class="gap-1.5"
                >
                  <XCircle class="size-4" />
                  {{ t('settings.billing.cancel') }}
                </UiButton>
              </div>
            </UiCardHeader>
          </UiCard>
        </div>
      </div>

      <div class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        <button
          v-for="tb in TABS"
          :key="tb"
          :class="
            cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          "
          @click="tab = tb"
        >
          {{ t(`settings.billing.tab_${tb}`) }}
        </button>
      </div>

      <UiCard>
        <UiCardHeader class="pb-0">
          <UiCardTitle class="text-base">{{ t('settings.billing.subscriptions') }}</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <DataTable
            :columns="columns"
            :rows="rows"
            :total="total"
            :page="page"
            :page-size="PAGE_SIZE"
            :search="search"
            :empty-text="t('settings.billing.no_subscription')"
            show-refresh
            @update:page="(p: number) => (page = p)"
            @update:search="(v: string) => (search = v)"
          >
            <template #cell-no="{ row }">
              <span class="font-mono text-xs">{{ row.subscriptionNo }}</span>
            </template>
            <template #cell-plan="{ row }">
              <div class="space-y-1">
                <span class="font-medium">{{ subscriptionTitle(row) }}</span>
              </div>
            </template>
            <template #cell-interval="{ row }">
              <span class="text-sm">
                {{ row.interval ? formatInterval(t, row.interval, row.intervalCount) : '—' }}
              </span>
            </template>
            <template #cell-status="{ row }">
              <UiBadge :variant="statusVariant(row.status)">
                {{ statusLabel(t, row.status) }}
              </UiBadge>
            </template>
            <template #cell-amount="{ row }">
              <span class="tabular-nums">
                {{ row.amount && row.currency ? formatAmount(row.amount, row.currency) : '—' }}
              </span>
            </template>
            <template #cell-period="{ row }">
              <span class="text-xs whitespace-pre-line text-muted-foreground">
                {{
                  row.currentPeriodStart && row.currentPeriodEnd
                    ? `${new Date(row.currentPeriodStart).toLocaleDateString()}
~ ${new Date(row.currentPeriodEnd).toLocaleDateString()}`
                    : '—'
                }}
              </span>
            </template>
            <template #cell-end="{ row }">
              <span class="text-sm text-muted-foreground">
                {{ row.canceledEndAt ? new Date(row.canceledEndAt).toLocaleDateString() : '—' }}
              </span>
            </template>
            <template #cell-date="{ row }">
              <span class="text-sm text-muted-foreground">
                {{ row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' }}
              </span>
            </template>
            <template #cell-actions="{ row }">
              <UiDropdownMenu>
                <UiDropdownMenuTrigger as-child>
                  <UiButton variant="ghost" size="icon" class="size-7">
                    <MoreHorizontal class="size-4" />
                  </UiButton>
                </UiDropdownMenuTrigger>
                <UiDropdownMenuContent align="end">
                  <UiDropdownMenuItem disabled>
                    <Eye class="size-4" />
                    {{ t('settings.billing.view') }}
                  </UiDropdownMenuItem>
                  <UiDropdownMenuItem :disabled="!isCancellable(row.status)">
                    <XCircle class="size-4" />
                    {{ t('settings.billing.cancel') }}
                  </UiDropdownMenuItem>
                </UiDropdownMenuContent>
              </UiDropdownMenu>
            </template>
          </DataTable>
        </UiCardContent>
      </UiCard>
    </div>
  </SettingsFeatureGate>
</template>
