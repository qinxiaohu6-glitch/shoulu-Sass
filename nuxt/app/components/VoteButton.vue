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
  /** Just launched: triangle, count, and the word "votes" in one column. */
  stack?: boolean
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

function statusOf(err: unknown): number {
  const info = err as { statusCode?: number; status?: number; response?: { status?: number } }
  return Number(info?.statusCode || info?.status || info?.response?.status || 0)
}

async function vote() {
  if (busy.value || voted.value) return
  busy.value = true
  try {
    const res = await $fetch<{ ok: boolean; accepted?: boolean; votes?: number }>('/api/vote', {
      method: 'POST',
      body: { slug: props.slug },
    })
    if (typeof res?.votes === 'number') count.value = res.votes
    else if (res?.accepted) count.value += 1
    voted.value = true
  } catch (err: unknown) {
    if (statusOf(err) === 401) {
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
    :class="[{ 'vote--sm': small && !stack, 'vote--stack': stack, 'is-voted': voted }]"
    type="button"
    :aria-label="`${count} ${pick('票 / 本周', 'votes this week')}`"
    :disabled="busy"
    @click.prevent.stop="vote"
  >
    <span v-if="stack" class="vote--stack__n">
      <Icon name="arrow-up" />
      <span>{{ count }}</span>
    </span>
    <template v-else>
      <Icon name="arrow-up" />
      <span>{{ count }}</span>
    </template>
    <small v-if="stack">{{ pick('票', 'votes') }}</small>
  </button>
</template>
