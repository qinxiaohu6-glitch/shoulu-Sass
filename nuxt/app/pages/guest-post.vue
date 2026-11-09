<script setup lang="ts">
/**
 * /guest-post — ported from `shipany-dir/src/routes/guest-post.tsx` and
 * `src/blocks/guest-post.tsx`.
 *
 * Layout and copy follow the source: centred title and description, then either
 * the three-step explainer plus one card per package, or the source's own
 * "not open" line.
 *
 * **Which branch renders here, and why.** The source calls
 * `useGuestPostInfo()`, which reads a `guest_post_enabled` config row and a list
 * of purchasable packages. This build has neither, so `info` is `null` and
 * `!info?.enabled` is true — the closed line. That is the source's own
 * behaviour when guest posts are switched off, not a hidden section: the markup
 * for the open state is all here, it simply has no packages to draw.
 *
 * The source also renders this page with the marketing `Header`/`Footer` blocks
 * rather than `DirectoryLayout`. This build has a single site shell, so the page
 * sits inside it — same title/description/section, different chrome.
 */
const { pick } = useLang()
const localePath = useLocalePath()

/**
 * No config store and no payment provider on this build. Shape matches
 * `useGuestPostInfo()` so the template is the source's, unchanged.
 */
const info = null as null | {
  enabled: boolean
  packages: Array<{
    productId: string
    planName: string
    priceInCents: number
    currency: string
    maxLinks: number
  }>
}

const steps = computed(() => [
  {
    icon: 'file-text',
    text: pick('选择套餐，写好文章并付款提交。', 'Pick a package, write your article and pay to submit it.'),
  },
  {
    icon: 'search',
    text: pick('编辑审核，必要时会请你修改。', 'Our editors review it and may ask for changes.'),
  },
  {
    icon: 'wallet',
    text: pick(
      '审核通过即在博客发布；未通过全额退款。',
      'Approved articles go live on the blog; rejected ones are refunded in full.',
    ),
  },
])

/** `formatPrice` from the source's `use-guest-posts` hook. */
function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100)
  } catch {
    return `$${Math.round(cents / 100)}`
  }
}

useSeo({
  title: computed(() => pick('客座文章 · Product Atlas', 'Guest Post · Product Atlas')),
  description: computed(() =>
    pick('把你的专业见解分享给我们的读者。', 'Share your expertise with our readers.'),
  ),
})
</script>

<template>
  <div class="src-page">
    <section class="px-4 py-20 sm:py-28">
      <div class="mx-auto max-w-4xl">
        <div class="text-center">
          <h1 class="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {{ pick('客座文章', 'Guest Post') }}
          </h1>
          <p class="mx-auto mt-5 max-w-2xl text-muted-foreground">
            {{ pick('把你的专业见解分享给我们的读者。', 'Share your expertise with our readers.') }}
          </p>
        </div>

        <div v-if="!info?.enabled" class="mx-auto mt-12 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          <p>
            {{
              pick(
                '撰稿评测由编辑交付。未发布可全额退。这一页没有自助标价，所以不打开结账。',
                'A written review is delivered by an editor. It is refunded in full if it is not published. This page has no self-serve price, so it does not open a checkout.',
              )
            }}
          </p>
          <p class="mt-4">
            <NuxtLink class="underline" :to="localePath('/advertise')">{{ pick('返回投放说明', 'Back to advertise') }}</NuxtLink>
          </p>
        </div>

        <template v-else>
          <ol class="mt-14 grid gap-4 sm:grid-cols-3">
            <li v-for="(s, i) in steps" :key="s.icon" class="rounded-2xl border p-5">
              <Icon :name="s.icon" :size="20" class="text-muted-foreground" />
              <p class="mt-3 text-sm">
                <span class="font-medium">{{ i + 1 }}. </span>
                {{ s.text }}
              </p>
            </li>
          </ol>

          <div class="mt-10 grid gap-4 sm:grid-cols-2">
            <div
              v-for="p in info.packages"
              :key="p.productId"
              class="flex flex-col rounded-2xl border p-6"
            >
              <p class="font-medium">{{ p.planName }}</p>
              <p class="mt-2 text-3xl font-semibold">
                {{ formatPrice(p.priceInCents, p.currency) }}
              </p>
              <ul class="mt-4 space-y-2 text-sm text-muted-foreground">
                <li
                  v-for="perk in [
                    pick(`最多 ${p.maxLinks} 个外链`, `Up to ${p.maxLinks} external link(s)`),
                    pick('永久发布', 'Published permanently'),
                    pick('未通过全额退款', 'Full refund if not accepted'),
                  ]"
                  :key="perk"
                  class="flex items-start gap-2"
                >
                  <Icon name="check" :size="16" class="mt-0.5 shrink-0" />
                  {{ perk }}
                </li>
              </ul>
              <NuxtLink
                :to="localePath(`/settings/guest-posts/new?package=${encodeURIComponent(p.productId)}`)"
                class="mt-6 inline-flex h-9 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
              >
                {{ pick('提交文章', 'Submit an article') }}
              </NuxtLink>
            </div>
          </div>

          <p class="mt-6 text-center text-xs text-muted-foreground">
            {{ pick(
              '投稿文章会标注「赞助内容」，文中链接带 rel="sponsored"。审核未通过全额退款。',
              'Guest posts are labeled Sponsored and their links are marked rel="sponsored". Not accepted? Full refund.',
            ) }}
          </p>
        </template>
      </div>
    </section>
  </div>
</template>
