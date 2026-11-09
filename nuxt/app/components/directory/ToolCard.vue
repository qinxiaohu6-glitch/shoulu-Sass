<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/ToolCard.tsx`.
 *
 * The card the listing pages are made of: a 44px icon, the name with an optional
 * editor's-pick sparkle, a two-line tagline, then a "Paid" chip and the category
 * on the right of the footer.
 *
 * Three mappings, because the two backends name things differently:
 *
 *   source          this build
 *   ─────────────   ──────────────────────────────
 *   `iconUrl`       `logo` (repo-relative or absolute, resolved by `ToolLogo`)
 *   `tagline`       `short`
 *   `categoryName`  `category`, a slug — resolved against the live category list
 *
 * `ToolLogo` rather than a bare `<img>`: a community listing may carry no logo at
 * all, and the source's own submit preview already renders a monogram in that
 * case. Same 44px box, no broken image.
 *
 * The whole card is one link because of `after:absolute after:inset-0` on the
 * name — the source's trick for making the click target the card without nesting
 * interactive elements.
 */
import type { LocalizedTool } from '~~/shared/types/catalog'

const props = defineProps<{ tool: LocalizedTool }>()

const { lang } = useLang()
const localePath = useLocalePath()
const t = useDirectoryCopy()
const { categories } = useDirectoryMeta()

const categoryName = computed(() => {
  const hit = categoryBySlug(props.tool.category, categories.value)
  return hit ? localizeCategory(hit, lang.value).name : ''
})
</script>

<template>
  <div
    class="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-primary/35 hover:shadow-[0_8px_24px_-12px] hover:shadow-primary/25"
  >
    <div class="flex items-start gap-3">
      <div
        class="size-11 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50"
      >
        <ToolLogo :logo="tool.logo" :name="tool.name" :size="44" lazy decorative />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <h3 class="min-w-0 truncate text-[15px] leading-tight font-semibold">
            <NuxtLink
              :to="localePath(`/products/${tool.slug}`)"
              class="after:absolute after:inset-0 after:rounded-xl"
            >
              {{ tool.name }}
            </NuxtLink>
          </h3>
          <span
            v-if="tool.is_featured"
            :title="t('directory.editors_pick')"
            class="shrink-0"
          >
            <Icon name="sparkles" :size="14" class="text-amber-500" />
            <span class="sr-only">{{ t('directory.editors_pick') }}</span>
          </span>
        </div>
        <p
          class="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground"
        >
          {{ tool.short }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <span
        v-if="tool.is_paid"
        class="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
      >
        {{ t('directory.pricing_paid') }}
      </span>
      <span
        class="ml-auto min-w-0 truncate rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
      >
        {{ categoryName }}
      </span>
    </div>
  </div>
</template>
