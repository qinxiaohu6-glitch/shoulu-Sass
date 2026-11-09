<script setup lang="ts">
/**
 * The Google / GitHub buttons from the source's auth forms.
 *
 * The logo paths are the source's inline SVGs, copied as-is — a re-drawn mark
 * would be a different logo. `outline` button styling is shadcn's, matching the
 * `Button variant="outline"` the source renders.
 *
 * Only Google is wired: it navigates to `/auth/google/start?next=<path>`, which
 * is this build's OAuth entry point. GitHub has no provider here, so the button
 * only renders when `githubEnabled`, which is always false — see
 * `useAuthConfig`.
 */
const props = withDefaults(
  defineProps<{
    provider: 'google' | 'github'
    label: string
    /** Where to land after the round trip. */
    next?: string
    /** `primary` is the only call to action on Google-only pages. */
    variant?: 'outline' | 'primary'
  }>(),
  { variant: 'outline' },
)

const localePath = useLocalePath()

const href = computed(() =>
  props.provider === 'google'
    ? `/auth/google/start?next=${encodeURIComponent(props.next || localePath('/settings'))}`
    : undefined,
)

const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
</script>

<template>
  <a
    v-if="provider === 'google'"
    :href="href"
    class="auth-google"
    :class="variant === 'primary' ? 'auth-google--primary' : 'auth-google--outline'"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="auth-google__mark" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.3 5.3C39.2 40.4 44 35 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
    <span>{{ label }}</span>
    <svg v-if="variant === 'primary'" class="auth-google__arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  </a>
  <button
    v-else
    type="button"
    class="inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4" aria-hidden="true">
      <path :d="GITHUB_PATH" fill="currentColor" />
    </svg>
    {{ label }}
  </button>
</template>

<style scoped>
.auth-google {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-decoration: none;
  font-weight: 650;
}
.auth-google__mark {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
.auth-google__arrow {
  width: 16px;
  height: 16px;
  margin-left: 4px;
}
.auth-google--outline {
  height: 44px;
  border-radius: 12px;
  border: 1px solid #e7e5e4;
  background: #fff;
  color: #1c1917;
  font-size: 14px;
}
.auth-google--primary {
  height: 52px;
  border-radius: 999px;
  border: 0;
  background: #111111;
  color: #fff;
  font-size: 15px;
  box-shadow: 0 8px 20px rgba(17, 17, 17, 0.18);
}
.auth-google--primary:hover {
  background: #2a2a2a;
}
</style>
