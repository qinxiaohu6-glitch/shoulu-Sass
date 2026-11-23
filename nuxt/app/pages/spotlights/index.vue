<script setup lang="ts">
/**
 * /spotlights — the index for Product Spotlights.
 *
 * Two audiences, one page: a reader who followed a link from an article, and a
 * listing owner deciding whether the entitlement is worth paying for. The first
 * version of this page wrote a paragraph for each and buried both — the copy is
 * now a headline that names the deliverable, one line of what it is, and a
 * three-row list of what the owner actually receives. Facts that used to be
 * prose ("not sold separately", "does not change rank") survive as one footnote
 * line, because they are objections, not benefits, and objections belong at the
 * bottom of the decision, not the top.
 *
 * The cards carry the decoration instead of the prose: a cover built from the
 * listing's first screenshot, the product's own icon, its category and its
 * weekly votes. A listing with no screenshot gets a generated tile rather than
 * an empty box — 23 of the 30 catalogue rows have no screenshot, so an empty
 * box would be the normal case, not the edge case.
 *
 * The list comes from `/api/spotlights`, not from a module constant. An article
 * only exists once the owner has approved it, so a build-time array would mean
 * a redeploy per article — which is exactly the workflow the review queue was
 * added to remove.
 *
 * Bilingual: copy goes through `pick()` and every internal link through
 * `localePath()`, otherwise a Chinese reader lands back in English on the first
 * click. Template comments stay on one line — a multi-line comment here once
 * made Nuxt's page-meta extraction return `{}` and dropped the layout.
 */
import { SPOTLIGHT_PLANS, type Spotlight } from '~~/shared/content/spotlights'
import { breadcrumbSchema, itemListSchema } from '~~/shared/utils/schema'
import { categoryBySlug, localizeCategory, mergeDirectory, orderedTools } from '~~/shared/utils/catalog'
import type { LocalizedTool } from '~~/shared/types/catalog'
import { useSubmittedTools } from '~/composables/useSubmittedTools'

const { lang, pick } = useLang()
const localePath = useLocalePath()

// `useRequestFetch`, not `$fetch`: during SSR a bare `$fetch` starts a new
// request that cannot resolve a relative URL on Workers, and the list would
// silently render empty on the live site while looking complete locally.
const requestFetch = useRequestFetch()
type Payload = { ok: boolean; items: Spotlight[] }
const { data } = await useAsyncData<Payload>(
  'spotlights-index',
  async () => {
    try {
      const res = await requestFetch<Payload>('/api/spotlights')
      return { ok: Boolean(res?.ok), items: res?.items ?? [] }
    } catch {
      // An empty list renders the honest empty state; a thrown error would
      // replace the whole page — including the explanation of what a Spotlight
      // is — over a failed read.
      return { ok: false, items: [] as Spotlight[] }
    }
  },
  { default: (): Payload => ({ ok: false, items: [] }) },
)

// The article record carries no logo, category or screenshot: those belong to
// the listing, and the listing may be a community submission that only exists
// in D1. Resolving through the same merge the product pages use keeps the card
// consistent with what the reader sees after the click.
const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories } = useDirectoryMeta()

const listings = computed(() => {
  const merged = mergeDirectory(
    orderedTools(lang.value, overrides.value),
    submitted.value,
    overrides.value,
  )
  return new Map(merged.map((tool) => [tool.slug, tool]))
})

/**
 * The cover is the listing's first screenshot — the same image the product page
 * leads with. A submission stores an absolute URL, the catalogue a bare file
 * name under `/assets/img/screenshots`, so the two are told apart here.
 */
function coverOf(tool?: LocalizedTool): string {
  const shot = tool?.shots?.[0]
  if (!shot) return ''
  return /^https?:\/\//i.test(shot) ? shot : `/assets/img/screenshots/${shot}`
}

/** A stable tint per product, so two generated covers are not the same tile. */
function hueOf(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

function categoryLabel(slug?: string): string {
  const found = slug ? categoryBySlug(slug, categories.value) : undefined
  return found ? localizeCategory(found, lang.value).name : ''
}

/** `Nov 19, 2026` / `2026年11月19日` — an ISO string reads as a database row. */
function dateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(lang.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: lang.value === 'zh' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

type Card = {
  slug: string
  productName: string
  tagline: string
  publishedAt: string
  cover: string
  hue: number
  logo: string
  name: string
  short: string
  category: string
  votes: number
}

const cards = computed<Card[]>(() =>
  (data.value?.items ?? []).map((item) => {
    const listing = listings.value.get(item.listingSlug)
    return {
      slug: item.slug,
      productName: item.productName,
      tagline: item.tagline,
      publishedAt: item.publishedAt,
      cover: coverOf(listing),
      hue: hueOf(item.productName),
      logo: listing?.logo ?? '',
      name: listing?.name ?? item.productName,
      short: listing?.short ?? '',
      category: categoryLabel(listing?.category),
      votes: listing?.votes_week ?? 0,
    }
  }),
)

const items = computed(() => data.value?.items ?? [])

const planNames = computed(() =>
  pick(
    SPOTLIGHT_PLANS.map((plan) => (plan === 'pro' ? '专业' : '精选')).join('和'),
    SPOTLIGHT_PLANS.map((plan) => (plan === 'pro' ? 'Pro' : 'Featured')).join(' and '),
  ),
)

// `useSeo` owns title/description/OG/canonical/hreflang and derives the two
// canonical URLs from the route. The hand-rolled `useHead` this replaced pinned
// `canonical` to the English URL, which would have pointed the Chinese page at
// its English twin.
useSeo({
  title: computed(() =>
    pick(
      '产品聚光灯：为收录产品写的长文 · dirtool',
      'Product Spotlights: long-form articles about listed products · dirtool',
    ),
  ),
  description: computed(() =>
    pick(
      '一个产品一篇 800–1,500 字长文，挂在自己的网址上，正文链到收录页和官网。已经付款的精选和专业档仍包含这篇。这两档已停售，不单卖。',
      'One 800–1,500 word article per product, at its own URL, with a dofollow link to your site. A Featured or Pro listing already paid for still includes one. Those plans are no longer sold, and this is not sold on its own.',
    ),
  ),
})

useHead({
  script: computed(() => {
    const scripts: { type: 'application/ld+json'; innerHTML: string }[] = [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          breadcrumbSchema([
            { name: pick('发现', 'Discover'), path: '/' },
            { name: pick('产品聚光灯', 'Product Spotlights'), path: '/spotlights' },
          ]),
        ),
      },
    ]
    if (items.value.length) {
      scripts.push({
        type: 'application/ld+json',
        innerHTML: JSON.stringify(
          itemListSchema(
            pick('产品聚光灯', 'Product Spotlights'),
            items.value.map((item) => ({ name: item.productName, path: `/spotlights/${item.slug}` })),
          ),
        ),
      })
    }
    return scripts
  }),
})
</script>

<template>
  <div class="container spx-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('产品聚光灯', 'Product Spotlights') }}</span>
    </nav>

    <header class="spx-hero">
      <div class="spx-hero__main">
        <p class="spx-kicker">{{ pick('产品聚光灯', 'PRODUCT SPOTLIGHTS') }}</p>
        <h1>
          {{ pick('一个产品一篇长文，挂在它自己的网址上', 'One article per product, at its own URL') }}
        </h1>
        <p class="spx-lead">
          {{ pick(
            '800–1,500 字写清它做什么、给谁用、在同类里站哪儿，正文带一条 dofollow 链接指向官网。',
            'A professional 800–1,500 word article covering what the product does, who it is for and how it compares — with a dofollow link to your site.',
          ) }}
        </p>
        <div class="spx-hero__actions">
          <NuxtLink class="spx-btn spx-btn--primary" :to="localePath('/spotlights/submit')">
            {{ pick('提交你的文章', 'Submit your article') }}
          </NuxtLink>
          <NuxtLink class="spx-btn" :to="localePath('/spotlights/guidelines')">
            {{ pick('看模板与标准', 'See the template') }}
          </NuxtLink>
        </div>
      </div>

      <aside class="spx-gain">
        <p class="spx-gain__title">{{ pick('包含什么', "What's included") }}</p>
        <ul>
          <li>
            <span class="spx-gain__icon"><Icon name="link" :size="15" /></span>
            <div>
              <strong>{{ pick('一个独立网址', 'Its own URL') }}</strong>
              <span>/spotlights/your-product</span>
            </div>
          </li>
          <li>
            <span class="spx-gain__icon"><Icon name="arrow-up-right" :size="15" /></span>
            <div>
              <strong>{{ pick('官网链接是 dofollow', 'A dofollow link to your site') }}</strong>
              <span>{{ pick('正文其它外链一律 nofollow', 'All other outbound links are nofollow') }}</span>
            </div>
          </li>
          <li>
            <span class="spx-gain__icon"><Icon name="clock" :size="15" /></span>
            <div>
              <strong>{{ pick('当天进 sitemap', 'In the sitemap the same day') }}</strong>
              <span>{{ pick('收录在多久它就挂多久', 'Available for as long as your listing remains active') }}</span>
            </div>
          </li>
        </ul>
        <p class="spx-gain__note">
          {{ pick('已经付款的', 'Included with a') }}
          <NuxtLink :to="localePath('/pricing')">{{ planNames }}</NuxtLink>
          {{ pick('收录仍包含一篇。这两档已停售，不单卖，也不影响排名。', 'listing that was already paid for. Those plans are no longer sold. It is not sold on its own and does not affect rank.') }}
        </p>
      </aside>
    </header>

    <section v-if="cards.length" class="spx-list">
      <div class="spx-grid">
        <NuxtLink
          v-for="card in cards"
          :key="card.slug"
          class="spx-card"
          :class="{ 'spx-card--lead': cards.length === 1 }"
          :to="localePath(`/spotlights/${card.slug}`)"
        >
          <div class="spx-card__cover" :style="{ '--hue': card.hue }">
            <img v-if="card.cover" :src="card.cover" :alt="card.productName" loading="lazy">
            <span v-else class="spx-card__tile">
              <span class="spx-card__tile-logo">
                <ToolLogo :logo="card.logo" :name="card.productName" :size="56" decorative />
              </span>
            </span>
            <span v-if="card.category" class="spx-card__cat">{{ card.category }}</span>
          </div>

          <div class="spx-card__body">
            <p class="spx-card__product">
              <span class="spx-card__logo">
                <ToolLogo :logo="card.logo" :name="card.productName" :size="18" decorative />
              </span>
              <strong>{{ card.name }}</strong>
              <em v-if="card.votes">
                <Icon name="arrow-up" :size="11" />{{ card.votes }}
              </em>
            </p>
            <h2 class="spx-card__title">{{ card.tagline }}</h2>
            <p v-if="card.short" class="spx-card__short">{{ card.short }}</p>
            <p class="spx-card__foot">
              <time :datetime="card.publishedAt">{{ dateLabel(card.publishedAt) }}</time>
              <span class="spx-card__more">{{ pick('读全文', 'Read article') }} →</span>
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="spx-empty">
      <p class="spx-empty__title">{{ pick('第一篇正在发布中', 'The first Spotlight is in production') }}</p>
      <p class="spx-empty__note">
        {{ pick('文章逐篇发布，所以这里一开始是空的。', 'Articles are published individually, so this list begins empty.') }}
      </p>
      <NuxtLink class="spx-btn spx-btn--primary" :to="localePath('/spotlights/submit')">
        {{ pick('提交你的文章', 'Submit your article') }}
      </NuxtLink>
    </section>

    <section class="spx-how" aria-labelledby="spx-how-title">
      <h2 id="spx-how-title">{{ pick('发布流程', 'How it works') }}</h2>
      <ol class="spx-steps">
        <li>
          <strong>{{ pick('几分钟提交发布', 'Submit in minutes') }}</strong>
          <span>{{ pick(
            '一个表单：粘贴草稿、填产品信息即可提交，不用建站，也不用学后台。',
            'One form. Paste your draft, add the product details and submit — no site setup and no dashboard to learn.',
          ) }}</span>
        </li>
        <li>
          <strong>{{ pick('我们负责发布', 'We publish it') }}</strong>
          <span>{{ pick(
            '排版、校对、上线由编辑部完成，你不需要处理任何技术环节。',
            'Formatting, proofreading and publishing are handled by our editorial team.',
          ) }}</span>
        </li>
        <li>
          <strong>{{ pick('独立网址上线', 'Live at its own URL') }}</strong>
          <span>{{ pick(
            '发布在 /spotlights/your-product，链到收录页，当天进 sitemap。',
            'Published at /spotlights/your-product, linked from your listing, indexed in the sitemap the same day.',
          ) }}</span>
        </li>
      </ol>
      <div class="spx-actions">
        <NuxtLink class="spx-btn spx-btn--primary" :to="localePath('/spotlights/submit')">
          {{ pick('提交你的文章', 'Submit your article') }}
        </NuxtLink>
        <NuxtLink class="spx-btn" :to="localePath('/spotlights/guidelines')">
          {{ pick('模板与发布标准', 'Template and standards') }}
        </NuxtLink>
        <NuxtLink class="spx-btn" :to="localePath('/spotlights/badge')">{{ pick('领取徽章', 'Get the badge') }}</NuxtLink>
      </div>
    </section>

    <p class="spx-foot">
      {{ pick(
        '聚光灯是编辑内容，不是软文：产品官网链接是 dofollow，正文其它外链一律 nofollow，每篇文章都会在页面上声明它随付费收录一起提供。',
        'Editorial, not an advertorial: the product\'s own link is dofollow, all other outbound links in the article are nofollow, and every article discloses that it accompanies a paid listing.',
      ) }}
    </p>
  </div>
</template>

<style scoped>
.spx-page { padding-top: 28px; padding-bottom: 72px; max-width: 1040px; }

/* ── hero ─────────────────────────────────────────────────────────────── */
.spx-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 30px;
  align-items: start;
  margin: 14px 0 34px;
}
.spx-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.spx-hero__main h1 {
  margin: 10px 0 14px;
  font-size: 38px;
  line-height: 1.14;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.spx-lead { margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #4b5058; max-width: 34em; }
.spx-hero__actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* The deliverable list, not another paragraph. Three rows the reader can skim. */
.spx-gain {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(180deg, #fffdf8, #fbfaf6);
  box-shadow: 0 1px 2px rgba(20, 22, 26, 0.04);
}
.spx-gain__title {
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #b45309;
}
.spx-gain ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.spx-gain li { display: flex; gap: 10px; align-items: flex-start; }
.spx-gain__icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  background: #fdf3dc;
  border: 1px solid #f2e0b4;
  color: #a9750a;
}
.spx-gain li div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.spx-gain strong { font-size: 13.5px; line-height: 1.35; }
.spx-gain li span { font-size: 12px; line-height: 1.5; color: var(--muted-foreground); word-break: break-word; }
.spx-gain__note {
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px dashed #e8e2d4;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted-foreground);
}
.spx-gain__note a { color: #b45309; font-weight: 600; text-decoration: none; }
.spx-gain__note a:hover { text-decoration: underline; }

/* ── article cards ────────────────────────────────────────────────────── */
/* `auto-fit`, not `auto-fill`: the pilot has one article, and a 300px card in a
   1040px row reads as a page that failed to load. Empty tracks collapse, so the
   cards stretch to whatever width the row has. */
.spx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
.spx-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s, box-shadow 0.16s, transform 0.16s;
}
.spx-card:hover { border-color: #d9a03a; box-shadow: 0 12px 28px rgba(20, 22, 26, 0.09); transform: translateY(-2px); }

.spx-card__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  max-height: 320px;
  overflow: hidden;
  background: #f1f2f4;
  border-bottom: 1px solid var(--border);
}
.spx-card__cover img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
.spx-card:hover .spx-card__cover img { transform: scale(1.035); }

/* Generated cover: no screenshot exists for most listings, so the empty case
   is the common one and it has to look designed rather than missing. */
.spx-card__tile {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    radial-gradient(120% 130% at 16% 8%, hsl(var(--hue, 40) 78% 91%) 0%, transparent 56%),
    radial-gradient(120% 130% at 90% 96%, hsl(calc(var(--hue, 40) + 38) 70% 90%) 0%, transparent 58%),
    linear-gradient(135deg, #f8f7f2, #eff1f5);
}
.spx-card__tile::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(20, 22, 26, 0.055) 1px, transparent 1px);
  background-size: 14px 14px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 70%);
}
.spx-card__tile-logo {
  position: relative;
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(20, 22, 26, 0.14), 0 1px 0 #fff inset;
}
.spx-card__tile-logo img { width: 56px; height: 56px; object-fit: contain; }

/* Dark, not white: a screenshot cover is often a white UI, and a white pill on
   it disappears. This reads on both a light screenshot and a dark one. */
.spx-card__cat {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(20, 22, 26, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  backdrop-filter: blur(6px);
}

.spx-card__body { display: flex; flex-direction: column; gap: 9px; padding: 16px 18px 18px; }
.spx-card__product { display: flex; align-items: center; gap: 8px; margin: 0; min-width: 0; }
.spx-card__logo {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: #fff;
  overflow: hidden;
}
.spx-card__product strong {
  font-size: 13px;
  font-weight: 700;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spx-card__product em {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: #f4f5f7;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
}
.spx-card__title { margin: 0; font-size: 18px; line-height: 1.38; letter-spacing: -0.015em; text-wrap: balance; }
.spx-card__short {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.spx-card__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted-foreground);
}
.spx-card__more { margin-left: auto; font-weight: 700; color: #b45309; }

/* The newest article gets the wide slot: with one article in the pilot a
   single 300px card in a 1040px row reads as a page that failed to load. */
.spx-card--lead { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr); }
.spx-card--lead .spx-card__cover { aspect-ratio: auto; min-height: 250px; }
.spx-card--lead .spx-card__body { padding: 24px 26px; gap: 12px; justify-content: center; }
.spx-card--lead .spx-card__title { font-size: 25px; line-height: 1.28; }
.spx-card--lead .spx-card__product strong { font-size: 14px; }

/* ── empty state ──────────────────────────────────────────────────────── */
.spx-empty {
  padding: 30px;
  border: 1px dashed #ded9cc;
  border-radius: 18px;
  background: linear-gradient(180deg, #fffdf8, #fbfaf6);
  text-align: center;
}
.spx-empty__title { margin: 0 0 6px; font-size: 16px; font-weight: 700; }
.spx-empty__note { margin: 0 0 18px; font-size: 13px; line-height: 1.6; color: var(--muted-foreground); }
.spx-empty .spx-btn { display: inline-flex; }

/* ── steps ────────────────────────────────────────────────────────────── */
.spx-how { margin-top: 46px; }
.spx-how h2 { margin: 0 0 16px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: var(--foreground); }
.spx-steps {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  counter-reset: spx;
}
.spx-steps li {
  position: relative;
  padding: 18px 18px 18px 48px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}
.spx-steps li::before {
  counter-increment: spx;
  content: counter(spx);
  position: absolute;
  left: 16px;
  top: 17px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #14161a;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spx-steps strong { display: block; margin-bottom: 4px; font-size: 14px; }
.spx-steps span { font-size: 13px; line-height: 1.6; color: var(--muted-foreground); }

/* ── buttons ──────────────────────────────────────────────────────────── */
.spx-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.spx-btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}
.spx-btn:hover { border-color: #c9ccd2; }
.spx-btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
.spx-btn--primary:hover { background: #2a2d33; border-color: #2a2d33; }

.spx-foot { margin: 34px 0 0; font-size: 12px; line-height: 1.7; color: var(--muted-foreground); max-width: 62em; }

@media (max-width: 900px) {
  .spx-hero { grid-template-columns: minmax(0, 1fr); gap: 22px; }
  .spx-card--lead { grid-template-columns: minmax(0, 1fr); }
  .spx-card--lead .spx-card__cover { min-height: 0; aspect-ratio: 16 / 9; }
  .spx-card--lead .spx-card__body { padding: 18px; }
  .spx-steps { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .spx-hero__main h1 { font-size: 27px; }
  .spx-lead { font-size: 15px; }
  .spx-card--lead .spx-card__title { font-size: 20px; }
}
</style>
