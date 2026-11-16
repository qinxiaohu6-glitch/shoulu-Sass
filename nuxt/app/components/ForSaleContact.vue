<script setup lang="ts">
import { CONTACT_CTA, CONTACT_NOTE } from '~~/shared/content/for-sale'

const props = defineProps<{ listingId: string }>()

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const { signedIn, ensure } = useSession()
await ensure()

const message = ref('')
const busy = ref(false)
const note = ref('')

const signInTo = computed(() => localePath({ path: '/sign-in', query: { next: route.fullPath } }))

async function send() {
  if (busy.value) return
  busy.value = true
  note.value = ''
  try {
    const res = await $fetch<{ ok: boolean; interested: number }>('/api/for-sale/contact', {
      method: 'POST',
      body: { listing_id: props.listingId, message: message.value },
    })
    message.value = ''
    note.value = pick(
      `已发给卖家。${res.interested} interested`,
      `Message sent. We emailed the seller. ${res.interested} interested`,
    )
  } catch (err) {
    const data = (err as { data?: { message_en?: string; message_zh?: string } }).data
    note.value =
      (isZh.value ? data?.message_zh : data?.message_en) ||
      pick('没有发出去，请稍后再试。', 'Could not send that message. Try again in a moment.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="sale-contact">
    <p>{{ CONTACT_NOTE }}</p>
    <NuxtLink v-if="!signedIn" class="btn btn--primary" :to="signInTo">{{ CONTACT_CTA }}</NuxtLink>
    <form v-else @submit.prevent="send">
      <label>
        {{ CONTACT_CTA }}
        <textarea v-model="message" rows="3" required maxlength="2000" />
      </label>
      <button class="btn btn--primary" type="submit" :disabled="busy">{{ CONTACT_CTA }}</button>
    </form>
    <p v-if="note" class="sale-contact__note">{{ note }}</p>
  </div>
</template>

<style scoped>
.sale-contact { margin-top: 14px; }
.sale-contact p { margin: 0 0 10px; color: var(--muted-foreground); font-size: 13px; line-height: 1.5; }
.sale-contact textarea {
  display: block;
  width: 100%;
  margin-top: 6px;
  margin-bottom: 10px;
}
.sale-contact__note { margin-top: 8px; }
</style>
