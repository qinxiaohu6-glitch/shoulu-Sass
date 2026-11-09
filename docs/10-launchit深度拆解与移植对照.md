# launchit.fast 深度拆解与我方移植对照

> 调研日期：2026-11-08
> 调研方式：入口资产抓取、sitemap 全量解析、49 个页面 HTML + 可见文本提取、真实浏览器截图（首页 / pricing / billboard）、JS bundle 拆解、公开只读接口实测、结构化数据统计、与线上 dirtool.com 逐项对照。
> 原始素材：`/tmp/lif/`（`html/` 49 个页面、`md/` 49 份可见文本、`shots/` 3 张截图、`js/` + `js2/` 37 个 chunk、`sitemap.xml`、`urls.txt`、`llms.txt`、`llms-full.txt`、`robots.txt`）。
> **本轮只做研究：没有改任何代码、没有构建、没有部署、没有推送 GitHub。** 文末的移植清单只是建议，等 owner 明确点头才动手。

---

## 一、结论先行

launchit.fast 不是「一个目录站加了几个收费按钮」，而是**一个把 534 个产品页放大成 1009 个 URL 的内容工厂，再挂三层变现漏斗的独立生意**。它真正厉害的地方不在视觉，而在三件事：

1. **每个产品页都是一篇自动装配的长文**：用站内真实数据（上线日期、同周竞品、30 天浏览量、投票、分类排名）生成 10 多个叙事区块 + 11 条 FAQ + FAQPage JSON-LD + 该产品的 Ask AI 深链。534 个产品 = 534 篇不重复的长尾内容，不需要人写。
2. **把「数据」变成「说服」**：`/stats` 直接把数据库数字摊开（534 产品 / 718 累计提交 / 390,281 浏览 / 73 个付费档 / 40 个外站挂了 badge），`/api/launchQueue` 实时返回 `waiting:180, earliest:"2027-01-12"` 制造免费排队稀缺感，`/api/presence` 返回实时在线人数与国家分布。定价页每一句都在引用这些活数字。
3. **商业化切成三段漏斗，且每段都能单独买、能叠加**：Step 1 Launch（免费 / $24.99 / $49 / $15 重发）、Step 2 Get seen（$39/月 / $29 / $59 / $15 起竞价）、Step 3 Compound（$99 / $149 / $199 代提交）。另有一个配置化全站促销 `sale` 对象，一次配置、全站改价。

**最值得抄的三件事**（按性价比排序）：
- 产品详情页的「站内数据叙事」区块（纯模板 + 已有数据，不动支付、不动版式）；
- 每个落地页标配 FAQPage 结构化数据（对方 49 个抓取页里 21 个有，我方 12 个抽查页里只有 2 个有）；
- `/stats` 透明数据页 + 运行时稀缺感接口（`launchQueue` / `presence`），把「我们有多少流量」变成可验证的卖点。

**绝对不能照抄的一条**：它整个付费叙事建立在「**从 DR 71 域名拿一条永久 dofollow 反链**」上。我方 `dirtool.com` 经真实 Ahrefs 免费接口实测 **DR4 = 0、DR3 = 0**（见 `docs/06` §5.2），`catalog.json` 里那个 `site.dr: 41` 是未验证旧值。抄它的反链话术会构成虚假宣传。

**我方已经明显更强、不要倒退的三处**：DR 查询是 DR4（对方是 DR3）、robots 点名 15 个 AI 爬虫 + 有 `ai.txt` + `llms.txt` 有 `Cite this site for`（对方 `ai.txt` 是 404、robots 只有 `User-agent: *`）、sitemap 真用了 600 条 `xhtml:link` hreflang（对方声明了 xhtml 命名空间但 0 条使用）。

---

## 二、技术指纹与基础设施

| 项 | 实测值 | 证据 |
|---|---|---|
| 框架 | Next.js SSR（Pages Router），`x-powered-by: Next.js`、`__NEXT_DATA__`、`_next/static/chunks` | 响应头、`html/home.html` |
| buildId | `pyoSaJ2AoqGO4io_jz_g8` | `__NEXT_DATA__` |
| 托管 / CDN | Cloudflare，`server: cloudflare`，`cf-ray: ...-AMS` | 响应头 |
| 缓存 | `cache-control: s-maxage=60, stale-while-revalidate=120`；`cf-cache-status: HIT / EXPIRED / DYNAMIC` | `/pricing` 响应头 |
| 图片存储 | Firebase Storage `launch-it-a38f6.firebasestorage.app`，分 `icons/`、`featured-image/`、`blog-thumbnails/`、`billboard-screenshots/` 四类目录，URL 带 `?alt=media&token=<uuid>` | 首页 `pageProps`、`billboardTop` |
| 字体 | `font-family:'Inter',system-ui,sans-serif`，无 Google Fonts 外链 | `html/home.html` |
| 样式 | Tailwind 原子类（如 `text-[13px] text-gray-500`） | 页面 HTML |
| OG 图 | 静态 `https://launchit.fast/img/og-image.png?v=4`，另有 `/api/og` 动态图接口 | meta / JS bundle |
| Twitter | `@launchitfast`，`summary_large_image` | meta |
| 语言 | 纯英文，`<html lang="en">`，无 hreflang、无第二语言 | 全站 |
| 数据形态 | 服务端把整页数据塞进 `__NEXT_DATA__.props.pageProps`，一次请求返回完整数组 | 首页 13 个 key |

首页 `pageProps` 的 13 个 key（这说明它把首屏所有模块都做成 SSR 数据，而不是客户端再拉）：

```
tools, deals, categories, stats, groupedByMonth, totalCount,
currentMonthLabel, footerBacklinks, domainRating, billboardTop,
guides, directoryStats, sale
```

几个关键字段原样：

```json
"stats": { "listingViews": 390276, "websiteClicks": 1022 },
"directoryStats": { "total": 216, "highDr": 105,
  "top": [ {"name":"Reddit r/SaaS","dr":95}, {"name":"Source Forge","dr":93}, {"name":"AI Infinity","dr":92} ] },
"domainRating": 71,
"totalCount": 534,
"currentMonthLabel": "November 2026",
"sale": {
  "id": "sale-1793977033645", "theme": "black-friday", "name": "Black Friday",
  "percent": 50,
  "products": ["premium","boost","relaunch","featured","newsletter","review","liftoff","orbit","moonshot"],
  "percents": { "premium":30, "boost":30, "relaunch":30, "featured":30, "newsletter":30, "review":30 },
  "startsAt": null, "endsAt": "2026-11-30T22:59:00.000Z",
  "placements": { "home": false, "pricing": true, "everywhere": true },
  "cta": { "label": "Claim the deal", "href": "/pricing" }
}
```

`sale` 是**一套配置驱动的全站促销系统**，不是硬编码横幅：含主题、总折扣、参与商品清单、逐商品折扣、起止时间、投放位置（首页 / 定价页 / 全站）、CTA。`/api/sale` 实时返回同一对象。注意它写 `percent: 50` 但 6 个商品实际是 30%，只有目录服务三档是 50% —— 所以对外文案诚实写成 "**Up to** 50% OFF"。

---

## 三、站点全貌：1009 个 URL 的构成

`sitemap.xml` 共 **1009 个 `<loc>`**，每个都带 `lastmod` / `changefreq` / `priority`（1009/1009，覆盖率 100%）。命名空间声明了 `image / video / xhtml / news`，但**这四类标签一个都没用**（`xhtml:link` = 0，即无 hreflang）。

| URL 数 | 页型 | 说明 |
|---:|---|---|
| 529 | `/tools/*` | 产品详情页，占 52% |
| 140 | `/tags/*` | 标签聚合页（站内共 454 个 tag / 3,072 次标注，sitemap 收录其中 140 个） |
| 104 | `/glossary/*` | SEO / 创业术语词条页 |
| 47 | `/compare/*` | 两两产品对比页，**自动生成** |
| 46 | `/blog/*` | 长文指南 |
| 32 | `/seo-tools/*` | 31 个免费工具 + 1 个工具首页 |
| 30 | `/directories/*` | 216 个外部目录的分页列表（每页 30 条，8 页） |
| 17 | `/category/*` | 16 个分类 + 分类首页 |
| 13 | `/launching-now/*` | 月度归档（当月 + 12 个月历史） |
| 12 | `/alternatives/*` | 「X 的替代品」页 |
| 11 | `/how-to/*` | 操作指南 |
| 6 | `/deals/*` | 折扣详情 |
| 5 | `/docs/*` | 产品文档 |
| 其余 | 单页 | `/`、`/about`、`/startups`、`/community`、`/featured`、`/submit`、`/partners`、`/contributors`、`/submission-service`、`/billboard`、`/advertise`、`/pricing`、`/product-launch-checklist`、`/startup-showdown`、`/top` |

**没进 sitemap 的页面**：`/stats`、`/contact`、`/mcp`、`/llms.txt`。

对照我方线上 `https://dirtool.com/sitemap.xml`：**200 个 URL**（100 英文 + 100 中文），其中 `/tools` 70、`/makers` 62、`/tags` 32、`/categories` 18；**600 条 `xhtml:link` hreflang 真实生效**（每个 URL 列 en / zh-Hans / x-default 三条）。我方是双语，量级是对方的 1/5，但语言标注反而更规范。

### 每种页型都在解决同一件事

它不是「写 1009 篇内容」，而是**6 种模板 × 少量结构化数据**：

- `/tools/<slug>` ← 534 个产品记录
- `/tags/<slug>` ← 454 个标签
- `/compare/<a>-vs-<b>` ← 同分类产品两两组合（只生成 47 对，不是全组合）
- `/glossary/<term>` ← 103+ / 113 个术语（页面写 103+，`/stats` 写 113，**两处口径不一致**）
- `/alternatives/<product>` ← 12 个知名工具的替代清单
- `/launching-now/<month>` ← 12 个月归档，每个月页自动生成「本月 N 个产品、最热分类、得票冠军、Top 10」

`/launching-now/march-2026` 的开头就是自动写好的一段话：

> "19 startups launched on LaunchIt in March 2026, across 9 categories. The busiest were AI and Machine Learning (7), SaaS and Business Tools (3) and Startup and Small Business (2). Brew TV led the month with 3 upvotes, ahead of TeamShotsPro and OpenScout. 3 of the top 10 can be tried for free."

`/tags/ai-video` 同理：

> "The collection spans AI and Machine Learning and Creative and Media Tools among other categories. Pricing starts at $19. The newest arrival is SentX SI, launched in November 2026. BeatMotion currently leads the ranking with 3 votes."

**这是可复制性最高的部分**：这些句子全部由 `count / max / min / top-N / groupBy` 拼出来，不需要 LLM、不需要编辑。

---

## 四、逐页精读（49 个抓取页里的关键页）

### 4.1 首页 `/` —— 六屏结构（截图 `shots/home.png`）

1. **顶栏**：火箭 logo `LaunchIt`；导航 `Billboard / Launchpad / Community / Pricing / More▾`；右侧搜索图标、`Login`、`Sign Up`、黑底白字 `↗ New Launch`。
2. **全站促销条**（黑底）：`🟡 BLACK FRIDAY — Up to 50% off everything · Premium listings $17.49 · ends in 22d 7h →`；倒计时天数由 `sale.endsAt` 算。
3. **Hero**（浅米色渐变）：左右各 4 张悬浮的「Featured」小卡（真实付费客户，如 VendorButton / IndieTools / BeatMotion / Blipix、DirPilot / MegaLaunch / Inkwell / "Your product here"）；中间大标题 `Launch today. Get discovered.`，副标题 `Guaranteed homepage placement, a permanent listing page, and founders discovering your product long after launch day.`；两个按钮 `Launch Now`（黑）/ `Advertise`（白）；下面一排 8 个创始人头像 + `100+ founders launched`，三行信任标签 `✓ AI fills in your listing` `✓ Under 2 minutes` `✓ 534 products listed`；再一个 `▶ Watch LaunchIt in 30s`。
   - 细节：hero 标题正上方叠了一枚小徽章，页面源码里是 `ahrefs` / `DR 0` 两行（截图可见蓝黑色小标），同页 `pageProps.domainRating` 却是 `71` —— 这是「工具组件」和「站点自身 DR 卖点」两个不同的数，抓取时未能确定该徽章的确切语义，**不要按「实时 DR checker」理解**。
4. **Billboard Top 10 卡带**（浅黄绿渐变，`TOP 10 ON THE BILLBOARD`）：10 张带网站截图的卡，每张右下角标金额（$27 / $26 / $25 / $20 / $15 / $10 / $7 / $6 / $6 / $5），右上 `Want this spot?`。**首页直接露价** —— 我方 P0 刚做了同样的事（右栏 `rail-for-rent` 露 $19）。
5. **三栏主体**：左 `ALL TIME Statistics`（390,307 Listing views / 1,022 Website clicks）+ `BROWSE Categories`（带计数）+ `LIST IT EVERYWHERE`（Reddit r/SaaS DR 95 / Source Forge DR 93 / AI Infinity DR 92 → `Browse 216 startup directories`）+ `Where to launch in 2026 From $99 Submit for me`；中 `LIVE DIRECTORY Just launched`（绿色小点 + `Next launch in 00:20:55`）+ 按月份分组的产品列表（November 2026 · 34 launches），每条卡含 logo、名称、✅ 认证勾、分类标签、⚡ 票数、💬 评论数；右 `HAND-PICKED Featured`（第一张是 `Your product / $39/mo / Get Featured →`，下面才是真实 Featured 客户）。
   - **左栏「Deals」和「Best startup directories」都是内链到自己的变现页**，没有一处外链漏出。
6. **页脚**：五组内链（Product / Discover / Learn / Free Tools / Startup Showdown），外加 `Ask AI about LaunchIt` 四个深链、`RSS`、`llms.txt`。

### 4.2 `/pricing` —— 三层漏斗（截图 `shots/pricing.png`）

黑金渐变的 Black Friday 大卡（`UP TO 50% OFF On everything we sell`，右侧 4 格倒计时 `22 DAYS / 07 HOURS / 16 MIN / 41 SEC`，下面 4 个商品价格对照 `Premium $24.99→$17.49`、`Boost $49→$34.30`、`Moonshot $199→$99.50`、`Featured $39→$27.30 1st mo`，`Plus 5 more products on sale`）。

标题 `Put your product in front of thousands of customers`，副标题点明 `pay once, reach the makers ... keep the visibility`。下面一个 ③ 步骤条 `1 Launch (Free or $17.49) → 2 Get seen (Placements from $15) → 3 Compound (Directories from $49.50)`，再一行 `ASK AI ABOUT LAUNCHIT PRICING` + ChatGPT / Claude / Perplexity / Grok 四个图标。

再一条**深色数据条**：`2,037 Newsletter subscribers | 390K+ Listing views | 534 Products listed | DR 71 Ahrefs domain rating`，底下一句 `Live numbers from the directory. Every plan below buys into this audience.`

全量价格（含 Black Friday 折后，2026-11-08 实测）：

| 步骤 | 商品 | 标准价 | BF 折后 | 计费 |
|---|---|---|---|---|
| 1 | Basic Launch | $0 | — | 免费，须挂反链 + badge |
| 1 | Premium Launch | $24.99 | $17.49 | 一次性 |
| 1 | Boost bundle（Premium + 30 天 Featured） | $49 | $34.30 | 一次性 |
| 1 | Relaunch（重发） | $15 | $10.50 | 一次性 |
| 2 | Featured placement | $39/月 | 首月 $27.30 | **唯一订阅**，可随时取消 |
| 2 | Newsletter issue | $29/期 | $20.30 | 一次性 |
| 2 | Written review | $59 | $41.30 | 一次性 |
| 2 | Billboard spot | 自定，from $15 | — | 一次性，可追加 |
| 3 | Liftoff 30+ 目录 | $99 | $49.50 | 一次性 |
| 3 | Orbit 60+ 目录 | $149 | $74.50 | 一次性 |
| 3 | Moonshot 100+ 目录 | $199 | $99.50 | 一次性 |

⚠️ **发现一处对方的价格不一致**：`/submission-service` 页把三档写成 `$99 / $149 / $199`（折后）对 `$149 / $199 / $249`（划线原价），而 `/pricing` 写的是 `$99 / $149 / $199`（划线原价）对 `$49.50 / $74.50 / $99.50`。两套原价差 $50。**不要照抄，也不要拿它当定价参考**。

定价页底部还有：`Not sure where to start? Pick the line that sounds like you.`（三句场景化导购）、7 条 FAQ、X 上创始人证言 3 条、5 篇免费指南、`Launch once. Keep showing up.` 收尾 CTA、Newsletter 订阅框。

FAQ 里两条**合规消歧**写得非常克制，值得记：

> "Is the backlink dofollow? Yes. Every listing links to your website with a standard link, server-rendered in the page HTML, and it stays up permanently. **Advertising is sold for the placement and the readers it reaches, and we make no claims about search rankings.**"

> "Only Featured placement, at $39 a month, and you can cancel anytime. **Everything else is a one-time payment.**"

### 4.3 `/billboard` —— 全场最巧的商业化设计（截图 `shots/billboard.png`）

`Pay what you want, from $15` 的**竞价榜**，不是固定档位广告位：

- 顶部三个活数字：`$187 backed`、`18 spots`、`887 visitors`（截图另有 `10` 与绿点，对应 Top 10），右上黑按钮 `Claim a spot →`。
- 左侧 `Claim your spot` 卡：一个 URL 输入框 + 黑按钮；下面一行 **动态出价提示** `#1 is held at $27. Take it for $28` + `Aim for #1`；三枚小图标 `Permanent / One payment / Stripe secure`。
- 右侧榜单筛选 `Top spots / Under $50 / Under $20 / Just landed` + 刷新按钮；`TOP 10 also shown on the launchit.fast home page`；每条含排名、logo、名称、域名、一句话描述、金额徽章、`N clicks`，以及 **`Claim #N $<金额+1>` 按钮**（第 1 名 $27 → `Claim #1 $28`，第 2 名 $26 → `Claim #2 $27`……）。第 10 名之后是 `THE REST OF THE BOARD`，最低价统一 $5。
- `How it works` 用一个动画示意：**同站再次付款金额叠加**（`Your product $30 → +$35 → $65`），超过上方即可升位。文字三条规则：`01 Name your price (from $15, no account)` / `02 Live the second you pay (no queue, no review)` / `03 Pay again, climb (Amounts stack on the same website)`。
- `Latest activity` 实时流水：`Thelaunchdirectory backed their spot +$27 14d ago` …
- 收尾一句稀缺感：`The top spot is $28 away. One payment, no expiry. **It will never be cheaper to be first than it is right now.**`
- FAQ 再强调：`We sell visibility and traffic from the LaunchIt community, **not search rankings**, and we make no promises about SEO outcomes.`

接口侧：`POST /api/billboard/checkout` 空 body 返回 `{"error":"Amount must be between $15 and $5000."}` —— **服务端硬校验下限 $15、上限 $5000**。另有 `/api/billboard/track` 记点击（榜单上那些 `N clicks` 由此而来）。

**对照我方**：我方 `ad_booking` 是固定四档 + 周一起算的排期窗口 + 30 分钟未付款预留 + 冲突检测，价格由 `adPriceCents()` 服务端算（board 1w $29 / 4w $99、sidebar 1w $19 / 4w $65）。**我方更严谨（不会超卖），对方更会榨取付费意愿（竞价、可重复付款、无上限对冲）**。两条路线不是对错，是取舍。

### 4.4 `/submit` —— 免费档的「反链门槛」

`Launch once. Get seen for good.` → 选档卡（Boost / Premium / Free / Relaunch）→ `How it works: One launch. Three things you keep.` → 8 条 FAQ → **创始人亲笔信**（Brian Millot，法国独立开发者，2024 年起做，讲自己「每次发布都死在沉默里」）。

FAQ 明确免费档的代价：

> "The Basic Launch ... **requires a backlink to LaunchIt and display our badge on your website. Submissions without these will not be accepted.**"

> "Every listing links to your website with a standard dofollow link, **server-rendered in the page HTML so crawlers see it on the first pass. No rel=\"nofollow\", no redirects, no JavaScript tricks.**"

### 4.5 `/docs/backlink-verification` —— badge 反链的自动验证机制

免费档不是「人工看一眼」，而是有服务端爬虫 + 人工兜底：

- **查什么**：目标站首页 HTML 里任何指向 `launchit.fast` 的 `<a>`（含指向自己产品页的链接，锚文本无所谓）；或者识别出的 badge 图片（无 `<a>` 包裹的裸图也能识别，但推荐带链接）；读取 `rel` 判断是不是 `nofollow`。
- **三种容错**：JS 渲染的 footer 读不到 → `flagged for manual review, not rejected`；站点对爬虫返回 403/429 → `marks it unreachable and a human checks manually`，**绝不因为防火墙自动拒绝**；提交后才补反链也行，因为检查发生在审核阶段。
- **给用户的通过指南**：把 badge 放进站点 footer（保证出现在首页 HTML）、不要加 `rel="nofollow"`、纯 JS footer 就在 `/about` 或 `/links` 放一条纯 HTML 链接、不想挂链就买 Premium。
- Badge 三种 SVG：`launching.svg`（即将发布）/ `live.svg`（正在首页）/ `featured.svg`（已发布），从 `launchit.fast` 自己域下 serve，dashboard 生成带自己产品页 URL 的 embed code，提交后的 thank-you 页也直接给。

**这构成一个闭环**：免费用户给我方挂 dofollow 反链 → 我方域名权重上升 → 「DR 71 反链」这个卖点更值钱 → 更多人愿意付费。

另外两个「40」要分清楚，别混为一谈：
- 首页 `pageProps.footerBacklinks` 是 **40 条别家目录的 badge 嵌入代码**（twelve.tools / wired.business / easylaunch.dev / saasfame / fazier / turbo0 …），即**我方页脚给对方挂反链**；
- `/stats` 的 `40 Partner badges displayed / Sites showing our badge` 是**别的站挂了 LaunchIt 的 badge**。

两者数量恰好相同，很像同一批互换伙伴，但页面没有明示关联，这里只记录事实、不推断。

> ⚠️ 我方不要直接抄：我方 `dirtool.com` DR=0，「挂我方 badge 换 dofollow 反链」对用户没有价值；而且我方免费档目前是 nofollow，改链接政策属于业务决策，不在本轮建议范围内。

### 4.6 `/stats` —— 把数据库摊开当销售页

`Every stat on this page is pulled straight from the live directory, **not a slide deck**. If you are deciding whether to launch here, this is the honest picture.` 数字每 30 分钟自动刷新。

```
534 Products listed (718 submitted all time)   |  390,281 Listing views
1,655 Members (2,037 on the newsletter)        |  DR 71 Domain Rating (Verified by Ahrefs)

The directory: 534 Active listings / 73 Premium launches / Featured right now
               16 Categories / 454 Tags in use / 1,022 Clicks to founder sites
               458 Community votes / 22 Reviews written
SEO value:     40 Partner badges displayed / 534 Dofollow links live / DR 71 Link source authority
Content:       27 Free tools / 113 Glossary terms / 45 Blog articles / 10 How-to guides
               13 Alternatives pages / 16 Category hubs / 454 Tag hubs
Growth:        12 个月的 launches-per-month 柱状图；首页 groupedByMonth 的口径为
               Dec 25 50 / Jan 26 53 / Feb 17 / Mar 19 / Apr 9 / May 7 / Jun 7
               / Jul 14 / Aug 32 / Sep 174 / Oct 118 / Nov 34
```

> 注：`/stats` 柱状图里抓到的数字序列（50 53 17 19 14 32 174 118 34）与首页分组不完全对齐，两处口径有出入，此处以首页 `groupedByMonth` 为准，不再推断。

它还把「为什么要买」写成一句可点链接的因果：`Curious what a backlink from a DR 71 domain is worth? Read the backlinks guide or check any domain with our free DR checker` —— **数据页 → 指南页 → 免费工具 → 提交页**的内链闭环。

### 4.7 产品详情页 `/tools/<slug>` —— 全站最值得抄的一页

以 `/tools/sora-2-ai-co` 为例，页面分区顺序：

```
面包屑 Home / AI and Machine Learning / Sora 2 AI Co
标题 + by <maker> + No reviews yet + tagline + 日期 + 分类
Open Website / Upvote / Save for later / Share on X
数字条 Upvotes / Views / Comments / Saves
DR 模块：Domain Rating 12 /100 · Ahrefs + 解释 + "Click to check any domain free"
① About > Overview                        （长描述）
② LaunchIt data > "<X> on LaunchIt"        ← 自动生成的站内数据叙事
   "launched on March 11, 2026, in AI and Machine Learning. It ranks #1 of the
    2 products launched that day. Since launch it has collected 0 upvotes and
    893 page views." + 六个数字格（Launched / Rank that day / In category /
    Upvotes / Page views / Rating）
③ LaunchIt data > "<X>'s launch week"      ← 同周产品 30 天浏览量折线图
   "6 products launched between March 9 and March 15, 2026" +
   "in its first 30 days it drew 90 page views, the most of its launch week" +
   "Today #3 of 6 ... 893"
④ At a glance > "<X> in a Nutshell"        ← Who is it for / Problem / Solution /
                                              What makes it unique
⑤ In practice > Use Cases 01–06
⑥ Topics > Tags（8 个标签内链）
⑦ Alternatives > "<X> alternatives"        ← 自动摘要 + 7 行对比表
   （Product / Pricing / Rating / Upvotes / Launched）
⑧ Good to know > Frequently Asked Questions（11 问，配 FAQPage JSON-LD）
⑨ Behind the product > Meet the Maker      ←  maker 页内链
⑩ Instant answers > Ask AI about <X>       ← ChatGPT/Claude/Perplexity/Grok 深链
⑪ Community > Discussion（0/2000 输入框）
⑫ Reviews > Community Ratings / Write a Review
```

**关键点**：②③④⑦ 全部由站内数据库字段自动生成，且每一段都是「具体数字 + 具体对比对象」，不是「这是一个很棒的工具」这种模板空话。第 ② 段甚至把「当天只有 2 个产品、它排第 1」这种本来很寒酸的数据写成了正面的排名事实。

**我方对照**（线上实测 `https://dirtool.com/tools/bolt`）：可见标题只有 `Bolt` / `What is Bolt?` / `More in Developer Tools` + 3 个产品卡 + 页脚三栏，HTML 52 KB，JSON-LD 只有 `SoftwareApplication` + `BreadcrumbList`。我方详情页虽然也有「七分区」组件（见 Task #43），但**没有站内数据叙事、没有同周对比、没有自动生成 FAQ、没有该产品专属的 Ask AI 深链**。这是量级差距最大的一处。

### 4.8 其余页面的角色

| 页 | 作用 | 值得记的细节 |
|---|---|---|
| `/seo-tools`（31 Free Tools） | 免费工具获客矩阵 | 分 5 组：SEO Essentials / AI Visibility Trackers / Marketing Calculators / Branding & Naming / Social Media / Writing & Text Utilities。`Domain Rating Checker` 标 `Live Ahrefs data / No free rival`，`Bulk DR Checker` 上限 25 域名 + CSV 导出，`Website Comparison` 双站 18 项 on-page 检查 |
| `/directories`（216 个） | 免费数据 → 代提交服务 | 分页 8 页；筛选 `Highest DR / Lowest DR / A to Z`、DR 区间（70+ / 50-69 / 30-49 / <30）、niche（AI / SaaS / Dev tools / Design / Community / Deals / No-code）；105 个 DR≥50、均值 DR 47 |
| `/glossary`（103+ 词条） | 术语长尾 + 结构化数据 | 列表页塞了 **100 个 `DefinedTerm`** 在一个 `DefinedTermSet` 里 |
| `/alternatives/<x>` | 「X 的替代品」搜索意图 | 每页写明数据核对日期（如 `checked on 4 November 2026`），10 个 `SoftwareApplication` + 5 问 FAQ |
| `/compare/<a>-vs-<b>` | 自动对比 | `Quick verdict` 由票数 / 浏览量自动生成；含 `By the numbers` 对比表 |
| `/product-launch-checklist` | 39 步交互清单 | 进度存 localStorage（`Your progress saves in this browser`），`HowTo` + 39 `HowToStep` + 10 问 FAQ |
| `/startup-showdown` | 小游戏 | 5 轮猜「哪个产品票数更高」，数据来自真实目录，每个产品可点进详情页 |
| `/top` | 历史总榜 Top 100 | `No editors, no paid placement, just votes`；1 个 `ItemList` + 100 `ListItem` |
| `/contributors` | 投票贡献者榜 | 把「投票」这个行为本身做成荣誉榜 |
| `/community` | 极轻的 feed | 只有 3 条社区规则 + 登录才能发帖，`CollectionPage` |
| `/partners` | 6 个合作站 + `Become a Partner` | 与 40 条 footerBacklinks 配套 |
| `/mcp` | AI agent 接入说明页 | 见 §6.3 |

**发现的对方线上缺陷（不是我们的问题，仅作避坑参考）**：
- `/deals/prime-calendar-50-off-for-family` 返回 **500 Internal Server Error**，但首页 `pageProps.deals` 里仍在推这个 slug（首页第一条 deal 就是它）。
- `/glossary` 页写 `103+ terms`，`/stats` 写 `113 Glossary terms`，口径不一致。
- `/submission-service` 与 `/pricing` 的划线原价差 $50（见 §4.2）。

---

## 五、视觉呈现细节（三张真实截图）

- **配色**：整体米白 / 纯白底 + 近黑文字（`#0a0a0a` 级），主强调色是**橙黄**（Black Friday 渐变 `UP TO 50%`、Billboard 的 `$27` 徽章、hero 的 `FEATURED` 标签），辅助色是浅黄绿（Billboard 卡带）与浅灰蓝（筛选胶囊）。深色只用在 CTA 按钮、促销条、页脚、数据条 —— **深色面积很小，所以黑按钮非常抓眼**。
- **字号层级**：hero 是超大无衬线粗体（约 60–72px，`Launch today. / Get discovered.` 两行，句点用橙色），页面 H1 约 40px，卡片标题 15–16px，说明文字 13px（`text-[13px]` 在源码里直接可见）。
- **卡片**：细边框 + 大圆角（约 16px）+ 极轻阴影；促销/Featured 卡用暖色描边而非重色块区分。
- **CTA 规范**：主按钮一律黑底白字胶囊 + 右箭头（`Launch Now →` / `Claim your spot →` / `New Launch ↗`），次按钮白底黑字；价格永远紧跟 or 内嵌在卡上，不让用户跳走查价。
- **数字**：所有社会证明数字都用大号粗体 + 灰色小标签（`390,307` / `Listing views`），在首页左栏、pricing 数据条、stats 页反复出现同一套视觉语言。
- **浮层**：Cookie Consent 弹窗三张截图里都出现（`Customize / Reject All / Accept All`），左下角还有一个可关闭的 `50% Black Friday is live` 小浮标 —— 促销有至少 3 个触点（顶栏条、pricing 大卡、左下浮标），但 `sale.placements.home: false` 说明首页大卡被配置关掉了，只留顶栏条和浮标。

---

## 六、AI 时代基础设施（这块与我方 / productsfarm 差异最大）

### 6.1 有 / 没有

| 资产 | launchit.fast | dirtool.com（我方，P0 上线后） |
|---|---|---|
| `robots.txt` | 极简：`User-agent: *` / `Allow: /` / `Disallow: /cdn-cgi/` / `Host` / `Sitemap`，**不点名任何 AI 爬虫** | 16 行，`User-agent: *` + 15 个点名（OAI-SearchBot / ChatGPT-User / GPTBot / Claude-SearchBot / Claude-User / ClaudeBot / PerplexityBot / Perplexity-User / Google-Extended / Applebot / Applebot-Extended / CCBot / DuckAssistBot / Googlebot / Bingbot），并指向 `llms.txt` / `ai.txt` |
| `llms.txt` | 200，`text/plain`，3.6 KB：`# LaunchIt` + 一段品牌自述 + `## Key Pages` + `## Categories`（16 条）+ `## Full Catalog`（llms-full.txt / RSS / Sitemap）。**没有 `Cite this site for`** | 200，有 `## Cite this site for`（6 条可引用结论 + 锚点）、`Last updated: 2026-11-08`、`## Notes for summarisers`、完整 30 产品 / 8 分类 / 9 页面清单 |
| `llms-full.txt` | **200，64.8 KB**：`# LaunchIt - Full Product Catalog`，534 个产品按分类列全，每条 `- [Name](url): tagline` | ❌ 没有 |
| `ai.txt` | **404**，返回 83,846 B 的 Next.js 404 HTML | **200**，纯文本 6 段 `[identity] [permissions] [restrictions] [attribution] [scope]`，含 `quote: allowed, with attribution` |
| 逐页 `.md` | ❌ `/pricing.md` 404；`Accept: text/markdown` 仍返回 `text/html` 304 KB | ❌ 也没有（这是 productsfarm 的强项，不是 launchit 的） |
| `rss.xml` | ✅ 200，`<lastBuildDate>` 实时 | ❌ 没有 |
| MCP | ✅ 见下 | ❌ 没有 |
| Ask AI 深链 | ✅ 见下 | ❌ 没有 |
| hreflang | ❌ 0 条 | ✅ 600 条 `xhtml:link` |

**判断**：在「AI 抓取友好度」这一单项上，**我方 > launchit.fast > 纯靠 robots 的普通站**；但 launchit 用 `llms-full.txt` 把 534 个产品一次性喂给 AI，这一点我方缺。若照 productsfarm 的结论排，AI 基建完整度是 **productsfarm > 我方 > launchit.fast**（productsfarm 有逐页 `.md` + `ai.txt` + `Cite this site for`）。

### 6.2 结构化数据：把 FAQPage 当「每页标配」

抓取的 49 个页面里 **21 个带 FAQPage**，共 21 个 `Question` / 21 个 `Answer`（单页最多 11 问）。它不是「做一个 FAQ 页」，而是**每个模板都自动生成几条该页专属问答并打上 JSON-LD**：

| 页面 | JSON-LD |
|---|---|
| `glossary.html` | `FAQPage` + 4 Question + **`DefinedTermSet` + 100 `DefinedTerm`** |
| `tags.html` / `startups.html` / `top.html` | `ItemList` + **100 `ListItem`** |
| `product-launch-checklist.html` | `HowTo` + 5 `HowToSection` + **39 `HowToStep`** + 10 问 FAQ |
| `tools_*.html` | `SoftwareApplication` + `Offer` + `Person` + `BreadcrumbList` + 11 问 FAQ |
| `docs_*.html` | `TechArticle` + 2 `Organization` + `BreadcrumbList` |
| `seo-tools_*.html` | `WebApplication` + `Offer` + `HowTo` + `BreadcrumbList` + 8–10 问 FAQ |
| `alternatives_appsumo.html` | `WebPage` + 10 `SoftwareApplication` + 5 问 FAQ |
| `home.html` | `Organization` + `Person` + `WebSite`（**首页反而没有 FAQ**） |

类型覆盖（按含该类型的页面数）：`FAQPage 21 / Question 21 / Answer 21 / ListItem 20 / ItemList 12 / BreadcrumbList 9 / Organization 7 / Person 4 / Offer 4 / SoftwareApplication 3 / TechArticle 3 / HowTo 3 / WebApplication 3 / WebSite 2 / CollectionPage 2 / VideoObject 2 / WebPage 1 / DefinedTerm(Set) 1 / WebAPI 1 / Dataset 1`。

**我方线上抽查 12 页**：只有 `/`（FAQPage + 4 问）和 `/faq`（FAQPage + 20 问）有 FAQPage，`/tools/bolt` 有 `SoftwareApplication` + `BreadcrumbList`，其余 9 页（`/pricing` `/tools` `/weekly` `/rules` `/seo-check` `/categories` `/tags` `/submit` `/book-ad`）**没有任何 JSON-LD**。这是最低成本、最高确定性的一块可补项。

### 6.3 MCP Server：`/api/mcp`

- SSE JSON-RPC，`content-type: text/event-stream`，`access-control-allow-origin: *`，`access-control-expose-headers: mcp-session-id`，`cf-cache-status: DYNAMIC`，`x-do-app-origin` / `x-do-orig-status` 头说明它挂在 **Cloudflare Durable Object** 上。
- `initialize` 返回 `protocolVersion: 2024-11-05`、`serverInfo: {name:"launchit", version:"1.0.0"}`、`capabilities: {tools:{}}`。
- `tools/list` 实测 5 个只读工具（完整 inputSchema 已抓）：

| 工具 | 参数 | 返回 |
|---|---|---|
| `search_startups` | `query`, `category`, `tag`, `limit`(1–25，默认 10) | tagline、category、votes、link |
| `get_startup` | `slug`（必填） | description / problem / solution / audience / pricing / votes / rating |
| `list_categories` | 无 | 16 个分类 + 实时计数 |
| `compare_startups` | `slugA`, `slugB`（必填） | 双站详情 + 共同分类 / 共同标签 + 公开对比页链接 |
| `list_deals` | 无 | 有效折扣与优惠码 |

- `/mcp` 落地页：`New: MCP server / Plug LaunchIt into your AI agent.`、端点 `https://launchit.fast/api/mcp` 一键复制、四枚标签 `Free / No auth required / Read-only / Official`、5 种客户端配置（Claude.ai / Claude Code / Cursor / VS Code / REST）、4 个示例问句、收尾 CTA `Get listed — Be the product the agent recommends`。数据缓存 60 秒。
- **商业意图很直白**：让 AI agent 在回答「有哪些 AI 视频工具」时能引用自己的目录，等于给 534 个产品页开了一条新的分发渠道，并把它写成付费收录的新卖点。

### 6.4 Ask AI 深链：让模型替你讲品牌

页脚固定 `Ask AI about LaunchIt` + ChatGPT / Claude / Perplexity / Grok 四个图标；**每个产品详情页还有该产品专属的一组**；pricing 页也有 `ASK AI ABOUT LAUNCHIT PRICING`。解码后的 ChatGPT prompt 原文：

```
What is LaunchIt (launchit.fast) and how does it work?

LaunchIt is a launch platform and startup directory for makers and early-stage
startups. Explain how launching on LaunchIt works, what makers actually get
(a permanent listing page, community votes and reviews, homepage visibility),
how the free launch compares to the $24.99 Premium Launch, and who it is a
good fit for.

You can check https://launchit.fast and https://launchit.fast/llms.txt for
up-to-date details.

Keep it short and practical for an indie hacker deciding where to launch.
```

**技巧**：不是让用户自己去问，而是把「站方希望模型怎么说自己」预先写进 query，并明确要求模型去读自己的站和 `llms.txt` 拿最新数据。这是 AI 搜索时代的品牌自述分发。

> ⚠️ **需 owner 单独确认**：这类深链会把用户带到 `chatgpt.com` / `claude.ai` 等站外。它不属于 DR 查询，不触碰「用户查询 DR 不要跳出我们自己的站」这条铁律；但与 owner 偏好的「站内闭环」方向可能冲突，所以**不列入自动移植清单**，先单独请示。

### 6.5 DR 工具对照（我方是更新的版本）

| | launchit.fast | dirtool.com |
|---|---|---|
| 接口 | `POST /api/domainRating` → `{"domain":"example.com","rating":94,"cached":true}` | `POST /api/dr` → `{"ok":true,"domain":"example.com","provider":"ahrefs","metric":"DR","version":"dr4","value":93,"license":"http://ahrefs.com/legal/domain-rating-license"}` |
| 版本 | **94 = DR3**（Ahrefs 免费端点不传 `version` 时的默认值） | **93 = DR4**（显式 `version=dr4`） |
| 对照功能 | 无 | `compare:true` 返回 DR3 94 → DR4 93，Δ−1 |
| 工具矩阵 | 31 个免费工具（DR checker / Bulk DR 25 域名 / Website Comparison / 18 项 on-page audit / 各类生成器 / AI 提及追踪） | 只有 `/seo-check` 一个 |
| License 署名 | 抓取到的页面 HTML 与 37 个前端 chunk 中**均未出现** `Domain Rating by Ahrefs` 精确字样，也未出现 `ahrefs.com` 链接（只有 "Ahrefs DR"、"powered by live Ahrefs data" 等描述） | 结果旁固定 `Domain Rating by <a href="https://ahrefs.com/">Ahrefs</a>`（Ahrefs license 硬要求） |

**判断**：单点的 DR 数据我方更准、更合规；但对方把 DR 做成 31 个工具的获客矩阵，并让 `/directories`（216 个按 DR 排序）、`/stats`、`/pricing`、每个产品页的 DR 模块全部互链，形成「免费工具 → 数据 → 付费收录」的漏斗。我方 `/seo-check` 目前是一个孤岛。

---

## 七、接口清单与实测行为

JS bundle 里出现的全部 `/api/*` 路径（17 个），以及本轮只读实测结果：

| 接口 | 实测 |
|---|---|
| `/api/sale` | 200，返回 §2 那个 `sale` 对象 |
| `/api/launchQueue` | `{"waiting":180,"earliest":"2027-01-12"}` ← **「免费档约两个月」文案的数据源** |
| `/api/presence` | `{"count":10,"countries":{"NZ":1,"FR":2,"US":3,...},"recent":[{"country":"GB","path":"/launching-now","ago":3},...],"geo":true}` ← 实时社会证明（Billboard 顶栏 `887 visitors` 同源） |
| `/api/search?q=ai` | 200，直接返回产品对象数组（含 logo / tagLine / primaryTaskName / featured / tags）；响应里未见分页字段或总数上限 |
| `/api/domainRating` | `POST` → `{"domain":"example.com","rating":94,"cached":true}`；`GET` → `{"error":"Method not allowed"}` |
| `/api/billboard/checkout` | `POST {}` → `{"error":"Amount must be between $15 and $5000."}`（**只探了空 body，未发起任何支付**） |
| `/api/billboard/track` | 记录榜单点击（`N clicks`） |
| `/api/mcp` | SSE JSON-RPC，5 个只读工具 |
| `/api/og` | 动态 OG 图 |
| `/api/seo-tool` | 免费工具后端（DR / audit / compare） |
| `/api/ai-mentions` | 本轮 `GET ?engine=chatgpt` → `{"error":"Method not allowed"}`；早期另一组参数探测（`/tmp/lif/ai.out`）→ `{"error":"Unknown engine."}`。两次返回值不同，未进一步判定方法/参数白名单 |
| `/api/newsletterSubscribe` | 订阅 |
| `/api/track-click` | 出站点击统计（首页 `1,022 Website clicks`） |
| `/api/claimGift` / `/api/replyEmail` / `/api/reportClientError` | 礼品 / 邮件回复 / 前端错误上报 |
| `/api/webhooks/ai-directories` | 接收 AI 目录侧 webhook |

响应头要点：`x-powered-by: Next.js`、`server: cloudflare`、`cache-control: s-maxage=60, stale-while-revalidate=120`、`vary: Accept-Encoding`；`/api/mcp` 额外有 `access-control-allow-methods: GET, POST, OPTIONS` 与 `mcp-session-id` 暴露头，并下发 `__cf_bm` bot-management cookie。

---

## 八、商业化全景：三层漏斗 + 一条隐藏的第四层

```
[免费流量] 31 个 SEO 工具 / 216 个目录列表 / 103 术语 / 45 篇博客 / 12 替代品页
   │  （全部对内链到 /submit 或 /submission-service）
   ▼
Step 1  Launch      $0（须反链+badge） / $24.99 Premium / $49 Boost / $15 Relaunch
   ▼
Step 2  Get seen    $39/月 Featured / $29 Newsletter / $59 Review / $15 起 Billboard
   ▼
Step 3  Compound    $99 / $149 / $199 代提交 30 / 60 / 100+ 目录
   ▼
[第四层] 反向 SEO：40 个合作站挂我方 badge + 534 条 dofollow 外链 → DR 71 → 反哺 Step 1 卖点
```

**几条设计原则**（比具体价格更值得学）：

1. **几乎所有东西都是一次性**：11 个商品里只有 Featured 是订阅，FAQ 专门用一条问答强调这点。`No subscription, no auto-renewal`、`pay once, keep the visibility` 反复出现 —— 降低首次付费的心理门槛。
2. **免费档不是白送，是换反链**：用 `$0` 换一条 dofollow + 一次品牌曝光，还配了自动验证器与人工兜底。
3. **每段都能叠加**：`Everything on this page stacks, and nothing here expires on you`；导购区直接写「我下周要读者 → $20.30 赞助一期 + $41.30 一篇评测」这种组合。
4. **价格永远就近展示**：每个卡片自带价格、周期、`One-time payment · secure Stripe checkout`、履约时间（`Published in 2 to 3 days` / `Starts within one business day`）。用户不用跳页比价。
5. **合规切割干净**：卖 dofollow 反链的是「收录」，广告位一律写明 `we make no claims about search rankings`；评测写明 `Honest take, refunded if it is not ready`；退款政策分商品写清（未通过审核全退、上线后不退）。
6. **促销配置化**：`sale` 一个对象控制全站折后价、倒计时、投放位置、CTA，`/api/sale` 可实时读。

**我方对照**：我方是 Listing 四档（免费 / $19 / $39 / $69，服务端 `planAmountCents()`）+ 广告位四档（board 1w $29 / 4w $99、sidebar 1w $19 / 4w $65，服务端 `adPriceCents()`），全部走 Waffo Pancake 一次性支付 + webhook 自动履约。**我方在「金额服务端算、不读请求体」「订单幂等」「排期不超卖」「自动履约」上比对方严谨**；缺的是「一次性」这句话的营销表达、竞价/追加付费、可叠加套餐、配置化促销、透明数据页，以及「付款后多久上线」这类履约时间承诺。

> **2026-11-08 后续更新**：owner 已明确纠正「不应该是『人工确认收款』，付款成功自动收录发布」，并要求把 4.1 / 4.2 / 4.3 里值得立即抄的部分落地。该文案问题已修正，且首页 / `/pricing` / `/book-ad` 已按本报告 §4 做了第一轮移植，详见 **§12**。

---

## 九、我方逐项对照总表

### ✅ 我方已经有、甚至更强的

| 项 | 我方 |
|---|---|
| DR 数据版本 | DR4（93）+ DR3↔DR4 对照，显式 `version=dr4`；对方是默认 DR3（94） |
| Ahrefs license 署名 | 结果旁固定 `Domain Rating by Ahrefs` 且 `Ahrefs` 指向 `https://ahrefs.com/`；对方静态页与 bundle 未见 |
| AI 抓取入口 | robots 点名 15 个 AI/传统引擎 + `ai.txt` 200 + `llms.txt` 有 `Cite this site for`；对方 robots 只有 `*`、`ai.txt` 404、无 Cite 段 |
| 双语与 hreflang | 中英双语 + 600 条 `xhtml:link`（en / zh-Hans / x-default）；对方纯英文、0 条 |
| 支付严谨性 | 服务端算价、订单幂等、排期冲突检测、30 分钟预留、webhook 验签自动履约 |
| 站内闭环（DR 铁律） | DR 查询、结果、失败态全部留在 `/seo-check`，无外部 checker 链接 |
| 新页与内链 | P0 已上 `/rules` `/faq` + 页脚内链 + 首页广告位露价 + FAQPage 20 问 |
| 提交页 | 链接自动抓取（含方形 icon）、分类/邮箱必填、四档全展示、默认 $39 |

### ❌ 我方缺的（按「性价比 / 风险」排序）

| # | 缺口 | 说明 | 依赖 |
|---|---|---|---|
| 1 | 产品详情页的站内数据叙事 | 自动生成「上线日/当天排名/分类排名/同周对比/30 天浏览量/替代产品表」，534 产品页变长尾内容 | 只需已有数据字段 |
| 2 | 每页标配 FAQPage | 对方 21/49 页有；我方 12 页抽查只有 2 页有 | 纯模板 |
| 3 | 自动生成的产品对比页 `/compare/<a>-vs-<b>` | 同分类两两组合 + Quick verdict + 对比表 | 已有产品数据 |
| 4 | `/stats` 透明数据页 | 把 D1 数字摊开，配「每 30 分钟刷新」 | 只读查询 |
| 5 | 运行时稀缺感接口 | `/api/launchQueue` / `/api/presence` 这类活数字 | 轻量 |
| 6 | `llms-full.txt` | 把全部产品一次性喂给 AI | 静态生成 |
| 7 | `rss.xml` | 对方有，我方无 | 静态生成 |
| 8 | 月度归档页 `/weekly/<id>` | 我方 sitemap 注释里已留好扩展点（`void weeks`），当前只列当期 | 已有 `weeks` 数据 |
| 9 | 免费工具矩阵 | 我方只有 `/seo-check` 一个孤岛；对方 31 个且全部互链回变现页 | 工作量最大 |
| 10 | 术语 / 替代品 / how-to / 指南内容矩阵 | 对方 104 + 12 + 11 + 46 页 | 需真实内容 |
| 11 | MCP Server | 让 AI agent 直接查目录 | 新接口 |
| 12 | 竞价式广告位（可追加升位） | 对方 Billboard；我方是固定四档排期 | 业务决策 |
| 13 | 配置化全站促销 `sale` | 一次配置改全站价格 + 倒计时 + 投放位置 | 需与服务端算价联动，**风险高** |
| 14 | badge / 反链互换网络 | 对方免费档的核心对价 | **不建议抄**，见下 |
| 15 | Ask AI 深链 | 站外跳转 | **需 owner 单独确认** |

### ⚠️ 不建议抄 / 有风险的

1. **「DR 71 永久 dofollow 反链」整套话术** —— 我方 `dirtool.com` DR4=0 / DR3=0，抄了就是虚假宣传。`catalog.json` 的 `site.dr: 41` 是未验证旧值，`docs/06` 已写明不要引用、不要展示。
2. **免费档强制反链 + badge 验证** —— 反链价值建立在高 DR 上，我方不满足；且会改动免费/付费档的链接政策（当前免费 nofollow），属业务决策。
3. **Billboard 的「无审核、即时上线」** —— `Live instantly, no review step` 意味着任何站点付款即出现在首页。我方有 Waffo AUP / 合规文案约束，不宜取消审核。
4. **`/api/search` 返回数组但未见分页字段或总数上限** —— 若我方将来做同类搜索接口，要自带 limit 与限流（我方 `/api/dr` 已有每 IP 12 次/10 分钟），不要为了对齐而放松。
5. **`/api/presence` 暴露访客国家与最近访问路径** —— 社会证明有效，但隐私口径需评估，不建议直接照搬。
6. **促销系统直连价格** —— 我方金额铁律是「服务端算、不读请求体」，任何促销配置都必须只改服务端常量，不能让前端传折扣。若要做，得先定清楚这一层。
7. **对方的价格不一致 / deal 500 / 术语口径不一致** —— 见 §4.8，纯避坑。

---

## 十、移植清单（建议分三批，本轮不实施）

### P0 —— 纯加法、不动现有版式、不碰支付、不碰链接政策

1. **产品详情页「站内数据叙事」**：用已有 `created_at` / `voteCount` / `views` / `category` / 同周产品，生成 4 个只读区块（上线日与当日排名 / 分类排名 / 同周对比 / 替代产品表），中英双语。
2. **每页标配 FAQPage**：给 `/pricing` `/rules` `/weekly` `/tools` `/tags` `/categories` `/submit` `/book-ad` `/seo-check` 各加 4–8 条该页专属问答 + JSON-LD。
3. **`/stats` 透明数据页** + 进 sitemap + 页脚内链；数字只读 D1，标注刷新时间。
4. **`llms-full.txt` + `rss.xml`**：静态生成，分别列全量产品与最新收录。
5. **`/weekly/<id>` 月度/周度归档页**，把 `sitemap.xml.ts` 里预留的 `void weeks` 用起来。

### P1 —— 需要新数据字段或新页型

6. `/compare/<a>-vs-<b>` 自动对比页（先限定同分类、只生成有真实数据的组合）。
7. 月度归档页的自动结论段（「本月 N 个、最热分类、得票冠军」）。
8. 运行时稀缺感：一个只读接口返回当前排队量与最早可排日期（**只用于展示，不改变审核逻辑**）。
9. `/seo-check` 之外的 2–3 个轻量免费工具，并全部互链回 `/submit`、`/pricing`。

### P2 —— 需要内容积累或业务决策，先别动

10. 术语 / 替代品 / how-to / 指南内容矩阵（需要真实内容，不能 AI 灌水）。
11. MCP Server（5 个只读工具，可参考对方 schema）。
12. 竞价式广告位、可叠加套餐（要动 `ad_booking` 与履约逻辑）。
13. 配置化促销（必须先定「服务端算价 + 促销只改服务端常量」的边界）。
14. Ask AI 深链（**先请示 owner**：会跳出本站）。
15. badge / 反链互换网络（**不建议做**：依赖高 DR）。

---

## 十一、本轮交付边界与证据清单

**做了**：入口资产、1009 URL 解析、49 页 HTML + 可见文本、3 张真实浏览器截图、37 个 JS chunk 拆解、17 个公开只读接口实测（含 MCP `initialize` / `tools/list`、`/api/billboard/checkout` 空 body 校验）、结构化数据全量统计、与我方线上 12 页 / sitemap / robots / llms / DR 接口逐项对照、产出本文档。

**没做**：
- 没改任何仓库源码、没构建、没部署、没推 GitHub；
- 没发起任何支付、没写入对方任何数据（`/api/billboard/checkout` 只发空 body 看校验错误）；
- 没做 P0–P2 任何一项实现，等 owner 圈定范围；
- 没把 Ask AI 深链 / badge 反链 / 竞价广告位列进自动执行清单（都标了需单独决策）。

**证据位置**：

| 内容 | 路径 |
|---|---|
| 入口资产 | `/tmp/lif/{robots.txt,sitemap.xml,llms.txt,llms-full.txt,ai.txt,urls.txt}` |
| 页面 HTML / 文本 | `/tmp/lif/html/*.html`（49）、`/tmp/lif/md/*.txt`（49） |
| 截图 | `/tmp/lif/shots/{home.png,pricing.png,billboard.png}` |
| JS bundle | `/tmp/lif/js/`、`/tmp/lif/js2/` |
| 接口 / 响应头 | `/tmp/lif/{mcp-headers.txt,dr.json,q.json,st.out,ai.out,probe2.out}` |
| 我方对照数据 | `/tmp/lif/ours-sitemap.xml` + 线上 `dirtool.com` 实测 |
| 已有竞品研究 | `docs/09-productsfarm竞品拆解与移植方案.md` |
| 我方 DR 实测与旧值警告 | `docs/06-路线图与待办.md` §5.2 |

---

## 十二、后续一轮已落地：履约文案纠正 + 4.1/4.2/4.3 快速移植

> 本节记录的是**调研之后的另一轮改动**，不是第十一节所述的调研交付。详细交付说明见 `docs/11-自动履约文案与竞品快速移植交付说明.md`。

**① 事实纠正（owner 原话：「不应该是『人工确认收款』，付款成功自动收录发布」）**

付费 Listing / 广告位正常链路是 `Waffo webhook 验签 → settleOrder() → confirmPayment() / activateAdBooking() → 自动发布 / 自动排期`。已把首页、`/pricing`、`/book-ad`、`/rules`、`/faq`、法务页、邮件、AI 资产、后台提示、服务端错误文案全部统一；免费档「人工审核，7–14 天不保证」保留；后台「确认收款」降级为回调丢失时的手动兜底。

**② 从 4.2 `/pricing` 抄来的（做了）**

| 竞品做法 | 我方落地 |
|---|---|
| Step 1/2/3 三层漏斗 | `#pricing` / `#ads` / `#compound` 三步卡带，锚点同页跳转 |
| 中间活数字条 | `useAsyncData('pricing-live')` 读 `/api/tools` + `/api/ads/availability`，展示已收录产品数、分类数、可订周次、一次性付费档数 |
| 价格就近 + 一次性强调 | 原四档表保留，数字条下写明「一次性付费 / 不承诺排名」 |
| 场景导购 | 「不确定选哪个」三张卡 → `?plan=standard` / `?plan=featured` / `/book-ad?slot=sidebar` |
| 长期曝光区（Step 3） | `#compound` 三张卡 → `/weekly`、`/seo-check`、站内入口，明确「不再付费也持续生效」 |
| FAQPage 每页标配 | `/pricing` 的 FAQPage 从 `pricingFaq`（10 条）生成，与可见折叠问答同源 |

**③ 从 4.3 `/billboard` 抄来的（做了，不抄竞价）**

- `/pricing#ads` 与 `/book-ad` 都显示**实时可订周次**（同一 `/api/ads/availability`，数据不会互相打架）；
- `/book-ad` 加三条信任标（付款成功自动排期 / 一次性付款不自动续费 / 同一周不超卖）与**可见 FAQ + 同源 FAQPage**；
- 首页加「两个位置，明码标价」卡带：board $29 / sidebar $19、实时可订周次、直达 `/book-ad?slot=…`。

**④ 明确不抄**

竞价 / 金额叠加 / 同站重复付款升位（要动 `ad_booking` 与履约）、「无审核即时上线」放进 Listing 收录（我方 Listing 免费档仍需审核）、DR 71 反链话术（我方 DR4=0）、Ask AI 站外深链（撞「站内闭环」偏好）、配置化全站促销（要先定服务端算价边界）、badge 反链互换网络。

**⑤ 验证与上线**：本地接口 + SSR 回归 158/158、本地真实浏览器 64/64、typecheck 只余 3 条既有 blog 基线错误。**已于 2026-11-09 上线**（Version `8f0bea44-b63a-4428-911e-970855fd7520`）：线上冒烟 159/159、线上真实浏览器 64/64。**未推 GitHub**，等 owner 说「推」。详见 `docs/11` 第六节。
