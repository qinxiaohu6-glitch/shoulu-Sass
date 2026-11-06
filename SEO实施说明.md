# SEO 实施说明

> 对应 PRD §3.2（工具详情页 = SEO 核心）、§3.8（SEO 与程序化页面）、§3.6（多语言 Hreflang）
> 审计时间：2026-10-30　审计范围：148 个 HTML 页面全量静态解析

---

## 0. 先说结论

SEO 之前**已经做了**，而且不是空架子：sitemap / robots / llms.txt、canonical、hreflang、JSON-LD 全部在。

但这次逐页审计翻出了 **5 个真缺陷**，其中 2 个是肉眼看不出来、只有解析 HTML 才能发现的：

| # | 问题 | 严重度 | 影响 |
|---|---|---|---|
| 1 | `<title>` / `og:title` 出现 `&amp;amp;` 双重转义 | **高** | 31 个页面的 SERP 标题会显示成字面量 `&amp;` |
| 2 | 列表页缺 `ItemList` 结构化数据 | **高** | 分类/标签/最新页无法被识别为"工具清单"，丢失列表富媒体机会 |
| 3 | `SearchAction` 指向的 `?q=` 前端根本没实现 | **中高** | 从 Google 搜索框进来的用户看到的是未筛选的完整列表 |
| 4 | `admin.html` 没有 noindex | **中** | 后台管理页可被搜索引擎索引 |
| 5 | 隐私政策/条款页可索引但不在 sitemap | **中** | 信任页（E-E-A-T 信号）不被发现 |

以上全部已修，本地回归 0 报错。

---

## 1. PRD §3.2 逐条对照（工具详情页）

| PRD 要求 | 实现 | 证据 |
|---|---|---|
| 独立 URL `/tools/[slug]` 与 `/zh/tools/[slug]` | ⚠️ 见 §4.2 | `/tools/chatgpt.html` |
| 名称、Logo、一句话描述、长描述、分类、标签 | ✅ | 全部渲染 |
| 官网链接 **dofollow** | ✅ | 30/30 `rel="dofollow noopener"`，0 个 nofollow |
| 投票数、提交时间、Featured 标记 | ✅ | — |
| 相关工具 | ✅ | 同分类+同标签+热度加权 |
| JSON-LD（SoftwareApplication） | ✅ | 60 个（30 工具 × 2 语言） |
| Title / Meta Description / Canonical / Hreflang 自动生成 | ✅ | 124/124 可索引页全覆盖 |
| 中英双语字段分开存储 | ✅ | `name_en/name_zh`、`short_en/short_zh`、`long_en/long_zh` |

**验收标准复核**：页面可被爬虫抓取 ✅（纯静态 HTML，无 CSR 依赖）；JSON-LD 可解析 ✅（0 解析失败）；中英切换正常 ✅。

---

## 2. PRD §3.8 逐条对照（SEO 与程序化页面）

| PRD 要求 | 实现 | 数字 |
|---|---|---|
| 自动生成 sitemap.xml | ✅ | 124 URL / 372 条 `xhtml:link` |
| 自动生成 robots.txt | ✅ | 含 Sitemap 指令 |
| 自动生成 llms.txt | ✅ | 核心页 + 30 个工具条目 |
| 分类页程序化标题描述 | ✅ | 如 `5 Best AI Chatbots in 2026` |
| 周榜页程序化标题描述 | ✅ | 含当前周期与周 ID |
| Just Added 页程序化标题描述 | ✅ | — |
| 所有页面支持结构化数据 | ✅ | **124/124 可索引页，244 个实体** |
| 所有页面支持多语言标签 | ✅ | 124/124 页 3 条 hreflang |

**结构化数据分布**

| 类型 | 数量 | 覆盖 |
|---|---|---|
| `BreadcrumbList` | 118 | 除首页外所有页 |
| `SoftwareApplication` | 60 | 30 个工具 × 2 语言 |
| `ItemList` | 56 | 工具列表、8 分类、15 标签、索引页、最新、周榜 |
| `WebPage` | 6 | 隐私、条款、提交页 |
| `WebSite` + `SearchAction` | 2 | 中英首页 |
| `FAQPage` | 2 | 提交页 5 组问答 |

---

## 3. 本次修的问题

### 3.1 `&amp;amp;` 双重转义（31 页）

**现象**：`<title>ChatGPT: Features, Pricing &amp;amp; Alternatives</title>`

浏览器会把这个标题渲染成 `ChatGPT: Features, Pricing &amp; Alternatives`——用户和 Google 看到的都是字面量 `&amp;`。

**根因**：`build.py` 的标题模板里手写了 `&amp;`，而 `page()` 会用 `esc()` 再转义一次。`&` → `&amp;` → `&amp;amp;`。

**修法**：模板里只写 `&`，转义交给 `esc()` 统一处理。共 2 处（工具详情页、工具列表页）。

**为什么重要**：标题是 SERP 里权重最高的元素。带 `&amp;` 的标题会降低点击率，且看起来像技术故障。

---

### 3.2 列表页缺 `ItemList`（30 页）

**现象**：分类页、标签页、最新收录页只有 `BreadcrumbList`，没有 `ItemList`。而 `tools.html` 和 `weekly.html` 是有的——不一致。

**为什么重要**：`ItemList` 是告诉 Google "这一页是一个有序清单，里面是这些条目及其 URL" 的唯一方式。缺了它，Google 只能靠链接抓取去猜，分类页/标签页的抓取优先级和列表理解都会变弱。

**修法**：新增 `ld_graph()` 把 `BreadcrumbList` 和 `ItemList` 合并到一个 `@graph` 里输出（一个 script 标签两个实体，不增加请求）。

结果：`ItemList` 从 4 个 → **56 个**。

---

### 3.3 `SearchAction` 是空标记

**现象**：首页 JSON-LD 声明了

```json
"potentialAction": {
  "@type": "SearchAction",
  "target": { "urlTemplate": "https://shipanydir.com/tools.html?q={search_term_string}" }
}
```

但 `tools.html` 的前端只读 `category` / `sort` / `page` 三个参数，**完全不认 `q`**。从 Google 搜索结果里的搜索框提交关键词，用户会落到一个没有任何筛选的完整列表页。

**修法**：
1. `app.js` 支持 `?q=` 关键词过滤（匹配名称、分类、slug、卡片全文，支持多词 AND）
2. 页面上加一条可见提示条「Search results for chat · Clear」，可一键清除
3. 中英文案分别处理

**为什么重要**：`SearchAction` 是让 Google 在品牌词的搜索结果下方直接展示站内搜索框的机制。标记存在但落地页不工作，等于白标。修好之后从 SERP 搜索框进来的流量能直接看到结果。

实测：`?q=chat` → 6 条、`?q=code` → 4 条、`?q=image generation` → 4 条、中文 `?q=视频` → 4 条、无匹配 → 0 条 + 空状态。

---

### 3.4 `admin.html` 没有 noindex

后台管理页（审核队列、订单、工具管理）原本是可索引的。虽然是演示数据，但正式上线后后台结构不该进搜索引擎。

**修法**：`page()` 新增 `noindex` 参数，`admin` 和 `sign-in` 都传 `True`。

顺带把 `404.html` 也加了 `noindex,nofollow`（原本没有，Google 可能把它当正常页索引）。

结果：noindex 页从 20 → **24**（+admin×2、sign-in×2、404 本来有但没 robots 标签）。

---

### 3.5 法律页不在 sitemap

`privacy-policy` / `terms-of-service` 可索引，但 sitemap 里没有。

**为什么重要**：这两页是 E-E-A-T 的信任信号，也是 Google 判断站点合法性的依据之一。可索引却不提交，等于让 Google 自己慢慢发现。

**修法**：加进 sitemap，priority 给 0.3（低于内容页，但要被收录）。

---

### 3.6 附带修的三处

| 问题 | 修法 |
|---|---|
| `og:image` 是 128×128 的 logo，分享卡片会糊 | 生成 1200×630 专用 OG 图（中英各一张，JPEG q82，44KB / 38KB），`twitter:card` 升级为 `summary_large_image`，补 `og:image:width/height/alt` |
| 分类页 `5 Best AI Chatbots Tools`（复数重复）、中文 `效率工具工具` | 名称已复数则不加 `Tools`；中文名已含"工具"则不重复；年份改为 `TODAY.year` 动态 |
| `applicationCategory: "WebApplication"` 不是 schema.org 枚举值 | 按分类映射到标准枚举：`CommunicationApplication` / `DeveloperApplication` / `MultimediaApplication` / `BusinessApplication` / `UtilitiesApplication` |

---

## 4. 还没做的（需要你决策）

### 4.1 Canonical 域名是占位的

**现状**：所有 canonical、hreflang、og:url、sitemap 里的域名都是 `https://shipanydir.com`，但站点实际部署在 `repostgone.apps.workbuddy.host`。

**影响**：现在把 sitemap 提交到 Google Search Console 会失败——Google 访问 `shipanydir.com/sitemap.xml` 找不到东西。PRD §3.8 的验收标准「GSC 可正常提交」卡在这里。

**已准备好解法**：`build.py` 支持环境变量覆盖，不用改数据文件：

```bash
SITE_BASE=https://你的域名.com python3 build.py
```

一次构建，canonical / hreflang / og:url / sitemap / robots / llms.txt 全部跟着变。

**需要你定**：正式域名是什么。如果暂时没有，可以先保持现状（不影响本地和预览访问），等域名定了再重新构建一次即可。

---

### 4.2 URL 带 `.html` 后缀

**现状**：PRD §3.2 写的是 `/tools/[slug]`，我们生成的是 `/tools/chatgpt.html`。

**影响**：SEO 上带不带后缀本身没有优劣（Google 一视同仁）。差异在于：
- 无后缀 URL 更短、更好分享、看起来更"产品化"
- 带后缀在纯静态托管下最稳（不需要服务器 rewrite）

**改造代价**：需要改目录结构（`tools/chatgpt.html` → `tools/chatgpt/index.html`）或给 `serve.py` 加 rewrite 规则。前者会让所有内链、canonical、sitemap 跟着变，需要全量回归；后者只在当前这台服务器有效，换静态托管（GitHub Pages / Vercel）会 404。

**建议**：等域名定了、确定最终托管方式之后再做，一次改到位。现在改属于返工风险。

---

### 4.3 详情页没有 FAQ / 优缺点

PRD §8 明确把「富内容（优缺点、用例、FAQ）」排除在 MVP 之外，所以工具详情页只有短描述 + 长描述。

原站是有 FAQPage 的（每个工具 3 组问答）。我们只在**提交页**做了 FAQPage（因为那页本来就有可见的 5 组问答）。

这是**按 PRD 执行**，不是遗漏。如果后续要加，需要先补数据模型和内容生产流程。

---

## 5. 线上验收结果

已发布到 `https://repostgone.apps.workbuddy.host/?sharecode=P3JHPXA67X`，用真实 Chrome + 逐页抓取复核：

| 检查项 | 结果 |
|---|---|
| 13 个代表页抓取 | 全部 200，`&amp;amp;` 出现 **0** 次 |
| `ItemList` | 工具列表 / 分类 / 标签 / 最新 / 周榜 全部命中 |
| `noindex` | admin、sign-in、404 命中；内容页 0 命中 |
| `FAQPage` | 提交页命中，5 组问答 |
| `hreflang` | 每页 3 条 link（en / zh-Hans / x-default） |
| `og:image` | 全部指向 `og-en.jpg` / `og-zh.jpg`，`content-type: image/jpeg`，cache 1 天 |
| 浏览器交互 | 首页 12 卡片 0 破图；`?q=chat` → 6 条 + 提示条；点 Clear 回 24 条；中文 `?q=视频` → 4 条 |
| 详情页 | JSON-LD = `SoftwareApplication` + `BreadcrumbList`；官网外链 `rel="dofollow noopener"` |
| console / 网络 | **0 报错、0 个 4xx/5xx** |

---

## 6. 上线前 Checklist

按 PRD §3.8 验收标准：

- [x] sitemap.xml 可访问、124 URL 全部指向真实文件、0 死链
- [x] 124 个可索引页全部有 canonical + hreflang×3 + JSON-LD
- [x] hreflang 中英互指正确、x-default 指向英文版
- [x] 244 个 JSON-LD 实体 0 解析失败
- [x] 1422 张图片 0 缺 alt
- [x] 30/30 官网外链 dofollow
- [x] 130 条内链 0 死链
- [x] noindex 页 0 个混进 sitemap
- [ ] **域名确认后重新构建**（§4.1）
- [ ] 提交 sitemap 到 Google Search Console
- [ ] 用 Google Rich Results Test 抽查 3 类页面：工具详情、分类、提交

---

## 7. 怎么验证

```bash
# 本地起服务
cd dir-shipany-clone
PORT=8898 python3 serve.py

# 换域名重新构建（canonical 全部跟着变）
SITE_BASE=https://yourdomain.com python3 build.py
```

抽查这几个 URL：

| 检查项 | 地址 |
|---|---|
| 结构化数据 | 任意工具详情页，查看源码里的 `ld+json` |
| 关键词过滤 | `/tools.html?q=chat` |
| 中英 hreflang | `/index.html` 与 `/zh/index.html` 对比 |
| sitemap | `/sitemap.xml` |
| robots | `/robots.txt` |
| llms.txt | `/llms.txt` |
