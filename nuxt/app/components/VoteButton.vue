<script setup lang="ts">
/**
 * The vote button — one per card, one per detail page.
 *
 * The server render keeps the catalogue's `votes_week` so the first paint is
 * byte-identical to the live site; only a click moves the number. `/api/vote`
 * answers 401 without a session, which is the signal to send the visitor to
 * sign in rather than pretend the click landed.
 */
const props = defineProps<{
  slug: string
  votes: number
  /** The card variant (24px pill) instead of the detail-page one (36px). */
  small?: boolean
}>()

const { pick } = useLang()
// @nuxtjs/i18n v10 exposes the helper as a composable, not an auto-import.
const localePath = useLocalePath()
const route = useRoute()

const count = ref(props.votes)
const voted = ref(false)
const busy = ref(false)

watch(
  () => props.votes,
  (n) => {
    if (!voted.value) count.value = n
  },
)

async function vote() {
  if (busy.value || voted.value) return
  busy.value = true
  try {
    const res = await $fetch<{ ok: boolean; accepted?: boolean }>('/api/vote', {
      method: 'POST',
      body: { slug: props.slug },
    })
    if (res?.accepted) count.value += 1
    voted.value = true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 401) {
      // `localePath` comes from @nuxtjs/i18n, so zh pages go to /zh/sign-in.
      // `next` is the full path (locale prefix included) so the visitor lands
      // back on the page whose button they clicked, not on the homepage.
      await navigateTo(localePath({ path: '/sign-in', query: { next: route.fullPath } }))
      return
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    class="vote"
    :class="[{ 'vote--sm': small, 'is-voted': voted }]"
    type="button"
    :aria-label="`${count} ${pick('票 / 本周', 'votes this week')}`"
    :disabled="busy"
    @click.prevent.stop="vote"
  >
    <Icon name="arrow-up" />
    <span>{{ count }}</span>
  </button>
</template>
