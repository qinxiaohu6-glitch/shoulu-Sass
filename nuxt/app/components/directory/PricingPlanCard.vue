<script setup lang="ts">
/**
 * One ProductsBoost-style plan card. The page owns the copy and the price;
 * this component only owns the shared visual grammar.
 */
type PlanView = {
  id: string
  n: string
  name: string
  badge?: string
  description: string
  pricePrefix?: string
  price: string
  unit: string
  original?: string
  limited?: string
  features: string[]
  cta: string
  to: string
  featured?: boolean
}

defineProps<{ plan: PlanView; compact?: boolean }>()
</script>

<template>
  <article class="pb-card" :class="{ 'is-featured': plan.featured, 'is-compact': compact }">
    <header class="pb-card__head">
      <span class="pb-num">{{ plan.n }}</span>
      <div class="pb-card__title">
        <strong>{{ plan.name }}</strong>
        <span v-if="plan.badge" class="pb-pill">{{ plan.badge }}</span>
      </div>
      <span class="pb-card__mark" aria-hidden="true">{{ plan.featured ? '★' : '↗' }}</span>
    </header>

    <p class="pb-card__desc">{{ plan.description }}</p>

    <div class="pb-card__price">
      <small v-if="plan.pricePrefix">{{ plan.pricePrefix }}</small>
      <s v-if="plan.original">{{ plan.original }}</s>
      <strong>{{ plan.price }}</strong>
      <span>{{ plan.unit }}</span>
    </div>
    <p v-if="plan.limited" class="pb-card__limited">{{ plan.limited }}</p>

    <ul class="pb-card__features">
      <li v-for="feature in plan.features" :key="feature">
        <span class="pb-check" aria-hidden="true">✓</span>{{ feature }}
      </li>
    </ul>

    <NuxtLink class="pb-card__cta" :class="{ 'is-solid': plan.featured }" :to="plan.to">
      {{ plan.cta }}
    </NuxtLink>
  </article>
</template>

<style scoped>
.pb-card { display: flex; flex-direction: column; min-width: 0; padding: 20px; border: 1px solid var(--pb-line, #e5e7eb); border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(20, 20, 20, .03); }
.pb-card.is-featured { background: var(--pb-gold-soft, #fff9e8); border-color: #f0d58b; box-shadow: 0 6px 22px rgba(245, 196, 81, .12); }
.pb-card.is-compact { padding: 16px; }
.pb-card__head { display: flex; align-items: center; gap: 10px; }
.pb-num { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 22px; height: 22px; border-radius: 999px; background: #17181a; color: #fff; font-size: 11px; font-weight: 800; }
.pb-card__title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.pb-card__title strong { font-size: 15px; color: var(--pb-ink, #17181a); }
.pb-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: #dff3c4; color: #2d6416; font-size: 10px; font-weight: 800; }
.pb-card.is-featured .pb-pill { background: var(--pb-gold, #f5c451); color: #3d2b00; }
.pb-card__mark { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid var(--pb-line, #e5e7eb); border-radius: 8px; color: #9a6700; font-size: 13px; }
.pb-card__desc { margin: 12px 0 10px; font-size: 12px; color: var(--pb-muted, #6b7280); }
.pb-card__price { display: flex; align-items: baseline; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--pb-line, #e5e7eb); }
.pb-card__price small { font-size: 11px; color: var(--pb-muted, #6b7280); }
.pb-card__price s { font-size: 13px; color: var(--pb-muted, #6b7280); }
.pb-card__price strong { font-size: 34px; line-height: 1; letter-spacing: -.04em; color: var(--pb-ink, #17181a); }
.pb-card.is-compact .pb-card__price strong { font-size: 28px; }
.pb-card__price span { font-size: 11px; color: var(--pb-muted, #6b7280); }
.pb-card__limited { margin: 7px 0 0; font-size: 11px; font-weight: 700; color: #4f992d; }
.pb-card__features { display: grid; gap: 7px; margin: 12px 0 18px; padding: 0; list-style: none; }
.pb-card__features li { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.45; color: #3e4146; }
.pb-check { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 16px; height: 16px; border-radius: 999px; background: #e8f6dc; color: #4f992d; font-size: 11px; font-weight: 900; line-height: 1; }
.pb-card__cta { display: inline-flex; align-items: center; justify-content: center; margin-top: auto; min-height: 36px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 999px; background: #fff; color: var(--pb-ink, #17181a); font-size: 12px; font-weight: 700; text-decoration: none; }
.pb-card__cta:hover { border-color: #17181a; }
.pb-card__cta.is-solid { background: #17181a; border-color: #17181a; color: #fff; }
/* The global .src-page link reset carries #__nuxt inside :not(), so it outranks
   a plain class rule. Anchor the white text to the pricing page id. */
#pricing-page .pb-card__cta.is-solid { color: #fff; }
</style>
