<script setup lang="ts">
/**
 * Source `routes/admin/-user-timeline.tsx` — the activity card.
 *
 * Cursor-paged, oldest-first by default so the list reads as the user's
 * journey. The event vocabulary, the dot colours, the "kind falls back to its
 * own name" label rule and the row→record links are the source's.
 *
 * Two things are thinner than the source, both because this build records less:
 *
 *  - the endpoint behind it only has tickets to merge (see
 *    `server/api/admin/users/timeline.get.ts`), so `describe()`'s order /
 *    credit / task branches never fire today — they are kept so a future table
 *    needs no UI change;
 *  - the source colours a dot from `config/events`' registry first. There is no
 *    event pipeline here, hence no registry, so only the local map applies and
 *    everything else is the source's grey.
 */
import { ArrowDownNarrowWide, ArrowUpNarrowWide, RefreshCw } from 'lucide-vue-next'
import { cn } from '~/utils/ui'
import {
  type TimelineDetail,
  type TimelineEvent,
  type TimelinePage,
} from '~/utils/admin-user-detail-ui'

const props = defineProps<{ userId: string }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

/** Oldest first by default: reads top to bottom as the user's journey. */
const order = ref<'asc' | 'desc'>('asc')
const events = ref<TimelineEvent[]>([])
const nextCursor = ref<string | null>(null)
const pending = ref(true)
const fetching = ref(false)
const failed = ref('')

const TONE_CLASSES = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  gray: 'bg-muted-foreground/50',
}

// Source `TONES`: kinds whose colour is fixed regardless of the registry.
const TONES: Record<string, string> = {
  order_paid: TONE_CLASSES.green,
  subscription_started: TONE_CLASSES.green,
  order_failed: TONE_CLASSES.red,
  order_refunded: TONE_CLASSES.red,
  subscription_canceled: TONE_CLASSES.red,
  task_failed: TONE_CLASSES.red,
  order_created: TONE_CLASSES.amber,
}

function toneOf(kind: string) {
  return TONES[kind] || TONE_CLASSES.gray
}

/** Registered kinds without a translation fall back to the kind itself. */
function labelOf(kind: string) {
  const key = `admin.user_detail.timeline_${kind}`
  const label = t(key)
  return label === key ? kind : label
}

/** Source `money()`: minor units, with a graceful fallback for odd currencies. */
function money(amount: unknown, currency: unknown) {
  if (typeof amount !== 'number') return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'USD'),
    }).format(amount / 100)
  } catch {
    return `${amount / 100} ${currency ?? ''}`.trim()
  }
}

function describe(kind: string, d: TimelineDetail): string {
  const parts: unknown[] = (() => {
    switch (kind) {
      case 'signup':
        return [d.source, d.referrer, d.country]
      case 'order_created':
      case 'order_paid':
        return [d.product, money(d.amount, d.currency), d.provider]
      case 'order_failed':
        return [d.product, d.orderNo]
      case 'order_refunded':
        return [money(d.amount, d.currency), d.orderNo]
      case 'subscription_started':
        return [d.product, d.interval, money(d.amount, d.currency)]
      case 'subscription_canceled':
        return [d.product, d.reason]
      case 'credits_granted':
        return [`+${d.credits}`, d.description || d.scene]
      case 'credits_consumed':
        return [`-${d.credits}`, d.description || d.scene]
      case 'task_created':
        return [d.mediaType, d.model, d.cost ? t('admin.user_detail.timeline_cost', { cost: String(d.cost) }) : '']
      case 'task_succeeded':
      case 'task_failed':
        return [d.mediaType, d.model]
      case 'ticket_opened':
        return [d.title]
      default:
        // Product events and custom sources: show the detail values.
        return Object.values(d).map((v) => (typeof v === 'boolean' ? String(v) : v))
    }
  })()
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ')
}

/**
 * The whole row opens the record it came from, in a new tab, keeping the
 * timeline where it was. Events without an admin page stay plain.
 */
function rowTarget(event: TimelineEvent) {
  if (event.href) return { tag: 'a', attrs: { href: event.href, target: '_blank', rel: 'noreferrer' } }
  const ref_ = event.ref
  if (!ref_) return { tag: 'div', attrs: {} }
  const to =
    ref_.type === 'order'
      ? { path: '/admin/payments', query: { search: ref_.id } }
      : ref_.type === 'subscription'
        ? { path: '/admin/subscriptions', query: { search: ref_.id } }
        : ref_.type === 'credit'
          ? { path: '/admin/credits', query: { search: ref_.id } }
          : { path: '/admin/tickets', query: { id: ref_.id } }
  return { tag: 'NuxtLink', attrs: { to, target: '_blank' } }
}

function endpoint(cursor: string | null) {
  return pageQuery('/api/admin/users/timeline', {
    userId: props.userId,
    order: order.value,
    cursor: cursor ?? undefined,
  })
}

async function load() {
  pending.value = true
  failed.value = ''
  try {
    const page = await api.get<TimelinePage>(endpoint(null))
    events.value = page.items
    nextCursor.value = page.nextCursor
  } catch (error) {
    failed.value = (error as Error).message
    events.value = []
    nextCursor.value = null
  } finally {
    pending.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || fetching.value) return
  fetching.value = true
  try {
    const page = await api.get<TimelinePage>(endpoint(nextCursor.value))
    events.value = [...events.value, ...page.items]
    nextCursor.value = page.nextCursor
  } catch (error) {
    failed.value = (error as Error).message
  } finally {
    fetching.value = false
  }
}

function toggleOrder() {
  order.value = order.value === 'asc' ? 'desc' : 'asc'
}

onMounted(load)
watch([() => props.userId, order], load)
</script>

<template>
  <UiCard>
    <UiCardHeader class="flex flex-row items-center justify-between">
      <UiCardTitle>{{ t('admin.user_detail.timeline_title') }}</UiCardTitle>
      <div class="flex items-center gap-1">
        <UiButton variant="ghost" size="sm" class="h-8" @click="toggleOrder">
          <ArrowDownNarrowWide v-if="order === 'asc'" class="size-4" />
          <ArrowUpNarrowWide v-else class="size-4" />
          {{
            order === 'asc'
              ? t('admin.user_detail.timeline_oldest_first')
              : t('admin.user_detail.timeline_newest_first')
          }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="icon"
          class="size-8"
          :aria-label="t('admin.user_detail.timeline_refresh')"
          @click="load"
        >
          <RefreshCw :class="cn('size-4', pending && 'animate-spin')" />
        </UiButton>
      </div>
    </UiCardHeader>
    <UiCardContent>
      <div v-if="pending" class="space-y-3">
        <UiSkeleton v-for="i in 5" :key="i" class="h-5 w-full" />
      </div>
      <p v-else-if="failed" class="text-muted-foreground text-sm">{{ failed }}</p>
      <p v-else-if="events.length === 0" class="text-muted-foreground text-sm">
        {{ t('admin.user_detail.timeline_empty') }}
      </p>
      <ol v-else class="border-border relative ml-1.5 border-l">
        <li v-for="event in events" :key="event.key" class="relative">
          <span
            :class="
              cn(
                'ring-background pointer-events-none absolute top-1/2 -left-[5px] z-10 size-2.5 -translate-y-1/2 rounded-full ring-2',
                toneOf(event.kind),
              )
            "
          />
          <component
            :is="rowTarget(event).tag"
            v-bind="rowTarget(event).attrs"
            class="ml-2 flex min-w-0 items-baseline gap-3 rounded-md py-1.5 pr-2 pl-3 text-sm transition-colors hover:bg-muted"
          >
            <span class="text-muted-foreground shrink-0 tabular-nums">
              {{ formatDateTime(event.at) }}
            </span>
            <span class="shrink-0 font-medium">{{ labelOf(event.kind) }}</span>
            <span
              v-if="describe(event.kind, event.detail)"
              class="text-muted-foreground min-w-0 truncate"
              :title="describe(event.kind, event.detail)"
            >
              {{ describe(event.kind, event.detail) }}
            </span>
          </component>
        </li>
      </ol>
      <UiButton
        v-if="nextCursor"
        variant="outline"
        size="sm"
        class="mt-4"
        :disabled="fetching"
        @click="loadMore"
      >
        {{ t('admin.user_detail.timeline_more') }}
      </UiButton>
    </UiCardContent>
  </UiCard>
</template>
