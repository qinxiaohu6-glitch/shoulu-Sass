<script setup lang="ts">
/**
 * Source `routes/admin/-settings-field.tsx` — `SettingField`.
 *
 * One row of a settings group: the label, the control the registry asks for
 * (text / password / number / textarea / switch / select), an optional
 * field-specific helper and the tip. Appearance fields render as chip pickers
 * instead of a select, and the three product-mapping textareas get a
 * "fill template" shortcut.
 */
import { toast } from 'vue-sonner'
import { cn } from '~/utils/ui'
import type { Setting } from '~/utils/admin-settings-registry'
import {
  ADMIN_APPEARANCE_FIELDS,
  productIdsMappingPlaceholder,
} from '~/utils/admin-settings-ui'
import { COLOR_MODE_CONFIG_KEY, appearanceOptions, colorModeOptions } from '~/utils/admin-appearance'

const props = defineProps<{
  setting: Setting
  label: string
  placeholder?: string
  tip?: string
  value: string
}>()

const emit = defineEmits<{ change: [string] }>()

const { t } = useSettingsI18n()

const PRODUCT_MAPPING_FIELDS = [
  'creem_product_ids_mapping',
  'waffo_product_ids_mapping',
  'dodo_product_ids_mapping',
]

const appearanceKey = computed(() => ADMIN_APPEARANCE_FIELDS[props.setting.name])
const isColorMode = computed(() => props.setting.name === COLOR_MODE_CONFIG_KEY)
const chips = computed(() =>
  appearanceKey.value ? appearanceOptions(appearanceKey.value) : colorModeOptions(),
)

const isProductMapping = computed(() => PRODUCT_MAPPING_FIELDS.includes(props.setting.name))

const fillTemplateOpen = ref(false)

const selectText = computed(
  () =>
    props.setting.options?.find((o) => o.value === props.value)?.label ??
    props.placeholder ??
    '',
)
</script>

<template>
  <!-- Appearance: chip pickers -->
  <div v-if="appearanceKey || isColorMode" class="space-y-2">
    <UiLabel class="select-text">{{ props.label }}</UiLabel>
    <AdminAppearanceOptions
      :options="chips"
      :value="props.value"
      @change="(id: string) => emit('change', id)"
    />
    <p
      v-if="props.tip"
      class="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line"
    >
      {{ props.tip }}
    </p>
  </div>

  <!-- Switch -->
  <div v-else-if="props.setting.type === 'switch'" class="space-y-2">
    <UiLabel :for="props.setting.name" class="select-text">{{ props.label }}</UiLabel>
    <div>
      <UiSwitch
        :id="props.setting.name"
        :model-value="props.value === 'true'"
        @update:model-value="(v: boolean) => emit('change', v ? 'true' : 'false')"
      />
    </div>
    <p
      v-if="props.tip"
      class="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line"
    >
      {{ props.tip }}
    </p>
  </div>

  <!-- Select -->
  <div v-else-if="props.setting.type === 'select' && props.setting.options" class="space-y-2">
    <UiLabel :for="props.setting.name" class="select-text">{{ props.label }}</UiLabel>
    <UiSelect
      :model-value="props.value"
      @update:model-value="(v: string) => emit('change', v || '')"
    >
      <UiSelectTrigger>
        <UiSelectValue :text="selectText" :placeholder="props.placeholder || 'Select...'" />
      </UiSelectTrigger>
      <UiSelectContent>
        <UiSelectItem v-for="opt in props.setting.options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </UiSelectItem>
      </UiSelectContent>
    </UiSelect>
    <p
      v-if="props.tip"
      class="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line"
    >
      {{ props.tip }}
    </p>
  </div>

  <!-- Textarea -->
  <div v-else-if="props.setting.type === 'textarea'" class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <UiLabel :for="props.setting.name" class="select-text">{{ props.label }}</UiLabel>
      <button
        v-if="isProductMapping"
        type="button"
        class="text-primary cursor-pointer text-xs font-medium transition-colors hover:underline"
        @click="fillTemplateOpen = true"
      >
        {{ t('admin.settings.product_mapping.fill_template') }}
      </button>
    </div>
    <textarea
      :id="props.setting.name"
      :value="props.value"
      :placeholder="props.placeholder"
      :rows="isProductMapping ? 10 : 3"
      :class="
        cn(
          'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none',
          isProductMapping && 'font-mono',
        )
      "
      @input="emit('change', ($event.target as HTMLTextAreaElement).value)"
    />
    <UiDialog :open="fillTemplateOpen" @update:open="(v: boolean) => (fillTemplateOpen = v)">
      <UiDialogContent class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>{{ t('admin.settings.product_mapping.dialog_title') }}</UiDialogTitle>
          <UiDialogDescription>
            {{ t('admin.settings.product_mapping.dialog_desc') }}
          </UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter class="flex justify-end gap-2 pt-2">
          <UiButton type="button" variant="outline" @click="fillTemplateOpen = false">
            {{ t('admin.settings.product_mapping.dialog_cancel') }}
          </UiButton>
          <UiButton
            type="button"
            @click="
              () => {
                emit('change', productIdsMappingPlaceholder(props.setting.name.startsWith('creem') ? 'prod_' : props.setting.name.startsWith('waffo') ? 'PROD_' : 'pdt_'))
                fillTemplateOpen = false
                toast.success(t('admin.settings.product_mapping.filled_success'))
              }
            "
          >
            {{ t('admin.settings.product_mapping.dialog_confirm') }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
    <p
      v-if="props.tip"
      class="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line"
    >
      {{ props.tip }}
    </p>
  </div>

  <!-- Text / password / number -->
  <div v-else class="space-y-2">
    <UiLabel :for="props.setting.name" class="select-text">{{ props.label }}</UiLabel>
    <UiInput
      :id="props.setting.name"
      :type="
        props.setting.type === 'password'
          ? 'password'
          : props.setting.type === 'number'
            ? 'number'
            : 'text'
      "
      :model-value="props.value"
      :placeholder="props.placeholder"
      @update:model-value="(v: string | number | undefined) => emit('change', String(v ?? ''))"
    />
    <slot name="extra" />
    <p
      v-if="props.tip"
      class="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-line"
    >
      {{ props.tip }}
    </p>
  </div>
</template>
