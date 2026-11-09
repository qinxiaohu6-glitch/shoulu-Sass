# productsfarm.com 全站拆解与移植方案

> 调研时间：2026-11-08
> 对象：https://productsfarm.com/
> 我方：https://dirtool.com（Nuxt 4 + Cloudflare Workers + D1）
> 结论先行：**这个站真正厉害的不是页面设计，是"一个人能运营的 1443 页程序化 SEO 机器 + 三条独立收入线"。设计可以少抄，结构必须抄。**

---

## 一、站点全貌：1443 个 URL 的构成

从 `sitemap.xml` 实测（1443 条 `<url>`）：

| 路径 | 数量 | 作用 | 我方现状 |
| --- | --- | --- | --- |
| `/compare/<a>-vs-<b>` | **638** | 两个产品逐项对比 | ❌ 无 |
| `/product/<slug>` | 216 | 产品永久页 | ✅ `/tools/<slug>` |
| `/u/<handle>` | 180 | 创始人主页 | ✅ `/makers/<slug>` |
| `/directories/*` | 144 | 137 个目录 + 6 个筛选页 + 索引 | ❌ 无 |
| `/tags/<slug>` | 97 | 平台/形态标签页 | ✅ `/tags/<slug>` |
| `/tech-stack/<slug>` | 64 | "用什么技术做的" | ❌ 无 |
| `/c/<slug>` | 20 | 分类页 | ✅ `/categories/<slug>` |
| `/alternatives/<slug>` | 17 | "XX 的替代品" | ❌ 无 |
| `/tools/<slug>` | 13 | 免费小工具 | ⚠️ 只有 `/seo-check` 一个 |
| `/countries/<cc>` | 12 | 按创始人国家 | ❌ 无 |
| `/blog/<slug>` | 10 | 内容营销 | ✅ `/blog` |
| `/week/<yyyy>/<ww>` | 9 | 周榜存档 | ⚠️ `/weekly` 只有当期 |
| `/research/*` | 3 | 原创数据研究 | ❌ 无 |
| 其他单页 | ~20 | `/faq` `/rules` `/top` `/weeks` `/upcoming` `/submit-to-directories` `/directory-submission` 等 | ⚠️ 大部分无 |

**关键洞察：216 个产品，靠 6 种自动派生页型放大到 1443 页。**
即 `产品 × 产品 = 对比页`、`产品 × 标签 = 标签页`、`产品 × 技术栈 = 技术栈页`、`创始人 × 国家 = 国家页`。
数据录一次，页面自动长出 6.7 倍。

---

## 二、真正做得好的 14 个细节

### 【结构类】

#### 1. `/compare` 638 页 —— 最值得抄的一条

两个产品并排的固定表格：`是什么 / 定价 / 平台 / 分类 / 面向谁 / 技术栈 / 票数 / 官网`，下面各接一段完整介绍，最后 "Related"。

- 为什么有效：搜"X vs Y"的人是**购买决策中**的人，转化意图最强；且这类页面没有原创内容成本，全是已有字段重排。
- 我方可行性：**高**。`catalog.json` 已有 `name / short / long / url / category / tags / maker / votes`，做 8 行对比表够用。缺 `pricing`（free/freemium/paid）和 `platforms` 两个字段，补上即可。

#### 2. `/directories` 137 条带 DR3/DR4 的目录库

每条：`排名 | 名称 | 官网 | DR3 | DR4 | 免费还是付费 | dofollow/nofollow/unknown | 类型`。
每个目录还有**独立详情页** `/directories/sourceforge`：怎么提交（3 步）、DR、链接类型、6 个同类目录、4 条 FAQ。

- 为什么有效：这是"提交产品到目录"这个搜索意图的**终极答案页**，同时是付费服务的售前页。
- 我方可行性：**高，而且我们有天然优势** —— 我们已经有 Ahrefs 免费 DR4 接口（`/api/dr` 已上线）。他们 137 条 DR 是人工核对的，我们可以做成**自动刷新**的。

#### 3. `/alternatives/<tool>` 17 页

结构极其聪明：先讲"这个工具是什么"→"人们为什么找替代品"（列 4 条**具体缺点**，比如 Product Hunt "链接是 nofollow""2024 年起由团队挑选上首页"）→ 对比表 → 自家产品**排第一**但给的理由站得住 → FAQ → "Facts checked 2026-10-30"。

- 为什么有效：这是唯一一种"可以正大光明把自己排第一"的页面类型，且不显得自吹。
- 我方可行性：**高**。我们 30 个工具里有一批天然对标物（ChatGPT、Midjourney…），可做 `/alternatives/chatgpt` 等。

#### 4. `/rules` 排名规则页 —— 信任基建

开头一句：**"These rules come from the same settings the site runs on, so this page always matches what happens."**（这页的规则直接读站点运行时配置，所以永远和实际一致。）

然后逐条写死：周榜时间（周一 00:00 – 周日 23:59 UTC）、每周 25 个免费位 + 10 个付费位、投票权重表、隐藏票数规则、平票怎么破、dofollow 政策、拒收清单、"付费永不改变排名"。

- 为什么有效：**创作者最怕的是"榜单可以花钱买"**。把规则摊开、并声明"这页读的是运行时配置"，一次性消灭这个疑虑，比任何营销文案都强。
- 我方可行性：**极高，成本极低**。我们 `vote.post.ts` 已经有明确规则（每周一重置、一人一票），照实写成一页即可。

#### 5. `/faq` 按主题分组 + 每组答案都带内链

分 `Launching / Votes and ranking / Links / Directory submissions / Numbers from our data` 五组。每条答案 2–3 句，**末尾必带一条站内链接**（去 `/rules`、去 `/research`、去 `/submit`）。

- 为什么有效：FAQ 既是长尾词入口，又是内链枢纽，还是 AI 抓取时最爱引用的段落。
- 我方可行性：**极高**。纯内容页，零技术风险。

#### 6. `/research/*` 原创数据研究 + CC BY 4.0

两篇：《137 个产品目录统计》《216 个新产品的技术栈与定价统计》。
每篇结构：`Key findings`（5 条，每条带锚点链接）→ 分组表格 → **"How we counted"**（怎么数的，逐条写）→ FAQ → **"Cite this page"**（标准引用格式）→ 声明数据以 **CC BY 4.0** 开放。

- 为什么有效：这是**外链磁铁**。别的博主引用数据必须给链接，CC BY 4.0 让"引用"变成被鼓励的行为。同时 `llms.txt` 里专门有一节 `## Cite this site for`，把可引用结论直接喂给 AI。
- 我方可行性：**中**。需要真实数据。但我们的 `catalog.json` 就是数据集——30 个工具的定价、分类、技术栈，本身就能出一篇《AI 工具目录统计》。

#### 7. `/top` `/weeks` `/upcoming` `/week/<yyyy>/<ww>` 四层榜单归档

- `/` 本周榜（含倒计时"Voting closes in 1h 27m"）
- `/week/2026/45` 历史每周榜（9 个）
- `/weeks` 所有周的索引（含每周冠军）
- `/top` 历史总榜 100
- `/upcoming` 未来 21 周已预约的发布（29 KB，说明预约量很大）

- 为什么有效：每周自动产生 1 个新 URL + 1 次内容更新，Google 看到的是"这个站一直在动"。`/upcoming` 还把"下周有什么"变成可搜内容。
- 我方可行性：**高**。我们已有 `/weekly` 和 `week_archive` 表 + 周一 cron，只是没把历史周暴露成独立 URL。

---

### 【商业化类】

#### 8. 三条独立收入线，互不干扰

| 收入线 | 价格 | 性质 | 我方对应 |
| --- | --- | --- | --- |
| **Premium 收录** | **$5 一次性**（限时价，平时 $10） | 高亮 + 永久 dofollow | ✅ 已有 $19/$39/$69 三档 |
| **Sponsor 广告位** | **$20/周** 或 **$80/4 周**，无需账号 | 榜单旁 + 产品页 | ✅ 已有 board $29/$99、sidebar $19/$65 |
| **代提交目录服务** | **$49/30 家 · $99/60 家 · $199/100 家 · $500/350+ 家** | 纯人工服务 | ❌ **完全没有** |

**最关键的一条：代提交服务。** 这是唯一一条"卖时间而不是卖页面"的收入，客单价 $49–$500，是 Premium 的 10–100 倍，而且**不需要用户先发布产品**（"No launch needed"）。

它的售前逻辑完美闭环：`/research` 用数据证明"91% 免费、37% 给 dofollow、中位 DR 66" → `/directories` 给出 137 条可核对清单 → `/directory-submission` 教你自己做（还老实告诉你"每个约 30 分钟，350 家要 175 小时"）→ `/submit-to-directories` 卖"我们替你做，3–10 天"。

**它甚至给了一张"自己做 vs 我们做"的对照表**，把"你的时间成本"明码标价。这是把免费内容变成付费服务的最干净手法。

#### 9. $5 定价的"创始月"心理

`$5 一次性（限时价，通常 $10）` + 首页微文案 "Launch in our founding month and keep a Founding badge for good."

- 用低价换早期供给（没产品就没内容）
- "限时价"制造行动理由
- "Founding badge 永久保留"给早期用户身份感
- **对比我方 $19 起** —— 我们定价是他们的 4 倍。不是说要降，但要意识到：他们靠**极低价冲量**把目录填满，再用填满的目录卖 $49–$500 的服务。这是两种完全不同的模型。

#### 10. 广告位就在榜单侧栏，价格直接写在卡上

首页右侧两个 `Sponsor this spot` 卡片，**$20/week 明码标价 + "Book this spot" 链接，无需登录**。

- 为什么有效：广告位不藏在 `/advertise` 页面里，而是出现在流量最集中的位置，且价格透明到不需要询价。
- 我方现状：已有 `/book-ad` 和 sidebar 广告位，但**首页侧栏没露出价格**。这是低成本可补的一环。

---

### 【AI 时代基础设施类】（这块最该抄）

#### 11. 每个页面都有 `.md` 版本 + `Accept: text/markdown` 内容协商

实测：

```bash
curl -H 'Accept: text/markdown' https://productsfarm.com/tools/dr-checker
# → 直接返回 markdown 正文，不是 HTML
curl https://productsfarm.com/directories/sourceforge.md
# → 同样内容，纯 markdown
```

`robots.txt` 第一行就写着：

```
# Every public page also has a markdown version: add .md to its address.
```

还有 `/api/md/_catalog` 列出所有页面的 markdown 版本。

- 为什么有效：AI 爬虫抓 HTML 要清洗，抓 markdown 直接吃。**同样的内容，喂给 AI 的成本低一个数量级，被引用的概率就高一个数量级。**
- 我方现状：**有 `llms.txt`，但没有逐页 `.md`**。这是最大的技术缺口。

#### 12. `robots.txt` 显式点名 15 个 AI 爬虫

```
User-agent: * / Googlebot / Bingbot
User-agent: OAI-SearchBot / ChatGPT-User / GPTBot
User-agent: Claude-SearchBot / Claude-User / ClaudeBot
User-agent: PerplexityBot / Perplexity-User
User-agent: Google-Extended / Applebot / Applebot-Extended / CCBot / DuckAssistBot
Allow: /
```

单独 `Disallow: /` 掉 Bytespider。并且 `Allow: /api/og-image`、`/api/badge/`（让分享图和徽章能被抓）。

- 我方现状：`robots.txt` 只有 `User-agent: *`，**没有点名任何 AI 爬虫，也没提 `llms.txt`**。这是 10 行代码的事。

#### 13. `ai.txt` + `llms.txt` 的 `## Cite this site for` 段落

`ai.txt` 用 `ai-txt v1.1.1` 格式，明确写：

```
[permissions]
summarise: allowed
quote: allowed, with attribution
cite: allowed
train: allowed, on public pages only

[restrictions]
- Don't make up quotes, reviews, ratings, vote counts or ranks for any product.
- Don't present this site's content, research numbers or rankings as your own.

[attribution]
format: <page title>, ProductsFarm, <canonical page URL>
```

而 `llms.txt` 里有一节 **`## Cite this site for`**，把 5 条可引用结论连锚点一起列出来：

> 137 个目录中 91% 免费、37% 给 dofollow、中位 DR 66 …([finding](...#free-to-list))

- 为什么有效：不是"请引用我"，而是**把可以直接抄的句子准备好**，AI 引用时不用改写，自然带上链接。
- 我方现状：`llms.txt` 质量不错（有 `Notes for summarisers`），但**没有 `## Cite this site for`，没有 `ai.txt`**。

#### 14. 结构化数据 + 许可证署名

产品页 JSON-LD 实测：

```json
{ "@type": "SoftwareApplication", "name": "posthell",
  "applicationCategory": "Marketing", "operatingSystem": "API, Web, CLI",
  "sameAs": ["官网","GitHub","X"], "author": [{"@type":"Person","name":"Rohan","url":".../u/rohangotwal"}],
  "datePublished": "2026-10-30T08:07:49Z" }
```

DR 数据旁一律标 `Domain Rating by Ahrefs`（Ahrefs license 硬要求）。研究数据标 CC BY 4.0。

- 我方现状：`/tools/[slug]` 已有 JSON-LD，方向一致，可对照补齐 `sameAs` / `author`。

---

## 三、我方对照：已有 vs 缺失

### ✅ 已经有的（不用抄）

| 能力 | 我方 | 竞品 |
| --- | --- | --- |
| 首页粘贴网址直接提交 | ✅ `mk-url` 表单 | ✅ |
| 产品永久页 | ✅ `/tools/<slug>` | ✅ |
| 分类 / 标签 / 合集 | ✅ 三类齐全 | ⚠️ 只有分类+标签 |
| 创始人主页 | ✅ `/makers/<slug>` | ✅ `/u/<slug>` |
| 周榜 | ✅ `/weekly` | ✅ |
| 定价三档 + 支付 | ✅ Waffo 已上线 | ✅ |
| 广告位自助购买 | ✅ `/book-ad` + `ad_booking` | ✅ 但更简单 |
| DR 查询（DR4） | ✅ `/seo-check` 免费 DR4 + DR3 对照 | ✅ `/tools/dr-checker` |
| 博客 | ✅ `/blog` | ✅ |
| sitemap / llms.txt | ✅ | ✅ |
| 双语 | ✅ 中英 | ❌ 仅英文 |

**我方在双语、合集（collections）、DR3↔DR4 对照这三点上其实领先。**

### ❌ 缺的（按价值排序）

1. **`/compare` 对比页** —— 0 → 可生成上百页，最高性价比
2. **`/directories` 目录库 + `/submit-to-directories` 代提交服务** —— 唯一的高客单价收入线
3. **逐页 `.md` 版本 + `Accept: text/markdown`** —— AI 抓取的基础设施
4. **`robots.txt` 点名 AI 爬虫 + `ai.txt`**
5. **`llms.txt` 的 `## Cite this site for` 段**
6. **`/rules` 排名规则页** —— 信任基建，成本极低
7. **`/faq`** —— 长尾词 + 内链枢纽
8. **`/research` 原创数据** —— 外链磁铁
9. **`/alternatives/<tool>`** —— 可正大光明自荐
10. **周榜历史独立 URL** `/week/<yyyy>/<ww>` + `/weeks` + `/top`
11. **`/tech-stack/<slug>`** —— 需补数据字段
12. **首页侧栏广告位露出价格**

---

## 四、不建议抄的

| 他们的做法 | 为什么不抄 |
| --- | --- |
| **投票权重按账号年龄**（0 / 0.5 / 1） | 我们用户量还小，加权重会让早期真实票变成 0，等于自断增长。等有刷票问题再上。 |
| **前 24 小时隐藏票数 + 打乱顺序** | 同上。这是防"首小时雪崩"的机制，我们现在的量级不需要，反而降低即时反馈感。 |
| **必须先打开产品官网才能投票** | 会显著降低投票转化率。他们靠这个给客户导流，代价是投票门槛。我们现阶段要票。 |
| **$5 低价策略** | 会把我们的付费档位打崩。他们的 $5 是"创始月冲量"，且靠 $49–$500 服务赚钱；我们的 $19/$39/$69 是主收入。 |
| **`/tech-stack` 64 页** | 需要抓取每个产品官网技术栈，成本高、准确率低、且和我们的"AI 工具目录"定位弱相关。优先级放最低。 |
| **`/countries` 12 页** | 数据量太少（我们 30 个工具），页面会太空，反而稀释质量分。等工具数到 200+ 再说。 |
| **`/compare` 一次生成 638 页** | 别一次全上。先按"同分类 + 都有票数"筛出 50–100 对，验证收录和流量后再放量。 |

---

## 五、移植清单（建议分三批）

### P0 —— 一周内可上线，纯加法，不动现有版式

| # | 事项 | 产出 | 工作量 | 风险 |
| --- | --- | --- | --- | --- |
| 1 | `robots.txt` 点名 15 个 AI 爬虫 + 指向 `llms.txt` | 改 1 个文件 | 10 分钟 | 无 |
| 2 | 新增 `/ai.txt` | 1 个路由 | 30 分钟 | 无 |
| 3 | `llms.txt` 补 `## Cite this site for` + `Last updated` | 改 1 个文件 | 30 分钟 | 无 |
| 4 | 新增 `/rules` 排名规则页（中英） | 1 个页面 | 2 小时 | 无 |
| 5 | 新增 `/faq` 分组 FAQ（中英） | 1 个页面 | 3 小时 | 无 |
| 6 | 首页侧栏广告位露出价格 + 直达 `/book-ad` | 改组件 | 1 小时 | 低 |

> 这 6 项全部是"加内容/加路由"，不碰现有页面布局，符合"除首页外按源码版式"的约束。

### P1 —— 两周内，需要新数据字段

| # | 事项 | 前置 | 工作量 |
| --- | --- | --- | --- |
| 7 | `/compare/<a>-vs-<b>`，先 50–100 对 | 给 `catalog.json` 补 `pricing`（free/freemium/paid）+ `platforms` 字段 | 2 天 |
| 8 | 周榜历史 `/week/<yyyy>/<ww>` + `/weeks` + `/top` | 读现有 `week_archive` 表 | 1.5 天 |
| 9 | `/alternatives/<slug>`，先 5–8 个 | 复用 compare 的数据层 | 2 天 |
| 10 | 逐页 `.md` 版本（`/tools/x.md`、`/compare/x-vs-y.md`…）+ `Accept: text/markdown` 协商 | 需一套 markdown 渲染器（从现有数据生成，不走 HTML 转） | 3 天 |

### P2 —— 一个月，需要真实数据积累

| # | 事项 | 前置 |
| --- | --- | --- |
| 11 | `/research` 原创数据研究（《AI 工具目录统计》）+ CC BY 4.0 + Cite 区块 | 需要真实统计脚本，数据来自 `catalog.json` + `tool` 表 |
| 12 | `/directories` 目录库（先 60–80 条，DR 用 `/api/dr` 自动取）+ 每条独立详情页 | 需要人工整理目录清单（名称/官网/提交地址/价格/链接类型） |
| 13 | `/submit-to-directories` 代提交服务 + 4 档定价 + 订单/履约流程 | 依赖 #12，且需要**人工履约能力**（这是运营问题，不是技术问题） |

---

## 六、一句话总结

**他们的护城河不是设计，是"数据录一次、页面自动长 6.7 倍"的结构，加上"免费内容 → 数据研究 → 付费服务"的漏斗。**

我方最短路径：
1. **本周**把 AI 抓取基础设施补齐（`robots.txt` / `ai.txt` / `llms.txt` / `/rules` / `/faq`）——几乎零成本，立刻生效；
2. **下周**用现有数据长出 `/compare` 和 `/alternatives`——这是最大的一块未被利用的 SEO 面积；
3. **再往后**才考虑 `/directories` + 代提交服务——那是收入结构的升级，需要人工履约，得单独决策。

---

## 七、P0 落地记录（2026-11-08）

owner 选定「只做 P0 六项」，以下六项**已全部写完、本地测试通过，并于 2026-11-08 部署上线**（Worker `product-atlas` Version `45f36e68-429c-4cbc-b093-012fe18b6e1c`）。上线前的本地测试过程保留在下文，线上验证结果见第八节。

| # | 事项 | 落地文件 | 状态 |
| --- | --- | --- | --- |
| 1 | `robots.txt` 点名 AI 爬虫 + 指向 `llms.txt` / `ai.txt` | `server/routes/robots.txt.ts` | ✅ |
| 2 | 新增 `/ai.txt` | `server/routes/ai.txt.ts` | ✅ |
| 3 | `llms.txt` 补 `## Cite this site for` + `Last updated` | `server/routes/llms.txt.ts` | ✅ |
| 4 | 新增 `/rules`（中英） | `app/pages/rules.vue` | ✅ |
| 5 | 新增 `/faq`（中英，5 组 20 问） | `app/pages/faq.vue` | ✅ |
| 6 | 首页侧栏广告位露出价格 + 直达 `/book-ad` | `app/pages/index.vue`、`app/assets/css/legacy.css` | ✅ |

### 本地测试结果

- 回归探针 `/tmp/p0-probe.sh`：**87 PASS / 0 FAIL**。覆盖 robots 16 个 agent 行、`ai.txt` 六个段与 `content-type`、`llms.txt` Cite 段、`/rules` 与 `/faq` 中英 SSR 文案、FAQPage 结构化数据 20 条、sitemap 四个新 URL、首页侧栏卡片与页脚内链、12 个既有页面全部 200。
- `npx nuxi typecheck`：仍只有 3 条既有 blog 基线错误（`app/pages/blog/index.vue`、`shared/content/blog.ts` ×2），**本轮零新增**。
- 真实浏览器截图（headless Chrome）：首页侧栏卡片、`/rules`、`/faq` 三张，版式正常，无遮挡/裁切。
  - 过程中发现并修掉一个自己引入的 bug：新卡片里的 `<Icon>` 没给 `size`，而本站所有图标尺寸都由父级 CSS 提供，导致 SVG 回落成浏览器默认 300×150，撑爆 CTA 按钮。已加 `:size="14"` 与 `.rail-for-rent__cta svg` 规则。

### ⚠️ 这是我主动补的、超出原确认范围

owner 确认的是「P0 六项」。以下四项是我为了让新页面真正可用/可查而顺手做的，**不在字面清单里**，请一并审阅：

1. **`/faq` 的 `FAQPage` JSON-LD**（20 条问答结构化数据）——竞品 FAQ 页有，属于搜索富摘要；新增 1 个 `useSeo` 调用，不影响可见版式。
2. **`/rules`、`/faq` 进 sitemap**（中英共 4 个 URL）——不进 sitemap 等于没有入口。
3. **两个新页面接进页脚导航**——否则站内没有任何内链指向它们。
4. **`robots.txt` 显式点名 `Googlebot` / `Bingbot`**——核对竞品原文时发现第一版只抄了 13 个 AI 爬虫，漏了这两个（竞品 Allow 组共 15 个）。补齐后 agent 行共 16 行（含 `*`）。

### 明确没做 / 主动不抄

- **不屏蔽 `Bytespider`**：竞品 robots 单独给它 `Disallow: /`。本轮目标是最大化 AI 可见性，屏蔽一个会读站的 AI 爬虫与目标相反，故不跟。
- **逐页 `.md` 版本、`/compare`、`/directories`、代提交服务**：分别是 P1 / P2，本轮按约定不做。
- **没有改任何现有页面的版式**：除了首页右栏新增的那张招租卡（第 6 项本身），其余全是新路由、纯文本资产和站点级配置。
- **上线前没有提前部署**：按既定纪律，本地测完先汇报，拿到 owner「上线」后才在会话内直接执行部署；上线记录见第八节。

### 一处已发现、当时未改的既有文案问题（**已于 2026-11-08 解决**）

`shared/content/pricing.ts`、`/pricing`、首页付费卡、以及本次 `/rules`、`/faq` 当时都写着「付款确认后当天上线（**人工确认收款**）」，但生产实际是 Waffo webhook 自动验签并履约，付款成功后即时上线，不需要人工确认。本轮因为横跨多个页面且属于定价承诺，按约定等 owner 单独决策，没有擅自改。

**owner 后来明确纠正：「不应该是『人工确认收款』，付款成功自动收录发布。」** 已在后续一轮把全站付费档 / 广告位的承诺统一为「付款成功后自动收录发布」，免费档仍保留人工审核表述；后台「确认收款」降级为异常兜底。详见 `docs/11-自动履约文案与竞品快速移植交付说明.md`。

---

## 八、上线记录（2026-11-08）

owner 回复「上线」后，由 AI 在会话内直接执行 `npm run deploy`（不再给终端手册、不再让 owner 手动跑），未做任何人工干预。

| 项目 | 结果 |
| --- | --- |
| 命令 | `env -u NODE_OPTIONS -u SANDBOX_CENTER_IPC_ADDRESS -u CODEBUDDY_SANDBOX_BROKER_READ_TIMEOUT_MS npm run deploy`（日志 `/tmp/p0-deploy.log`） |
| EXIT | 0 |
| Worker | `product-atlas` |
| **Version ID** | **`45f36e68-429c-4cbc-b093-012fe18b6e1c`** |
| 静态资源 | 249 个文件，新上传 9 个（231 个命中缓存），2.76 sec |
| Worker Startup | 33 ms |
| Bindings | `env.DB (product-atlas)`、`env.ASSETS` |
| 部署前处理 | 先 `kill` 掉本地 dev（3108 端口），避免与构建抢 `.nuxt` / `.output` |

### 线上冒烟：`/tmp/p0-online-verify.sh` → **94 PASS / 0 FAIL**

在本地 87 条断言基础上把 BASE 换成 `https://dirtool.com`、去掉 `--noproxy`（线上走系统代理）、每个请求加 `Cache-Control: no-cache` 防 CDN 缓存，并追加 7 条生产专属断言：

- **AI 抓取基建**：`robots.txt` 16 个 agent 行、`ai.txt` 六段 + `text/plain`、`llms.txt` Cite 段 + `text/markdown`，全部线上生效；两个文本资产都没有把 `127.0.0.1` 带上去。
- **新页面**：`/rules`、`/zh/rules`、`/faq`、`/zh/faq` 全部 200；中英关键文案、FAQPage JSON-LD 20 条 Question、sitemap 四个新 URL、页脚内链全部命中。
- **首页招租卡**：线上 HTML 含 `rail-for-rent`、`$19`、`/book-ad?slot=sidebar`、中英招租文案；**线上 CSS 产物**里 `.rail-for-rent__cta svg` 与 `width:14px` 均已上传（即本地修的图标撑爆问题在正式构建里也修好了）。
- **既有功能未受影响**：`/`、`/tools`、`/pricing`、`/submit`、`/book-ad`、`/seo-check`、`/categories`、`/weekly`、`/just-added`、`/collections`、`/makers`、`/blog` 全 200；`/api/payments/config` 仍 `ready:true`；`POST /api/dr`（`example.com`）仍返回 DR4 **93**，支付与 DR4 两条既有生产链路都没被这次部署打断。

### 本轮未做

- **未推送 GitHub**：`shoulu-Sass` 的同步仍按流程等 owner 说「推」。
- **未做线上浏览器截图**：本地已实拍首页 / `/rules` / `/faq` 三张且版式正常，线上 CSS 规则也已断言上传；生产环境的 headless Chrome 截图在本机代理下不稳定，不在关键路径上，故跳过。
- **P1 / P2 未动**：逐页 `.md`、`/compare`、`/directories`、代提交服务仍按约定留待后续决策。
- **「人工确认收款」文案当时未改**：见第七节末。**注**：该条在 2026-11-08 的后续一轮已按 owner 决策统一修正，见 `docs/11`。
