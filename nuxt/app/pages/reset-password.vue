<script setup lang="ts">
/**
 * /reset-password — ported from `shipany-dir/src/routes/(auth)/reset-password.tsx`.
 *
 * The source reads `?token=` off the URL and branches: no token → "this link is
 * invalid or has expired"; success → "your password has been reset" and a push
 * to /sign-in after 1.5s; otherwise the two-password form.
 *
 * There is no password store here, so the form can only fail — and with no
 * token in the URL (there is no mailer to produce one) the page lands on the
 * invalid-link branch, which is the source's own state for a dead link.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const token = computed(() => {
  const raw = String(route.query.token || '')
  return raw && !route.query.error ? raw : null
})

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const submitting = ref(false)

async function submit() {
  error.value = ''
  if (!token.value) {
    error.value = pick('缺少重置令牌，请从邮件中打开链接。', 'Missing reset token. Please open the link from your email.')
    return
  }
  if (password.value.length < 8) {
    error.value = pick('密码至少 8 位。', 'Password must be at least 8 characters.')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = pick('两次输入的密码不一致', 'Passwords do not match')
    return
  }
  submitting.value = true
  // No password store on this build: the token cannot be redeemed.
  error.value = pick('重置链接无效或已过期，请重新申请。', 'This reset link is invalid or has expired. Please request a new one.')
  submitting.value = false
}

useSeo({
  title: computed(() => pick('重置密码 | Product Atlas', 'Reset password | Product Atlas')),
  description: computed(() => pick('为你的账号设置新密码。', 'Choose a new password for your account.')),
})
</script>

<template>
  <AuthShell
    :title="pick('重置密码', 'Reset password')"
    :description="token && !success ? pick('为你的账号设置新密码。', 'Choose a new password for your account.') : undefined"
  >
    <div v-if="!token" class="grid gap-4">
      <div class="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
        {{ pick('重置链接无效或已过期，请重新申请。', 'This reset link is invalid or has expired. Please request a new one.') }}
      </div>
      <NuxtLink :to="localePath('/forgot-password')" class="text-center text-sm underline underline-offset-4">
        {{ pick('找回密码', 'Forgot password') }}
      </NuxtLink>
    </div>

    <div v-else-if="success" class="grid gap-4">
      <p class="text-center text-sm">
        {{ pick('密码已重置，请使用新密码登录。', 'Your password has been reset. You can now sign in.') }}
      </p>
      <NuxtLink :to="localePath('/sign-in')" class="text-center text-sm underline underline-offset-4">
        {{ pick('返回登录', 'Back to sign in') }}
      </NuxtLink>
    </div>

    <form v-else class="grid gap-4" @submit.prevent="submit">
      <div v-if="error" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </div>
      <AuthField
        id="reset-password"
        v-model="password"
        type="password"
        :label="pick('新密码', 'New password')"
        :placeholder="pick('输入新密码', 'Enter your new password')"
        required
      />
      <AuthField
        id="reset-confirm"
        v-model="confirmPassword"
        type="password"
        :label="pick('确认密码', 'Confirm Password')"
        :placeholder="pick('再次输入新密码', 'Re-enter your new password')"
        required
      />
      <button
        type="submit"
        :disabled="submitting"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {{ submitting ? '...' : pick('重置密码', 'Reset password') }}
      </button>
      <p class="text-center text-sm text-muted-foreground">
        <NuxtLink :to="localePath('/sign-in')" class="underline underline-offset-4">
          {{ pick('返回登录', 'Back to sign in') }}
        </NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
