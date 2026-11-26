<script setup lang="ts">
const { pick } = useLang()
const localePath = useLocalePath()

useSeo({
  title: computed(() => pick('提交应用 · dirtool', 'Submit an app · dirtool')),
  description: computed(() => pick(
    '粘贴 App Store、Google Play 或 Mac App Store 链接，导入公开应用资料并提交审核。',
    'Paste an App Store, Google Play or Mac App Store link to import public app details and submit for review.',
  )),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header class="mb-10 max-w-3xl">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ pick('提交应用', 'Submit an app') }}
      </h1>
      <p class="mt-2 text-base text-muted-foreground">
        {{ pick(
          '粘贴 App Store、Google Play 或 Mac App Store 链接。我们会尝试导入商店公开资料，你可以校对后再登录提交。',
          'Paste an App Store, Google Play or Mac App Store link. We will import available public details for you to review before signing in and submitting.',
        ) }}
      </p>
      <NuxtLink :to="localePath('/apps')" class="mt-3 inline-flex text-sm text-primary underline underline-offset-4">
        {{ pick('返回应用目录', 'Back to apps') }}
      </NuxtLink>
    </header>

    <DirectorySubmitForm listing-type="app" />
  </div>
</template>
