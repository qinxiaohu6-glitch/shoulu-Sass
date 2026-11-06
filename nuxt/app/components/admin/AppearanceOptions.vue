<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/appearance-options.tsx`.
 *
 * A row of selectable chips for one appearance setting: a colour dot for
 * themes, the label drawn in its own font for fonts, a check on the chosen one.
 */
import { Check } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

export interface AppearanceChip {
  id: string
  /** i18n key of the label — `common.themes.classic` and friends. */
  labelKey: string
  swatch?: string
  fontFamily?: string
}

const props = defineProps<{ options: AppearanceChip[]; value: string }>()
const emit = defineEmits<{ change: [string] }>()

const { t } = useSettingsI18n()
</script>

<template>
  <div role="radiogroup" class="flex flex-wrap gap-2">
    <button
      v-for="opt in props.options"
      :key="opt.id"
      type="button"
      role="radio"
      :aria-checked="opt.id === props.value"
      :class="
        cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
          'focus-visible:ring-ring/50 outline-none focus-visible:ring-3',
          opt.id === props.value
            ? 'border-primary bg-accent text-accent-foreground font-medium'
            : 'hover:bg-muted/60',
        )
      "
      @click="emit('change', opt.id)"
    >
      <span
        v-if="opt.swatch"
        aria-hidden="true"
        class="inline-block size-4 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/20"
        :style="{ background: opt.swatch }"
      />
      <span :style="opt.fontFamily ? { fontFamily: opt.fontFamily } : {}">
        {{ t(opt.labelKey) }}
      </span>
      <Check v-if="opt.id === props.value" class="size-3.5" />
    </button>
  </div>
</template>
