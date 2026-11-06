<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/admin/settings-test-dialog.tsx`.
 *
 * The "Test" button on a group header opens this: the spec's inputs, a Run
 * button, and the outcome. Inputs are the group's own credentials, so a test
 * works before the settings are saved.
 *
 * This build has no config store and no provider keys, so the endpoint answers
 * with the source's own failure shape (`{ success: false, message }`) and the
 * dialog renders it as the red result — nothing pretends to have reached
 * Stripe, OpenAI or Telegram.
 */
import { CheckCircle2, Loader2, XCircle } from 'lucide-vue-next'
import type { TestField, TestResult, TestSpec } from '~/utils/admin-settings-test-specs'

const props = defineProps<{
  open: boolean
  group: string
  spec: TestSpec
  groupTitle: string
  /** Current (possibly unsaved) form values for this group. */
  configOverrides?: Record<string, string>
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const inputs = ref<Record<string, string>>({})
const result = ref<TestResult | null>(null)
const running = ref(false)

// Reset form + result each time the dialog opens for a new group.
watch(
  () => [props.open, props.group] as const,
  ([open]) => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const f of props.spec.fields) {
      if (f.defaultValue) initial[f.name] = f.defaultValue
    }
    inputs.value = initial
    result.value = null
    running.value = false
  },
  { immediate: true },
)

const canRun = computed(() =>
  props.spec.fields.every((f) => !f.required || !!inputs.value[f.name]?.trim()),
)

async function run() {
  result.value = null
  running.value = true
  try {
    result.value = await api.post<TestResult>('/api/admin/settings/test', {
      group: props.group,
      inputs: inputs.value,
      configs: props.configOverrides ?? {},
    })
  } catch (error) {
    result.value = { success: false, message: (error as Error).message }
  } finally {
    running.value = false
  }
}
</script>

<template>
  <UiDialog :open="props.open" @update:open="(v: boolean) => !v && emit('close')">
    <UiDialogContent class="sm:max-w-lg">
      <UiDialogHeader>
        <UiDialogTitle>{{ t('admin.settings.test.title', { group: props.groupTitle }) }}</UiDialogTitle>
        <UiDialogDescription>{{ t('admin.settings.test.description') }}</UiDialogDescription>
      </UiDialogHeader>

      <form class="grid gap-4" @submit.prevent.stop="run">
        <div class="space-y-3">
          <div v-for="field in props.spec.fields" :key="field.name" class="space-y-2">
            <UiLabel :for="field.name">
              {{ field.label }}
              <span v-if="field.required" class="text-destructive ml-1">*</span>
            </UiLabel>
            <textarea
              v-if="field.type === 'textarea'"
              :id="field.name"
              :value="inputs[field.name] ?? ''"
              :placeholder="field.placeholder"
              rows="3"
              class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
              @input="inputs[field.name] = ($event.target as HTMLTextAreaElement).value"
            />
            <UiInput
              v-else
              :id="field.name"
              :type="field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'"
              :model-value="inputs[field.name] ?? ''"
              :placeholder="field.placeholder"
              @update:model-value="(v: string | number | undefined) => (inputs[field.name] = String(v ?? ''))"
            />
          </div>
        </div>

        <div
          v-if="result"
          :class="
            [
              'rounded-lg border p-3 text-sm',
              result.success
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-destructive/30 bg-destructive/5',
            ]
          "
        >
          <div class="flex items-start gap-2 font-medium">
            <CheckCircle2 v-if="result.success" class="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <XCircle v-else class="text-destructive mt-0.5 size-4 shrink-0" />
            <span :class="result.success ? '' : 'text-destructive'">{{ result.message }}</span>
          </div>

          <dl
            v-if="result.details && Object.keys(result.details).length > 0"
            class="mt-3 space-y-1.5 text-xs"
          >
            <div
              v-for="(value, key) in result.details"
              :key="key"
              class="grid grid-cols-[auto_1fr] gap-2"
            >
              <dt class="text-muted-foreground whitespace-nowrap">{{ key }}:</dt>
              <dd class="break-all">
                <a
                  v-if="value?.startsWith('http')"
                  :href="value"
                  target="_blank"
                  rel="noreferrer"
                  class="text-primary underline underline-offset-2"
                >
                  {{ value }}
                </a>
                <span v-else class="font-mono">{{ value }}</span>
              </dd>
            </div>
          </dl>
        </div>

        <UiDialogFooter>
          <UiButton type="button" variant="outline" :disabled="running" @click="emit('close')">
            {{ t('admin.settings.test.close') }}
          </UiButton>
          <UiButton type="submit" :disabled="running || !canRun">
            <Loader2 v-if="running" class="size-4 animate-spin" />
            {{ running ? t('admin.settings.test.running') : t('admin.settings.test.run') }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
