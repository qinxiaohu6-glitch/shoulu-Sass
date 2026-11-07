<script setup lang="ts">
/**
 * Source `components/directory/SubmissionsList.tsx`.
 *
 * The row layout, badges and button set are the source's. The data is this
 * build's own `MySubmission` shape, mapped rather than renamed:
 *
 *  - `status` — the source's four states (`published` / `pending_payment` /
 *    `rejected` / `pending`) are derived from our three plus
 *    `awaiting_payment`, which is the flag that actually decides whether a paid
 *    listing is in the review queue at all.
 *  - `tagline` ← `short`, `websiteUrl` ← `url`, `iconUrl` ← `logo`.
 *  - `featured` has no equivalent (our `slot` column only ever holds an ad
 *    position), so that badge is not rendered — the source only renders it when
 *    the flag is set.
 *
 * The pay button is rendered for a submission awaiting payment, as in the
 * source. Unlike the source — which opens a provider picker — this build
 * configures one provider server-side, so the button goes straight to checkout.
 * It used to report `common.checkout_failed` unconditionally, which made the
 * cancel page's "start the payment again from My submissions" a dead end: the
 * only place that could start a payment was the submit form itself.
 */
import type { MySubmission } from '~/composables/useMySubmissions'
import { Crown, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{ items: MySubmission[] }>()

const { t } = useSettingsI18n()
const localePath = useLocalePath()
const { ready: payReady, busy: payBusy, pay } = await usePayment()

type Status = 'published' | 'pending_payment' | 'rejected' | 'pending'

function statusOf(item: MySubmission): Status {
  if (item.status === 'approved') return 'published'
  if (item.status === 'rejected') return 'rejected'
  if (item.awaiting_payment) return 'pending_payment'
  return 'pending'
}

function statusLabel(status: Status) {
  if (status === 'published') return t('directory.settings_status_published')
  if (status === 'pending_payment') return t('directory.settings_status_pending_payment')
  if (status === 'rejected') return t('directory.settings_status_rejected')
  return t('directory.settings_status_pending')
}

/** The source's `SUBMIT_TIERS` lookup, with its own `$39` fallback. */
const premiumPrice = '$39'

const payError = ref('')

async function onPay(item: MySubmission) {
  payError.value = ''
  // `pay()` already reports a provider-side failure through the toast; this
  // inline line only covers "no provider is switched on", which is a state the
  // buyer can understand and the operator can fix.
  if (!payReady.value) {
    payError.value = t('common.checkout_failed')
    return
  }
  await pay(item.id)
}
</script>

<template>
  <UiCard>
    <div v-if="props.items.length === 0" class="py-12 text-center">
      <p class="text-sm text-muted-foreground">
        {{ t('directory.settings_no_submissions_desc') }}
      </p>
      <NuxtLink
        :to="localePath('/submit')"
        class="mt-4 inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <span>{{ t('directory.settings_submit_first') }}</span>
      </NuxtLink>
    </div>

    <div v-else class="divide-y divide-border px-6">
      <div
        v-for="item in props.items"
        :key="item.id"
        class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div
            class="size-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50"
          >
            <ToolLogo :logo="item.logo" :name="item.name" :size="40" decorative />
          </div>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <a
                :href="
                  localePath(
                    statusOf(item) === 'published'
                      ? `/tools/${item.slug}`
                      : `/tools/${item.slug}?preview=1`,
                  )
                "
                target="_blank"
                rel="noopener noreferrer"
                class="truncate text-sm leading-none font-medium hover:underline"
              >
                {{ item.name }}
              </a>

              <span
                class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium"
                :class="
                  statusOf(item) === 'published'
                    ? 'bg-primary text-primary-foreground'
                    : statusOf(item) === 'rejected'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-secondary text-secondary-foreground'
                "
              >
                {{ statusLabel(statusOf(item)) }}
              </span>

              <span
                v-if="item.paid_at || item.plan !== 'free'"
                class="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] leading-none font-medium text-foreground"
              >
                <Crown class="size-2.5 text-amber-500" />
                <span>{{ t('dir.submit.plan_premium') }}</span>
              </span>
            </div>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ item.short || item.slug }}
            </p>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
          <a
            :href="
              localePath(
                statusOf(item) === 'published'
                  ? `/tools/${item.slug}`
                  : `/tools/${item.slug}?preview=1`,
              )
            "
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <ExternalLink class="size-3" />
            <span>
              {{ statusOf(item) === 'published' ? t('directory.view') : t('directory.preview') }}
            </span>
          </a>
          <a
            v-if="statusOf(item) !== 'published' && item.url"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <ExternalLink class="size-3" />
            <span>{{ t('directory.visit_website') }}</span>
          </a>

          <button
            v-if="statusOf(item) === 'pending_payment'"
            type="button"
            :disabled="Boolean(payBusy)"
            class="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            @click="onPay(item)"
          >
            <Crown class="size-3 text-amber-500" />
            <span>{{ t('dir.submit.btn_pay', { price: premiumPrice }) }}</span>
          </button>
        </div>
      </div>
    </div>

    <p v-if="payError" class="px-6 pb-4 text-sm text-destructive">{{ payError }}</p>
  </UiCard>
</template>
