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
 * approved there is no provider, and a button that opens an error is worse
 * than the manual instructions it replaces.
 */

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
      const message = (err as { data?: { message_zh?: string; message_en?: string } })?.data
      toast.add({
        title:
          (isZh.value ? message?.message_zh : message?.message_en) ||
          pick('暂时打不开付款页面，请稍后再试。', 'Could not open the payment page — try again in a moment.'),
        color: 'error',
      })
      return false
    } finally {
      busy.value = ''
    }
  }

  return { ready, provider, busy, pay }
}
