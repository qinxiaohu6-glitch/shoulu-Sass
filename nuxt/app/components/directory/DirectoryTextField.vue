<script setup lang="ts">
/**
 * Source `components/form-field.tsx` — `TextField`, plus the `Field` /
 * `FieldLabel` wrapper from `components/ui/field.tsx`.
 *
 * The source binds a TanStack Form field; here the parent owns the value and
 * passes the error string it computed on submit. Same markup, same
 * `aria-invalid`, same first-error line under the input.
 */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue?: string
    type?: string
    placeholder?: string
    autoComplete?: string
    required?: boolean
    disabled?: boolean
    error?: string
    class?: string
  }>(),
  { modelValue: '', type: 'text', error: '' },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const id = `field-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div :class="cn('grid gap-2', props.class)">
    <UiLabel :for="id">{{ props.label }}</UiLabel>
    <UiInput
      :id="id"
      :type="props.type"
      :model-value="props.modelValue"
      :placeholder="props.placeholder"
      :autocomplete="props.autoComplete"
      :required="props.required"
      :disabled="props.disabled"
      :aria-invalid="props.error ? true : undefined"
      @update:model-value="(v: any) => emit('update:modelValue', String(v ?? ''))"
    />
    <p v-if="props.error" class="text-destructive text-sm">{{ props.error }}</p>
  </div>
</template>
