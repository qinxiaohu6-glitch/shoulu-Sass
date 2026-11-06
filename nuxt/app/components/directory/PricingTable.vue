<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/pricing-table.tsx`.
 *
 * A pill toggle across the top when there is more than one group, then the plan
 * cards: name, serif price, optional struck-through original price, description,
 * a full-width pill CTA, and the feature list underneath.
 *
 * The card widths follow the source's rule — 2 plans in two columns, 3 in three,
 * 4 in four — because a 4-plan grid squeezed into three columns is the usual way
 * this layout breaks.
 *
 * Checkout is not wired here on purpose. The source posts to
 * `/api/payment/checkout` from this component because its plans are subscriptions;
 * this build's plans are one-time listings, which are paid *after* a submission
 * exists (see `/submit`). So the component emits `select` and the page decides
 * where the button goes.
 */

import type { PricingGroup, PricingPlan } from '~/utils/directory-ui'

const props = defineProps<{ groups: PricingGroup[] }>()
const emit = defineEmits<{ select: [plan: PricingPlan] }>()

const activeGroup = ref(props.groups[0]?.key ?? '')

const currentGroup = computed(
  () => props.groups.find((group) => group.key === activeGroup.value) ?? props.groups[0],
)

const gridClass = computed(() => {
  const count = currentGroup.value?.plans.length ?? 0
  if (count === 2) return 'max-w-3xl sm:grid-cols-2'
  if (count === 3) return 'max-w-5xl sm:grid-cols-2 lg:grid-cols-3'
  return 'max-w-6xl sm:grid-cols-2 lg:grid-cols-4'
})
</script>

<template>
  <div class="space-y-10">
    <div v-if="groups.length > 1" class="flex justify-center">
      <div class="inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
        <button
          v-for="group in groups"
          :key="group.key"
          type="button"
          class="cursor-pointer rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
          :class="
            activeGroup === group.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="activeGroup = group.key"
        >
          {{ group.label }}
        </button>
      </div>
    </div>

    <div class="mx-auto grid gap-6" :class="gridClass">
      <div
        v-for="plan in currentGroup?.plans"
        :key="plan.id"
        class="relative flex flex-col rounded-2xl border border-border p-8 transition-all"
        :class="
          plan.featured
            ? 'bg-card shadow-md ring-1 ring-foreground/10'
            : 'bg-background hover:border-foreground/30'
        "
      >
        <p v-if="plan.name" class="mb-2 text-sm font-medium text-foreground">{{ plan.name }}</p>

        <div class="mb-2 flex items-baseline gap-1">
          <span class="font-serif text-5xl tracking-tight">{{ plan.price }}</span>
          <span v-if="plan.interval" class="text-sm text-muted-foreground">/{{ plan.interval }}</span>
        </div>
        <span v-if="plan.originalPrice" class="mb-1 text-sm text-muted-foreground line-through">
          {{ plan.originalPrice }}
        </span>

        <p v-if="plan.description" class="mb-8 text-sm text-muted-foreground">
          {{ plan.description }}
        </p>

        <UiButton
          :variant="plan.featured ? 'default' : 'outline'"
          class="h-10 w-full rounded-full text-sm font-medium"
          @click="emit('select', plan)"
        >
          {{ plan.buttonText }}
        </UiButton>

        <ul class="mt-8 space-y-3">
          <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-2.5 text-sm">
            <Icon name="check" :size="16" class="shrink-0 text-muted-foreground" />
            <span class="text-foreground/90">{{ feature }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
