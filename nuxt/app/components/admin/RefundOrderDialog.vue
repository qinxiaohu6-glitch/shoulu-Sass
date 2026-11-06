<script setup lang="ts">
/**
 * Source `routes/admin/-payments-refund-dialog.tsx` — refund one paid order.
 *
 * Same fields as the source: the order number and refund amount read out, the
 * credits to deduct, an optional reason, and — only when the order belongs to a
 * subscription — the "also cancel" checkbox. Our orders never carry a
 * `subscriptionNo`, so that row stays hidden, exactly as the source hides it
 * when there is no subscription.
 *
 * Confirming refuses: this build has no refund call (refunds arrive as the
 * provider's `charge.refunded` webhook) and no credit ledger to deduct from.
 * See `server/api/admin/orders/refund.post.ts`.
 */
import { toast } from 'vue-sonner'
import { formatOrderAmount } from '~/utils/admin-user-detail-ui'
import type { AdminOrder } from '~/utils/admin-payments-ui'

const props = defineProps<{ order: AdminOrder | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const refundCredits = ref('')
const refundReason = ref('')
const refundCancelSub = ref(true)
const refunding = ref(false)

watch(
  () => props.order,
  (order) => {
    if (!order) return
    refundCredits.value = String(order.creditsAmount ?? 0)
    refundReason.value = ''
    refundCancelSub.value = true
  },
)

async function submit() {
  const order = props.order
  if (!order) return
  const credits = Number(refundCredits.value)
  if (!Number.isInteger(credits) || credits < 0) {
    toast.error(t('admin.payments.refund_credits_invalid'))
    return
  }
  refunding.value = true
  try {
    await api.post('/api/admin/orders/refund', {
      orderNo: order.orderNo,
      deductCredits: credits,
      reason: refundReason.value.trim() || undefined,
      cancelSubscription: !!order.subscriptionNo && refundCancelSub.value,
    })
    emit('changed')
    emit('close')
  } catch (error) {
    toast.error((error as Error).message)
    emit('changed')
  } finally {
    refunding.value = false
  }
}
</script>

<template>
  <UiDialog :open="!!props.order" @update:open="(v: boolean) => !v && !refunding && emit('close')">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>{{ t('admin.payments.refund_title') }}</UiDialogTitle>
        <UiDialogDescription>
          {{ t('admin.payments.refund_description', { provider: props.order?.paymentProvider || '' }) }}
        </UiDialogDescription>
      </UiDialogHeader>
      <form class="grid gap-4" @submit.prevent.stop="submit">
        <div class="space-y-4 py-2">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="space-y-1">
              <div class="text-muted-foreground">{{ t('admin.payments.order_no') }}</div>
              <div class="font-mono text-xs break-all">{{ props.order?.orderNo }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-muted-foreground">{{ t('admin.payments.refund_amount') }}</div>
              <div class="font-medium">
                {{
                  props.order
                    ? formatOrderAmount(props.order.paymentAmount ?? props.order.amount, props.order.currency)
                    : ''
                }}
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <UiLabel for="refund-credits">{{ t('admin.payments.refund_credits_label') }}</UiLabel>
            <UiInput id="refund-credits" v-model="refundCredits" type="number" :min="0" :step="1" />
            <p class="text-muted-foreground text-xs">
              {{ t('admin.payments.refund_credits_hint', { credits: props.order?.creditsAmount ?? 0 }) }}
            </p>
          </div>

          <label
            v-if="props.order?.subscriptionNo"
            class="flex cursor-pointer items-center gap-3 text-sm"
          >
            <UiCheckbox v-model="refundCancelSub" />
            {{ t('admin.payments.refund_cancel_subscription') }}
          </label>

          <div class="space-y-1.5">
            <UiLabel for="refund-reason">{{ t('admin.payments.refund_reason_label') }}</UiLabel>
            <UiInput id="refund-reason" v-model="refundReason" :maxlength="500" />
          </div>
        </div>
        <UiDialogFooter>
          <UiButton type="button" variant="outline" :disabled="refunding" @click="emit('close')">
            {{ t('admin.payments.cancel') }}
          </UiButton>
          <UiButton type="submit" variant="destructive" :disabled="refunding">
            {{ refunding ? t('admin.payments.refunding') : t('admin.payments.refund_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
