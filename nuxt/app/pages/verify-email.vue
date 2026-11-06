<script setup lang="ts">
/**
 * /verify-email — ported from `shipany-dir/src/routes/(auth)/verify-email.tsx`.
 *
 * Same card: title, "click the link sent to <email>", a resend button with a
 * 60-second cooldown persisted in localStorage, a Continue button that checks
 * the session and moves on, and a back-to-sign-in link.
 *
 * The resend calls a verification mailer this build does not have, so it
 * reports the source's own `verify_email_send_failed` sentence instead of
 * pretending to send. Nothing routes here either — `email_verification_enabled`
 * is false — so the page is reachable only by typing the URL.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const { ensure } = useSession()

const RESEND_COOLDOWN_SECONDS = 60

const email = computed(() => String(route.query.email || '') || null)
const callbackUrl = computed(() => {
  const raw = String(route.query.callbackUrl || '')
  try {
    const decoded = decodeURIComponent(raw)
    return decoded.startsWith('/') ? decoded : localePath('/')
  } catch {
    return localePath('/')
  }
})

const error = ref('')
const loading = ref(false)
const cooldownSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function cooldownKey() {
  return `verify-email:lastSentAt:${String(email.value || '').toLowerCase()}`
}

function readCooldown(): number {
  if (!import.meta.client || !email.value) return 0
  const raw = window.localStorage.getItem(cooldownKey())
  const last = raw ? Number(raw) : 0
  if (!last || Number.isNaN(last)) return 0
  const elapsed = Math.floor((Date.now() - last) / 1000)
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed)
}

function markSentNow() {
  if (!import.meta.client || !email.value) return
  try {
    window.localStorage.setItem(cooldownKey(), String(Date.now()))
  } catch {
    // Private mode: no cooldown persistence, but resending still works.
  }
}

async function resend() {
  error.value = ''
  if (!email.value) {
    error.value = pick('邮箱不能为空', 'Email is required')
    return
  }
  if (loading.value || cooldownSeconds.value > 0) return
  loading.value = true
  // No verification mailer on this build.
  error.value = pick('发送验证邮件失败', 'Failed to send verification email')
  loading.value = false
  markSentNow()
  cooldownSeconds.value = readCooldown()
}

async function proceed() {
  error.value = ''
  if (await ensure()) {
    await navigateTo(callbackUrl.value, { external: true })
    return
  }
  error.value = pick('尚未完成验证，请先前往邮箱点击验证链接。', 'Not verified yet. Please click the link in your email first.')
}

onMounted(() => {
  cooldownSeconds.value = readCooldown()
  timer = setInterval(() => {
    const next = readCooldown()
    cooldownSeconds.value = next
    if (next === 0 && timer) clearInterval(timer)
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

useSeo({
  title: computed(() => pick('请查收邮件 | Product Atlas', 'Check your email | Product Atlas')),
  description: computed(() => pick('继续操作前，请点击发送到以下邮箱的验证链接：', 'To continue, click the link sent to')),
})
</script>

<template>
  <AuthShell
    :title="pick('请查收邮件', 'Check your email')"
    :description="`${pick('继续操作前，请点击发送到以下邮箱的验证链接：', 'To continue, click the link sent to')}${email ? ` ${email}` : ''}`"
  >
    <div class="grid gap-3">
      <div v-if="error" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </div>

      <button
        type="button"
        :disabled="loading || cooldownSeconds > 0"
        class="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        @click="resend"
      >
        <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <template v-else-if="cooldownSeconds > 0">
          {{ pick(`${cooldownSeconds} 秒后可重新发送`, `Resend in ${cooldownSeconds}s`) }}
        </template>
        <template v-else>{{ pick('重新发送验证邮件', 'Resend verification email') }}</template>
      </button>

      <button
        type="button"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        @click="proceed"
      >
        {{ pick('继续', 'Continue') }}
      </button>

      <NuxtLink
        :to="localePath('/sign-in')"
        class="inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
      >
        {{ pick('返回登录', 'Back to sign in') }}
      </NuxtLink>

      <p class="w-full text-center text-xs text-muted-foreground">
        {{ pick('完成验证后，请点击「继续」按钮。', 'After verifying, click "Continue".') }}
      </p>
    </div>
  </AuthShell>
</template>
