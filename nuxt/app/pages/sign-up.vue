<script setup lang="ts">
/**
 * /sign-up — ported from `shipany-dir/src/routes/(auth)/sign-up.tsx`.
 *
 * The source's form is one `FieldGroup` with, in order: the error box, the
 * social buttons, the "or" separator, name/email/password/confirm (plus the
 * invite-code field when that flag is on), then the submit button and the
 * "already have an account?" line.
 *
 * Everything below the separator lives inside `emailEnabled`, and the submit
 * button lives there with it. This build has no password store, so that whole
 * block is off and the page is the Google button — the exact branch the source
 * renders when email auth is disabled. Nothing here is hidden by hand; the same
 * flag drives it.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const { ensure } = useSession()
const { googleEnabled, githubEnabled, emailEnabled, configsLoaded, inviteCodeRequired } =
  useAuthConfig()

const hasSocial = computed(() => googleEnabled || githubEnabled)
const hasAnyMethod = computed(() => emailEnabled || hasSocial.value)

const next = computed(() => {
  const raw = String(route.query.next || route.query.callbackUrl || route.query.redirect || '')
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : localePath('/settings')
})

/** Carry the destination across to sign-in so it survives the switch. */
const switchQuery = computed(() =>
  route.query.next ? `?next=${encodeURIComponent(String(route.query.next))}` : '',
)

onMounted(async () => {
  if (await ensure()) await navigateTo(next.value, { external: true })
})

useSeo({
  title: computed(() => pick('注册 | Product Atlas', 'Create a free account | Product Atlas')),
  description: computed(() =>
    pick(
      '用 Google 免费建账号。这一页不需要银行卡。',
      'Create a free account with Google. No card on this page.',
    ),
  ),
})
</script>

<template>
  <AuthShell
    welcome
    :title="pick('免费建账号', 'Create a free account')"
    :description="pick('已经有账号？用同一个 Google 登录即可。', 'Already have one? The same Google sign-in opens it.')"
    :hero="pick('给你的产品一个会留下来的页面。', 'A page for your product that stays up.')"
    :lead="pick('用 Google 免费建账号。目录页会留下来。付费位置一次付清，付款成功后系统自动发布。', 'Create a free account with Google. The listing page stays up. Paid placement is one payment, and it goes live when that payment succeeds.')"
  >
    <div
      v-if="configsLoaded && !hasAnyMethod"
      class="rounded-lg border border-dashed p-6 text-center"
    >
      <p class="text-sm font-medium">{{ pick('暂无可用的登录方式', 'No sign-in methods available') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ pick(
          '管理员尚未启用任何登录方式，请稍后再试。',
          "The administrator hasn't enabled any sign-in methods yet. Please check back later.",
        ) }}
      </p>
    </div>

    <form v-else class="grid gap-4" @submit.prevent>
      <div v-if="hasSocial" class="grid gap-3">
        <AuthSocialButton
          v-if="googleEnabled"
          provider="google"
          variant="primary"
          :label="pick('使用 Google 继续', 'Continue with Google')"
          :next="next"
        />
        <AuthSocialButton
          v-if="githubEnabled"
          provider="github"
          :label="pick('使用 GitHub 登录', 'Sign in with GitHub')"
        />
      </div>

      <div v-if="hasSocial && emailEnabled" class="flex items-center gap-3">
        <span class="h-px flex-1 bg-border" />
        <span class="text-xs text-muted-foreground">{{ pick('或者继续使用', 'Or continue with') }}</span>
        <span class="h-px flex-1 bg-border" />
      </div>

      <!--
        Name / email / password / confirm / invite code and the submit button
        are all inside `emailEnabled` in the source. Off on this build — see
        `useAuthConfig`. The `inviteCodeRequired` flag is wired the same way.
      -->
      <template v-if="emailEnabled">
        <AuthField id="signup-name" :label="pick('姓名', 'Name')" :placeholder="pick('输入姓名', 'Enter your name')" required />
        <AuthField id="signup-email" type="email" :label="pick('邮箱', 'Email')" :placeholder="pick('输入邮箱地址', 'Enter your email')" required />
        <AuthField id="signup-password" type="password" :label="pick('密码', 'Password')" :placeholder="pick('输入密码', 'Enter your password')" required />
        <AuthField id="signup-confirm" type="password" :label="pick('确认密码', 'Confirm Password')" :placeholder="pick('再次输入密码', 'Re-enter your password')" required />
        <AuthField
          v-if="inviteCodeRequired"
          id="signup-invite"
          :label="pick('邀请码', 'Invite code')"
          :placeholder="pick('请输入邀请码', 'Enter your invite code')"
          required
        />
        <button
          type="submit"
          class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          {{ pick('注册', 'Sign Up') }}
        </button>
        <p class="text-center text-sm text-muted-foreground">
          {{ pick('已有账号？', 'Already have an account?') }}
          <NuxtLink :to="`${localePath('/sign-in')}${switchQuery}`" class="underline underline-offset-4">
            {{ pick('登录', 'Sign In') }}
          </NuxtLink>
        </p>
      </template>
      <p class="auth-switch">
        {{ pick('已经有账号？', 'Already have an account?') }}
        <NuxtLink :to="`${localePath('/sign-in')}${switchQuery}`">
          {{ pick('登录', 'Sign in') }}
        </NuxtLink>
      </p>
      <p class="auth-legal">
        {{ pick('继续即表示你同意', 'By continuing you agree to the') }}
        <NuxtLink :to="localePath('/terms-of-service')">{{ pick('服务条款', 'Terms') }}</NuxtLink>
        {{ pick('和', 'and') }}
        <NuxtLink :to="localePath('/privacy-policy')">{{ pick('隐私政策', 'Privacy') }}</NuxtLink>{{ pick('。', '.') }}
      </p>
    </form>
  </AuthShell>
</template>

<style scoped>
.auth-switch {
  margin: 4px 0 0;
  text-align: center;
  font-size: 14px;
  color: #78716c;
}
.auth-switch a {
  color: #1c1917;
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.auth-legal {
  margin: 0;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: #a8a29e;
}
.auth-legal a {
  color: #57534e;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
