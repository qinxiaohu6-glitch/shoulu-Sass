export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  // Off by default: the floating performance badge overlaps the page and shows
  // up in every pixel-diff screenshot. Set NUXT_DEVTOOLS=1 to turn it back on.
  devtools: { enabled: process.env.NUXT_DEVTOOLS === '1' },

  modules: ['@nuxt/ui', '@nuxtjs/i18n'],

  // Toasts are the source's own dependency (`sonner`); `vue-sonner` is its Vue
  // port with the same DOM and class names. Its stylesheet goes first so
  // `main.css` — which owns the theme tokens the toaster reads — can win.
  css: ['vue-sonner/style.css', '~/assets/css/main.css'],

  // Server-side secrets. `ipSalt` salts the hash stored on submissions for the
  // quota check — the raw address is never written. `sessionSecret` signs the
  // login cookie. Both must be set in production; the dev fallbacks in
  // `hashIp` / `session.ts` exist only so local data stays readable.
  //
  // The Google trio comes from a "Web application" OAuth client. Without
  // clientId + clientSecret the sign-in button reports `unconfigured` instead
  // of bouncing through Google; `googleRedirectUri` is optional and falls back
  // to `<origin>/auth/google/callback`, which is what you register in the
  // Google console anyway.
  runtimeConfig: {
    ipSalt: '',
    sessionSecret: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: '',
    // Test seams only. Set these to run the OAuth round trip against a local
    // stub; empty means the real Google endpoints.
    googleAuthUrl: '',
    googleTokenUrl: '',
    // The owner console. Empty means `/admin` does not exist — a missing secret
    // must not degrade into "anyone can review submissions".
    adminToken: '',
    // Transactional mail. Empty key or sender means every message is skipped
    // silently, which is the correct behaviour for a local checkout: the
    // submission still lands, only the receipt is missing.
    mailApiKey: '',
    mailFrom: '',
    mailReplyTo: '',
    // Public origin used in the links inside those messages.
    siteUrl: '',
    // Test seam only, like googleAuthUrl above: point this at a local stub to
    // assert on the payload without sending mail. Empty means the real API.
    mailEndpoint: '',

    // Domain Rating for /seo-check, via Ahrefs' FREE DR4 endpoint:
    //   GET https://api.ahrefs.com/v3/public/domain-rating-free
    //       ?target=<domain>&version=dr4&output=json
    //   Authorization: Bearer <APIv3 key>
    //
    // The endpoint is free (no paid plan, no API units) but NOT keyless:
    // APIv3 keys are free to generate from a free Ahrefs account at
    // Account settings → API keys. Empty means /api/dr answers
    // `not_configured` and the page says so honestly instead of guessing.
    //
    //   NUXT_AHREFS_TOKEN=<free APIv3 key>
    //
    // `ahrefsDrEndpoint` is a local test seam only, like googleAuthUrl below:
    // point it at a stub to assert the payload without calling Ahrefs. Empty
    // means the real free endpoint.
    ahrefsToken: '',
    ahrefsDrEndpoint: '',
    // Deprecated and unused. Open PageRank answered PR (0–10), which is not
    // DR; DR4 is now the only metric this page shows. Kept declared so an old
    // secret in an existing environment does not break a deploy.
    openPagerankKey: '',

    // Online payment. Empty means the manual flow — tell the submitter to pay,
    // confirm by hand in the console — which is how the site works today and
    // how it keeps working if a merchant account is refused.
    //
    //   NUXT_PAYMENT_PROVIDER=stripe
    //   NUXT_STRIPE_SECRET_KEY=sk_live_…        (sk_test_… while testing)
    //   NUXT_STRIPE_WEBHOOK_SECRET=whsec_…
    //
    // All three are required together: a provider name with a missing secret
    // resolves to "no provider", never to a half-configured checkout.
    paymentProvider: '',
    paymentCurrency: 'usd',
    stripeSecretKey: '',
    stripeWebhookSecret: '',

    // Waffo Pancake. The private key is the PEM downloaded from the Dashboard
    // (PKCS#1 or PKCS#8 both work) and `environment` must match the mode the
    // key was created in — a test-mode event is ignored once pinned to prod.
    //
    //   NUXT_PAYMENT_PROVIDER=waffo
    //   NUXT_WAFFO_MERCHANT_ID=MER_…
    //   NUXT_WAFFO_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n…"
    //   NUXT_WAFFO_ENVIRONMENT=test            (test | prod)
    //   NUXT_WAFFO_PRODUCT_ID=PROD_…           (one product for every tier)
    //   NUXT_WAFFO_TAX_CATEGORY=digital_goods
    //
    // `PRODUCT_IDS` is the per-tier alternative, as JSON:
    //   {"standard":"PROD_…","featured":"PROD_…","pro":"PROD_…","ad":"PROD_…"}
    // The amount is sent with each checkout, so a single product is enough.
    waffoMerchantId: '',
    waffoPrivateKey: '',
    waffoEnvironment: '',
    waffoProductId: '',
    waffoProductIds: '',
    waffoTaxCategory: 'digital_goods',
    // Only needed if Waffo ever rotates the platform key; empty uses the
    // bundled public key for the environment above.
    waffoWebhookPublicKey: '',

    // Creem. `environment` is `production` or anything else for the sandbox
    // host, and the product map is required — Creem prices live on the product,
    // so each tier needs its own.
    //
    //   NUXT_PAYMENT_PROVIDER=creem
    //   NUXT_CREEM_API_KEY=creem_…
    //   NUXT_CREEM_SIGNING_SECRET=whsec_…
    //   NUXT_CREEM_ENVIRONMENT=production
    //   NUXT_CREEM_PRODUCT_IDS={"standard":"prod_…","featured":"prod_…","pro":"prod_…"}
    creemApiKey: '',
    creemSigningSecret: '',
    creemEnvironment: '',
    creemProductIds: '',
  },

  // The site ships a system font stack (see --font-sans in main.css), so Nuxt
  // UI's fonts module has nothing to do. Left enabled it fetches Google Fonts
  // metadata at build time, which fails on networks that cannot reach
  // fonts.google.com and prints two ERROR + six WARN lines on every boot.
  ui: {
    fonts: false,
  },

  // @nuxtjs/color-mode (pulled in by @nuxt/ui) adds `.dark-mode` by default.
  // main.css keys the palette off `.dark`, so drop the suffix. `preference:
  // 'system'` means a visitor whose OS is dark gets dark on first paint with
  // no flash — the class is written server-side.
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'atlas:mode',
  },

  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    // The live site never redirects on Accept-Language: `/` is the English
    // page and `/zh` is the Chinese one, for everyone. Nuxt i18n turns browser
    // detection on by default and bounces `/` to `/zh` for a zh-CN browser,
    // which would (a) look different from the original and (b) leave the
    // English root hard to index.
    detectBrowserLanguage: false,
    locales: [
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'zh', name: '中文', language: 'zh-Hans', file: 'zh.json' },
    ],
  },

  app: {
    head: {
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
