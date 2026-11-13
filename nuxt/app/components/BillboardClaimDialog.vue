<script setup lang="ts">
/**
 * Guest claim modal. Opening it does not require a session.
 * /submit keeps its own sign-in gate; this form is not a directory submission.
 *
 * One-liner stays empty until the visitor types it. The name is a hostname
 * suggestion and can be overwritten. Favicon is Google's public s2 endpoint.
 */
import { centsLabel } from '~~/shared/content/campaign'
import {
  aimSpan,
  amountToTakeRank,
  BILLBOARD_FLOOR_CENTS,
  domainLabel,
  faviconForUrl,
  productNameFromUrl,
  rankForPayment,
  type BidOccupant,
} from '~~/shared/utils/billboard-bid'

const props = defineProps<{
  open: boolean
  url: string
  occupants: BidOccupant[]
  paymentReady: boolean
  busy: boolean
  error: string
  done: boolean
  presetCents: number | null
}>()

const emit = defineEmits<{
  close: []
  'change-url': []
  submit: [payload: { email: string; name: string; tagline: string; amountCents: number }]
}>()

const { pick } = useLang()
const dialog = ref<HTMLDialogElement | null>(null)
const email = ref('')
const name = ref('')
const tagline = ref('')
const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)
const amountDollars = ref(BILLBOARD_FLOOR_CENTS / 100)
const nameTouched = ref(false)

const chargeCents = computed(() => {
  const dollars = Number(amountDollars.value)
  const cents = Number.isFinite(dollars) ? Math.round(dollars) * 100 : 0
  return Math.max(BILLBOARD_FLOOR_CENTS, cents > 0 ? cents : BILLBOARD_FLOOR_CENTS)
})

const landing = computed(() => rankForPayment(chargeCents.value, props.occupants, props.url))
const span = computed(() => aimSpan(props.occupants, props.url))
const host = computed(() => domainLabel(props.url))
const favicon = computed(() => faviconForUrl(props.url))
const price = computed(() => centsLabel(landing.value.chargeCents))

const cta = computed(() =>
  props.paymentReady
    ? pick(`认领展示位 · ${price.value}`, `Claim your spot for ${price.value}`)
    : pick(`索取发票 · ${price.value}`, `Request invoice · ${price.value}`),
)

const landingCopy = computed(() => {
  const dollars = landing.value.chargeCents / 100
  const rank = landing.value.rank
  if (rank === 1) {
    return pick(`${dollars} 美元会让你排到第 1，登上榜首。`, `$${dollars} lands you at #1, the top of the board.`)
  }
  return pick(`${dollars} 美元目前会让你排在第 ${rank}。`, `$${dollars} lands you at #${rank} on the board right now.`)
})

const checks = computed(() => [
  pick('首页展示前 10 名', 'Top 10 shown on the homepage'),
  pick('直接链到你的网站', 'Direct link to your website'),
  props.paymentReady
    ? pick('付款到账后即上线', 'Live the moment payment clears')
    : pick('发票确认后上线', 'Live after the invoice is confirmed'),
  pick('不过期，不续费', 'No expiry, no renewal'),
  pick('一次付清，随时加价爬升', 'Pay once, climb anytime'),
])

function suggestName() {
  if (nameTouched.value) return
  name.value = productNameFromUrl(props.url)
}

function applyPreset() {
  const cents = props.presetCents && props.presetCents >= BILLBOARD_FLOOR_CENTS ? props.presetCents : amountToTakeRank(1, props.occupants, props.url)
  amountDollars.value = cents / 100
}

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    if (!dialog.value) return
    if (isOpen && !dialog.value.open) {
      suggestName()
      applyPreset()
      dialog.value.showModal()
    } else if (!isOpen && dialog.value.open) {
      dialog.value.close()
    }
  },
)

watch(
  () => props.url,
  () => {
    if (props.open) suggestName()
  },
)

function nudge(toward: 'higher' | 'lower') {
  const current = landing.value.rank
  const next = toward === 'higher' ? Math.max(span.value.min, current - 1) : Math.min(span.value.max, current + 1)
  if (next === current) return
  amountDollars.value = amountToTakeRank(next, props.occupants, props.url) / 100
}

function onSubmit() {
  emit('submit', {
    email: email.value,
    name: name.value,
    tagline: tagline.value,
    amountCents: landing.value.chargeCents,
  })
}

function onClose() {
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="bb-modal" @close="onClose" @cancel.prevent="onClose">
    <div class="bb-modal__grid">
      <aside class="bb-modal__sell">
        <p class="bb-modal__kicker">{{ pick('Billboard', 'THE BILLBOARD') }}</p>
        <h2>{{ pick('一次付款，永久可见。', 'One payment. Permanent visibility.') }}</h2>
        <ul>
          <li v-for="line in checks" :key="line">{{ line }}</li>
        </ul>
        <p class="bb-modal__fine">
          {{
            paymentReady
              ? pick('一次付清。付款到账后上线。', 'One-time payment. Live the moment payment clears.')
              : pick('一次付清。发票确认后上线。', 'One-time payment. Live after the invoice is confirmed.')
          }}
        </p>
      </aside>
      <form class="bb-modal__form" @submit.prevent="onSubmit">
        <header>
          <div>
            <h2>{{ pick('快到了', 'Almost there') }}</h2>
            <p>
              {{
                paymentReady
                  ? pick('无需注册账户。付款到账后即可上线。', 'No account needed. Live the moment payment clears.')
                  : pick('无需注册账户。发票确认后上线。', 'No account needed. Live after the invoice is confirmed.')
              }}
            </p>
          </div>
          <button class="bb-modal__x" type="button" :aria-label="pick('关闭', 'Close')" @click="onClose">×</button>
        </header>

        <div class="bb-modal__domain">
          <img v-if="favicon" :src="favicon" alt="" width="28" height="28">
          <span>{{ host || url }}</span>
          <button type="button" @click="emit('change-url')">{{ pick('改变', 'Change') }}</button>
        </div>

        <label>
          {{ pick('产品名称', 'Product name') }}
          <input v-model="name" required maxlength="80" @input="nameTouched = true">
        </label>
        <label>
          {{ pick('一句话（可选）', 'One-liner (optional)') }}
          <input
            v-model="tagline"
            maxlength="140"
            :placeholder="pick('它的功能是什么？请用一句话概括。', 'What does it do, in one sentence?')"
          >
        </label>
        <label>
          {{ pick('邮箱', 'Email') }}
          <input v-model="email" type="email" required maxlength="160" autocomplete="email" placeholder="you@example.com">
        </label>
        <label>
          {{ pick('你的金额', 'Your amount') }}
          <span class="bb-modal__money">
            <span>$</span>
            <input v-model.number="amountDollars" type="number" min="1" step="1" inputmode="numeric" required>
          </span>
          <small>{{ pick(`自己出价，从 ${floorLabel} 起`, `Name your amount, from ${floorLabel}`) }}</small>
        </label>

        <div class="bb-modal__aim">
          <span>{{ pick('目标是', 'Aim for') }}</span>
          <button type="button" :disabled="landing.rank <= span.min" :aria-label="pick('更高名次', 'Higher spot')" @click="nudge('higher')">⌃</button>
          <strong>#{{ landing.rank }}</strong>
          <button type="button" :disabled="landing.rank >= span.max" :aria-label="pick('更低名次', 'Lower spot')" @click="nudge('lower')">⌄</button>
          <em>{{ pick(`需要 ${price}`, `takes ${price}`) }}</em>
        </div>

        <p class="bb-modal__land">{{ landingCopy }}</p>

        <button class="bb-modal__cta" type="submit" :disabled="busy">
          {{ busy ? pick('处理中…', 'Working…') : cta }}
        </button>
        <p v-if="error" class="bb-modal__error">{{ error }}</p>
        <p v-else-if="done" class="bb-modal__fine">
          {{ pick('发票已记下。确认之前不会上线。', 'Invoice requested. Nothing goes live until the invoice is confirmed.') }}
        </p>
        <p v-else class="bb-modal__fine">
          {{
            paymentReady
              ? pick('一次付清。到账后上线。', 'One-time payment. Live the moment payment clears.')
              : pick('一次付清。发票确认后上线。', 'One-time payment. Live after the invoice is confirmed.')
          }}
        </p>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
.bb-modal {
  width: min(880px, calc(100vw - 24px));
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: transparent;
}
.bb-modal::backdrop {
  background: rgba(20, 16, 12, 0.55);
}
.bb-modal__grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  min-height: 520px;
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
}
.bb-modal__sell {
  padding: 28px 24px;
  background: #14120f;
  color: #f6f1e8;
}
.bb-modal__kicker {
  display: inline-block;
  margin: 0 0 16px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #3a2a12;
  color: #f5c451;
  font-size: 11px;
  letter-spacing: 0.08em;
}
.bb-modal__sell h2 {
  margin: 0 0 18px;
  font-size: 32px;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.bb-modal__sell ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}
.bb-modal__sell li::before {
  content: '✓ ';
  color: #86efac;
}
.bb-modal__form {
  padding: 22px 22px 18px;
  display: grid;
  gap: 10px;
  align-content: start;
}
.bb-modal__form header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.bb-modal__form h2 { margin: 0; font-size: 22px; }
.bb-modal__form header p { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
.bb-modal__x {
  border: 0;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.bb-modal__domain {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f4f4f5;
}
.bb-modal__domain img { border-radius: 6px; }
.bb-modal__domain span { flex: 1; font-weight: 650; }
.bb-modal__domain button {
  border: 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}
.bb-modal label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #57534e;
}
.bb-modal input {
  width: 100%;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-weight: 500;
  color: #111;
}
.bb-modal__money {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  padding: 0 12px;
}
.bb-modal__money input { border: 0; padding-left: 0; }
.bb-modal__aim {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.bb-modal__aim button {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #e7e5e4;
  background: #fff;
  cursor: pointer;
}
.bb-modal__aim strong {
  min-width: 42px;
  text-align: center;
  background: #f5f5f4;
  border-radius: 8px;
  padding: 4px 0;
}
.bb-modal__land {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7e8;
  font-size: 14px;
}
.bb-modal__cta {
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-weight: 750;
  padding: 12px 16px;
  cursor: pointer;
}
.bb-modal__cta:disabled { opacity: 0.6; cursor: wait; }
.bb-modal__error { margin: 0; color: #b91c1c; font-size: 13px; }
.bb-modal__fine { margin: 0; color: #78716c; font-size: 12px; }
@media (max-width: 800px) {
  .bb-modal__grid { grid-template-columns: 1fr; }
  .bb-modal__sell { display: none; }
}
</style>
