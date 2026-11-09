<script setup lang="ts">
/**
 * Ahrefs DR4 lookup. The only data source is POST /api/dr.
 * A missing number stays a missing number — no estimate, no outbound checker.
 */
interface DrComparison {
  dr3: { value: number; cached: boolean }
  dr4: { value: number; cached: boolean }
  delta: number
}

interface DrAnswer {
  ok: boolean
  reason?: string
  domain?: string
  version?: string
  value?: number
  checked_at?: number
  cached?: boolean
  compare?: DrComparison
}

const { isZh, pick } = useLang()
const localePath = useLocalePath()

const domain = ref('')
const drAnswer = ref<DrAnswer | null>(null)
const drBusy = ref(false)
const drStatus = ref('')
const drStatusKind = ref<'info' | 'error'>('info')

const drWhen = computed(() => {
  const at = drAnswer.value?.checked_at
  if (!at) return ''
  return new Date(at * 1000).toLocaleString(isZh.value ? 'zh-CN' : 'en-US', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })
})

const drDeltaLabel = computed(() => {
  const delta = drAnswer.value?.compare?.delta
  if (delta === undefined) return ''
  if (delta === 0) return pick('持平', 'no change')
  return delta > 0 ? `+${delta}` : `${delta}`
})

const drHeadline = computed(() => {
  switch (drAnswer.value?.reason) {
    case 'not_configured':
      return pick('DR4 查询还没接通', 'The DR4 lookup is not wired up yet')
    case 'bad_key':
      return pick('数据源凭据暂时不可用', 'The data source credentials are not accepted right now')
    case 'rate_limited':
      return pick('查询太频繁了', 'Too many lookups')
    case 'no_data':
      return pick('这个域名暂时没有 DR4 数据', 'No DR4 data for this domain yet')
    default:
      return pick('数据源这次没有返回结果', 'The data source returned nothing this time')
  }
})

const drLead = computed(() => {
  switch (drAnswer.value?.reason) {
    case 'not_configured':
      return pick(
        '本站的 DR4 查询需要一把免费的 Ahrefs API key；接通后会直接在这个框里显示真实数值。我们不会编一个数字，也不会把你送去别的站。',
        'Our DR4 lookup needs a free Ahrefs API key. Once it is connected, the real number appears right here. We will not invent one, and we will not send you to another site.',
      )
    case 'bad_key':
      return pick(
        '本站的查询凭据被数据源拒绝了，我们会尽快修复。请稍后重试，结果仍会显示在本页。',
        'Our lookup credentials were rejected by the data source and we will fix it shortly. Please try again later — the answer still shows up on this page.',
      )
    case 'rate_limited':
      return pick(
        '免费接口有频率限制，稍等一会儿再查就行。查询和结果都留在本页。',
        'The free endpoint has a rate limit. Wait a moment and try again — the lookup and the answer both stay on this page.',
      )
    case 'no_data':
      return pick(
        'Ahrefs 的索引里还没有这个域名的 DR4 数值，可以换个域名，或过几天再查。我们不会用一个估出来的值补空。',
        'Ahrefs does not have a DR4 value for this domain yet. Try another domain or check back in a few days; we will not fill the gap with an estimate.',
      )
    default:
      return pick(
        '可能限流或网络波动，稍后重试即可。查询和结果都留在本页，不会跳到外部网站。',
        'Probably a rate limit or a network hiccup — try again shortly. The lookup and the answer both stay on this page, with no jump to an external site.',
      )
  }
})

async function lookUpDr(withCompare = false) {
  if (drBusy.value) return
  const raw = domain.value.trim()
  if (!raw) {
    drStatusKind.value = 'error'
    drStatus.value = pick('输入一个域名，比如 your-product.com', 'Enter a domain, like your-product.com')
    return
  }
  drBusy.value = true
  drAnswer.value = null
  drStatusKind.value = 'info'
  drStatus.value = pick('正在查询…', 'Looking up…')
  try {
    const res = await $fetch<DrAnswer>('/api/dr', {
      method: 'POST',
      body: { domain: raw, ...(withCompare ? { compare: true } : {}) },
    })
    if (!res.ok && res.reason === 'invalid_domain') {
      drStatusKind.value = 'error'
      drStatus.value = pick('输入一个域名，比如 your-product.com', 'Enter a domain, like your-product.com')
      return
    }
    drStatus.value = ''
    drAnswer.value = res
  } catch {
    drStatusKind.value = 'error'
    drStatus.value = pick('查询服务暂时不可用，请稍后再试。', 'The lookup service is unavailable right now — please try again later.')
  } finally {
    drBusy.value = false
  }
}
</script>

<template>
  <div class="dr-card">
    <form class="tool-form" novalidate @submit.prevent="lookUpDr()">
      <div class="tool-form__field">
        <span class="tool-form__ico"><Icon name="globe" /></span>
        <input
          v-model="domain"
          name="domain"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="your-product.com"
          :aria-label="pick('要查询的域名', 'Domain to look up')"
        >
      </div>
      <button class="btn btn--outline btn--lg" type="submit" :disabled="drBusy">
        <span>{{ pick('查询 DR', 'Look up DR') }}</span>
      </button>
    </form>

    <p class="tool-status" :class="{ 'is-error': drStatusKind === 'error' }" role="status" aria-live="polite">{{ drStatus }}</p>

    <div v-if="drAnswer" class="dr-result">
      <template v-if="drAnswer.ok">
        <div class="dr-value" data-metric="DR">
          <b>{{ drAnswer.value }}</b><span>DR</span>
        </div>
        <p class="dr-meta dr-attribution">
          Domain Rating by <a href="https://ahrefs.com/" target="_blank" rel="noopener">Ahrefs</a>
        </p>
        <p class="dr-meta">
          {{ drAnswer.domain }} · {{ drAnswer.version || 'DR4' }} · {{ pick('数据来源', 'Source') }}：Ahrefs
          <template v-if="drWhen"> · {{ pick('查询时间', 'Checked') }} {{ drWhen }}</template>
          <template v-if="drAnswer.cached"> · {{ pick('缓存', 'Cached') }}</template>
        </p>
        <div v-if="drAnswer.compare" class="dr-compare">
          <p class="dr-compare__head">{{ pick('DR3 → DR4 对照', 'DR3 → DR4 comparison') }}</p>
          <div class="dr-compare__row">
            <span class="dr-compare__label">DR3</span><b>{{ drAnswer.compare.dr3.value }}</b>
            <span class="dr-compare__arrow" aria-hidden="true">→</span>
            <span class="dr-compare__label">DR4</span><b>{{ drAnswer.compare.dr4.value }}</b>
            <span class="dr-compare__delta">{{ drDeltaLabel }}</span>
          </div>
        </div>
        <p class="dr-note">
          <NuxtLink :to="localePath('/seo-check')">
            {{ pick('接着做 28 项页内诊断', 'Run the 28-point SEO check') }}
          </NuxtLink>
        </p>
      </template>
      <div v-else class="dr-empty">
        <p class="dr-empty__head">{{ drHeadline }}</p>
        <p class="dr-empty__body">{{ drLead }}</p>
        <button
          v-if="drAnswer.reason !== 'not_configured'"
          class="btn btn--outline btn--sm"
          type="button"
          :disabled="drBusy"
          @click="lookUpDr()"
        >
          {{ pick('重试', 'Retry') }}
        </button>
      </div>
    </div>
    <p class="dr-disclaimer">
      <Icon name="info" />
      <span>{{ isZh
        ? '我们只显示 Ahrefs 免费 DR4 接口真实返回的数字。查询和结果都留在本站；拿不到就告诉你拿不到，不给你估出来的值，也不把你送去别的站。'
        : 'We only show numbers the free Ahrefs DR4 endpoint actually returned. The lookup and the answer both stay on this site: if we cannot get one, we say so — no estimate dressed up as a fact, and no trip to another site.' }}</span>
    </p>
  </div>
</template>
