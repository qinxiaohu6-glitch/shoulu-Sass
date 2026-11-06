<script setup lang="ts">
/**
 * /redeem-invite — ported from `shipany-dir/src/routes/(auth)/redeem-invite.tsx`.
 *
 * One field, one submit, a sign-out escape hatch. The source validates the code
 * against `/api/invite-codes/validate` and then redeems it.
 *
 * This build has no invite table, so both calls are absent and the form reports
 * the source's own `invite_code_invalid` sentence. `invite_code_required` is
 * false as well, which is why nothing links here — the route exists so the port
 * is complete, not because the flow is switched on.
 */
definePageMeta({ layout: false })

const { pick } = useLang()
const localePath = useLocalePath()

const code = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  const trimmed = code.value.trim()
  if (!trimmed) {
    error.value = pick('请输入邀请码', 'Invite code is required')
    return
  }
  loading.value = true
  // No invite store on this build: no code can validate.
  error.value = pick('邀请码无效', 'Invalid invite code')
  loading.value = false
}

useSeo({
  title: computed(() => pick('输入邀请码 | Product Atlas', 'Enter your invite code | Product Atlas')),
  description: computed(() => pick('本应用为邀请制,请输入有效的邀请码以继续。', 'This app is invite-only. Enter a valid invite code to continue.')),
})
</script>

<template>
  <AuthShell :title="pick('输入邀请码', 'Enter your invite code')">
    <form class="grid gap-4" @submit.prevent="submit">
      <div v-if="error" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </div>

      <p class="text-sm text-muted-foreground">
        {{ pick('本应用为邀请制,请输入有效的邀请码以继续。', 'This app is invite-only. Enter a valid invite code to continue.') }}
      </p>

      <AuthField
        id="invite-code"
        v-model="code"
        :label="pick('邀请码', 'Invite code')"
        :placeholder="pick('请输入邀请码', 'Enter your invite code')"
        required
      />

      <button
        type="submit"
        :disabled="loading"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {{ loading ? '...' : pick('继续', 'Continue') }}
      </button>

      <p class="text-center text-sm text-muted-foreground">
        <NuxtLink :to="localePath('/auth/logout')" external class="underline underline-offset-4">
          {{ pick('退出登录', 'Sign Out') }}
        </NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
