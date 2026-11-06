<script setup lang="ts">
/**
 * /admin/settings — source `shipany-dir/src/routes/admin/settings.tsx`.
 *
 * Twelve tabs down the left (a scroll strip on small screens), each holding
 * collapsible group cards built from the registry: `admin-settings-registry.ts`
 * is the source's `modules/config/settings.ts`, copied verbatim. One Save
 * button posts the active tab; the appearance switches save on click instead,
 * because the admin wants to see the change immediately.
 *
 * The "Custom" tab is a key/value editor for keys the registry does not know.
 *
 * This build has no config table: the page loads `{}` and every write says why
 * nothing was stored (`server/api/admin/config*`). The fields, their tips and
 * their defaults are the source's, so the page reads as the source's does.
 */
definePageMeta({ layout: 'admin' })

import { ChevronDown, FlaskConical, Save } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { cn } from '~/utils/ui'
import {
  getSettingGroups,
  getSettingTabs,
  getSettings,
  type Setting,
} from '~/utils/admin-settings-registry'
import { getTestSpec } from '~/utils/admin-settings-test-specs'
import {
  INSTANT_SETTINGS,
  productIdsMappingPlaceholder,
  settingTipKey,
  type CustomRow,
} from '~/utils/admin-settings-ui'
import { APPEARANCE_ENABLED_KEY } from '~/utils/admin-appearance'

const { t } = useSettingsI18n()
const api = useAdminApi()

const tabs = getSettingTabs()
const groups = getSettingGroups()
const settings = getSettings()

const configs = ref<Record<string, string>>({})
const activeTab = ref('general')
const collapsed = ref<Set<string>>(new Set())
const testingGroup = ref<string | null>(null)
const customRows = ref<CustomRow[]>([])
const saving = ref(false)

const placeholders = computed<Record<string, string>>(() => ({
  creem_test_amount: t('admin.settings.placeholders.creem_test_amount'),
  paypal_test_amount: t('admin.settings.placeholders.paypal_test_amount'),
  alipay_test_amount: t('admin.settings.placeholders.alipay_test_amount'),
  wechat_test_amount: t('admin.settings.placeholders.wechat_test_amount'),
  dodo_test_amount: t('admin.settings.placeholders.dodo_test_amount'),
  dodo_api_key: t('admin.settings.placeholders.dodo_api_key'),
  creem_product_ids_mapping: productIdsMappingPlaceholder('prod_'),
  waffo_product_ids_mapping: productIdsMappingPlaceholder('PROD_'),
  dodo_product_ids_mapping: productIdsMappingPlaceholder('pdt_'),
}))

const { data: loadedConfigs, status: configStatus, refresh: refreshConfig } = await useAsyncData<
  Record<string, string>
>('admin-config', () => api.get<Record<string, string>>('/api/admin/config'), {
  default: () => ({}),
})

const { data: loadedCustom, refresh: refreshCustom } = await useAsyncData<CustomRow[]>(
  'admin-config-custom',
  () => api.get<CustomRow[]>('/api/admin/config/custom'),
  { default: () => [] },
)

watch(
  loadedConfigs,
  (value) => {
    if (value) configs.value = { ...value }
  },
  { immediate: true },
)

watch(
  loadedCustom,
  (value) => {
    if (value) customRows.value = value.map((row) => ({ ...row }))
  },
  { immediate: true },
)

const loading = computed(() => configStatus.value === 'pending')

function toggleCollapse(name: string) {
  const next = new Set(collapsed.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  collapsed.value = next
}

function handleChange(name: string, value: string) {
  configs.value = { ...configs.value, [name]: value }
  if (INSTANT_SETTINGS.has(name)) void instantSave(name, value)
}

/**
 * Appearance settings save on click and repaint at once. Doesn't refetch
 * `admin-config`, which would wipe other unsaved edits in the form.
 */
async function instantSave(name: string, value: string) {
  try {
    await api.post('/api/admin/config', { [name]: value })
    toast.success(t('admin.settings.applied'))
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function save() {
  saving.value = true
  try {
    if (activeTab.value === 'custom') {
      const rows = customRows.value
        .map((r) => ({ key: r.key.trim(), value: r.value }))
        .filter((r) => r.key)
      await api.post('/api/admin/config/custom', { configs: rows })
      toast.success(t('admin.settings.save_success'))
      await refreshCustom()
      return
    }
    const toSave: Record<string, string> = {}
    for (const setting of tabSettings.value) {
      if (configs.value[setting.name] !== undefined) toSave[setting.name] = configs.value[setting.name]!
    }
    await api.post('/api/admin/config', toSave)
    toast.success(t('admin.settings.save_success'))
    await refreshConfig()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

const tabGroups = computed(() => groups.filter((g) => g.tab === activeTab.value))
const tabSettings = computed(() => settings.filter((s) => s.tab === activeTab.value))

/** The fields of one group, minus the appearance ones while the switch is off. */
function groupSettings(groupName: string): Setting[] {
  return tabSettings.value.filter(
    (s) =>
      s.group === groupName &&
      // Appearance options only show once the switch is on.
      (s.group !== 'appearance' ||
        s.name === APPEARANCE_ENABLED_KEY ||
        configs.value[APPEARANCE_ENABLED_KEY] === 'true'),
  )
}

/** `admin.settings.tips.<name>` if defined, else nothing. */
function fieldTip(name: string) {
  const key = settingTipKey(name)
  const text = t(key)
  return text === key ? undefined : text
}

/** The current form values of one group — what a test would run against. */
function testOverrides(groupName: string) {
  return Object.fromEntries(
    settings
      .filter((s) => s.group === groupName && configs.value[s.name] !== undefined)
      .map((s) => [s.name, configs.value[s.name]!]),
  )
}

/** The group whose test dialog is open, with its spec resolved. */
const testing = computed(() => {
  const name = testingGroup.value
  if (!name) return null
  const spec = getTestSpec(name)
  return spec ? { name, spec } : null
})
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6 lg:max-w-5xl">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold">{{ t('admin.settings.title') }}</h1>
        <p class="text-muted-foreground">{{ t('admin.settings.description') }}</p>
      </div>
      <UiButton class="gap-2" :disabled="saving" @click="save">
        <Save class="size-4" />
        {{ saving ? t('admin.settings.saving') : t('admin.settings.save') }}
      </UiButton>
    </div>

    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <!-- Tabs: horizontal scroll strip on small screens, sticky side nav on lg+ -->
      <nav
        class="border-border -mx-6 flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b px-6 lg:sticky lg:top-6 lg:mx-0 lg:w-48 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0"
      >
        <button
          v-for="tab in tabs"
          :key="tab.name"
          type="button"
          :aria-current="activeTab === tab.name ? 'page' : undefined"
          :class="
            cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              'lg:mb-0 lg:rounded-md lg:border-b-0 lg:px-3 lg:text-left',
              activeTab === tab.name
                ? 'border-primary text-foreground lg:bg-muted'
                : 'text-muted-foreground hover:text-foreground lg:hover:bg-muted/50 border-transparent',
            )
          "
          @click="activeTab = tab.name"
        >
          {{ t(`admin.settings.tabs.${tab.name}`) }}
        </button>
      </nav>

      <div class="min-w-0 flex-1 space-y-6">
        <!-- Groups -->
        <template v-if="loading">
          <UiCard v-for="i in 4" :key="i">
            <UiCardHeader>
              <UiSkeleton class="h-5 w-40" />
            </UiCardHeader>
            <UiCardContent class="space-y-4">
              <div v-for="j in 3" :key="j" class="space-y-2">
                <UiSkeleton class="h-4 w-24" />
                <UiSkeleton class="h-8 w-full" />
              </div>
            </UiCardContent>
          </UiCard>
        </template>

        <AdminSettingsCustomCard v-else-if="activeTab === 'custom'" v-model="customRows" />

        <template v-else>
          <UiCard v-for="group in tabGroups" :key="group.name">
            <template v-if="groupSettings(group.name).length > 0">
              <UiCardHeader class="cursor-pointer" @click="toggleCollapse(group.name)">
                <div class="flex items-center justify-between">
                  <UiCardTitle class="select-text">
                    {{ t(`admin.settings.groups.${group.name}.title`) }}
                  </UiCardTitle>
                  <div class="flex items-center gap-2">
                    <UiButton
                      v-if="getTestSpec(group.name)"
                      variant="outline"
                      size="sm"
                      class="gap-1.5"
                      @click.stop="testingGroup = group.name"
                    >
                      <FlaskConical class="size-3.5" />
                      {{ t('admin.settings.test.button') }}
                    </UiButton>
                    <ChevronDown
                      :class="
                        cn(
                          'text-muted-foreground size-5 transition-transform',
                          collapsed.has(group.name) && '-rotate-90',
                        )
                      "
                    />
                  </div>
                </div>
              </UiCardHeader>
              <UiCardContent v-if="!collapsed.has(group.name)" class="space-y-4">
                <AdminSettingField
                  v-for="setting in groupSettings(group.name)"
                  :key="setting.name"
                  :setting="setting"
                  :label="t(`admin.settings.fields.${setting.name}`)"
                  :placeholder="placeholders[setting.name] ?? setting.placeholder"
                  :tip="fieldTip(setting.name)"
                  :value="configs[setting.name] ?? setting.defaultValue ?? ''"
                  @change="(v: string) => handleChange(setting.name, v)"
                >
                  <template v-if="setting.name === 'telegram_chat_id'" #extra>
                    <AdminTelegramChatIdHelper :configs="configs" />
                  </template>
                </AdminSettingField>
              </UiCardContent>
            </template>
          </UiCard>
        </template>
      </div>
    </div>

    <AdminSettingsTestDialog
      v-if="testing"
      :open="true"
      :group="testing.name"
      :spec="testing.spec"
      :group-title="t(`admin.settings.groups.${testing.name}.title`)"
      :config-overrides="testOverrides(testing.name)"
      @close="testingGroup = null"
    />
  </div>
</template>
