# 16 · 与 ProductsBoost 六维对比与优化清单

对照对象：`https://productsboost.com`（首页 / pricing / alternatives / sponsor）
本站：`https://dirtool.com`（Product Atlas）
取数时间：2026-11-18，桌面 1440 宽全页截图 + 生产 HTML 元信息 + JSON-LD 解析

---

## 一、先回答最初那个问题

首页统计条原先的大数字是「本周获票 / THIS WEEK'S VOTES」，取值来自 `week_votes`。
已改为「本周新收录 / NEW THIS WEEK」，取值改为 `launch_weeks[].listed`，按 `listedAt`
归属 ISO 周计数，趋势线取前 5 周。竞品同一位置的标签是
`29 Products launched selected week` —— 口径一致，说明改对了。

本地实测（无数据周）：`本周新收录 0 / 收录上线的产品`、`NEW THIS WEEK 0 / products listed`。
`/api/stats` 新增 `launch_weeks`，`week_votes` 不再被这个数字使用。

---

## 二、六维差异

### 1. 对外宣传（价值主张）

| | 竞品 | 本站 | 判定 |
|---|---|---|---|
| H1 | 无 H1，直接进榜单（`ProductsBoost` 只做 logo） | `List your product. Get found, not buried.` | 本站更强 |
| 副标题 | — | `A permanent product page with a dofollow link — indexed by search engines and readable by AI.` | 本站更强，且是差异化卖点 |
| 首屏转化 | `Submit launch` 按钮 | 域名输入框 + `List it free` | 本站更强（零摩擦） |
| 信任信号 | `No subscription` / `Secure checkout by Creem` / `Applied in seconds` | `No subscription` / `Secure checkout` / `Applied in seconds` | 持平 |

结论：宣传层本站不弱，**不需要向竞品对齐**。唯一可借的是竞品标题里堆关键词的写法
（`launch your product, get upvotes, traffic and a backlink`），本站首页标题已含
`List your product, get found`，可接受。

### 2. 布局

| 位置 | 竞品 | 本站 |
|---|---|---|
| 左侧导航 | 固定栏：Launch weeks / Hall of fame / Search / Alternatives / Pricing / Advertise / Submit launch / My launches | 无固定栏（首页），`/pricing` 有 pb-rail |
| 周切换条 | 顶部：`‹ Week 47 ●Live 4d 14h left ›` + 横向周号 42–53 | 有周号 45–53，**无剩余时间** |
| 首屏主体 | 直接是榜单 Top 3 行 | 先一整条 Billboard（10 格，5 格是空位） |
| 榜单行内广告 | 第 3 名后插一张 `Your ad here · SPONSORED` | 无行内广告位 |
| 右栏 | 广告 + Last week's top 3 | 广告 + Last week's top 3（一致） |
| 悬浮转化卡 | 左下角常驻 `Boost · $4.99` + 倒计时 | 侧栏 `BOOST YOUR LAUNCH $4.99`（一致） |

**主要差距：首屏被空 Billboard 吃掉。** 竞品首屏是三条真实产品；本站首屏是
`TOP 10 ON THE BILLBOARD` 里 5 个 `Open / Claim from $10` 的空格子，高度约 370px。
这是「布局」维度唯一明显落后的一项。

### 3. UI / 设计

| | 竞品 | 本站 |
|---|---|---|
| 配色 | 白底 + 黄（Boost）+ 黑按钮 | 同 |
| 榜单行 | 左侧大号排名 + 皇冠（前三）+ logo 56px | 同 |
| 排名样式 | 前三有皇冠/金框 | 同（`pb-row__crown`） |
| 空位 | 不展示空位 | 展示 10 格，含 5 个空位 |
| 字体层级 | H1 34px / H2 24px | 一致 |

结论：设计语言已经同源，**问题不在 UI 风格，在空位的呈现方式**。

### 4. 文案

| | 竞品 | 本站 |
|---|---|---|
| 定价页 H1 | `Launch free. Boost for $4.99.` | 同（已对齐） |
| 定价页副标 | `One-time payments. Ads are booked per week. Nothing renews.` | 同 |
| Free vs Boost 表 | 9 行 | 同 9 行 |
| FAQ | 6 条 | 7 条（多一条退款） |
| 徽章 | `Most popular`（Boost） | 同，且 Featured 改 `Widest reach` 避免与 Boost 撞 |
| 产品名 | 截断到约 60 字符加省略号 | 按分隔符取产品名（见下） |

**产品名问题（用户指出的第二条）**：原逻辑只剥 `Team/Support` 后缀，线上仍在显示
`MielaChat - Meet Verified Latinas on Live Map | Private 1v1` 这种整句标题。
已重写为「分段打分」：按 `| — – · :: - :` 切段，含停用词 / ≥4 词 / ≥24 字符的段判为标语，
取第一个非标语段。

关键改进是**反向情况**：产品名不一定在第一段。
`Free Anonymous Video Chat with Strangers | OmeWisp` → `OmeWisp`（旧逻辑会整串截断）。
`Notion – AI`、`Claude 3.5: Sonnet` 两段都不是标语 → 原样保留，不误伤。

### 5. SEO

这是**差距最大的一维**，且是可以直接补的。

| 项 | 竞品 | 本站（改造前） | 本站（改造后） |
|---|---|---|---|
| 首页 `ItemList`（30 条发布） | ✅ | ❌ | ✅ |
| `/weekly` `ItemList` | ✅ | ❌ | ✅ |
| `/alternatives` `FAQPage` | ✅ | ❌ | ✅ |
| `/alternatives` `BreadcrumbList` | ✅ | ❌ | ✅ |
| `/alternatives/<平台>` 子页 | **8 个** | **0 个** | **8 个** |
| 子页 `FAQPage` + `BreadcrumbList` | ✅ | — | ✅ |
| 子页进 sitemap | ✅ | — | ✅ |
| 定价页 meta description | 138 字符，含全部价格 | **59 字符，无价格** | 138 字符，含全部价格 |
| 首页标题长度 | 74 字符 | 54 字符 | 保持 |

竞品 8 个子页：`product-hunt` / `betalist` / `devhunt` / `uneed` / `peerlist` /
`fazier` / `microlaunch` / `hacker-news`，每条吃一个「X alternative」长尾词。

**另外发现一个流量漏斗问题**：本站 `/alternatives` 底部「更多发布平台」8 张卡片
原本是 `target="_blank"` 外链，直接把访客送去竞品官网。已改为指向自家 8 个子页。
子页里保留一个 `Official site ↗`（`rel="noopener nofollow"`），用于必要的出处标注。

### 6. 内容资产

| | 竞品 | 本站 |
|---|---|---|
| 多站点发布计划（4 步） | ✅ | ✅ |
| 平台对比表（节奏 / 适合） | ✅ | ✅ |
| 「Where each option shows」标注截图 | ✅ | ❌（有编号图例，无截图） |
| Hall of fame | ✅ | ❌（404） |
| 独立 Search 页 | ✅ | ❌（404，但顶栏有 ⌘K） |
| 24h 流量（浏览量 / 访客） | ✅ | ❌（无埋点数据） |
| `llms.txt` + `Ask ChatGPT/Claude/Perplexity/Grok` | ❌ | ✅（本站独有） |

---

## 三、已完成的修改（本轮）

全部是技术性 / 正确性修正，未改动任何设计版式或定价决策。

1. `shared/utils/public-name.ts` — 重写为分段打分，覆盖「长标语 | 产品名」反向情况，
   上限 44 字符。`localizeTool` 已在读取时调用，所以**存量 78 条记录无需迁移即生效**。
2. `app/components/WeeklyPulse.vue` — 统计条口径改「本周新收录」，并去掉与 kicker
   重复的 `this week`。
3. `shared/utils/schema.ts`（新增）— `faqPageSchema` / `breadcrumbSchema` / `itemListSchema`。
4. `shared/content/launch-platforms.ts`（新增）— 8 个平台的单一数据源，含中英双语
   `rhythm` / `best` / `note`，硬规则：不写别家价格。
5. `app/pages/alternatives/index.vue` — 由 `alternatives.vue` 迁入（否则与
   `alternatives/[platform].vue` 构成父子路由，子页永远渲染不出来）；8 张卡片改内链。
6. `app/pages/alternatives/[platform].vue`（新增）— 8 个子页，含 FAQPage + BreadcrumbList，
   未知 slug 返回 404。
7. `app/pages/index.vue` — 首页 `ItemList`（空清单不发）。
8. `app/pages/weekly.vue` — 榜单 `ItemList`（按当前面板，空周不发）+ `BreadcrumbList`。
9. `app/pages/pricing.vue` — meta description 从 59 字符补到 138 字符，价格取自
   `effectiveQuote`，活动价变化会自动跟着变。
10. `server/routes/sitemap.xml.ts` — 8 个子页进 sitemap。
11. `shared/utils/schema.test.ts`（新增）— 5 个用例锁住 schema 结构与平台数据约束。

### 本地验证结果

- `npm test`：**112 / 112 通过**（原 107 + 新增 5）
- `nuxi typecheck`：**无新增错误**，仍是 10 条既有基线（admin/*、blog.ts、submissions.ts、batch2-*）
- 溢出巡检 390 / 1440：`/alternatives`、`/alternatives/devhunt` 均 `overflow=0`
- 路由：`/alternatives` 200、8 个子页 200、未知 slug 404、`/zh/alternatives/betalist` 200
- 结构化数据实测：
  - `/` → `FAQPage`（本地无数据周，ItemList 按设计不发）
  - `/weekly` → `BreadcrumbList`
  - `/alternatives` → `FAQPage, BreadcrumbList`
  - `/alternatives/devhunt` → `FAQPage, BreadcrumbList`
  - `/pricing` → `FAQPage`
- sitemap 已含 8 条 `alternatives/<slug>`
- 中文子页标题：`最值得考虑的 DevHunt 替代品 · Product Atlas`，canonical 正确带 `/zh`

### 顺带核实（不是 bug）

榜单行的 logo 在截图里显示为白框，实测是截图时远程图未加载完的假象；
`ordogrid.com` / `tunenoodle.com` / `aihotellobby.dev` 的图标均 200。
`blurbackground.vip` 返回 403（防盗链），此时 `ToolLogo` 已降级为首字母，不会出现破图。

---

## 四、待决策（没有动，等确认）

按建议优先级排列。这些都涉及版式或产品策略，不属于「技术修正」，所以只列不改。

### P0 · 首屏空 Billboard

现状：`TOP 10 ON THE BILLBOARD` 展示 10 格，本周只卖出 5 格，另外 5 格是
`Open / Claim from $10`，占掉约 370px 首屏高度，访客第一眼看到的是一排空格子。

建议：空位收敛成一条 `5 个位置待售 · $10 起 →` 的细条，只保留已售格子 + 1 个占位。
可逆，纯 CSS/模板层改动，不碰计价。

### P1 · 周条缺剩余时间

竞品 `Week 47 · 4d 14h left` 是明确的紧迫感信号。本站只有 `Week 47 · LIVE · Nov 16 – Nov 22`。
`remainingHms()` 已存在（首页「下一次发布」在用），加一行即可。

### P1 · 定价页 Boost 卡缺倒计时

竞品：`50% off ends 56:20:05`。本站 Boost 卡只有 `LIMITED TIME` 字样，
活动截止时间在页面底部以静态文字给出。站内已有全站 Black Friday 倒计时横幅，
所以这是「要不要在卡内再放一个」的选择，不是缺失。

### P2 · 五档定价 vs 竞品两档

竞品：Free / Boost + 2 个广告位。本站：Free / Boost / Standard / Featured / Pro + 2 个广告位。
档位越多，选择成本越高。是否收敛属于产品策略，需要你定。

### P2 · 免费档链接策略

竞品：免费也能拿 dofollow（条件是挂他们的徽章）。
本站：免费一律 nofollow，dofollow 只在付费档。
这是刻意更保守的承诺，不建议为了对齐而改——但如果不改，免费档的吸引力确实低于竞品。

### P2 · 榜单票数偏低

线上 Top 1 只有 2 票，多数 0 票。竞品 Top 1 是 36 票。
这不是代码问题，是冷启动问题；但页面看上去「没人用」，会反过来影响转化。

### P3 · 缺 Hall of fame / 独立 Search 页

两者线上都是 404。`/weekly` 已能翻历史周，`/hall-of-fame` 可以直接 301 过去；
独立 Search 页收益低（顶栏 ⌘K 已覆盖）。建议只做前者。

### P3 · 「Where each option shows」标注截图

竞品用一张带 ①②③④ 标记的站点截图解释四种广告位位置，本站是纯文字编号图例。
图需要设计产出，不是代码能补的。

---

## 五、部署状态

以上 11 项改动**只在本地，未部署、未推 GitHub**。
`npm test` 与 `typecheck` 已通过，等你说「上线」再执行 `npm run deploy`。
