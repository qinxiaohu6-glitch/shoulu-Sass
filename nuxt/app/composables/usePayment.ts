/**
 * Starting a card payment, from anywhere that shows a "Pay" button.
 *
 * Two pages need it — the submit confirmation and the submissions table — and
 * both need the same three things: whether a provider is switched on at all,
 * a busy flag scoped to one row, and a failure message the buyer can act on.
 *
 * The redirect is a real navigation, not a fetch: the provider's hosted page is
 * a different origin and the point is that the card number never touches us.
 *
 * `ready` is fetched rather than assumed. While the merchant account is being
 * approved there is no provider. A failed pay does not toast an email or
 * invoice promise from the API; the buyer only sees that the payment page
 * did not open.
 */

const PAY_CLOSED = {
  zh: '暂时打不开付款页面，请稍后再试。',
  en: 'Could not open the payment page — try again in a moment.',
}

/**
 * The unconfigured checkout has no payment page and no email. Ignore whatever
 * sentence the API attached to that reason, and show only the short line.
 */
function payErrorText(raw: string, reason: string | undefined, zh: boolean): string {
  const closed = zh ? PAY_CLOSED.zh : PAY_CLOSED.en
  if (reason === 'unconfigured') return closed
  return raw || closed
}

export interface PaymentConfigView {
  ok: boolean
  ready: boolean
  provider: string | null
  requested: string | null
  currency: string
}

export async function usePayment() {
  const { pick, isZh } = useLang()
  const toast = useToast()
  const requestFetch = useRequestFetch()

  const { data } = await useAsyncData<PaymentConfigView>(
    'payment-config',
    () => requestFetch<PaymentConfigView>('/api/payments/config'),
    {
      default: () => ({
        ok: false,
        ready: false,
        provider: null,
        requested: null,
        currency: 'usd',
      }),
    },
  )

  const ready = computed(() => Boolean(data.value?.ready))
  const provider = computed(() => data.value?.provider ?? null)

  /** Which submission is currently mid-redirect, so one row's spinner is not every row's. */
  const busy = ref('')

  async function pay(submissionId: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = submissionId
    try {
      const res = await $fetch<{ ok: boolean; url?: string }>('/api/payments/checkout', {
        method: 'POST',
        body: { submission_id: submissionId },
      })
      if (res?.url) {
        window.location.href = res.url
        return true
      }
      return false
    } catch (err) {
      const message = (err as { data?: { reason?: string; message_zh?: string; message_en?: string } })?.data
      const raw = String((isZh.value ? message?.message_zh : message?.message_en) || '')
      // The toast stays human; the console keeps the fact. A checkout that never
      // reaches the server looks identical to one the provider refused, and
      // without the status there is nothing to tell them apart with later.
      console.error('[payment] checkout failed', {
        submissionId,
        status: (err as { statusCode?: number; status?: number })?.statusCode
          ?? (err as { status?: number })?.status,
        reason: message?.reason || (err as Error)?.message,
      })
      toast.add({
        title: payErrorText(raw, message?.reason, isZh.value),
        color: 'error',
      })
      return false
    } finally {
      busy.value = ''
    }
  }

  return { ready, provider, busy, pay }
}
