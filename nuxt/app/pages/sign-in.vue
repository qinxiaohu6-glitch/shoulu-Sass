<script setup lang="ts">
/**
 * /sign-in — ported from `shipany-dir/src/routes/(auth)/sign-in.tsx`.
 *
 * Same card, same order: error, social buttons, separator, email form,
 * "no account?" line. Every one of those is gated on the same config flags the
 * source reads, so with this build's config (`email_auth_enabled: false`,
 * Google only) the page renders exactly the branch the source would render —
 * one Google button, and nothing that cannot work.
 *
 * The auth pages sit outside `DirectoryLayout` in the source; here they set
 * `layout: false` and use `AuthShell`, which is the same full-screen card.
 *
 * `?auth=<reason>` is this build's own: `/auth/google/start` and the callback
 * answer failures by redirecting back here with a code, and turning that into a
 * sentence is the difference between "try again" and "the site is broken".
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const { ensure } = useSession()
const { googleEnabled, githubEnabled, emailEnabled, configsLoaded } = useAuthConfig()

const hasSocial = computed(() => googleEnabled || githubEnabled)
const hasAnyMethod = computed(() => emailEnabled || hasSocial.value)

/** Where to land after a successful sign-in. Same-site paths only. */
const next = computed(() => {
  const raw = String(route.query.next || route.query.callbackUrl || route.query.redirect || '')
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : localePath('/settings')
})

const AUTH_MSG = {
  unconfigured: [
    'Google 登录还没配置好：站点缺少 OAuth 客户端凭据。',
    'Google sign-in is not configured yet: the site has no OAuth client.',
  ],
  denied: [
    '你取消了 Google 授权。想继续的话再点一次。',
    'You cancelled the Google consent screen. Try again if you changed your mind.',
  ],
  failed: ['Google 授权没走完，请再试一次。', 'Google sign-in did not complete. Please try again.'],
  bad_code: [
    '登录链接已过期或被用过一次，请重新点一次 Google 登录。',
    'That sign-in link expired or was already used. Start again with Google.',
  ],
} as const

type AuthReason = keyof typeof AUTH_MSG
const isReason = (v: string): v is AuthReason => Object.prototype.hasOwnProperty.call(AUTH_MSG, v)

const authError = computed(() => {
  const code = String(route.query.auth || '')
  if (!isReason(code)) return null
  const why = String(route.query.why || '')
  const key: AuthReason = isReason(why) ? why : code
  return pick(AUTH_MSG[key][0], AUTH_MSG[key][1])
})

/** Already signed in — the source sends them home rather than showing a form. */
onMounted(async () => {
  if (await ensure()) await navigateTo(next.value, { external: true })
})

useSeo({
  title: computed(() => pick('登录 | Product Atlas', 'Sign In | Product Atlas')),
  description: computed(() => pick('欢迎回来', 'Welcome back')),
})
</script>

<template>
  <AuthShell :title="pick('登录', 'Sign In')">
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
      <div v-if="authError" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {{ authError }}
      </div>

      <div v-if="hasSocial" class="grid gap-3">
        <AuthSocialButton
          v-if="googleEnabled"
          provider="google"
          :label="pick('使用 Google 登录', 'Sign in with Google')"
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
        The email form is inside `emailEnabled` in the source too. This build has
        no password store, so that branch is off — see `useAuthConfig`.
      -->
      <p v-if="emailEnabled" class="text-center text-sm text-muted-foreground">
        {{ pick('还没有账号？', "Don't have an account?") }}
        <NuxtLink :to="localePath('/sign-up')" class="underline underline-offset-4">
          {{ pick('注册', 'Sign Up') }}
        </NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
