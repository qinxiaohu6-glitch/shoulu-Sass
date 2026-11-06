<script setup lang="ts">
/**
 * /settings/profile — source `routes/settings/profile.tsx` +
 * `-settings-form.tsx`.
 *
 * Structure, labels and card layout follow the source. Two things it cannot do
 * here, and both are stated on the page rather than silently failing:
 *
 *  - **Avatar upload.** The source's `ImageUploader` posts to object storage.
 *    There is no storage binding in this build, so the field shows the picture
 *    Google supplied (or the source's own `avatar_hint` when there is none) and
 *    no upload control.
 *  - **Saving.** The source PATCHes `/api/user/profile`. This build has no user
 *    table — the session is a signed cookie minted by Google OAuth — so there is
 *    nothing to write to. Submitting reports the source's own
 *    `settings.profile.save_failed`, which is what its UI shows when the
 *    endpoint errors, instead of pretending the name was saved.
 *
 * The email field is disabled in the source too (it comes from the identity
 * provider), so that one is a straight port.
 */
definePageMeta({ layout: 'settings' })

const { t } = useSettingsI18n()
const { user } = useSession()

const name = ref(user.value?.name || '')
const email = computed(() => user.value?.email || '')
const avatar = computed(() => user.value?.picture || '')
const initial = computed(() => (name.value || 'U').trim().charAt(0).toUpperCase() || 'U')

const saving = ref(false)
const error = ref('')
const saved = ref(false)

async function submit() {
  error.value = ''
  saved.value = false
  if (!name.value.trim()) return
  saving.value = true
  // Nothing to persist — see the note above. The delay keeps the button's
  // pending state readable instead of flashing.
  await new Promise((r) => setTimeout(r, 250))
  saving.value = false
  error.value = t('settings.profile.save_failed')
}

useHead({
  title: computed(() => `${t('settings.profile.title')} · Product Atlas`),
  meta: [{ name: 'robots', content: 'noindex,nofollow' }],
})
</script>

<template>
  <form class="space-y-6 p-6" @submit.prevent="submit">
    <div>
      <h1 class="text-2xl font-bold">{{ t('settings.profile.title') }}</h1>
      <p class="text-muted-foreground">{{ t('settings.profile.description') }}</p>
    </div>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>{{ t('settings.profile.profile') }}</UiCardTitle>
      </UiCardHeader>
      <UiCardContent class="space-y-6 pb-2">
        <div class="space-y-2">
          <UiLabel>{{ t('settings.profile.avatar') }}</UiLabel>
          <div class="flex items-center gap-3">
            <UiAvatar size="lg" class="size-16 rounded-xl">
              <UiAvatarImage
                :src="avatar || undefined"
                :alt="name || 'Avatar'"
                :fallback="initial"
                image-class="rounded-xl"
                fallback-class="rounded-xl text-lg"
              />
            </UiAvatar>
            <p class="text-sm text-muted-foreground">{{ t('settings.profile.avatar_hint') }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <UiLabel for="profile-name">{{ t('settings.profile.name') }}</UiLabel>
          <UiInput id="profile-name" v-model="name" required />
        </div>

        <div class="space-y-2">
          <UiLabel for="profile-email">{{ t('settings.profile.email') }}</UiLabel>
          <UiInput id="profile-email" :model-value="email" disabled class="opacity-60" />
        </div>
      </UiCardContent>
      <UiCardFooter class="flex-col items-start gap-2">
        <UiButton type="submit" :disabled="saving">
          {{ saving ? t('settings.profile.saving') : t('settings.profile.save') }}
        </UiButton>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </UiCardFooter>
    </UiCard>
  </form>
</template>
