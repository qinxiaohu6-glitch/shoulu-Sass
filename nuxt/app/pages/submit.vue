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
const { pick } = useLang()

useSeo({
  title: computed(() => pick('提交产品 · Product Atlas', 'Submit a product · Product Atlas')),
  description: computed(() =>
    pick(
      '先粘贴网址。我们起草收录。只在保存或付款时登录。',
      'Paste your URL first. We draft the listing. Sign in only when you save it or pay.',
    ),
  ),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header class="mb-10 max-w-3xl">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ pick('提交产品', 'Submit a product') }}
      </h1>
      <p class="mt-2 text-base text-muted-foreground">
        {{
          pick(
            '粘贴产品网址。我们从公开页面起草标题、简介和图标。不对的地方由你修改，然后登录以保存或付款。',
            'Paste the product URL. We draft a title, description, and icon from the public page. You edit anything that is wrong, then sign in to save or pay.',
          )
        }}
      </p>
    </header>

    <DirectorySubmitForm />
  </div>
</template>
