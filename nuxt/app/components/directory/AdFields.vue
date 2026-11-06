<script setup lang="ts">
/**
 * Source `routes/admin/directory/-ads-form.tsx` — `renderAdFields`.
 *
 * Four editable fields, then four that are not: tier, status and the two dates
 * come from payment and inventory, so they render disabled with the reason
 * stated above them. The source does exactly this, and its PUT handler ignores
 * anything but the creative fields.
 *
 * The tier select lists this build's two slots rather than the source's three
 * tiers — `dir_ad`-equivalent here is `ads.slot` (`board` / `sidebar`). See
 * `app/utils/admin-ads-ui.ts` for the note.
 */
import { AD_TIERS, type AdFormValues } from '~/utils/admin-ads-ui'

const props = defineProps<{ form: AdFormValues }>()

const { t } = useSettingsI18n()

const tierLabel = computed(() => t(`admin.directory.tier_${props.form.tier}`))
const statusLabel = computed(() => t(`admin.directory.status_${props.form.status}`))
</script>

<template>
  <div class="space-y-4">
    <DirectoryFormRow>
      <DirectoryTextField v-model="props.form.name" :label="t('admin.directory.ads.col_name')" />
      <DirectoryTextField v-model="props.form.url" :label="t('admin.directory.ads.url')" />
    </DirectoryFormRow>

    <DirectoryTextField v-model="props.form.tagline" :label="t('admin.directory.ads.tagline')" />

    <div class="space-y-1">
      <DirectoryImageField
        :label="t('admin.directory.ads.icon_url')"
        :value="props.form.iconUrl"
        @change="(url: string) => (props.form.iconUrl = url)"
      />
      <p class="text-muted-foreground text-xs">{{ t('admin.directory.ads.icon_hint') }}</p>
    </div>

    <p class="text-muted-foreground text-xs">{{ t('admin.directory.ads.billing_locked_hint') }}</p>

    <DirectoryFormRow>
      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.ads.tier') }}</UiLabel>
        <UiSelect :model-value="props.form.tier" disabled>
          <UiSelectTrigger class="w-full" disabled>
            <UiSelectValue :text="tierLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="tier in AD_TIERS" :key="tier" :value="tier">
              {{ t(`admin.directory.tier_${tier}`) }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.common.status') }}</UiLabel>
        <UiSelect :model-value="props.form.status" disabled>
          <UiSelectTrigger class="w-full" disabled>
            <UiSelectValue :text="statusLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="active">{{ t('admin.directory.status_active') }}</UiSelectItem>
            <UiSelectItem value="pending_payment">
              {{ t('admin.directory.status_pending_payment') }}
            </UiSelectItem>
            <UiSelectItem value="expired">{{ t('admin.directory.status_expired') }}</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>
    </DirectoryFormRow>

    <DirectoryFormRow>
      <DirectoryTextField
        v-model="props.form.startsAt"
        :label="t('admin.directory.ads.starts_at')"
        type="datetime-local"
        disabled
      />
      <DirectoryTextField
        v-model="props.form.endsAt"
        :label="t('admin.directory.ads.ends_at')"
        type="datetime-local"
        disabled
      />
    </DirectoryFormRow>
  </div>
</template>
