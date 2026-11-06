<script setup lang="ts">
/**
 * Source `routes/admin/-copy-button.tsx`.
 *
 * Copies the value, shows a check for 1.5 s, and toasts when the clipboard API
 * is refused (it is unavailable on an insecure origin, which is a real case for
 * a self-hosted install served over plain HTTP).
 */
import { Check, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn } from '~/utils/ui'

const props = defineProps<{ value: string; class?: string }>()

const { t } = useSettingsI18n()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => clearTimeout(timer))

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
  } catch {
    toast.error(t('admin.agent.copy_failed'))
  }
}
</script>

<template>
  <UiButton
    type="button"
    variant="ghost"
    size="icon"
    :class="cn('size-7 shrink-0', props.class)"
    :aria-label="t('admin.agent.copy')"
    @click="copy"
  >
    <Check v-if="copied" class="size-3.5" />
    <Copy v-else class="size-3.5" />
  </UiButton>
</template>
