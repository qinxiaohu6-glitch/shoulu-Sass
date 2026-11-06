<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/user-menu.tsx` — the account chip at the
 * foot of the sidebar rail, plus its dropdown.
 *
 * Three of the source's submenus are not rendered because the switches that
 * would show them are off in this deployment:
 *
 *  - **Theme colour** — `user_theme_enabled` is an admin switch, and the
 *    appearance presets (`THEMES`) are only applied while `APPEARANCE_ENABLED`
 *    is on. Neither is configured here, so `useAppearance` returns the defaults
 *    and the source itself would not render this submenu either.
 *  - **Admin entry** — only for `isAdmin`. This build has no role table; the
 *    admin console is gated by a token cookie, not by the session.
 *  - **Forced colour mode** — `colorModeForced` is false here, so the light /
 *    dark / system submenu does render.
 */
import { Check, EllipsisVertical, Languages, LogOut, Monitor, Moon, Palette, Sun, User } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ profileHref?: string }>(), { profileHref: '/settings/profile' })

const { user, signOut } = useSession()
const { isZh, pick, locale, locales, setLocale } = useLang()
const colorMode = useColorMode()
const localePath = useLocalePath()

const displayName = computed(() => user.value?.name || 'User')
const email = computed(() => user.value?.email || '')
const avatarUrl = computed(() => user.value?.picture || '')

const LOCALE_NAMES: Record<string, string> = { en: 'English', zh: '简体中文' }

const themeLabel = computed(() =>
  colorMode.value === 'dark'
    ? pick('深色', 'Dark')
    : colorMode.value === 'light'
      ? pick('浅色', 'Light')
      : pick('跟随系统', 'System'),
)

function onSignOut() {
  if (!window.confirm(pick('确定要退出登录吗？', 'Sign out of your account?'))) return
  signOut(localePath('/'))
}

function switchLocale(next: string) {
  // The locale is a URL prefix here (`prefix_except_default`), so this is a
  // navigation rather than a cookie write — same visible result as the source's
  // reload-on-the-localized-URL.
  setLocale(next as 'en' | 'zh')
}
</script>

<template>
  <ul data-slot="sidebar-menu" data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class="group/menu-item relative">
      <UiDropdownMenu>
        <UiDropdownMenuTrigger
          class="ring-sidebar-ring w-full rounded-lg outline-none focus-visible:ring-2 [&>div]:w-full"
        >
          <div
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            class="peer/menu-button group/menu-button flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate"
          >
            <UiAvatar class="size-8 rounded-lg">
              <UiAvatarImage
                :src="avatarUrl || undefined"
                :alt="displayName"
                :fallback="displayName.charAt(0).toUpperCase()"
                fallback-class="rounded-lg text-xs"
              />
            </UiAvatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ displayName }}</span>
              <span class="truncate text-xs text-sidebar-foreground/70">{{ email }}</span>
            </div>
            <EllipsisVertical class="ml-auto size-4" />
          </div>
        </UiDropdownMenuTrigger>

        <UiDropdownMenuContent class="min-w-56" side="right" align="end" :side-offset="4">
          <UiDropdownMenuGroup>
            <UiDropdownMenuLabel class="p-0 font-normal">
              <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UiAvatar class="size-8">
                  <UiAvatarImage
                    :src="avatarUrl || undefined"
                    :alt="displayName"
                    :fallback="displayName.charAt(0).toUpperCase()"
                    fallback-class="rounded-lg text-xs"
                  />
                </UiAvatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium">{{ displayName }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ email }}</span>
                </div>
              </div>
            </UiDropdownMenuLabel>
          </UiDropdownMenuGroup>

          <UiDropdownMenuSeparator />

          <UiDropdownMenuItem v-if="props.profileHref" @select="navigateTo(localePath(props.profileHref))">
            <User class="size-4" />
            {{ pick('个人资料', 'Profile') }}
          </UiDropdownMenuItem>

          <UiDropdownMenuSub>
            <UiDropdownMenuSubTrigger class="gap-2 px-2 py-2">
              <Languages class="size-4" />
              <span class="flex-1">{{ LOCALE_NAMES[locale] || locale }}</span>
            </UiDropdownMenuSubTrigger>
            <UiDropdownMenuSubContent>
              <UiDropdownMenuItem
                v-for="loc in locales"
                :key="typeof loc === 'string' ? loc : loc.code"
                @select="switchLocale(typeof loc === 'string' ? loc : loc.code)"
              >
                <span class="flex-1">{{
                  LOCALE_NAMES[typeof loc === 'string' ? loc : loc.code] ||
                  (typeof loc === 'string' ? loc : loc.code)
                }}</span>
                <Check
                  v-if="(typeof loc === 'string' ? loc : loc.code) === locale"
                  class="size-3.5"
                />
              </UiDropdownMenuItem>
            </UiDropdownMenuSubContent>
          </UiDropdownMenuSub>

          <UiDropdownMenuSub>
            <UiDropdownMenuSubTrigger class="gap-2 px-2 py-2">
              <Palette class="size-4" />
              <span class="flex-1">{{ themeLabel }}</span>
            </UiDropdownMenuSubTrigger>
            <UiDropdownMenuSubContent>
              <UiDropdownMenuItem @select="colorMode.preference = 'light'">
                <Sun class="size-4" />
                <span class="flex-1">{{ pick('浅色', 'Light') }}</span>
                <Check v-if="colorMode.preference === 'light'" class="size-3.5" />
              </UiDropdownMenuItem>
              <UiDropdownMenuItem @select="colorMode.preference = 'dark'">
                <Moon class="size-4" />
                <span class="flex-1">{{ pick('深色', 'Dark') }}</span>
                <Check v-if="colorMode.preference === 'dark'" class="size-3.5" />
              </UiDropdownMenuItem>
              <UiDropdownMenuItem @select="colorMode.preference = 'system'">
                <Monitor class="size-4" />
                <span class="flex-1">{{ pick('跟随系统', 'System') }}</span>
                <Check v-if="colorMode.preference === 'system'" class="size-3.5" />
              </UiDropdownMenuItem>
            </UiDropdownMenuSubContent>
          </UiDropdownMenuSub>

          <UiDropdownMenuSeparator />

          <UiDropdownMenuItem @select="onSignOut">
            <LogOut class="size-4" />
            {{ pick('退出登录', 'Sign out') }}
          </UiDropdownMenuItem>
        </UiDropdownMenuContent>
      </UiDropdownMenu>
    </li>
  </ul>
</template>
