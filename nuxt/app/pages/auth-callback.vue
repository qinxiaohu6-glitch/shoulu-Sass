<script setup lang="ts">
/**
 * /auth-callback — ported from `shipany-dir/src/routes/(auth)/auth-callback.tsx`.
 *
 * The landing pad between "you are signed in" and where you were going:
 *
 *  - internal path → straight there
 *  - allow-listed app protocol (`myapp://…`) → fetch a session token and append
 *    it as `?token=`; this is the only reason the page exists
 *  - anything else → `/`
 *
 * The allow-list is the source's `desktop_auth_schemes` setting. This build has
 * no desktop client and no `/api/auth/token`, so the list is empty and an app
 * protocol target falls through to `/` — the source's own behaviour for an
 * empty allow-list, not a disabled feature.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const { ensure } = useSession()

const error = ref('')

function safeInternalPath(raw: string | null): string | null {
  if (!raw) return null
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : null
}

function isAppProtocolUrl(raw: string | null): boolean {
  if (!raw) return false
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)
}

onMounted(async () => {
  const target = route.query.redirect ? String(route.query.redirect) : null
  const internal = safeInternalPath(target)

  // Web target, or nothing usable: no token involved, just go.
  if (!isAppProtocolUrl(target)) {
    await navigateTo(internal ? localePath(internal) : localePath('/'), { external: true })
    return
  }

  // App protocol with an empty allow-list → `/`, same as the source.
  if (!(await ensure())) {
    await navigateTo(
      `${localePath('/sign-in')}?redirect=${encodeURIComponent(String(target))}`,
      { external: true },
    )
    return
  }
  await navigateTo(localePath('/'), { external: true })
})

useSeo({
  title: computed(() => pick('正在跳转… | Product Atlas', 'Signing you in… | Product Atlas')),
  description: computed(() => ''),
})
</script>

<template>
  <div class="src-page flex min-h-svh flex-col items-center justify-center gap-3 bg-muted p-6">
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <template v-else>
      <span class="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p class="text-sm text-muted-foreground">{{ pick('正在跳转…', 'Signing you in…') }}</p>
    </template>
  </div>
</template>
