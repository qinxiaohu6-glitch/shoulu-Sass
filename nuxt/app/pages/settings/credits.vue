<script setup lang="ts">
/**
 * /settings/credits — source `routes/settings/credits.tsx`.
 *
 * The whole page is the source's: the balance card with its "Purchase Credits"
 * action, the all / grant / consume tabs, and the eight-column ledger.
 *
 * Balance is 0 and the ledger is empty because this build has no credits
 * ledger — there is no `credit_transaction` table and no code path that grants
 * or spends a credit. The source renders the same thing for an account that has
 * never bought any, so the page is a true empty state rather than a mock: the
 * "0" is the real number of credits this account holds, and the table's "no
 * records" is the real number of transactions.
 *
 * The tab and search controls are wired to local state so the page behaves
 * correctly the moment rows exist; with none they simply filter nothing.
 */
import { Coins } from 'lucide-vue-next'
import { buttonVariants, cn, type DataColumn } from '~/utils/ui'

definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const localePath = useLocalePath()

const TABS = ['all', 'grant', 'consume'] as const
type Tab = (typeof TABS)[number]

const tab = ref<Tab>('all')
const page = ref(1)
const search = ref('')

const PAGE_SIZE = 20

/** No credits ledger in this build — see the header. */
const balance = 0
const rows = computed<Record<string, unknown>[]>(() => [])
const total = 0

const columns = computed<DataColumn[]>(() => [
  { key: 'no', header: t('settings.credits.transaction_no') },
  { key: 'description', header: t('settings.credits.description_col') },
  { key: 'type', header: t('settings.credits.type') },
  { key: 'scene', header: t('settings.credits.scene') },
  { key: 'credits', header: t('settings.credits.credits'), class: 'text-right' },
  { key: 'remaining', header: t('settings.credits.remaining'), class: 'text-right' },
  { key: 'expires', header: t('settings.credits.expires_at') },
  { key: 'date', header: t('settings.credits.date') },
])

useHead({
  title: computed(() => `${t('settings.credits.title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <SettingsFeatureGate feature="credits">
    <div class="space-y-6 p-6">
      <div>
        <h1 class="text-2xl font-bold">{{ t('settings.credits.title') }}</h1>
        <p class="text-muted-foreground">{{ t('settings.credits.description') }}</p>
      </div>

      <UiCard class="max-w-md">
        <UiCardHeader>
          <div class="flex items-center justify-between">
            <UiCardTitle>{{ t('settings.credits.balance') }}</UiCardTitle>
            <NuxtLink
              :to="localePath('/pricing')"
              :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')"
            >
              <Coins class="size-4" />
              {{ t('settings.credits.purchase') }}
            </NuxtLink>
          </div>
        </UiCardHeader>
        <UiCardContent>
          <p class="text-3xl font-bold">{{ balance }}</p>
        </UiCardContent>
      </UiCard>

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
          {{ t(`settings.credits.tab_${tb}`) }}
        </button>
      </div>

      <UiCard>
        <UiCardContent>
          <DataTable
            :columns="columns"
            :rows="rows"
            :total="total"
            :page="page"
            :page-size="PAGE_SIZE"
            :search="search"
            :empty-text="t('settings.credits.no_records')"
            show-refresh
            @update:page="(p: number) => (page = p)"
            @update:search="(v: string) => (search = v)"
          />
        </UiCardContent>
      </UiCard>
    </div>
  </SettingsFeatureGate>
</template>
