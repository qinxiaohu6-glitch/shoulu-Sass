<script setup lang="ts">
/**
 * Source `routes/admin/-settings-field.tsx` — `TelegramChatIdHelper`.
 *
 * Telegram's getUpdates link for the token in the form, so the admin can read
 * `chat.id` after messaging the bot. Built only from an unsaved, well-formed
 * token — a saved token is masked and never sent back to the browser.
 */
import { ExternalLink } from 'lucide-vue-next'
import { MASKED_PREFIX } from '~/utils/admin-settings-ui'

const props = defineProps<{ configs: Record<string, string> }>()

const { t } = useSettingsI18n()

const token = computed(() => (props.configs.telegram_bot_token || '').trim())
const masked = computed(() => token.value.startsWith(MASKED_PREFIX))
const wellFormed = computed(() => /^\d+:[\w-]+$/.test(token.value))

const url = computed(() => {
  const base = (props.configs.telegram_api_base || '').trim() || 'https://api.telegram.org'
  return `${base.replace(/\/+$/, '')}/bot${token.value}/getUpdates`
})
</script>

<template>
  <p v-if="masked" class="text-muted-foreground text-xs">
    {{ t('admin.settings.telegram_token_masked') }}
  </p>
  <a
    v-else-if="wellFormed"
    :href="url"
    target="_blank"
    rel="noreferrer"
    class="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
  >
    {{ t('admin.settings.telegram_get_chat_id') }}
    <ExternalLink class="size-3" />
  </a>
</template>
