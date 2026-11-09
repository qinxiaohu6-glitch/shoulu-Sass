<script setup lang="ts">
/**
 * /payment/return — where the provider sends the buyer back.
 *
 * Two things happen on this page and only one of them is about the buyer: it
 * reports the outcome, and it waits. The waiting matters because the redirect
 * and the webhook are two independent trips — the browser usually arrives
 * first, so a page that trusts the URL alone would tell a paying customer their
 * payment failed while it is in fact in flight.
 *
 * So the page polls the order until it leaves `pending`, and the wording for
 * "still pending" is neutral rather than red. Nothing here is authoritative:
 * the listing goes live from the webhook, not from this page.
 */
definePageMeta({ layout: 'default' })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const requestFetch = useRequestFetch()
const { busy: payBusy, pay } = await usePayment()

const orderId = computed(() => String(route.query.order || ''))
const cancelled = computed(() => String(route.query.state || '') === 'cancelled')

type OrderView = {
  ok: boolean
  order: {
    id: string
    status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
    plan: string
    amount_cents: number
    currency: string
    created_at: number
    paid_at: number | null
    submission_id: string
    name: string
    slug: string
    live: boolean
    /** Present only for a weekly ad booking; null for a listing payment. */
    ad: {
      slot: string
      weeks: number
      start: string
      end: string
      status: string
    } | null
  }
}

const { data, error, refresh } = await useAsyncData(
  () => `payment-return:${orderId.value}`,
  async () => {
    if (!orderId.value) return null
    try {
      return await requestFetch<OrderView>(`/api/payments/order/${encodeURIComponent(orderId.value)}`)
    } catch {
      return null
    }
  },
  { watch: [orderId] },
)

const order = computed(() => data.value?.order ?? null)
const status = computed(() => order.value?.status ?? 'unknown')
const ad = computed(() => order.value?.ad ?? null)

/** An abandoned ad checkout goes back to the booking page, not to a listing. */
const rebookLink = computed(() =>
  ad.value
    ? `${localePath('/book-ad')}?slot=${ad.value.slot}&weeks=${ad.value.weeks}`
    : '',
)

/**
 * A cancelled or failed attempt can be restarted from here.
 *
 * The "My submissions" link only helps a signed-in buyer — an anonymous
 * submission has no account and therefore no row in that list. This page is the
 * one place every buyer reaches with proof of the order, so it carries the
 * retry. A `pending` order is deliberately excluded: it may still be settling,
 * and a second checkout is how someone pays twice.
 */
const canRetry = computed(() => {
  if (!order.value?.submission_id) return false
  return status.value === 'failed' || status.value === 'cancelled' || cancelled.value
})

async function retry() {
  const submissionId = order.value?.submission_id
  if (!submissionId) return
  // `pay()` redirects on success and reports a provider failure as a toast.
  await pay(submissionId)
}

/**
 * A webhook usually lands within a few seconds of the redirect. Forty-five
 * seconds of patience covers a slow one without leaving the buyer staring at a
 * spinner; after that the page says "still processing, we will email you",
 * which is true because the webhook will settle it either way.
 */
const tries = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (status.value !== 'pending' || cancelled.value) return
  timer = setInterval(async () => {
    tries.value += 1
    await refresh()
    if (status.value !== 'pending' || tries.value >= 15) {
      if (timer) clearInterval(timer)
      timer = null
    }
  }, 3000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const heading = computed(() => {
  if (!orderId.value) return pick('找不到这笔订单', 'No order in the link')
  if (status.value === 'paid') return pick('付款成功', 'Payment received')
  if (status.value === 'pending') return pick('正在确认付款…', 'Confirming your payment…')
  if (status.value === 'cancelled' || cancelled.value) return pick('付款已取消', 'Payment cancelled')
  if (status.value === 'refunded') return pick('这笔款项已退回', 'This payment was refunded')
  if (status.value === 'failed') return pick('付款没有完成', 'The payment did not go through')
  return pick('查不到这笔订单', 'That order could not be found')
})

const lead = computed(() => {
  if (status.value === 'paid' && ad.value) {
    if (ad.value.status === 'conflict') {
      return pick(
        '钱已收到，但这一周刚被别人订走了。请联系我们改期或退款，订单记录已保留。',
        'We have the money, but that week was just booked by someone else. Contact us to reschedule or refund — the order record is kept.',
      )
    }
    return order.value?.live
      ? pick(
          `广告位已排期：${ad.value.start} → ${ad.value.end}，届时自动上线、到期自动下架。`,
          `Your placement is scheduled: ${ad.value.start} → ${ad.value.end}. It goes up and comes down automatically.`,
        )
      : pick('钱已收到，广告位正在排期，通常几秒内完成。', 'We have the money; the placement is being scheduled, usually within seconds.')
  }
  if (status.value === 'paid') {
    return order.value?.live
      ? pick('收录已上线，详情页现在就能打开。', 'Your listing is live — the page is open now.')
      : pick(
          '钱已收到，收录正在上线，通常几秒内完成。',
          'We have the money; the listing is going live, usually within seconds.',
        )
  }
  if (status.value === 'pending') {
    return pick(
      '支付平台还在把结果发回来。这一页会自动刷新，不用手动重试。',
      'The provider is still sending the result back. This page refreshes itself — no need to retry.',
    )
  }
  if (status.value === 'cancelled' || cancelled.value) {
    return pick(
      '没有扣款。可以直接点下面的「重新付款」再试一次，或者联系我们人工处理。',
      'Nothing was charged. Use "Try the payment again" below, or contact us.',
    )
  }
  if (status.value === 'failed') {
    return pick(
      '这一笔没有成功，也没有扣款。可以换一张卡再试。',
      'This attempt failed and nothing was charged. You can try again with another card.',
    )
  }
  if (status.value === 'refunded') {
    return pick('款项已按原路退回，到账时间以银行或发卡行为准。', 'Refunded to the original method; your bank decides when it appears.')
  }
  return pick('链接里的订单号不对，或者这笔订单已经不存在。', 'The reference in this link is wrong, or the order no longer exists.')
})

useHead({
  title: computed(() => `${heading.value} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <div class="container">
    <header class="page-head">
      <h1 class="page-title">{{ heading }}</h1>
      <p class="page-sub">{{ lead }}</p>
    </header>

    <div v-if="order" class="pay-summary">
      <div class="pay-summary__row">
        <span>{{ pick('订单号', 'Order') }}</span>
        <strong>{{ order.id }}</strong>
      </div>
      <div class="pay-summary__row">
        <span>{{ ad ? pick('位置', 'Placement') : pick('产品', 'Product') }}</span>
        <strong>{{ order.name || '—' }}</strong>
      </div>
      <div v-if="ad" class="pay-summary__row">
        <span>{{ pick('投放周期', 'Window') }}</span>
        <strong>{{ ad.start }} → {{ ad.end }} · {{ ad.weeks === 1 ? pick('1 周', '1 week') : pick('4 周', '4 weeks') }}</strong>
      </div>
      <div class="pay-summary__row">
        <span>{{ pick('金额', 'Amount') }}</span>
        <strong>${{ (order.amount_cents / 100).toFixed(2) }} {{ order.currency.toUpperCase() }}</strong>
      </div>
      <div class="pay-summary__row">
        <span>{{ pick('状态', 'Status') }}</span>
        <strong>
          <span class="status" :class="order.status === 'paid' ? 'status--approved' : 'status--draft'">
            {{ order.status }}
          </span>
        </strong>
      </div>
    </div>

    <div v-if="error" class="empty-state">
      {{ pick('读取订单时出错了，稍后刷新这一页即可。', 'Could not read the order — refresh this page in a moment.') }}
    </div>

    <div class="pay-actions">
      <button
        v-if="canRetry"
        type="button"
        class="btn btn--primary"
        :disabled="Boolean(payBusy)"
        @click="retry"
      >
        {{ pick('重新付款', 'Try the payment again') }}
      </button>
      <!-- An ad has no submission to retry a charge against, so the buyer
           restarts from the booking page where the open weeks are listed. -->
      <NuxtLink
        v-if="rebookLink && (status === 'failed' || status === 'cancelled' || cancelled)"
        class="btn btn--primary"
        :to="rebookLink"
      >
        {{ pick('重新选择广告位', 'Book another week') }}
      </NuxtLink>
      <NuxtLink
        v-if="ad && status === 'paid' && order?.live"
        class="btn btn--ghost"
        :to="rebookLink"
      >
        {{ pick('续租下一周', 'Book the next week') }}
      </NuxtLink>
      <NuxtLink
        v-if="order?.slug && order.live"
        class="btn btn--primary"
        :to="localePath(`/products/${order.slug}`)"
      >
        {{ pick('打开我的详情页', 'Open my listing') }}<Icon name="arrow-right" />
      </NuxtLink>
      <NuxtLink class="btn btn--ghost" :to="localePath('/settings/submissions')">
        {{ pick('我的提交', 'My submissions') }}
      </NuxtLink>
      <NuxtLink class="btn btn--ghost" :to="localePath('/products')">
        {{ pick('逛逛目录', 'Browse the directory') }}
      </NuxtLink>
    </div>
  </div>
</template>
