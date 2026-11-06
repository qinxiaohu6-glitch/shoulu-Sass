<script setup lang="ts">
/**
 * /advertise — ported from `shipany-dir/src/routes/advertise.tsx` and
 * `components/directory/AdvertiseForm{,Parts}.tsx`.
 *
 * Structure, section order and copy follow the source. The one substitution is
 * the brand: the source says "ShipAny Dir" in three strings, this site is
 * Product Atlas.
 *
 * Two things the source has that this build does not, and how they are handled
 * rather than invented:
 *
 *  - **Logo upload.** The source uploads to object storage when signed in. There
 *    is no uploader here, so the field stays a URL input — which is what the
 *    source's own `field_icon_ph` placeholder describes.
 *  - **Checkout.** Booking an ad needs the sponsor inventory and a payment
 *    provider, neither of which exists on this build. Submitting reports the
 *    source's own failure string (`error_failed`) instead of pretending the
 *    booking went through.
 *
 * The inputs keep the source's `required` / `type="url"` / `maxlength=120`
 * attributes, so the browser's own constraint validation fires first and blocks
 * the submit with a native bubble. The guards in `book()` mirror the server
 * codes (`missing_fields`, `invalid_url`) for anything that slips past it — the
 * source keeps both layers too.
 */
const { lang, pick } = useLang()
const localePath = useLocalePath()

type TierId = 'silver' | 'gold' | 'platinum'

type Tier = {
  id: TierId
  name: string
  price: string
  spots: number
  left: number
  icon: string
  iconClass: string
  card: string
  feats: string[]
}

const tiers = computed<Tier[]>(() => [
  {
    id: 'silver',
    name: pick('白银', 'Silver'),
    price: '$49',
    spots: 12,
    left: 12,
    icon: 'award',
    iconClass: 'text-slate-400',
    card: 'border-border bg-card hover:border-primary/35',
    feats: [
      pick('所有工具详情页展示', 'Shown on every tool detail page'),
      pick('展示 Logo、名称、标语与直达链接', 'Logo, name, tagline and a direct link'),
    ],
  },
  {
    id: 'gold',
    name: pick('黄金', 'Gold'),
    price: '$149',
    spots: 8,
    left: 8,
    icon: 'medal',
    iconClass: 'text-amber-500',
    card: 'border-amber-200 bg-amber-50/70 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10',
    feats: [
      pick('首页和所有列表页赞助位', 'Sponsored row on the homepage and every listing'),
      pick('所有工具详情页展示', "Shown on every tool's detail page"),
    ],
  },
  {
    id: 'platinum',
    name: pick('铂金', 'Platinum'),
    price: '$299',
    spots: 4,
    left: 4,
    icon: 'crown',
    iconClass: 'text-violet-500',
    card: 'border-violet-200 bg-violet-50/70 hover:border-violet-300 dark:border-violet-500/30 dark:bg-violet-500/10',
    feats: [
      pick('首页和所有列表页赞助位，排在最前', 'First in the sponsored row on the homepage and every listing'),
      pick('所有工具详情页展示，排在最前', "First on every tool's detail page"),
      pick('专属白金高亮卡片样式', 'Highlighted platinum card'),
    ],
  },
])

const steps = computed(() => [
  pick('填写产品信息并选择档位。', 'Fill in your product and pick a tier.'),
  pick('支付月度订阅，广告立即上线。', 'Pay the monthly subscription; the ad goes live right away.'),
  pick('按月自动续订，可随时在「设置 → 我的广告」中取消。', 'It renews each month until you cancel from Settings → My Ads.'),
])

const faq = computed(() => [
  {
    q: pick('广告什么时候上线？', 'When does my ad go live?'),
    a: pick(
      '付款成功后立即上线，可以在「设置 → 我的广告」中查看。',
      'As soon as the payment succeeds. You can see it in Settings → My Ads.',
    ),
  },
  {
    q: pick('可以取消吗？', 'Can I cancel?'),
    a: pick(
      '可以随时取消，广告会继续展示到已付费的当月结束。',
      "Yes, any time. The ad keeps running until the end of the month you've paid for.",
    ),
  },
  {
    q: pick('广告具体在哪里展示？', 'Where exactly does it show?'),
    a: pick(
      '铂金：首页和所有列表页的赞助位、所有工具详情页，都排在最前。黄金：首页和列表页的赞助位、所有工具详情页。白银：所有工具详情页。',
      'Platinum: the sponsored row on the homepage and every listing, plus every tool\'s detail page, always shown first. Gold: the sponsored row and detail pages. Silver: detail pages only.',
    ),
  },
  {
    q: pick('之后可以修改广告文案吗？', 'Can I change the ad text later?'),
    a: pick('联系我们即可修改，订阅不受影响。', "Contact us and we'll update it; the subscription continues as is."),
  },
])

const selected = ref<TierId>('gold')
const name = ref('')
const tagline = ref('')
const url = ref('')
const iconUrl = ref('')
const openFaq = ref(-1)
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

const tier = computed(() => tiers.value.find((t) => t.id === selected.value) ?? tiers.value[1]!)

/**
 * The two live numbers in the header. Same source of truth as `/tools` —
 * curated catalogue merged with community listings — so the advertise page can
 * never quote a count the directory does not show.
 */
const submittedTools = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const toolCount = computed(
  () => mergeDirectory(orderedTools(lang.value, overrides.value), submittedTools.value, overrides.value).length,
)

useSeo({
  title: computed(() =>
    `${pick('推广你的 AI 工具', 'Advertise your AI tool')} · Product Atlas`,
  ),
  description: computed(() =>
    pick(
      '让您的产品展示在正在挑选 AI 工具的用户面前——每个页面均有展示，按月订阅计费，席位有限。',
      'Put your product in front of people choosing AI tools — on every page, billed monthly, with a limited number of spots.',
    ),
  ),
})

async function book() {
  if (submitting.value) return
  submitting.value = true
  error.value = ''

  // Same validation order as the source: required fields, then the URL.
  if (!name.value.trim() || !tagline.value.trim() || !url.value.trim()) {
    error.value = pick('请填写产品名称、标语和链接。', 'Please fill in product name, tagline and link.')
    submitting.value = false
    return
  }
  if (!/^https?:\/\/[^\s]+$/i.test(url.value.trim())) {
    error.value = pick('请输入有效的 https 链接。', 'Enter a valid https link.')
    submitting.value = false
    return
  }

  // No sponsor inventory and no payment provider on this build, so the honest
  // answer is the source's own failure string — not a fake confirmation.
  error.value = pick('创建广告失败，请重试。', 'Could not create the ad. Please try again.')
  submitting.value = false
}
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header class="mb-10 max-w-3xl">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ pick('成为赞助商', 'Sponsor Product Atlas') }}
      </h1>
      <p class="mt-2 text-base text-muted-foreground">
        {{ pick(
          '让您的产品展示在正在挑选 AI 工具的用户面前——每个页面均有展示，按月订阅计费，席位有限。',
          'Put your product in front of people choosing AI tools — on every page, billed monthly, with a limited number of spots.',
        ) }}
      </p>
      <p class="mt-3 text-xs text-muted-foreground">
        {{ pick(
          `${liveCategories.length} 个分类共收录 ${toolCount} 款工具。`,
          `${toolCount} tools listed across ${liveCategories.length} categories.`,
        ) }}
      </p>
    </header>

    <form @submit.prevent="book">
      <section class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <!-- Your ad -->
        <div>
          <h2 class="mb-4 text-lg font-semibold">{{ pick('广告内容', 'Your ad') }}</h2>
          <div class="space-y-4">
            <div class="space-y-2">
              <label for="ad-name" class="text-sm font-medium leading-none">
                {{ pick('产品名称', 'Product name') }}
              </label>
              <input
                id="ad-name"
                v-model="name"
                type="text"
                required
                :placeholder="pick('例如：Acme AI', 'Acme AI')"
                class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
            </div>

            <div class="space-y-2">
              <label for="ad-tagline" class="text-sm font-medium leading-none">
                {{ pick('标语', 'Tagline') }}
              </label>
              <input
                id="ad-tagline"
                v-model="tagline"
                type="text"
                required
                maxlength="120"
                :placeholder="pick('一句话说明产品功能，10–120 字符', 'One line on what it does, 10–120 characters')"
                class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
            </div>

            <div class="space-y-2">
              <label for="ad-url" class="text-sm font-medium leading-none">
                {{ pick('跳转链接', 'Link') }}
              </label>
              <input
                id="ad-url"
                v-model="url"
                type="url"
                required
                placeholder="https://"
                class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
            </div>

            <div class="space-y-2">
              <label for="ad-icon" class="text-sm font-medium leading-none">
                {{ pick('Logo（方形）', 'Logo (square)') }}
              </label>
              <input
                id="ad-icon"
                v-model="iconUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                class="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
            </div>
          </div>
        </div>

        <!-- Preview + how it works -->
        <div class="space-y-6">
          <div>
            <h2 class="mb-4 text-lg font-semibold">{{ pick('预览', 'Preview') }}</h2>
            <div class="group relative flex items-start gap-3 rounded-xl border p-4 transition" :class="tier.card">
              <span class="absolute right-3 top-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {{ pick('赞助', 'Sponsor') }}
                <Icon :name="tier.icon" :size="14" :class="tier.iconClass" />
              </span>

              <div class="shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50" style="width: 40px; height: 40px">
                <img v-if="iconUrl" :src="iconUrl" :alt="name" class="size-full object-cover">
                <div v-else class="grid size-full place-items-center bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <span class="font-semibold" style="font-size: 13.33px">
                    {{ name ? name.slice(0, 2).toUpperCase() : 'AA' }}
                  </span>
                </div>
              </div>

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1 pr-16 text-[15px] font-semibold leading-tight">
                  <span class="truncate">{{ name || 'Acme AI' }}</span>
                  <Icon name="arrow-up-right" :size="14" class="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </span>
                <span class="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                  {{ tagline || pick('一句话说明产品功能，10–120 字符', 'One line on what it does, 10–120 characters') }}
                </span>
              </span>
            </div>
          </div>

          <div class="rounded-2xl border border-border p-5">
            <h3 class="mb-3 text-sm font-semibold">{{ pick('运作方式', 'How it works') }}</h3>
            <ol class="space-y-2.5">
              <li v-for="(step, i) in steps" :key="i" class="flex items-start gap-2.5 text-sm">
                <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {{ i + 1 }}
                </span>
                <span class="leading-relaxed text-muted-foreground">{{ step }}</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- Tiers -->
      <section class="mt-10">
        <h2 class="mb-4 text-lg font-semibold">{{ pick('选择档位', 'Choose a tier') }}</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            v-for="t in tiers"
            :key="t.id"
            type="button"
            :disabled="t.left <= 0"
            :aria-pressed="selected === t.id"
            class="relative flex flex-col rounded-2xl border p-5 text-left transition"
            :class="selected === t.id
              ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
              : 'border-border bg-card hover:border-primary/40'"
            @click="selected = t.id"
          >
            <span
              v-if="selected === t.id"
              class="absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Icon name="check" :size="14" />
            </span>
            <span class="flex items-center gap-2 pr-7 font-semibold">
              <Icon :name="t.icon" :size="16" class="text-primary" />
              <span>{{ t.name }}</span>
            </span>
            <span class="mt-3 text-2xl font-semibold tracking-tight">
              {{ t.price }}<span class="text-sm font-normal text-muted-foreground">{{ pick('/月', '/mo') }}</span>
            </span>
            <ul class="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
              <li v-for="f in t.feats" :key="f" class="flex gap-2">
                <Icon name="check" :size="14" class="mt-0.5 shrink-0 text-foreground" />
                <span>{{ f }}</span>
              </li>
            </ul>
            <span class="mt-4 text-xs font-medium text-primary">
              {{ pick(`剩余 ${t.left} / ${t.spots} 个席位`, `${t.left} of ${t.spots} spots left`) }}
            </span>
          </button>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">
          {{ pick(
            '按月扣费，可随时取消，广告会展示到已付费月份结束。',
            'Billed monthly. Cancel anytime; your ad runs to the end of the paid month.',
          ) }}
        </p>
      </section>

      <div class="mt-8">
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-primary px-6 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
        >
          {{ submitting
            ? pick('处理中…', 'Processing…')
            : pick(`去付款 · ${tier.price}/月`, `Continue to payment · ${tier.price}/mo`) }}
        </button>
        <p v-if="error" class="mt-3 text-sm text-destructive">{{ error }}</p>
      </div>
    </form>

    <!-- FAQ -->
    <section class="mt-16 pb-4">
      <h2 class="mb-4 text-lg font-semibold">{{ pick('常见问题', 'FAQ') }}</h2>
      <div class="flex flex-col border-b border-border">
        <div v-for="(item, i) in faq" :key="item.q" class="border-t border-border">
          <h3 class="flex">
            <button
              type="button"
              :aria-expanded="openFaq === i"
              class="relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-4 text-left text-[15px] font-medium outline-none transition-all hover:no-underline"
              @click="openFaq = openFaq === i ? -1 : i"
            >
              <span>{{ item.q }}</span>
              <Icon
                name="chevron-down"
                :size="16"
                class="ml-auto shrink-0 text-muted-foreground transition-transform duration-200"
                :class="{ 'rotate-180': openFaq === i }"
              />
            </button>
          </h3>
          <div v-if="openFaq === i" class="pb-4 text-sm leading-relaxed text-muted-foreground">
            {{ item.a }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
