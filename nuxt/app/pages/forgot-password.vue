<script setup lang="ts">
/**
 * /forgot-password — ported from `shipany-dir/src/routes/(auth)/forgot-password.tsx`.
 *
 * Three states in the source, in this order: password reset disabled → the
 * "unavailable" box; request sent → "check your email"; otherwise the form.
 *
 * This build has no outbound mailer and no password store, so
 * `password_reset_enabled` is `false` and the first branch is the one that
 * renders — the source's own wording for exactly this situation ("the
 * administrator hasn't configured an email service yet"). The form below is
 * kept whole so the page is complete the day the mailer exists.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const { passwordResetEnabled, configsLoaded } = useAuthConfig()

const email = ref('')
const error = ref('')
const sent = ref(false)
const sentEmail = ref('')
const submitting = ref(false)

/**
 * Kept in script rather than inline: the English copy contains an apostrophe
 * ("we'll"), and a double-quoted JS string cannot live inside a double-quoted
 * Vue attribute — the attribute ends at the first `"` and the compiler sees a
 * truncated expression.
 */
const cardTitle = computed(() =>
  sent.value ? pick('请查收邮件', 'Check your email') : pick('找回密码', 'Forgot password'),
)
const cardDescription = computed(() =>
  sent.value
    ? undefined
    : pick('输入你的邮箱，我们将发送密码重置链接。', "Enter your email and we'll send you a link to reset your password."),
)

async function submit() {
  error.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    error.value = pick('输入邮箱地址', 'Enter your email')
    return
  }
  submitting.value = true
  // No mailer on this build. The source reports the transport's message here;
  // without a transport the honest answer is that the request could not be sent.
  error.value = pick('发送失败，请稍后再试。', 'Request failed. Please try again later.')
  submitting.value = false
}

useSeo({
  title: computed(() => pick('找回密码 | Product Atlas', 'Forgot password | Product Atlas')),
  description: computed(() =>
    pick('输入你的邮箱，我们将发送密码重置链接。', "Enter your email and we'll send you a link to reset your password."),
  ),
})
</script>

<template>
  <AuthShell :title="cardTitle" :description="cardDescription">
    <div v-if="configsLoaded && !passwordResetEnabled" class="grid gap-4">
      <div class="rounded-lg border border-dashed p-6 text-center">
        <p class="text-sm font-medium">{{ pick('暂无法找回密码', 'Password reset is not available') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ pick(
            '管理员尚未配置邮件服务，无法发送重置链接，请联系客服。',
            "The administrator hasn't configured an email service yet, so reset links can't be sent. Please contact support.",
          ) }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/sign-in')"
        class="text-center text-sm underline underline-offset-4"
      >
        {{ pick('返回登录', 'Back to sign in') }}
      </NuxtLink>
    </div>

    <div v-else-if="sent" class="grid gap-4">
      <p class="text-center text-sm text-muted-foreground">
        {{ pick(
          `如果 ${sentEmail} 已注册账号，我们已发送密码重置链接，请在 1 小时内完成重置。`,
          `If an account exists for ${sentEmail}, we've sent a link to reset your password. The link will expire in 1 hour.`,
        ) }}
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
        id="forgot-email"
        v-model="email"
        type="email"
        :label="pick('邮箱', 'Email')"
        :placeholder="pick('输入邮箱地址', 'Enter your email')"
        required
      />
      <button
        type="submit"
        :disabled="submitting"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {{ submitting ? '...' : pick('发送重置链接', 'Send reset link') }}
      </button>
      <p class="text-center text-sm text-muted-foreground">
        <NuxtLink :to="localePath('/sign-in')" class="underline underline-offset-4">
          {{ pick('返回登录', 'Back to sign in') }}
        </NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
