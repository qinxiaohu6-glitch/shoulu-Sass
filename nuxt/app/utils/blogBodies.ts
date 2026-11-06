/**
 * Article bodies for the local blog posts.
 *
 * These used to be four `?raw` imports of the matching .md files. Vite
 * understands that suffix and `nuxt dev` was fine, but Nitro builds the
 * **server** bundle with rollup, which does not: it tried to
 * `fs.open("shared/content/blog/...md?raw")` and the production build died
 * with ENOENT. So the bodies are inlined as plain string literals instead —
 * nothing for rollup to resolve, nothing for the Worker to read from disk.
 *
 * The .md files are kept as the editing source. They are the two demo posts
 * that ship with the port and the nav entry is hidden, so this ~7 KB of
 * duplication is deliberate and cheap. `loadLocalBody`'s signature is
 * unchanged; only `app/pages/blog/[slug].vue` calls it.
 */

const BODIES: Record<string, Record<string, string>> = {
  "what-is-shipany": {
    en: "ShipAny TanStack is a **headless SaaS engine**: pre-wired business logic with minimal UI. Instead of shipping yet another themed template, it gives you the machinery every SaaS needs — authentication, payments, subscriptions, a credit system, role-based access control, and internationalization — and stays out of the way of your product pages.\n\n## Why headless?\n\nMost SaaS boilerplates couple their business logic to a specific landing page design. The moment you rebrand, you fight the template. ShipAny TanStack splits the codebase along a different line:\n\n- **`src/components/`** — durable primitives. Pricing tables, headers, sidebars, shadcn/ui. These survive a rebrand.\n- **`src/blocks/`** — disposable page sections. They read your translations and wire content into the primitives. Rewrite them per project.\n- **`src/modules/`** — pure business logic. Payments, credits, subscriptions, RBAC. Each module is a standalone service file you can delete without breaking the others.\n\n## What's in the box\n\n1. **Authentication** — email/password and OAuth via better-auth, with session management and account linking.\n2. **Payments** — Stripe, PayPal, and Creem providers behind a single `PaymentManager` interface.\n3. **Credits** — FIFO consumption, expiration, auto-grant on signup, and revocation for usage-based billing.\n4. **RBAC** — roles and permissions with wildcard matching, plus a full admin panel.\n5. **Multi-database** — Drizzle ORM with PostgreSQL, MySQL, SQLite, Turso, and Cloudflare D1 support.\n6. **i18n** — English and Chinese built in, locale-aware routing via next-intl.\n\n## Getting started\n\n```bash\npnpm install\ncp .env.example .env.development\npnpm db:push\npnpm dev\n```\n\nThat's it — the engine runs on SQLite out of the box, and you can switch databases by changing one env var. Build your product on top, not the plumbing underneath.\n",
    zh: "ShipAny TanStack 是一个 **Headless SaaS 引擎**:预置完整业务逻辑,UI 保持最小化。它不是又一个绑定特定主题的模板,而是把每个 SaaS 都需要的底层机制——认证、支付、订阅、积分系统、基于角色的权限控制和国际化——全部装配好,把产品页面的设计自由留给你。\n\n## 为什么是 Headless?\n\n大多数 SaaS 模板把业务逻辑和特定的落地页设计耦合在一起,一旦改版就要和模板搏斗。ShipAny TanStack 按另一条线切分代码:\n\n- **`src/components/`** — 耐用的基础组件。价格表、页头、侧边栏、shadcn/ui,改版换皮时它们保持不变。\n- **`src/blocks/`** — 可抛弃的页面区块。读取翻译文案,把内容装配进基础组件,每个项目都应该重写。\n- **`src/modules/`** — 纯业务逻辑。支付、积分、订阅、权限,每个模块都是独立的 service 文件,删掉任何一个都不影响其他模块。\n\n## 开箱即用的能力\n\n1. **认证** — 基于 better-auth 的邮箱密码和 OAuth 登录,带会话管理和账号关联。\n2. **支付** — Stripe、PayPal、Creem 多 Provider,统一在 `PaymentManager` 接口之后。\n3. **积分** — FIFO 消耗、过期、注册自动发放、撤销,支持按量计费。\n4. **权限** — 角色与权限通配符匹配,配套完整的管理后台。\n5. **多数据库** — Drizzle ORM,支持 PostgreSQL、MySQL、SQLite、Turso 和 Cloudflare D1。\n6. **国际化** — 内置中英双语,基于 next-intl 的语言感知路由。\n\n## 快速开始\n\n```bash\npnpm install\ncp .env.example .env.development\npnpm db:push\npnpm dev\n```\n\n就这么简单——引擎默认跑在 SQLite 上,改一个环境变量即可切换数据库。把时间花在产品上,而不是底层管道上。\n",
  },
  "blocks-vs-components": {
    en: "Every template promises \"easy customization,\" then makes you grep through twelve files to change a headline. ShipAny TanStack avoids that with one rule:\n\n> A file that reads translations is a **block**. A file that takes all content via props is a **component**.\n\n## Blocks are disposable\n\nBlocks live in `src/blocks/` and are zero-config page sections — `<Hero />`, `<Pricing />`, `<Footer />`. Each one reads i18n messages, builds a content config, and passes it to a component. They're the demo material: when you start a real project, you delete them and write your own.\n\n```tsx\n// src/blocks/header.tsx — a block: reads i18n, wires a component\nexport async function Header() {\n  const t = await getTranslations('landing');\n  const navLinks = [{ href: '/#features', label: t('nav.features') }];\n  return <SiteHeader navLinks={navLinks} />;\n}\n```\n\n## Components are durable\n\nComponents live in `src/components/` and never read translations. `SiteHeader`, `PricingTable`, `AppSidebar` — all content arrives via props. They don't know your app's name, your copy, or your locale. That's exactly why they survive every rebrand.\n\n## Why the split matters\n\nWhen you rebrand or start a new project from the template:\n\n1. **Keep** `src/components/*` — the chassis.\n2. **Rewrite** `src/blocks/*` — the content wiring.\n3. **Rewrite** the translation JSON files that feed the blocks.\n\nThe page files themselves stay tiny — `page.tsx` is pure composition, a stack of blocks. Changing your entire landing page touches blocks and JSON, never the primitives. The split is not cosmetic; it's what makes customization a rewrite of intent instead of a fight with someone else's design decisions.\n",
    zh: "每个模板都宣称\"轻松定制\",然后让你为了改一句标题翻遍十二个文件。ShipAny TanStack 用一条规则避免这种局面:\n\n> 读取翻译文案的文件是 **block**,所有内容都通过 props 传入的文件是 **component**。\n\n## Block 是可抛弃的\n\nBlock 放在 `src/blocks/`,是零配置的页面区块——`<Hero />`、`<Pricing />`、`<Footer />`。每个 block 读取 i18n 文案,组装内容配置,再传给 component。它们是演示素材:真正开始项目时,删掉它们,写你自己的。\n\n```tsx\n// src/blocks/header.tsx — block:读 i18n,装配 component\nexport async function Header() {\n  const t = await getTranslations('landing');\n  const navLinks = [{ href: '/#features', label: t('nav.features') }];\n  return <SiteHeader navLinks={navLinks} />;\n}\n```\n\n## Component 是耐用的\n\nComponent 放在 `src/components/`,永远不读翻译。`SiteHeader`、`PricingTable`、`AppSidebar`——所有内容都来自 props。它们不知道你的应用叫什么、文案是什么、语言是什么,这正是它们能挺过每一次改版的原因。\n\n## 为什么这个切分重要\n\n当你改版或基于模板开新项目时:\n\n1. **保留** `src/components/*` —— 底盘。\n2. **重写** `src/blocks/*` —— 内容装配层。\n3. **重写**喂给 block 的翻译 JSON 文件。\n\n页面文件本身始终很小——`page.tsx` 是纯组合,一摞 block 而已。重做整个落地页只需要动 block 和 JSON,永远不碰基础组件。这个切分不是表面功夫:它让定制变成\"重写意图\",而不是和别人的设计决策搏斗。\n",
  },
}

const BASE_LOCALE = 'en'

/** Raw markdown for one post, falling back to the base locale. */
export function loadLocalBody(slug: string, locale: string): string | null {
  const entry = BODIES[slug]
  if (!entry) return null
  return entry[locale] ?? entry[BASE_LOCALE] ?? null
}
