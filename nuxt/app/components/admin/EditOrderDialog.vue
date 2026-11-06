<script setup lang="ts">
/**
 * Source `routes/admin/-payments-edit-dialog.tsx` — edit one order.
 *
 * Order number is read-only; the status select offers the current value plus
 * `failed` while the order is still unpaid (payment states come from the
 * provider, not from a form); the three product fields are free text.
 *
 * The PATCH behind it only has a column for `status` — `payment_order` records
 * the attempt, and the product copy belongs to the listing — so saving applies
 * the status and the product fields are not persisted. See
 * `server/api/admin/orders/index.patch.ts`.
 */
import { toast } from 'vue-sonner'
import type { AdminOrder } from '~/utils/admin-payments-ui'

const props = defineProps<{ order: AdminOrder | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const status = ref('')
const productId = ref('')
const productName = ref('')
const description = ref('')
const saving = ref(false)

watch(
  () => props.order,
  (order) => {
    if (!order) return
    status.value = order.status
    productId.value = order.productId || ''
    productName.value = order.productName || ''
    description.value = order.description || ''
  },
)

/** Only an unpaid order can be closed by hand. */
const statusOptions = computed(() => {
  const current = props.order?.status || ''
  const extra = ['created', 'pending'].includes(current) ? ['failed'] : []
  return [current, ...extra].filter(Boolean)
})

const statusText = computed(() => (status.value ? t(`admin.payments.status_${status.value}`) : ''))

async function submit() {
  const order = props.order
  if (!order) return
  saving.value = true
  try {
    await api.patch('/api/admin/orders', {
      orderNo: order.orderNo,
      status: status.value,
      productId: productId.value || null,
      productName: productName.value || null,
      description: description.value || null,
    })
    toast.success(t('admin.payments.update_success'))
    emit('changed')
    emit('close')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog :open="!!props.order" @update:open="(v: boolean) => !v && !saving && emit('close')">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>{{ t('admin.payments.edit_title') }}</UiDialogTitle>
        <UiDialogDescription>{{ t('admin.payments.edit_description') }}</UiDialogDescription>
      </UiDialogHeader>
      <form class="grid gap-4" @submit.prevent.stop="submit">
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <UiLabel>{{ t('admin.payments.order_no') }}</UiLabel>
            <UiInput :model-value="props.order?.orderNo || ''" disabled />
          </div>

          <div class="space-y-1.5">
            <UiLabel>{{ t('admin.payments.status_label') }}</UiLabel>
            <UiSelect v-model="status">
              <UiSelectTrigger>
                <UiSelectValue :text="statusText" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="s in statusOptions" :key="s" :value="s">
                  {{ t(`admin.payments.status_${s}`) }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div class="space-y-1.5">
            <UiLabel>{{ t('admin.payments.product_id_label') }}</UiLabel>
            <UiInput v-model="productId" />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('admin.payments.product_name_label') }}</UiLabel>
            <UiInput v-model="productName" />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('admin.payments.product_description_label') }}</UiLabel>
            <UiInput v-model="description" />
          </div>
        </div>
        <UiDialogFooter>
          <UiButton type="button" variant="outline" :disabled="saving" @click="emit('close')">
            {{ t('admin.payments.cancel') }}
          </UiButton>
          <UiButton type="submit" :disabled="saving">
            {{ saving ? t('admin.payments.saving') : t('admin.payments.save') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
