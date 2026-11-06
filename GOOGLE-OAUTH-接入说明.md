# Google OAuth 接入说明

代码已经写完，整条链路在本地用一个桩身份提供方验证过（start → authorize → callback → 会话 → 提交归属 → 退出）。
**2026-11-05 已在生产跑通**：客户端、两个 secret、回调地址三件事全部落地，实测能登录。下面的步骤留作**换域名或重建时**的参照，不是待办。

> 现行实现：`nuxt/server/utils/oauth.ts` + `nuxt/server/routes/auth/*`
> 旧实现（`auth.py`）已归档到 `legacy/`，只读，不要参照。

---

## 一、已经实现的部分

| 端点 | 作用 |
|---|---|
| `GET /auth/google/start?next=<路径>` | 生成 CSRF nonce，写进**签名 state cookie**（10 分钟），302 到 Google 授权页 |
| `GET /auth/google/callback` | 校验 state cookie（nonce 匹配 + 未过期）→ 用 code 换 token → 校验 id_token → 写会话 cookie → 302 回 `next` |
| `GET /auth/logout?next=<路径>` | 清会话 cookie 并跳回 |
| `GET /api/me` | 当前登录者 `{email, name, picture}`，未登录返回 `null` |

设计上的三个要点：

1. **没有用户表。** 会话是 HMAC-SHA256 签名的自包含 cookie（`atlas_session`，30 天，`HttpOnly; Secure; SameSite=Lax`），签名密钥是 Worker secret `NUXT_SESSION_SECRET`。重新部署不会让所有人掉线，也没有数据库要迁移。
2. **登录后去向存在签名 cookie 里，不在 URL 里**（cookie 名 `atlas_oauth`）。这样改查询串无法把它变成开放重定向。`safeTarget()` 只放行「以单个 `/` 开头、无 scheme、无反斜杠、无 `..`」的路径——注意 Nuxt 的路由**没有 `.html` 后缀**，旧站那套「必须以 `.html` 结尾」的规则已经不适用。
3. **提交会记到账号名下**（`submissions.owner_sub` / `owner_email`）。登录后提交的条目，换浏览器在「我的提交」里仍然能看到。

id_token 的签名**没有**在本地验：它是在携带 client_secret 的同一次请求里、经 TLS 直接从 Google 的 token 端点拿到的，Google 官方文档说明这种情况无需本地验签。`aud` / `iss` / `exp` / `email_verified` 仍然校验。

**配置缺失时的行为**：`/auth/google/start` 直接 302 到 `/sign-in?auth=unconfigured`，登录页显示「Google 登录还没配置好」。宁可明确说没配好，也不要带着空 `client_id` 去 Google 换一个「invalid_request」页面——那个错误页对访客没有任何可操作信息，而需要修的人是站长。

---

## 二、配置（已落地，留作换域名或重建时的参照）

### 现状速查

| 项 | 值 |
|---|---|
| Google Cloud 项目 | `august-lamp-513303-t9`（控制台显示名「My Project 58854」） |
| 客户端名称 | `product-atlas-web`（Web 应用，2026-10-31 创建） |
| 客户端 ID | `1039163473809-8dupcs9q5lfhotogm3i24c5a2vtthvuu.apps.googleusercontent.com` |
| 已注册的重定向 URI | `https://repostgone.apps.workbuddy.host/auth/google/callback`（旧预览域名，保留）<br>`https://dirtool.com/auth/google/callback`（2026-11-05 新增） |
| Worker secret | `NUXT_GOOGLE_CLIENT_ID`、`NUXT_GOOGLE_CLIENT_SECRET` |

**换域名时只做一件事**：到上面那个客户端的「已获授权的重定向 URI」里**新增** `https://<新域名>/auth/google/callback`，保存即可。旧的不要删，删了老地址立刻登不上。改完几十秒生效，不用重新部署。

> 踩过的坑：`data/google-oauth.json` 里的 `redirect_uri` 是**期望值**，不等于 Google 侧登记的值。当时那份写的是 `dirtool.com`，而控制台里只有 `repostgone.apps.workbuddy.host`，于是 `/auth/google/start` 跳过去被 Google 挡在 `Error 400: redirect_uri_mismatch`。判断方法：拿授权 URL 直接请求一次，看返回的是登录页还是错误页。

### 从零重建的步骤

#### 1. 建项目

打开 https://console.cloud.google.com/projectcreate ，随便起个名（如 `product-atlas`），创建。

#### 2. 配置同意屏幕

左侧「API 和服务 → OAuth 同意屏幕」

- User Type 选 **External**
- 应用名：`Product Atlas`
- 用户支持邮箱、开发者联系邮箱：填你自己的
- 范围（Scopes）：只加 **`openid`、`email`、`profile`** 三个，不要加别的
- 测试用户：把**你自己的 Gmail** 加进去（应用处于 Testing 状态时，只有测试用户能登录）

> Testing 状态就够了，不用提交审核。代价是只有测试用户能登录；等以后要对外开放，再点「发布应用」。
> 只申请 openid/email/profile 这三个非敏感范围，通常不需要 Google 人工审核。

#### 3. 建 OAuth 客户端

「API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID」

- 应用类型：**Web 应用**
- 名称：`product-atlas-web`
- **已获授权的重定向 URI**（必须一字不差，这是唯一容易错的地方）：

```
https://dirtool.com/auth/google/callback
```

本地开发要单独加一条（Google 允许一个客户端注册多条）：

```
http://localhost:3000/auth/google/callback
```

- 已获授权的 JavaScript 来源：可以不填（我们用的是服务端授权码流程，不走前端弹窗）

创建后会给你 **客户端 ID** 和 **客户端密钥**。

#### 4. 写进 Worker secret

```bash
cd nuxt
npx wrangler secret put NUXT_GOOGLE_CLIENT_ID
npx wrangler secret put NUXT_GOOGLE_CLIENT_SECRET
```

粘贴后回车。**secret 写完立即生成一个新版本并接管流量，不需要重新 deploy。**

`NUXT_GOOGLE_REDIRECT_URI` 是**可选的**：不填时用「请求 origin + `/auth/google/callback`」，也就是你上面注册的那个地址。只有在你把站点挂在反代后面、origin 和真实域名不一致时才需要显式设置。

**别忘了 `NUXT_SESSION_SECRET`**——会话与 state cookie 都靠它签名。没设的话会用代码里公开的 `dev-session-secret`，等于任何人都能伪造登录态：

```bash
npx wrangler secret put NUXT_SESSION_SECRET
# 生成随机串：
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

#### 5. 验收

- 点「使用 Google 继续」→ 真实跳转 `accounts.google.com` → 选账号 → 回到站点
- `/api/me` 返回真实邮箱和头像
- 提交一条产品 → 「我的提交」出现在列表里
- 换一个浏览器（同一账号）登录 → 仍然能看到那条提交
- 退出登录 → `/api/me` 变回 `null`

**如果失败**，登录页会带 `?auth=failed&why=<reason>`。这个 `reason` 就是诊断结论：

| `why` | 意思 | 怎么修 |
|---|---|---|
| `redirect_mismatch` | 回调地址没在 Google Console 注册，或注册的不是这个域名 | 回第 3 步，一字不差地加上 `https://dirtool.com/auth/google/callback` |
| `bad_client` | client_secret 错，或 client 被删了 | 重新 `secret put NUXT_GOOGLE_CLIENT_SECRET` |
| `bad_code` | code 过期或已用过（通常是刷新回调页导致） | 从登录页重新点一次，不要刷新回调 URL |
| `network` | Worker 没连上 Google | 检查 `wrangler tail`，通常是出网被限 |
| `audience_mismatch` | id_token 不是给这个 client 的 | client_id 填错了 |
| `issuer_mismatch` / `token_expired` / `no_id_token` / `bad_id_token` | token 本身有问题 | 重新登录一次；持续出现就贴 `wrangler tail` 日志 |

排查看日志：

```bash
npx wrangler tail
# 失败时会打 [auth] google exchange failed: <reason> <detail>
```

---

## 三、当前状态

- **本地已通**：用桩身份提供方（`NUXT_GOOGLE_AUTH_URL` / `NUXT_GOOGLE_TOKEN_URL` 指向本地 stub）跑过 start → authorize → callback → 会话 → 提交归属 → 退出，全绿。
- **生产已通**（2026-11-05）：`wrangler secret list` 五条齐全；`/auth/google/start` 302 到 `accounts.google.com` 且 `redirect_uri` 与 Google 侧登记的一致；真人登录走通，顶栏出现头像。
- **缺配置时的表现**：`/auth/google/start` 302 到 `/sign-in?auth=unconfigured`，登录页说「还没配置好」。这是**故意**的——带着空 `client_id` 去 Google 只会换回一个访客看不懂的 `invalid_request` 页面。

### 登录失败时页面上那串 `?auth=` 是什么

回调不再把三种情况混成一个 `denied`：

| 页面提示 | 触发条件 | 用户该做什么 |
|---|---|---|
| `auth=denied` | 在 Google 同意屏上点了取消 | 想继续就再点一次 |
| `auth=bad_code` | state cookie 丢了（超过 10 分钟、换了浏览器或标签页），或 code 过期/已用过 | 从登录页重新开始，别刷新回调 URL |
| `auth=failed&why=<reason>` | 换 token 失败 | 按第 5 步那张 `why` 对照表查 |

---

## 四、两个需要你知道的取舍

1. **只有 Google 一种登录方式。** 没有邮箱+密码表单：没有密码存储、没有找回流程的「登录」只会变成一个骗人的表单。竞品（Launch Llama / LaunchZone / Nick Launches）也都是 Google 单点登录。

2. **昵称 / 头像在资料页是只读的。** 值来自 Google，想改要去 Google 账户改。旧站的资料页有一个「上传头像」按钮，实际只把 data URL 写进 localStorage——那种功能已经删掉了，页面不假装能改。
