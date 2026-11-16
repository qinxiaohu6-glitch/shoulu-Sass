<script setup lang="ts">
import { centsLabel } from '~~/shared/content/campaign'
import {
  INCOME_NOTE,
  LABEL_ASKING,
  LABEL_PROFIT,
  LABEL_REVENUE,
  LABEL_STACK,
  LABEL_TEAM,
  interestedLabel,
} from '~~/shared/content/for-sale'
import type { PublicForSaleCard } from '~~/shared/utils/for-sale-state'

defineProps<{ card: PublicForSaleCard }>()

const localePath = useLocalePath()
</script>

<template>
  <article class="sale-card">
    <h2>
      <NuxtLink :to="localePath(`/products/${card.product_slug}`)">{{ card.product_name }}</NuxtLink>
    </h2>
    <dl>
      <div>
        <dt>{{ LABEL_ASKING }}</dt>
        <dd>{{ centsLabel(card.asking_cents) }}</dd>
      </div>
      <div v-if="card.revenue">
        <dt>{{ LABEL_REVENUE }}</dt>
        <dd>{{ card.revenue }}</dd>
      </div>
      <div v-if="card.profit">
        <dt>{{ LABEL_PROFIT }}</dt>
        <dd>{{ card.profit }}</dd>
      </div>
    </dl>
    <p v-if="card.revenue || card.profit" class="sale-card__note">{{ INCOME_NOTE }}</p>
    <dl>
      <div v-if="card.team">
        <dt>{{ LABEL_TEAM }}</dt>
        <dd>{{ card.team }}</dd>
      </div>
      <div v-if="card.stack">
        <dt>{{ LABEL_STACK }}</dt>
        <dd>{{ card.stack }}</dd>
      </div>
    </dl>
    <p v-if="interestedLabel(card.interested)" class="sale-card__count">
      {{ interestedLabel(card.interested) }}
    </p>
    <slot />
  </article>
</template>

<style scoped>
.sale-card {
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card);
}
.sale-card h2 { margin: 0 0 12px; font-size: 22px; }
.sale-card a { color: inherit; }
.sale-card dl { margin: 0; }
.sale-card div { display: grid; grid-template-columns: 11rem 1fr; gap: 8px; margin-top: 8px; }
.sale-card dt { color: var(--muted-foreground); font-size: 13px; }
.sale-card dd { margin: 0; font-size: 14px; }
.sale-card__note { margin: 10px 0 0; color: var(--muted-foreground); font-size: 13px; }
.sale-card__count { margin: 12px 0 0; font-size: 13px; font-weight: 700; }
</style>
