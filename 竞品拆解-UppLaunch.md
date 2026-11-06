# UppLaunch 拆解与改造清单

研究时间：2026-11-02
对象：https://www.upplaunch.com（Next.js / App Router）
样本：sitemap 全量 305 条 URL + 15 个关键页面 HTML + 计算样式 + 截图

---

## 一、它到底是个什么东西

| 维度 | UppLaunch | 我们（Product Atlas） |
|---|---|---|
| 定位 | 每周一重置的**发布榜**（Product Hunt 式） | 常驻**产品目录**（按分类/标签浏览） |
| URL 结构 | `/p/*` 117 · `/makers/*` 88 · `/topics/*` 57 · `/best/*` 19 · `/week/*` 7 · `/blog` 6 | `tools/*` · `categories/*` · `tags/*` · `weekly` · `just-added` |
| 核心动作 | 投票 + 排名（周赛） | 浏览 + 提交 |
| 变现 | 免费 / $19 一次性 Premium / **$19–29 每周广告位** | 免费 / $19 / $39 一次性 |
| 技术 | Next.js + Supabase | 纯 Python 静态构建 + 运行时渲染 |
| 字体 | `ui-sans-serif` 系统栈 + `ui-serif`(Georgia) 标题，**零 webfont** | 系统栈，纯 sans |
| 主色 | 黑白灰 + 一点 `#2563eb` 蓝 | OKLCH 暖米 + amber |

它最聪明的一步不是设计，是**把"收录"包装成"周赛"**：每周一开新榜、Top3 有奖牌、过期进归档。这让「回访」有了理由，而我们的目录页天生没有回访理由。

---

## 二、设计系统（可直接抄的数字）

**字体**
- 正文 `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
- 标题 `ui-serif, Georgia, Cambria, "Times New Roman", serif` — **只用在 h1/h2 级**
- 等宽 `ui-monospace, SFMono-Regular, Menlo, Consolas`
- 全文零 `@font-face`，零外部字体请求

**字号阶梯**（这是它显得"专业"的真正原因 —— 比我们密）
| 用途 | 字号 / 字重 / 字距 |
|---|---|
| 产品名 h1 | 26px / 800 / -0.02em |
| 榜单行标题 | 15px / 700 |
| 榜单行描述 | 13.5px / 400 / `#6b7280` |
| meta 行 | 12.5px / 400 / `#9ca3af` |
| 区块小标签 | 12.5px / 700 / **uppercase / 0.14em** |
| 正文段落 | 15.5px / 400 / line-height 1.75 |
| 大数字 | 30–34px / 800 / -0.03em / tabular-nums |

**色板**
`#101114` 正文 · `#111827` 标题 · `#6b7280` 次级 · `#9ca3af` 弱化 · `#e8eaee` 边框 · `#f8f9fb` 画布 · `#2b2b2e` 主按钮 · `#2563eb` 强调 · `#f5e6b3` 赞助条 · `#ecfdf3` Live 徽章

**结构**
- 左栏固定 320px（logo / 导航 / New Launch / 登录 / 页脚链接）
- 详情页三栏：320 + 内容 + **430px sticky 右栏**
- 圆角：8 / 12 / 14 / 18 / 20
- 分隔线大量使用 **dashed**，不是实线

---

## 三、它比我们强的 12 个点（按值得抄的程度排序）

| # | 点 | 为什么值得抄 | 状态 |
|---|---|---|---|
| 1 | **Ask AI 条** | 5 个 AI 引擎的预填查询链接。JSON-LD 只告诉爬虫"这页是什么"，不能让模型引用它；这条链接把产品名 + 一句话卖点直接塞进对话，是 GEO 最便宜的落地 | ✅ 已做 |
| 2 | **榜单 Top3 整行高亮** | 榜单站唯一要回答的问题是"我还在榜上吗"，高亮比奖牌图标更有效且不土 | ✅ 已做 |
| 3 | **分类卡 2×2 logo 拼贴** | 图标字体只说明"这是 AI 分类"，4 张真 logo 说明"里面有什么"，点击前就建立预期 | ✅ 已做 |
| 4 | **分类行热度条 + 真实票数** | 把"哪个分类在动"变成可扫描的信息，比单纯"N products"有用 | ✅ 已做 |
| 5 | **serif 标题 + sans 正文** | 一个变量换掉，整站从"后台管理"变成"出版物" | ✅ 已做（仅英文页） |
| 6 | **Similar to X 紧凑 2 列卡** | 详情页的相关推荐是"出口"，应该一眼读完、少占高度，不是再铺一遍大卡片 | ✅ 已做 |
| 7 | 周付广告位（$29.99/周） | 把广告位变成**按周租的稀缺资源**，而不是一次性买断，收入可重复 | ✅ 已做 |
| 8 | 讨论区（每个产品页） | 让页面有 UGC 增量，是 SEO 长尾和回访的源头 | ⏸ 暂缓 |
| 9 | Maker 主页 `/makers/<slug>` | 29 个页面，零内容成本，内链和"作者"信任都靠它 | ✅ 已做 |
| 10 | Demo 视频页 `/p/<slug>/video` | 独立可索引页，视频是转化率最高的素材 | ⏸ 待确认 |
| 11 | 周归档 `/week/2026/45` | 永久 URL，越积越多的长尾 | ⏸ 我们已有 weekly，但无独立归档 URL |
| 12 | Command palette（⌘K） | 我们已经有了，验证过能用 | ✅ 已有 |

---

## 四、这一轮实际改了什么

改动文件：`build.py`、`assets/css/style.css`，重新构建 148 个页面。

1. **`ask_ai_block()`** — 产品详情页标题下方插入 Ask AI 条
   - 5 个引擎：ChatGPT / Claude / Perplexity / Grok / DeepSeek
   - 每个带品牌色圆点（`#10a37f` / `#d97757` / `#20808d` / `#1a1a1a` / `#4d6bfe`）
   - 预填文案：`Summarise "<产品名>" — <一句话卖点>`（中文页为 `请介绍「产品名」：<卖点>`）
   - `rel="nofollow noopener"`，不影响自身权重

2. **榜单 Top3 整行高亮** — `build_home()` 给前三行加 `is-top`，淡琥珀底 + 徽章加深；meta 行的分类 chip 换成带图标的 `board__tag`

3. **分类卡重做** — `cat_card()` 从「emoji 图标 + 名称」改为「2×2 真 logo 拼贴 + 名称/数量 + 热度条 + 本周真实票数」

4. **右栏本周热度卡** — `rail_heat_card()` + `sparkline()`，数字来自本站真实投票，折线取最近 6 周归档；持平显示「flat」而不是 `+0%`

5. **serif 标题** — `--font-serif: Georgia, ...`，仅作用于 `html[lang="en"]`；中文页保留 sans（Songti 在小字号下像报纸）

6. **Similar to X** — 相关工具从 3 个大卡片改为 4 个紧凑 2 列卡

7. **Maker 主页** — 新增 `/makers.html` 索引 + 29 个 `/makers/<slug>.html`
   - 聚合轴是 `tools[].maker`（数据里本来就有，只是 20 条是空的，已补全）
   - 头像用首字母 + 名字哈希决定的色相，**不用产品 logo**（多产品的厂商会被某一张 logo 代表）
   - 每个 maker 页含：简介句、产品榜单行、同分类的其他 maker
   - 工具页 meta 里的 maker 从纯文本改成链接；sitemap 加 29×2 条；JSON-LD 用 `Organization` + `owns`

8. **周广告位 $29.99/周** — pricing 页新增 `#ads` 区块，两个位置同价
   - 榜单位（第 3、4 名之间）、侧栏位（全站右栏）
   - CTA → `submit.html?plan=ad`，提交页第 3 步多出一张「周广告位」卡（仅 `?plan=ad` 时显示）
   - `submissions.py` 放行 `plan="ad"`，`awaiting_payment` 对 paid/ad 都置真
   - **顺手修了一个既有断链**：`submit.html?plan=featured|pro` 之前完全不生效，前端一律重置为 free —— 也就是说过去点「Go live now」的人全都提交成了免费单。现在做了 `featured/pro → paid`、`ad → ad` 的映射。

---

## 五、明确不抄的

- **伪造访客数**。它的右栏写着「2,422 founders visited in the last 30 days, up 103%」，并挂 Cloudflare / Ahrefs 背书。我们没有访客计数，抄这个数字等于在最有说服力的位置撒谎。我们的热度卡只用真实投票数。
- **满屏 emoji 奖牌**。🥇🥈🥉 在高密度列表里会打断视觉节奏，我们用色块代替。
- **app 式 `h-screen` 布局**。它的整页是固定视口 + 内部滚动，导致每个页面 body 高度都锁死在 900px，截图、打印、移动端地址栏都吃亏。我们保持文档流滚动。

---

## 六、还没做的

1. **评论区** — 你决定先不做。要做得新增 `data/comments/` + 登录发帖 + 审核队列，约等于再做半个提交系统。
2. **域名** — 延后。但这件事卡着所有优化：站点现在被分享码挡着，`/` 和 `/robots.txt` 都返回 403 + `noindex`，上面这些东西线上一个都看不见。

## 七、本地验证

`PORT=8898 python3 serve.py` 已起，全部 200：
- `/index.html` — 热度卡、Top3 高亮、serif 标题
- `/tools/chatgpt.html` — Ask AI 条、Similar to、maker 链接
- `/categories.html` — 拼贴卡 + 热度条
- `/makers.html` + 29 个 `/makers/<slug>.html`
- `/pricing.html#ads` — 周广告位
- `/submit.html?plan=ad` — 第 3 步出现广告位卡
- `/zh/index.html` — 中文页字体回退正常

内部链接：13410 条，**0 断链**。构建 208 个文件。

**未部署。** 按规矩等你点头。
