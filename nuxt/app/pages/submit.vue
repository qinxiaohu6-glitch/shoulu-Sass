<script setup lang="ts">
/**
 * /submit — ported from `shipany-dir/src/routes/submit.tsx`.
 *
 * A heading block, then the form. Nothing else: the source's submit page has no
 * sidebar content and no second column beyond the form's own preview card.
 *
 * The page used to be a three-step wizard with URL auto-extraction. That was this
 * site's own design, not the source's, and the source's single form is what the
 * port asks for — so the fields are now name / website / tagline / category /
 * introduction, and the free-vs-paid choice is two cards under the form.
 */
const t = useDirectoryCopy()

useSeo({
  title: computed(() =>
    `${t('directory.submit_page_title')} · ${t('directory.brand_name')}`,
  ),
  description: computed(() => t('dir.submit.desc')),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header class="mb-10 max-w-3xl">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ t('dir.submit.title') }}
      </h1>
      <p class="mt-2 text-base text-muted-foreground">{{ t('dir.submit.desc') }}</p>
    </header>

    <DirectorySubmitForm />
  </div>
</template>
