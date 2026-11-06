<script setup lang="ts">
/**
 * Label + input + error, ported from `src/components/form-field.tsx` (`TextField`).
 *
 * Same three parts in the same order, so an auth form reads the same as the
 * source: label above the control, error below it, `aria-invalid` on the input
 * when there is one. Validation is the caller's business — the source hands the
 * field object to a form library, this takes the plain values.
 */
defineProps<{
  id: string
  label: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  required?: boolean
  autocomplete?: string
  error?: string | null
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="grid gap-2">
    <label :for="id" class="text-sm font-medium leading-none">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type || 'text'"
      :placeholder="placeholder"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="error ? true : undefined"
      class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    >
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
