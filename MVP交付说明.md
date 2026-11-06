# AI 工具收录站 · MVP v1.0 交付说明

> 依据《AI 工具收录站 PRD v1.0（2026-10-29）》重建。视觉沿用对 dir.shipany.site 的 1:1 复刻（设计令牌、栅格、组件、字体全部继承），**功能范围严格按 PRD 裁剪**。

- 生成器：`build.py`（数据 → 148 个静态页）
- 数据：`data/mvp.json`（由 `mvp_data.py` 从抓取结果重建为 PRD §5 数据模型）
- 交互：`assets/js/app.js`（投票 / 提交双轨 / 后台，localStorage 持久化）
- 预览：`cd dir-shipany-clone && python3 -m http.server 8899` → http://127.0.0.1:8899/

---

## 1. PRD 对照表

| PRD 条目 | 实现情况 | 落地位置 |
|---|---|---|
| §3.1 首页：Featured（付费置顶优先）/ 本周热门 / 最新启动 / 分类入口 | ✅ 四区块齐全 | `index.html` |
| §3.1 分类页：最新、最热、Featured 优先排序 | ✅ 列表页三种排序 + 分类筛选 | `tools.html?sort=featured\|newest\|votes` |
| §3.1 标签页、多标签 | ✅ 15 个标签页 + 工具多标签 | `tags.html`、`tags/*.html` |
| §3.1 搜索（名称/描述/分类，中英） | ✅ ⌘K 弹窗，双语字段同时命中 | 全站 |
| §3.1 周榜页：当前周 + 历史周 | ✅ 5 周，含排名变化 ▲▼/NEW | `weekly.html` |
| §3.1 Just Added | ✅ 按 `created_at` 倒序 | `just-added.html` |
| §3.1 相关推荐：同分类 + 同标签 + 热度 | ✅ 打分（同分类 +3、同标签 +2、票数次序） | 详情页底部 |
| §3.2 独立 URL `/tools/[slug]`、`/zh/tools/[slug]` | ✅ 30 工具 × 2 语言 | `tools/*.html`、`zh/tools/*.html` |
| §3.2 展示名称/Logo/一句话/长描述/分类/标签/官网(dofollow)/票数/提交时间/Featured | ✅ 全部字段 | 详情页 |
| §3.2 JSON-LD（SoftwareApplication） | ✅ + BreadcrumbList | 详情页 `<head>` |
| §3.2 Title / Meta / Canonical / Hreflang | ✅ en / zh-Hans / x-default 三向 | 全站 `<head>` |
| §3.2 中英双语字段 | ✅ 名称、一句话、长描述、分类、标签均双语 | `data/mvp.json` |
| §3.3 URL 粘贴 → 自动提取 → 确认编辑 → 选免费/付费 | ✅ 三步向导，含重复检测 | `submit.html` |
| §3.3 免费轨道：待审核 → 通过 → Badge 验证 → 展示 | ✅ pending → badge → live | `submit.html` / `dashboard.html` |
| §3.3 付费轨道：支付后自动发布 + 置顶 + Featured | ✅ $39 / 14 天，自动写订单 | `submit.html`（模拟 Stripe 弹窗） |
| §3.3 提交者后台：状态、编辑、被拒重提 | ✅ 列表 + 编辑 + 删除 + 重新提交 | `dashboard.html` |
| §3.3 Badge 验证按钮（半自动检查） | ✅ 模拟校验，成功转 live | `dashboard.html` |
| §3.4 登录投票、每周每工具 1 票、票数实时 | ✅ 未登录拦截 + 周维度去重 + 即时计数 | 全站投票按钮 |
| §3.4 周榜按票数排序、周期可配置 | ✅ 数据层 `weeks[]`，可加周 | `weekly.html` |
| §3.5 置顶套餐（天数可配置）、后台看订单、预留广告位 | ✅ 14 天套餐 + 订单表 + 详情页预留槽 | `admin.html`、详情页侧栏 |
| §3.6 `/` 与 `/zh`、UI 文案翻译、Hreflang | ✅ 74 页 × 2 语言 | `zh/` 整树 |
| §3.7 审核队列 / 工具管理 / 订单 / 统计 | ✅ 四项齐全 | `admin.html` |
| §3.8 sitemap.xml / robots.txt / llms.txt | ✅ 124 条 URL，含 xhtml:link 备用语言 | 站点根目录 |
| §3.8 所有页面结构化数据 + 多语言标签 | ✅ 124/124 可索引页，244 个 JSON-LD 实体 | 见 `SEO实施说明.md` |
| §8 不做：富内容（优缺点/用例/FAQ）、完整广告系统、Newsletter、更多语言 | ✅ 已移除 | — |

**从上一版删除的页面**：`advertise.html`（完整广告系统）、`collections.html`、`feed.html`、`blog.html` + `blog/*`（PRD 未列入 MVP）、详情页的 overview / steps / features / use cases / pros & cons / FAQ 六个富内容区块。

---

## 2. 页面清单（148 页）

| 类型 | 英文 | 中文 | 说明 |
|---|---|---|---|
| 首页 | 1 | 1 | 四区块 + 侧栏 |
| 工具列表 | 1 | 1 | 筛选 + 3 种排序 + 分页（24/页） |
| 工具详情 | 30 | 30 | JSON-LD + 图库 + 相关推荐 |
| 分类 | 1 + 8 | 1 + 8 | 程序化标题 |
| 标签 | 1 + 15 | 1 + 15 | |
| 周榜 | 1 | 1 | 5 周切换 |
| 最新收录 | 1 | 1 | |
| 提交 | 1 | 1 | 三步向导 |
| **用户后台** | **8** | **8** | 见第 9 节 |
| 后台管理 | 1 | 1 | 审核/订单/工具管理 |
| 登录 | 1 | 1 | 支持 `?next=` 回跳 |
| 隐私 / 条款 / 404 | 3 | 3 | |

> `dashboard.html` 保留为**重定向存根**（`meta refresh` + `location.replace`），指向 `settings/submissions.html`，旧链接不会失效。

---

## 3. 三条主流程怎么验

**投票（§3.4）**
1. 未登录点详情页 `↑ 68` → 提示「请先登录」并给登录入口
2. 登录后投票 → 数字 +1、按钮高亮
3. 同一周再投 → 「本周已投票」，计数不变

**免费轨道（§3.3）**
1. 提交页粘贴任意产品 URL → 自动提取名称/描述/分类/图标（若域名已在目录中，会提示重复并给出跳转）
2. 第 2 步逐项可改 → 第 3 步选「免费收录」→ 提交
3. 「我的提交」显示 *Pending review*
4. 后台审核队列点「通过」→ 状态转 *Badge pending*
5. 我的提交点「验证 Badge」→ *Live*

**付费轨道（§3.3 / §3.5）**
1. 第 3 步选「付费置顶 $39」→ 提交 → Stripe 结账弹窗（演示，不扣款）
2. 确认支付 → 直接 *Live*，标注 `Pinned until +14 天`
3. 后台订单表新增 1 条 $39，收入统计同步

---

## 4. 视觉一致性

与原站逐点比对（1440 宽）：

| 元素 | 原站 | 本版 |
|---|---|---|
| 顶栏 | 240,0,1200,57 | 240,0,1200,57 |
| 侧栏宽 | 240 | 240 |
| 首页 H1 | 272,89,796,36 | 272,89,796,36 |
| H1 副标题 | 272,131,796,21 | 272,131,796,21 |
| 工具卡 | 371×129 | 371×129 |
| 分类胶囊 | 47×32 | 47×32 |

工具卡内新增的投票按钮压到 20px，与 chip 同高，卡片高度仍为 129px，未破坏原栅格。

页面总高差异来自 PRD 裁剪：详情页 1917（原 3620，去富内容）、首页 2778（原 3381，去 Recommended 与分类分段）。

---

## 5. 已知边界（静态原型的取舍）

| 项 | 现状 | 接真实后端时 |
|---|---|---|
| 数据持久化 | localStorage（`dir-submissions` / `dir-votes` / `dir-orders`） | 换 Supabase 表：`tools` / `votes` / `submissions` / `orders` |
| 登录 | 表单直接写本地用户 | Supabase Auth（邮箱 + 社交） |
| 支付 | 弹窗模拟，不发请求 | Stripe Checkout + webhook 回调改 `status` / `featured_until` |
| URL 自动提取 | 前端解析域名 + 目录匹配 + 关键词猜分类 | 服务端抓取页面 → LLM 抽取 → 回填 |
| Badge 验证 | 模拟概率通过 | 服务端 fetch 对方页面查链接 |
| 票数 | 静态基线 + 本地增量 | `votes` 表按 `(tool_id, user_id, week)` 唯一约束 |
| URL 形式 | `*.html`（便于 file:// 直接打开） | Vercel 可改无扩展名，同步改 `SITE` 与 sitemap |

改域名只需改 `build.py` 顶部 `data/mvp.json` 的 `site.base`，重新 `python3 build.py` 即可，canonical / hreflang / sitemap 会一起更新。


---

## 6. 页面体积（优化后）

| 指标 | 数值 |
|---|---|
| 132 页合计 | 3.9 MB（原 7.1 MB） |
| 单页平均 | 29.8 KB |
| 最大页（周榜） | 64 KB，gzip 后 **9 KB** |
| 图标 | 每页内联一份 `<symbol>` 雪碧图，`<use>` 引用，不再重复 180 次路径数据 |
| 周榜历史 | 只服务端渲染当前周（30 行，利于 SEO）；其余 4 周以 JSON 下发，切标签时前端渲染 |

---

## 7. 重新生成与预览

> 预览注意：`zh/` 子目录里的页面用 `../assets/...` 引用资源，必须在站点根目录起服务再访问（`http://127.0.0.1:8899/zh/`）。若把 `zh/` 子目录单独当根目录打开，会出现「无样式 + 图标撑满屏」的裸 HTML。

```bash
cd dir-shipany-clone
python3 mvp_data.py   # 可选：重建 data/mvp.json（含中文字段与周榜）
python3 build.py      # 输出 135 个文件 + sitemap/robots/llms
PORT=8899 python3 serve.py   # 本地预览（推荐，见下）
```

### 7.1 为什么要用 `serve.py` 而不是 `python3 -m http.server`

`http.server` 是**单线程**：一个页面十几二十个子资源会逐个排队。实测首页 20 个请求时，第 6 个并发请求直接 40s 超时；单页 12s+。

`serve.py`（纯标准库，无依赖）做了三件事：

| 能力 | 效果 |
|---|---|
| `ThreadingHTTPServer` | 资源并发，6 个并发请求从「40s 超时」降到「<1s」 |
| gzip（文本类，>860B） | CSS 73KB→11.5KB、JS 37KB→10KB、HTML 49KB→9.2KB（压缩率约 84%） |
| 内存缓存（按 mtime 失效） | 压缩结果不重复计算；图片等二进制不压缩 |

另外还带了路径穿越防护、目录自动 `index.html`、`404.html` 兜底。

### 7.2 缓存与版本号

`build.py` 会给 CSS/JS 自动追加内容哈希（如 `style.css?v=b39600b1`），改动后重新构建即自动换 URL，避免浏览器拿到旧样式。

### 7.3 相对路径：页面链接和静态资源是两套深度

这是最容易踩的坑，记在这里：

| 目标 | 函数 | 例子（`/zh/settings/billing.html`） |
|---|---|---|
| 页面链接（留在当前语言） | `u()` / `R()` | `u('settings/payments.html')` → `../settings/payments.html` → `/zh/settings/payments.html` |
| 静态资源（在站点根） | `a()` / `RA()` / `au()` | `a('assets/css/style.css')` → `../../assets/css/style.css` → `/assets/css/style.css` |

`R()` 只按页内层级往回到**语言根**，`RA()` 再多退一级到**站点根**。两者混用会导致两种典型故障：

- 用 `u()` 引资源 → 中文页的 CSS/图片 404（页面变成裸 HTML）
- 用 `RA()` 引页面 → 中文站点击导航跳到英文站

构建后用这条命令可以一次性验证 148 个页面的链接和资源：

```bash
python3 - <<'PY'
import os,re,glob
from urllib.parse import urlparse,unquote
tag=re.compile(r'<(a|link|img|script)\b[^>]*>',re.I); attr=re.compile(r'(href|src)="([^"]+)"')
miss=[]
for f in glob.glob('**/*.html',recursive=True):
    d=os.path.dirname(f)
    for t in tag.finditer(open(f,encoding='utf-8').read()):
        for m in attr.finditer(t.group(0)):
            h=m.group(2)
            if h.startswith(('http','mailto:','javascript:','#')): continue
            p=unquote(urlparse(h).path)
            if p and not os.path.exists(os.path.normpath(os.path.join(d,p))): miss.append((f,h))
print('失效:',len(miss)); [print(' ',x) for x in miss[:10]]
PY
```


---

## 8. 线上发布

| 项 | 值 |
|---|---|
| 分享链接 | https://repostgone.apps.workbuddy.host/?sharecode=P3JHPXA67X |
| 形态 | `http-service`（`python3 serve.py`，读 `$PORT`） |
| 访问门禁 | 首次带 `?sharecode=` 打开会下发 `__wb_rsc` Cookie（30 天），之后站内跳转与资源加载正常 |
| 热态首屏 | 0.6–0.7s（TTFB 322ms），14 个页面 0 console error / 0 4xx |

线上验收结果（Chrome，1440×900）：

- 首页 / 工具列表 / 中文首页 / 分类 / 标签 / 周榜 / 最新收录 / 提交 / 登录 / 我的提交 / 后台 / 工具详情 / 分类详情 / 标签详情 —— 全部正常渲染，0 报错
- 未登录点投票：**停留原页**并弹「Sign in to vote」，不再误跳详情页
- 搜索 `chat` → 7 条结果；周榜 5 个周标签可切换；语言切换 `zh/index.html` 正常


---

## 9. 用户后台（/settings）

目标站 `dir.shipany.site/zh/settings/billing` 需要登录才能看，我注册了一个测试账号进后台，把 8 个页面逐个扒了一遍，按同样的结构复刻。

### 9.1 路由与内容

| 路由 | 页面 | 内容 |
|---|---|---|
| `/settings/` | 概览 | 欢迎语 + 套餐 / 余额 / 工单 三个统计卡 + 最近付款 / 积分变动 两张列表卡 |
| `/settings/submissions` | 我的提交 | 状态表（工具 / 状态 / 提交时间 / 操作），复用原 dashboard 渲染器 |
| `/settings/ads` | 我的广告 | 已付费置顶的广告位 + 续期说明 |
| `/settings/profile` | 个人资料 | 头像上传（≤2MB）+ 姓名 + 邮箱（只读）+ 保存 |
| `/settings/credits` | 积分 | 余额卡 + 全部/获得/消耗 标签 + 8 列流水表 |
| `/settings/billing` | 账单 | 当前订阅卡 + 7 个状态标签 + 9 列表格 + 订阅弹窗 |
| `/settings/payments` | 付款记录 | 4 个类型标签 + 状态下拉 + 8 列表格 + 发票按钮 |
| `/settings/tickets` | 工单支持 | 状态下拉 + 6 列表格 + 提交工单弹窗 |

侧栏按原站分组：**概览 / 活动**（我的提交、我的广告）**/ 账户**（个人资料、积分、账单、付款记录）**/ 内容**（工单支持），底部是「首页」+ 用户信息卡（头像、姓名、邮箱、⋮ 菜单）。

### 9.2 与原站的差异（有意为之）

原站后台依赖真实后端，我们是静态原型，所以：

- 未登录访问任何 `/settings/*` 会在 `<head>` 里被拦截，跳 `sign-in.html?next=<原路径>`，登录后自动回到该页
- 「立即订阅」「购买积分」「提交工单」都是**可用的模拟闭环**：确认后写 localStorage，并同步到概览统计、账单、付款记录
- 订阅会真实产生一条订单（类型=订阅），买积分会产生一条单次购买订单，都能在「付款记录」里看到
- 页面全部 `noindex,nofollow`，且不进 sitemap

### 9.3 几何对齐（1440×900 实测）

| 项 | 原站 | 我们 |
|---|---|---|
| H1 位置 / 字号 | 280, 88 / 24px 700 | 280, 80 / 24px 700 |
| 侧栏宽度 | 240px | 240px |
| 内容区宽度 | 1120px | 1120px |
| 当前订阅卡片 | 448×109 | 448×128 |

### 9.4 验收

- 8 个页面 × 中英 = 16 页，全部 0 console error / 0 4xx
- 完整流程：登录 → 订阅年度 → 账单出现「专业版 · 年度 · $190」→ 概览套餐同步 → 付款记录出现订阅订单 → 筛「单次购买」为空 → 买 5000 积分 → 余额 5,000 且流水 +5,000 → 提工单 → 资料改名后侧栏同步
- 移动端 390px：无横向溢出，侧栏收进抽屉（9 项）
- 全站内链 71 条，死链 0
