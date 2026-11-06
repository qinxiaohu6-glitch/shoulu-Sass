# 03 · API 接口文档

> 基准时间：2026-11-04。全部实现在 `nuxt/server/api/` 与 `nuxt/server/routes/`。
> **上一代文档里列出的 `/api/health`、`/api/reports/recent`、`/api/avatar/<slug>.svg`、`/api/my/submissions/update` 在 Nuxt 版里都不存在**，见 §六。
> `/api/audit` 与 `/api/dr` 已经从 GET 改成 POST（§十一）。

---

## 通用约定

| 项 | 约定 |
|---|---|
| 基础路径 | `/api/*`。**中文站没有 `/zh/api/*` 别名**——所有请求用绝对路径 `/api/...`，不要拼页面相对路径 |
| 响应格式 | JSON。成功一律 `{ ok: true, ... }`，失败 `{ ok: false, reason: "<机器可读码>", ... }` |
| 错误文案 | 提交类接口额外带 `message_zh` / `message_en`，由服务端决定，前端直接显示 |
| 认证 | `atlas_session` cookie（Google 登录后写入，30 天）。后台接口另需 `atlas_admin` cookie |
| 缓存 | 所有动态接口返回 `cache-control: no-store` |
| 方法 | 只读用 GET，写入用 POST。没有 PUT / PATCH / DELETE |
| 时间 | 响应里的 `created_at` / `updated_at` / `paid_at` 是**整数 Unix 秒**；广告的 `start` / `end` 是 `YYYY-MM-DD` |

### 未授权时为什么是 404 而不是 403

`/api/admin/*` 在缺少有效 cookie 时返回 **404**，body 与「路由不存在」无法区分。403 等于向扫描器确认「这个路径存在，只是你没权限」，等于把攻击面标出来。

---

## 一、公开 GET

### 1. `GET /api/me`

当前登录者，或 `null`。

```json
{ "ok": true, "user": { "email": "a@b.com", "name": "Ada", "picture": "https://…" } }
{ "ok": true, "user": null }
```

- 未登录返回 **200 + `user: null`**，不是 401。前端把「还没查」和「没登录」当同一件事，首屏因此不需要第二次往返。
- **不返回 `sub`。** 它是 `submissions.owner_sub` 的写入键，页面用不到一个稳定的身份标识。

### 2. `GET /api/tools`

**已上线**的社区提交，形状是 catalog 的 `Tool`。精选的 30 个不在这里（构建期静态 import，不需要往返）。

```json
{ "ok": true, "tools": [ { "slug": "acme", "name_en": "Acme", "…": "…" } ] }
```

- 数据库故障 → **503 + `{ ok: false, tools: [] }`**。页面因此降级成「只有精选目录」，仍是完整可用的目录。
- 运营 `hidden` 的条目在服务端就被过滤掉，页面不用各自再过滤。

### 3. `GET /api/tools/:slug`

一条**提交来的**收录。

```json
{ "ok": true, "tool": { "slug": "acme", "name_en": "Acme", "votes_week": 3, "…": "…" } }
```

| 状态 | 含义 |
|---|---|
| 200 | 已上线 |
| 404 | 不存在 / pending / rejected / 付费但未付款 —— **四者不可区分**，这是刻意的：能区分就等于泄露审核队列 |
| 410 | 存在但被运营下架（`tool_overrides.hidden = 1`） |

`410` 的判断在「是否公开」之后，所以 pending 记录无法被探测。

### 4. `GET /api/votes?week=YYYY-Www`

某一周的票数。`week` 省略时用当前 ISO 周。

```json
{ "ok": true, "week": "2026-W45", "counts": { "claude": 12, "acme": 3 } }
```

`week` 格式不对 → `400 { ok: false, reason: "bad_week" }`。

### 5. `GET /api/board`

cron 归档过的**最新一周**，形状是 catalog 的 `Week`。

```json
{ "ok": true, "week": { "id": "2026-W44", "start": "2026-10-26", "end": "2026-11-01", "ranking": [ … ] } }
{ "ok": true, "week": null }
```

`null` 是全新安装的正常答案，页面回落到 catalog 里的历史周。

### 6. `GET /api/ads`

两个位置各自当前展示的那一条。

```json
{
  "ok": true,
  "board":   { "id": "ad-20261104-1a2b", "slot": "board",   "name": "…", "headline": "…", "url": "…", "logo": "…", "start": "2026-11-02", "end": "2026-11-08", "note": "…" },
  "sidebar": null
}
```

- 一个位置只有一条（先订的赢），没有就是 `null`，页面**整块不渲染**——不画空框。
- 数据库出错 → `{ ok: false, board: null, sidebar: null }`，**200 不 500**：少一条广告是少一条广告，500 会把整个首页带走。

### 7. `GET /api/overrides`

运营开关的公开视图。

```json
{ "ok": true, "pinned": { "claude": "2026-11-20", "acme": "" }, "hidden": ["spam-tool"] }
```

- `pinned` 的值是置顶最后一天，`""` 表示「一直到关掉为止」。
- 出错 → `{ ok: false, pinned: {}, hidden: [] }`。降级方向是安全的：置顶加载失败只是少了置顶，下架加载失败是「照常显示」而不是把页面变成 410。

---

## 二、公开 POST

### 8. `POST /api/fetch-meta`

用网址预填提交表单。

```jsonc
// 请求
{ "url": "https://acme.com" }

// 成功
{ "ok": true, "name": "Acme — AI analytics", "short": "…", "logo": "https://acme.com/apple-touch-icon.png" }
```

| 状态 | `error` | 触发 |
|---|---|---|
| 400 | `empty_url` | 没传 url |
| 400 | `invalid_url` | 不是 http(s)，或域名是内网/环回/云元数据地址 |
| 502 | `upstream_error` | 目标返回非 2xx |
| 502 | `fetch_failed` | 超时（5s）、DNS 失败、连接被拒 |

提取顺序：`og:title` → `twitter:title` → `<title>`；描述取 `og:description` → `description` → `twitter:description`；图标取 `apple-touch-icon` → `rel=icon` → `/favicon.ico`。名称截 60 字，描述截 200 字。

**这是一个 SSRF 面，不是一个便利功能。** 拒绝名单见 02 文档 §9。

### 9. `POST /api/submit`

提交产品。**唯一的公开写入口。**

```jsonc
{
  "url": "https://acme.com",        // 或 website，二选一，后者是第二步里可编辑的副本
  "name": "Acme",                   // 2–60
  "short": "AI analytics for …",    // 20–200，不能含链接
  "long": "…",                      // 120–4000，可选
  "category": "coding",             // 必须是 catalog 里的 slug
  "tags": ["api", "agent"],         // slug 或英文名都行，最多 4 个，未知值静默丢弃
  "email": "you@example.com",       // 可选，但没它收不到任何通知
  "logo": "https://…",              // 可选，非 http(s) 会被清空
  "maker": "Acme Inc",              // 可选，≤60
  "plan": "free",                   // free | standard | featured | pro | ad
  "slot": "board"                   // 仅 plan=ad 时有效：board | sidebar
}
```

**成功 201：**

```json
{
  "ok": true,
  "id": "s_3f9a2c1b",
  "slug": "acme",
  "name": "Acme",
  "url": "https://acme.com",
  "domain": "acme.com",
  "short": "…",
  "category": "coding",
  "plan": "free",
  "slot": "",
  "status": "pending",
  "awaiting_payment": false,
  "created_at": 1762300000,
  "updated_at": 1762300000,
  "next": "review"
}
```

`next` 告诉表单显示哪个屏幕：`review`（免费档，进审核队列）或 `paid`（付费档，等站长确认收款）。

**响应里没有的东西，是刻意没有的：** `email`、`ip_hash`、`notes`、`paid_at`、`payment_ref`。

**失败：**

| 状态 | `reason` | 含义 |
|---|---|---|
| 400 | `invalid_url` | 网址不合法 |
| 400 | `required` | 必填项为空 |
| 400 | `too_short` | 太短 |
| 400 | `no_links` | 简介里带了链接 |
| 400 | `bad_category` | 分类不在目录里 |
| 400 | `bad_email` | 邮箱格式不对 |
| 409 | `already_listed` | 该域名已在**精选目录**里 |
| 409 | `duplicate` | 该域名已有 pending/approved 的提交 |
| 429 | `rate_limited` | 超配额（每小时 5 次 / 每天 20 次，按 IP 哈希） |
| 503 | `closed` | 总量达上限（20,000） |
| 500 | `internal_error` | 服务端异常 |

每个错误都带 `field`（哪个字段）与中英双语 `message_*`。

### 10. `POST /api/vote`

给一条收录投一票，每人每产品每 ISO 周一票。

```jsonc
{ "slug": "claude", "week": "2026-W45" }   // week 可选，格式不对时用当前周
```

```json
{ "ok": true, "week": "2026-W45", "slug": "claude", "counts": { "claude": 13 }, "accepted": true, "votes": 13 }
```

| 状态 | `reason` | 触发 |
|---|---|---|
| 401 | `signin_required` | 没登录。**这是刻意的**：榜单承诺「登录用户投票」，匿名接口按一次 F5 就能刷 |
| 400 | `bad_payload` | body 不是对象 |
| 400 | `bad_slug` | slug 格式不对（`^[a-z0-9][a-z0-9-]{0,63}$`） |
| 503 | `service_unavailable` | 数据库故障 |

重复投票不报错：`accepted: false`，票数不变。并发靠 `INSERT OR IGNORE` 的复合主键。

---

## 三、需要登录的 GET

### 11. `GET /api/my/submissions`

这个账号提交过的全部条目，`created_at DESC`。

```json
{
  "ok": true,
  "items": [
    {
      "id": "s_3f9a2c1b", "slug": "acme", "name": "Acme", "url": "https://acme.com",
      "domain": "acme.com", "short": "…", "category": "coding",
      "plan": "standard", "slot": "", "status": "approved",
      "awaiting_payment": false,
      "created_at": 1762300000, "updated_at": 1762300000,
      "paid_at": 1762300500, "payment_ref": "INV-2026-0007"
    }
  ]
}
```

- 未登录返回 **200 + `items: []`**，不是 401。设置页已经把未登录访客转走了，401 只可能被「慢 cookie 与重定向赛跑」撞到，而「你还没是谁」的诚实答案是空列表。
- 比 `/api/submit` 的响应多 `paid_at` 与 `payment_ref`：这两个字段是关于钱的，只在这个**所有者形状**里出现。

---

## 四、后台接口（全部需要 `atlas_admin` cookie）

未授权一律 **404**。

### 12. `GET /api/admin/submissions?status=pending`

审核队列。`status` 可选 `pending` / `approved` / `rejected`，省略则全部；上限 200 条（最大 500）。

```json
{
  "ok": true,
  "items": [
    {
      "id": "s_3f9a2c1b", "slug": "acme", "name": "Acme", "url": "https://acme.com",
      "domain": "acme.com", "short": "…", "category": "coding", "tags": ["API"],
      "plan": "standard", "slot": "", "status": "pending",
      "awaiting_payment": true, "paid_at": null,
      "created_at": 1762300000, "updated_at": 1762300000,
      "email": "you@example.com", "maker": "Acme Inc",
      "notes": "", "logo": "https://…", "long_desc": "…"
    }
  ],
  "stats": { "total": 41, "pending": 7, "approved": 30, "rejected": 4, "awaiting_payment": 2 }
}
```

- 比公开形状多 `email` / `maker` / `tags` / `notes` / `logo` / `long_desc` —— 拒绝时要能解释给提交者听，所以这个接口对任何没有令牌的人答 404。
- `stats.approved` 只算**真的公开**的（付费档必须有 `paid_at`），和详情页同一把尺子。

### 13. `POST /api/admin/review`

```jsonc
{ "id": "s_3f9a2c1b", "action": "approve", "notes": "", "ref": "" }
```

三个动作：

| action | 效果 | 约束 |
|---|---|---|
| `approve` | `status = approved`，立刻可访问 | **付费档且 `paid_at` 为空 → 409 `payment_required`** |
| `reject` | `status = rejected`，记录保留 | 拒绝后同域名仍不能重复提交 |
| `payment` | 写 `paid_at` / `payment_ref`，`status = approved`，`awaiting_payment = 0` | 唯一能跳过编辑判断的上线路径 |

成功：`{ ok: true, item: <adminRecord> }`。同时发对应邮件（通过 / 拒绝 / 收款确认）。

| 状态 | `reason` |
|---|---|
| 404 | `not_found` |
| 409 | `payment_required` |
| 400 | `bad_action` / `bad_payload` |

### 14. `GET /api/admin/ads`

```json
{ "ok": true, "items": [ { "id": "ad-…", "slot": "board", "active": 1, "stopped_at": null, "…": "…" } ],
  "stats": { "total": 9, "live": 2, "board_live": 1, "sidebar_live": 1 } }
```

`items` 是全部历史（含已下架），按 `created_at DESC`。`stats.live` 按**今天**是否在窗口内算。

### 15. `POST /api/admin/ads`

```jsonc
{ "action": "create", "slot": "board", "name": "Acme", "headline": "Ship faster",
  "url": "https://acme.com", "logo": "https://…", "start": "2026-11-02", "end": "2026-11-08",
  "note": "invoice #7" }

{ "action": "update", "id": "ad-20261104-1a2b", "end": "2026-11-15" }   // 只传要改的字段
{ "action": "stop",   "id": "ad-20261104-1a2b" }
```

- `update` 是「读出来 + 合并 + 整体重新校验」，所以只传 `end` 是安全的。
- `stop` 只置 `active = 0` 并记 `stopped_at`，**不删行**——发票是照这些日期开的，删掉就没得对账。

| 状态 | `reason` |
|---|---|
| 400 | `bad_slot` / `bad_date` / `bad_url` / `too_short` / `too_long` / `end_before_start` / `bad_action` / `bad_payload` |
| 404 | `not_found` |

### 16. `GET /api/admin/overrides`

```json
{ "ok": true,
  "items": [ { "slug": "claude", "pin": 1, "pin_until": "2026-11-20", "hidden": 0, "updated_at": 1762300000 } ],
  "state": { "pinned": { "claude": "2026-11-20" }, "hidden": [] } }
```

`items` 带时间戳给表格显示「上次改动」；`state` 是页面消费的形状，两者同源，所以后台和站点不会对「置顶是什么意思」产生分歧。

### 17. `POST /api/admin/overrides`

```jsonc
{ "slug": "claude", "key": "pin",    "value": true,  "until": "2026-11-20" }
{ "slug": "spam",   "key": "hidden", "value": true }
```

- `until` 只对 `pin` 有意义，空表示「一直到关掉」。
- 两个开关都变成 false 时**删行**。

成功：`{ ok: true, row: <行或 null>, state: <整个 state> }` —— 一次请求让后台面板和站点页面同时对齐。

| 状态 | `reason` |
|---|---|
| 400 | `bad_slug` / `bad_key` / `bad_date` |

### 18. `POST /api/admin/archive`

手动跑一次周一归档。

```jsonc
{ "week": "2026-W44" }   // 可省略，默认刚结束的那一周
```

```json
{ "ok": true, "week": "2026-W44", "rows": 18 }
```

`rows: 0` 是正常的（那周没人投票）。幂等：同一周重跑是「先删该周再插」。

`week` 格式不对 → `400 { ok: false, reason: "bad_week" }`。

---

## 五、非 `/api` 路由

### OAuth

| 端点 | 行为 |
|---|---|
| `GET /auth/google/start?next=<路径>` | 生成 nonce + 签名 state cookie（10 分钟），302 到 Google。未配置 client → `302 /sign-in?auth=unconfigured` |
| `GET /auth/google/callback?code=…&state=…` | 校验 state cookie（nonce 匹配 + 未过期）→ 换 token → 校验 `aud`/`iss`/`exp`/`email_verified` → 写 `atlas_session` → 302 回 `next`。失败 → `302 /sign-in?auth=failed&why=<reason>` |
| `GET /auth/logout?next=<路径>` | 清 `atlas_session`，302 回 `next`（`safeTarget` 校验，外站回落 `/`） |

`why` 的取值：`bad_code`（code 过期/重放）、`bad_client`（secret 错）、`redirect_mismatch`（回调地址没在 Google Console 注册）、`network`（没连上 Google）、`audience_mismatch`、`issuer_mismatch`、`token_expired`、`email_unverified`、`no_id_token`、`bad_id_token`。**这个区分是配置阶段唯一的诊断线索。**

### SEO

| 端点 | Content-Type | 说明 |
|---|---|---|
| `GET /sitemap.xml` | `application/xml` | 每个页面两个 `<url>`（en + zh），各自带完整 `hreflang` 三件套（en / zh-Hans / x-default）。含已上线提交，排除 hidden。数据库读失败时只用静态目录 |
| `GET /robots.txt` | `text/plain` | `Disallow: /api/`、`/admin`、`/settings`、`/dashboard` |
| `GET /llms.txt` | `text/markdown` | 30 个产品 + 8 个分类 + 主要页面，一行一条 |

### 中间件副作用（不是接口，但会改变响应）

| 请求 | 结果 |
|---|---|
| `http://dirtool.com/*` | 301（GET/HEAD）或 308（其他）到 `https://dirtool.com/*` |
| `https://www.dirtool.com/*` | 301/308 到 apex，路径与查询串保留 |
| `*.workers.dev`、预览子域 | 200 + `x-robots-tag: noindex, nofollow` |
| `/pricing.html`、`/tools/claude.html` 等旧 URL | 301 到无后缀路径，查询串保留 |
| `/dashboard(.html)` | 301 到 `/settings/submissions`（中文 `/zh/settings/submissions`），**单跳** |
| `/admin?token=<正确令牌>` | 种 `atlas_admin` cookie，302 到 `/admin`（token 从 URL 消失） |
| `/admin`（无有效 cookie） | **404** |

---

## 六、Nuxt 版里不存在的接口

上一代文档列过这些，容易误以为还在：

| 旧接口 | 现状 |
|---|---|
| `GET /api/health` | 没有。要探活就用 `GET /` |
| `GET /api/audit?url=…` | 已实现，但改成了 **`POST /api/audit`**（见 §十一 #38）。旧站用 GET，因为它是 Python 单进程；这里要带 `lang` 并接受 `{ url }` 体，GET 会把网址塞进日志和 Referer |
| `GET /api/dr?domain=…` | 已实现，改成 **`POST /api/dr`**（见 §十一 #39） |
| `GET /api/reports/recent` | 没有。报告功能整体没移植 |
| `GET /api/avatar/<slug>.svg` | 没有。头像走 `ToolLogo.vue`（首字母 + 稳定色相）与 Google 头像 URL |
| `POST /api/my/submissions/update` | **没有实现**。用户暂时不能自己编辑已上线的提交 |
| `/api/admin/tool` | 改名为 `/api/admin/overrides` |
| `/zh/api/*` 别名 | 没有，也不需要——前端全部用绝对路径 |

---

## 七、目录后台（`/api/admin/directory/*`，需要 `atlas_admin` cookie）

后台四页共用一套接口。鉴权失败一律 404，理由同 §0。

### 19. `GET /api/admin/directory`

一次取齐工具 / 分类 / 标签 / 合集。四个页面共用一个 `useAsyncData` key，
数据量是 30 + 8 + 15 条，拆开只会多三次往返。

```json
{
  "ok": true,
  "tools": [{ "tool": { "slug": "chatgpt", "…": "…" }, "source": "db" }],
  "categories": [{ "slug": "coding", "sort": 0, "status": "published", "…": "…" }],
  "tags": [{ "slug": "api", "sort": 0, "…": "…" }],
  "collections": [],
  "stats": { "tools": 30, "categories": 8, "tags": 15, "collections": 0,
             "featured": 8, "paid": 5, "unpublished": 0, "overrides": 30 }
}
```

`source`：`db` = 有人改过，`catalog` = 仍来自 `catalog.json`。

### 20. `POST /api/admin/directory/tool`

```json
{ "action": "save", "tool": { "slug": "chatgpt", "name_en": "…", "detail_en": { } } }
{ "action": "delete", "tool": { "slug": "chatgpt" } }
```

写整个对象，不是 patch——patch 分不清「清空这一栏」和「没提到这一栏」。
`slug` 建后不可改（它同时是网址）。缺两种语言的名称会 400。

### 21. `POST /api/admin/directory/taxonomy`

分类与标签共用，`kind` 决定写哪张表。

```json
{ "kind": "category", "action": "save",   "item": { "slug": "coding", "icon": "code", "sort": 0, "status": "published", "name_en": "…", "name_zh": "…", "desc_en": "…", "desc_zh": "…" } }
{ "kind": "category", "action": "delete", "item": { "slug": "writing" } }
{ "kind": "tag",      "action": "save",   "item": { "slug": "api", "sort": 0, "name_en": "…", "name_zh": "…" } }
```

- 分类的 `delete` 是**写墓碑** `status='deleted'`，不是真删——内置目录里还有它，
  真删会被下一次读取复活。保存一次即恢复。
- 内置标签 `delete` 返回 **400**：标签是条目自带的词，删掉行只会让标签页出现
  一个没有名字的标题。改名字即可。

### 22. `POST /api/admin/directory/collection`

```json
{ "action": "save", "item": { "slug": "video-starters", "status": "published",
  "name_en": "…", "name_zh": "…", "desc_en": "…", "desc_zh": "…",
  "icon": "sparkles", "cover": "", "sort": 0,
  "tools": ["runway", "pika", "heygen"] } }
```

成员按**整条序列**替换（顺序就是功能本身）。未知 slug 和重复 slug 会被丢弃，
响应里的 `dropped` 是丢弃条数。

「未知」的判据是**这个 slug 是不是一条真实收录**（库 ∪ `catalog.json`），不是
「`dir_tool` 表里有没有行」。后者只在 seeder 跑过之后才成立，用它会让一个刚部署的库
悄悄存不进任何成员——接口仍回 `ok: true`，只是成员全被丢掉。

`status: "draft"` 的合集不对外：公开接口和 sitemap 里都没有，详情页 404。

---

## 八、支付（`/api/payments/*`）

> 接口已预留，**未接入真实支付平台**。详见 `docs/08-在线支付接入.md`。

### 23. `GET /api/payments/config`

公开。前端据此决定要不要显示付款按钮。

```json
{ "ok": true, "ready": false, "provider": null, "requested": null, "currency": "usd" }
```

`requested` 是配置里写的平台名，`ready` 是「密钥齐了没有」。
两者分开，后台才能提示「你配了 Stripe 但缺密钥」。

### 24. `POST /api/payments/checkout`

```json
{ "submission_id": "s_7411d744" }
```

请求体里**只有 id**。金额、币种、描述全部服务端读，客户端说不了价。

| 状态 | 含义 |
|---|---|
| 200 | `{ ok: true, order: "po_…", url: "https://checkout.stripe.com/…" }` |
| 409 `unconfigured` | 没接支付平台，走人工收款 |
| 409 `already_paid` | 这条已经付过 |
| 409 `nothing_to_pay` | 免费档，没有费用 |
| 502 `provider_error` | 平台没响应；订单已标 `failed`，`note` 里有平台原话 |

### 25. `POST /api/payments/webhook`

支付平台回调。**未配置时返回 404**（同后台接口）。

- 验签失败 / 时间戳超出 ±5 分钟 → 400 `bad_signature`
- 金额或币种对不上 → 200 `ignored:amount_mismatch`，订单标 `failed`，**不上线**
- 同一事件投第二次 → 200 `duplicate:true`，不重复上线
- 正常 → 200 `{ ok: true, status: "paid", order: "po_…" }`

订阅事件：`checkout.session.completed` / `checkout.session.expired` /
`checkout.session.async_payment_failed` / `charge.refunded`。

### 26. `GET /api/payments/order/:id`

回跳页查状态。订单号本身就是凭证（96 位随机），只回订单状态和对应的产品，
不回邮箱、地址、平台会话号。

### 27. `GET /api/admin/orders`

后台订单列表，附带接入状态（`requested` / `key_present` / `webhook_present`）。
密钥本身永不回显。

---

## 九、目录元数据

### 28. `GET /api/directory/meta`

分类、标签、合集三张表一次读齐。**公开接口**，不需要任何 cookie。

```json
{
  "ok": true,
  "categories": [
    { "slug": "coding", "icon": "code", "count": 6,
      "name_en": "Developer Tools", "name_zh": "开发工具",
      "desc_en": "Editors, coding agents and app builders.", "desc_zh": "编辑器、编程智能体与应用构建工具。",
      "status": "published", "sort": 1 }
  ],
  "tags": [
    { "slug": "api", "count": 6, "name_en": "API", "name_zh": "API", "sort": 0 }
  ],
  "collections": [
    { "slug": "best-coding", "icon": "code", "cover": "", "sort": 0, "status": "published",
      "name_en": "Best coding tools", "name_zh": "最好用的编程工具",
      "desc_en": "", "desc_zh": "", "tools": ["cursor", "claude"] }
  ]
}
```

**为什么有这个接口**：分类名和标签名原本是构建时的常量，后台改了名没人读。现在每个
页面渲染前由 `plugins/directory-meta.server.ts` 调一次，塞进 SSR payload，页面用
`useDirectoryMeta()` 同步取——所以它的大小会被每一页承担（当前约 3KB）。

| 项 | 说明 |
|---|---|
| 数据来源 | 库优先、`catalog.json` 兜底。三张表都没有行时，返回的就是 catalog 原样 |
| `count` | **派生值**，不落库：按当前收录条数现算，标签计数走 `slugify` 归一 |
| 墓碑 | `status: "deleted"` 的分类**不在**返回里（后台接口才带）。所以删掉分类后它自己的页面会 404 |
| 合集 | 没有 catalog 兜底：合集是编辑动作，空表就是空列表，不是「回落到内置」。**`status: "draft"` 的不返回**——草稿对外等于不存在 |
| 缓存 | `public, max-age=0, s-maxage=30`。注意 SSR 走的是内部 `useRequestFetch`，**不经过边缘缓存**，这条头只对直接调用方有用 |
| 失败 | 表不存在 / 查询异常时返回 catalog，不返回 5xx——目录是完整的，不该因为分类名读不到而白屏 |

---

## 十、工单

工单是**一条线程**，不是一条表单记录。所有接口都 `cache-control: no-store`。

用户侧接口用 `atlas_session` cookie（Google 登录态）；后台接口用 `atlas_admin`
cookie，**没带就返回 404**，与「没有这个路由」无法区分。

### 状态

| 值 | 含义 | 谁写 |
|---|---|---|
| `open` | 用户最后说话，等我们 | 自动（`addMessage` 按 role） |
| `replied` | 我们最后说话，等用户 | 自动 |
| `closed` | 已关闭 | 人 |

`closed` 是硬约束：**双方都不能再写入**，回复返回 409。要继续沟通必须先改回 `open`。

### 29. `GET /api/tickets`

自己的工单，`updated_at DESC`。未登录返回空列表而不是 401（设置页的登录跳转可能
正在和慢 cookie 抢跑）。

| 参数 | 说明 |
|---|---|
| `status` | `open` / `replied` / `closed`，其它值忽略 |
| `keyword` | 匹配标题，`LIKE` 已转义（`%` / `_` 按字面处理） |
| `limit` / `offset` | 默认 20 / 0，`limit` 上限 100 |

```json
{ "ok": true,
  "items": [
    { "id": "t_394f9b8d453dba417d388fd6", "title": "Logo is wrong on my listing",
      "status": "replied", "created_at": 1793859534, "updated_at": 1793859586,
      "latest_reply": "Fixed — the new logo is live now." } ],
  "total": 1 }
```

`latest_reply` 是**最后一条管理员回复**（整页一次查询，不是每行一次）。
`user_sub` / `user_email` 不出现在响应里。

### 30. `POST /api/tickets`

```json
{ "title": "…", "content": "…", "attachments": ["https://…/shot.png"] }
```

| 项 | 限制 |
|---|---|
| `title` | 必填，≤200 |
| `content` | 必填，≤5000 |
| `attachments` | 可选，≤9 个；每个 ≤2048 字符，且必须是 `/` 开头或 `http(s)://` |
| 频率 | 同账号 30 秒内只能建一张 |

成功 **201**，返回 `{ ok, ticket }`。失败返回
`{ ok:false, reason, field, message_zh, message_en }`，`reason` 取值：
`signin_required`(401) / `bad_payload`(400) / `required`(400) / `too_long`(400) /
`bad_attachments`(400) / `ticket_rate_limited`(429) / `internal_error`(500)。

### 31. `GET /api/tickets/:id`

`{ ok, ticket, messages: [{ id, role, author, content, attachments, created_at }] }`，
`attachments` 已解析成数组，按时间正序。

别人的工单返回 **404**（不是 403）。

### 32. `POST /api/tickets/:id`

用户回复。`{ content, attachments }`，校验同上。写入后状态回到 `open`。
工单已关闭 → **409** `ticket_closed`。

### 33. `PATCH /api/tickets/:id`

只接受 `{ "status": "closed" }`，其它值 **400** `bad_action`。
重新打开不在这里做——回复本身就等于重开。

### 34. `GET /api/admin/tickets`

```json
{ "ok": true, "items": [ … ], "total": 4,
  "stats": { "total": 4, "open": 1, "replied": 2, "closed": 1 } }
```

`items` 比用户侧多 `user_email` / `user_name`。`keyword` 同时匹配标题、邮箱、名字、工单号。
`stats` 走 `GROUP BY status`，**与筛选条件无关**（永远是全局计数）。

### 35. `GET /api/admin/tickets/:id`

同 31，多 `user_email` / `user_name`，没有归属校验。

### 36. `POST /api/admin/tickets/:id`

管理员回复。`author` 存空字符串而不是 `Admin`——后台是一个共享 token，不是账号，
一个没人选过的名字读起来像一个不存在的人。页面渲染的是角色，不是这个字段。

写入成功后给工单作者发邮件（未配置邮件则跳过）。**邮件只通知「有回复了」，不带正文。**

### 37. `PATCH /api/admin/tickets/:id`

接受 `open` / `replied` / `closed`。页面只用 `closed` 和 `open`（关闭 / 重新打开）；
`replied` 由回复动作产生，手动设置只会让状态和线程最后一条消息对不上。

### 错误响应形状

用户侧接口统一：

```json
{ "ok": false, "reason": "ticket_closed", "field": null,
  "message_zh": "这个工单已经关闭了，需要继续沟通请新建一个。",
  "message_en": "This ticket is closed. Open a new one if you need more help." }
```

后台接口用 h3 的 `createError`，响应体带 `statusCode` / `statusMessage`，
页面读 `statusMessage` 显示。两种形状并存是历史原因：后台接口从一开始就走 h3 错误。

---

## 十一、SEO 诊断

两个接口都不需要登录，也**都不写库**：`/seo-check` 在 FAQ 里承诺「不存进数据库，刷新就没了」，所以连 IP 都不落表——限流只活在进程内存里。

### 38. `POST /api/audit`

抓取一个公开页面，跑 28 项检查，5 组各 20 分，满分 100。

```json
{ "url": "https://your-product.com", "lang": "zh" }
```

`url` 可以不带协议（会补 `https://`）。`lang` 只影响 `label` / `detail` / `fix` 的语言，`id` / `group` / `status` 与语言无关。

响应（200）：

```json
{
  "ok": true,
  "rubric": 2,
  "url": "nuxt.com",
  "final_url": "https://nuxt.com/",
  "status": 200,
  "score": 99,
  "grade": "A",
  "groups": [
    { "key": "meta", "label_zh": "标题与描述", "label_en": "Title & description", "score": 20, "max": 20, "count": 4 },
    { "key": "ai",   "label_zh": "AI 可读性",   "label_en": "AI readability",     "score": 19, "max": 20, "count": 7 }
  ],
  "checks": [{ "id": "title", "group": "meta", "label": "Title 标签", "status": "pass", "detail": "34 字符：…", "fix": "" }],
  "summary": { "pass": 27, "warn": 1, "fail": 0 },
  "title": "Nuxt: The Full-Stack Vue Framework",
  "facts": { "words": 1018, "h1_count": 1, "h2_count": 9, "jsonld_blocks": 1, "blocked_ai_crawlers": "", "checked_at": 1793863949 }
}
```

- 28 个 check 的 id 与顺序固定，按组排列：
  - `meta`（4）：`title, desc, og, twitter`
  - `schema`（4）：`jsonld, schema_type, schema_required, schema_deprecated`
  - `ai`（7）：`h1, semantic, text, llms, ai_crawlers, qa_headings, authority`
  - `crawl`（7）：`noindex, canonical, robots, sitemap, https, lang, hreflang`
  - `content`（6）：`wordcount, h2, alt, internal, img_dims, list_table`
- **`rubric` 是评分口径版本号**。检查项一变就 +1，两版分数不可直接比较。当前 `2`；`1` 是旧的 20 项版本。页面把它印在明细区页脚（`评分口径 v2 · 共 28 项检查`），这样一张「84 B」的截图不会跟另一张不同口径的截图被拿来比
- 打分：`pass=1 / warn=0.5 / fail=0`，每组 `round(得分 ÷ 项数 × 20)`，五组合计 100。**先折算再相加**，所以项数多的组（`ai` / `crawl` 各 7 项）不会因为项多就比 4 项的 `meta` 占更多分
- 等级：A ≥ 90、B ≥ 75、C ≥ 60、D ≥ 40，其余 E
- `facts` 是原始测量值，和 `label` 分开存——以后要做报告页或收录门槛，读这里，不要去解析文案
- `jsonld` 会跟进 `@graph`：绝大多数框架把 WebSite / WebPage / Organization 塞在一个 `@graph` 数组里，只看顶层会误报「没有 schema 类型」
- `ai_crawlers` 只认**AI 搜索**爬虫（`OAI-SearchBot` / `Claude-SearchBot` / `PerplexityBot`）。训练爬虫（`GPTBot` / `ClaudeBot` / `CCBot` / `Applebot-Extended`）挡了不影响这项——它们决定「能不能被训练」，不决定「能不能被引用」。命中的爬虫名写在 `facts.blocked_ai_crawlers`。`robots.txt` 返回 404 时记 `pass`（没有文件 = 什么都没挡），缺文件由 `robots` 检查单独记；只有 200 以外的其它状态（403 / 5xx / 超时）才记 `warn`，因为那时可能真挡了但读不到
- `schema_required` 按类型查必填字段（`Product` 要 `name` + `image` + `offers`，`Article` 要 `headline` + `author` + `datePublished` 等）；`schema_deprecated` 查已弃用类型（`HowTo`、`SpecialAnnouncement`、`CourseInfo`、`EstimatedSalary`、`LearningVideo`、`ClaimReview`、`VehicleListing`、`PracticeProblem`）
- `hreflang` 只在页面**声明过** alternates 时才判；单语言页面没声明记 pass，不是 fail
- `img_dims` 封顶 warn：`CSS` 的 `aspect-ratio` 也能预留位置，缺 `width`/`height` 不等于一定抖动
- `authority` 只测 E-E-A-T 里机器可读的那一小块（组织/作者是否具名、是否带链接、页面上有没有 about/contact/team），主观质量不测

失败：

| `reason` | HTTP | 含义 |
|---|---|---|
| `empty_url` | 400 | 没填 |
| `invalid_url` | 400 | 不是 http(s)，或主机名里没有点（`localhost:3000` 走这条） |
| `blocked_host` | 403 | 内网 / 本机地址，含**重定向后**的最终地址 |
| `http_error` | 502 | 目标返回 4xx/5xx，另带 `upstream_status` |
| `unreachable` | 502 | 超时、DNS 失败、被拦 |
| `rate_limited` | 429 | 同 IP 每分钟 20 次 |
| `internal_error` | 500 | 我们自己的 bug |

失败体统一带 `message_zh` / `message_en`，页面直接显示。

三次 SSRF 防护（详见 `server/utils/audit.ts` 头部注释）：只允许 http(s)、拒绝私网字面量、重定向后**再查一遍**最终地址。Workers 没有 socket 也没有 DNS 解析，所以这一层是字面量检查；真正兜底的是 Workers 的出口到不了私网。

### 39. `POST /api/dr`

```json
{ "domain": "your-product.com" }
```

**四种状态都返回 200**，因为它们是答案，不是错误：

```json
{ "ok": true, "domain": "…", "provider": "ahrefs", "metric": "DR", "value": 42, "rank": 1284, "checked_at": 1793861271, "cached": false }
{ "ok": false, "reason": "provider_error", "detail": "ahrefs: Error" }
{ "ok": false, "reason": "not_configured", "providers": ["ahrefs", "openpagerank"] }
{ "ok": false, "reason": "invalid_domain" }
```

- 数据源：`NUXT_AHREFS_TOKEN` → DR（0–100）；`NUXT_OPENPAGERANK_KEY` → PR（0–10）
- `metric` 必须跟 `value` 一起读：**PR 不是 DR**。页面按 `metric` 决定标签，绝不把 PR 当 DR 显示
- 两个都没配就是 `not_configured`——这是当前线上状态，页面如实说「读不到」，并给官方免费查询入口，不编数字
- **没有缓存**。旧站用 `data/dr-cache.json` 存 24h，Workers 没有文件系统。接真实数据源之前应先补一张 D1 缓存表，否则每次点击都在烧 API 配额
