# 部署手册 — dirtool.com（Cloudflare Workers + D1）

这份手册是给**你自己在终端里跑**的，每一步都写清楚：命令、为什么、怎么算成功、失败怎么办。
按顺序执行，不要跳步。

前提：`nuxt/` 目录下操作，Node 22+，已装 `wrangler`（`npx wrangler whoami` 能出账号即可）。

---

## 第 1 步 · 确认登录的是对的 Cloudflare 账号

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone/nuxt"
npx wrangler whoami
```

**为什么**：`wrangler` 可能同时登录了多个账号，部署到错误的账号会白跑一遍。

**怎么算成功**：输出里有 `You are logged in with an OAuth Token` 和你想用的那个账号邮箱 / Account ID。

**失败怎么办**：
- 未登录 → `npx wrangler login`（浏览器授权）。
- 账号不对 → `npx wrangler logout` 后重新 `login`。

---

## 第 2 步 · D1 数据库（已经建过就跳过）

```bash
npx wrangler d1 list
```

**为什么先看再建**：这个项目的 D1 已经建好，`wrangler.jsonc` 里的 `database_id` 也是真实值（`c3355beb-7437-4b29-9ab8-a12c3f7c0c55`）。重复 `create` 只会得到一个同名冲突的报错。

只有在**换 Cloudflare 账号**或**从零重建**时才需要：

```bash
npx wrangler d1 create product-atlas
```

输出里会有一段

```
[[d1_databases]]
binding = "DB"
database_name = "product-atlas"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

把那个 `database_id` 复制，替换 `wrangler.jsonc` 里的值。

**怎么算成功**：`d1 list` 里有 `product-atlas`，且它的 UUID 与 `wrangler.jsonc` 的 `database_id` 一致。

**失败怎么办**：
- `A database with that name already exists` → 正常，用 `d1 list` 拿 id 填进去，不要重复建。
- `database_id` 是占位符 → deploy 会直接报错。这是故意的，避免部署出一个「写入路径起不来」的站点。

---

## 第 3 步 · 把表结构打到线上库

```bash
npm run db:remote
```

**为什么**：D1 建出来是空库。脚本执行的是 `server/database/schema.sql`，全部是
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，**没有 DROP / DELETE /
INSERT**，重复跑不会清数据。截至 2026-11-06 共 **17 张表**，分四组：

- 早期：`submissions`、`votes`、`ads`、`tool_overrides`、`week_archive`
- 目录站：`dir_tool`、`dir_tool_tr`、`dir_category`、`dir_category_tr`、`dir_tag`、
  `dir_tag_tr`、`dir_collection`、`dir_collection_tr`、`dir_collection_tool`
- 订单：`payment_order`（在线支付）
- 工单：`ticket`、`ticket_message`（后台 tickets 页）

早期部署过的线上库通常只有第一组。**这一步必须重跑**把后三组补齐，否则新页面会 500。

**怎么算成功**：输出里能看到一串 `CREATE TABLE` / `CREATE INDEX` 的执行结果，没有 `error`。

**失败怎么办**：
- `no such table` 之类 → 说明 `database_id` 还没填对，回第 2 步。
- 已存在的表会安静跳过，这不是失败。

**验收**：

```bash
npx wrangler d1 execute product-atlas --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
```

应当列出 17 张表，**重点确认 `payment_order`、`ticket`、`ticket_message`、`dir_tool` 都在**——
这四张是本次新增代码会读写、而早期线上库里没有的。`sqlite_sequence` / `_cf_KV` 之类系统表忽略。

---

## 第 4 步 · 本地构建（先别部署）

```bash
NITRO_PRESET=cloudflare_module npm run build
```

**为什么**：`cloudflare_module` 这个 preset 才会产出 `.output/server/index.mjs`（`wrangler.jsonc` 的 `main` 指向它）。用默认 preset 构建出来的产物 wrangler 不认。

**怎么算成功**：结尾出现 `✔ You can preview this build using node .output/server/index.mjs` 之类的成功提示，且 `.output/server/index.mjs` 存在：

```bash
ls -lh .output/server/index.mjs
```

**失败怎么办**：
- `Cannot find module 'node:sqlite'` → 说明本地 SQLite 分支被打进了 Cloudflare 产物。这是回归，把报错原文发我。
- `EPIPE` / `write EPIPE` / 进程被 kill → 沙箱或内存问题，重开一个干净终端再跑。

---

## 第 5 步 · 部署

```bash
npm run deploy
```

等价于 `NITRO_PRESET=cloudflare_module nuxt build && wrangler deploy`。

**怎么算成功**：输出结尾有

```
Uploaded product-atlas (x.xx sec)
Deployed product-atlas triggers
  https://product-atlas.<你的子域>.workers.dev
  https://dirtool.com  (custom domain)
```

`*.workers.dev` 那个地址带 `x-robots-tag: noindex`（`00-canonical-host.ts` 加的），**不要用它做验收基线**——它和主域内容一样，用主域验。

**失败怎么办**：
- `database_id` 相关报错 → 回第 2 步。
- `crons` 相关报错 → 检查 `wrangler.jsonc` 的 `triggers.crons` 是否是 `["0 3 * * 1"]`。

**验收（部署完立刻做）**：

```bash
BASE=https://dirtool.com
curl -s -o /dev/null -w "%{http_code}\n" $BASE/                 # 200
curl -s $BASE/api/overrides                                      # {"ok":true,"pinned":{},"hidden":[]}
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/tools         # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/admin             # 404（没 cookie 必须 404）
curl -s $BASE/sitemap.xml | head -c 200                          # <urlset ...>
curl -s $BASE/zh | head -c 200                                   # 中文首页

# 本次移植的前台页面：全部应为 200
for p in /tools /categories /categories/chatbots /tags /submit /pricing /tools/chatgpt; do
  printf "%-24s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$BASE$p"
done

# 支付：本次部署不启用在线支付，应是 ready:false + webhook 404
curl -s $BASE/api/payments/config
curl -s -o /dev/null -w "webhook %{http_code}\n" -X POST \
  -H 'content-type: application/json' -d '{}' $BASE/api/payments/webhook
```

---

## 第 6 步 · 写 secrets

**必须在 `deploy` 之后做**：Worker 还没创建时 `wrangler secret put` 会报
`Couldn't find a Worker`。secret 写上去会立即生成一个新版本并接管流量，不需要再 deploy 一次。

`NUXT_ADMIN_TOKEN` 为空意味着 `/admin` 整个不存在（这是设计，不是 bug）。

```bash
# 会话签名密钥：随便生成一串 32+ 字符，别用示例值
npx wrangler secret put NUXT_SESSION_SECRET
# IP 哈希盐：提交配额用，同样随机
npx wrangler secret put NUXT_IP_SALT
# 后台口令：你自己记牢，登录 /admin 用
npx wrangler secret put NUXT_ADMIN_TOKEN
# Google OAuth（没配就一直显示"未配置"，不影响其他功能）
npx wrangler secret put NUXT_GOOGLE_CLIENT_ID
npx wrangler secret put NUXT_GOOGLE_CLIENT_SECRET
# 邮件（Resend）：不配则所有通知静默跳过，提交照常落库
npx wrangler secret put NUXT_MAIL_API_KEY
npx wrangler secret put NUXT_MAIL_FROM        # 形如 Product Atlas <noreply@dirtool.com>
npx wrangler secret put NUXT_MAIL_REPLY_TO    # 可选
npx wrangler secret put NUXT_SITE_URL         # https://dirtool.com
```

生成随机串可以用：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**怎么算成功**：每条命令提示 `Enter a secret value:`，粘贴后回车，显示 `Success! Uploaded secret XXX`。

**失败怎么办**：`Not logged in` → 回第 1 步。

**验收**：

```bash
npx wrangler secret list
```

---

## 第 7 步 · 验证 Cron 已注册

```bash
npx wrangler deployments list
```

或者 Cloudflare 后台 → Workers & Pages → product-atlas → Settings → Trigger Events，应看到
`Cron Triggers: 0 3 * * 1`（每周一 03:00 UTC）。

**手动跑一次归档**（不用等到周一）：

```bash
BASE=https://dirtool.com
curl -s -X POST -H "cookie: atlas_admin=<你设的 NUXT_ADMIN_TOKEN>" \
  -H "content-type: application/json" -d '{}' $BASE/api/admin/archive
```

**怎么算成功**：`{"ok":true,"week":"2026-Wxx","rows":N}`。`rows:0` 也正常——说明那一周没人投票。

**验收**：

```bash
npx wrangler d1 execute product-atlas --remote \
  --command "SELECT week, COUNT(*) n FROM week_archive GROUP BY week"
curl -s $BASE/api/board
```

---

## 第 8 步 · 自定义域名（已经挂好，换域名时才重做）

**当前状态**：`dirtool.com` 与 `www.dirtool.com` 都已 `Active`（2026-11-04 完成）。日常部署**不需要**碰这一步——`npm run deploy` 只换代码，域名绑定跟着 Worker 走。

只有换域名时才需要：

Cloudflare 后台 → Workers & Pages → product-atlas → Settings → Domains & Routes →
**Add → Custom domain** → 填新域名，再加一条 `www.` 前缀的。

**为什么在后台点而不是命令行**：自定义域名要顺带处理 DNS 与证书，后台会一次性把这两件事做完；命令行 `routes` 只改路由不建证书。

**换域名时还要改的四处**（漏一处就是线上错链）：

1. `server/middleware/00-canonical-host.ts` 的 `CANONICAL_HOST` 与 `UNDER_APEX`
2. `server/routes/sitemap.xml.ts`、`robots.txt.ts`、`llms.txt.ts` 里的 `SITE` 常量
3. `wrangler secret put NUXT_SITE_URL`（邮件里的链接）
4. Google Console 的 redirect URI

**怎么算成功**：两条域名状态变成 `Active`（证书签发通常 1–3 分钟）。

**验收**：

```bash
curl -sI https://dirtool.com | head -3          # 200
curl -sI https://www.dirtool.com | head -3      # 301 → https://dirtool.com/
curl -sI http://dirtool.com | head -3           # 301 → https://dirtool.com/
```

---

## 第 9 步 · 上线后的三重交叉验证

```bash
# 1) 首页与关键页面
for p in / /tools /weekly /makers /pricing /zh; do
  printf "%-10s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://dirtool.com$p"
done

# 2) 提交 → 审核 → 详情页（用测试邮箱，跑完自己删掉）
curl -s -X POST -H "content-type: application/json" \
  -d '{"url":"https://deploycheck.example","name":"Deploy Check","short":"A listing used once to verify the production write path end to end.","email":"you@example.com","category":"coding","tags":["API"],"plan":"free"}' \
  https://dirtool.com/api/submit
# 期望 201 + "next":"review"，并且你邮箱收到 "We received Deploy Check"

# 3) 详情页 404 语义：未审核的提交必须查不到
curl -s -o /dev/null -w "%{http_code}\n" https://dirtool.com/tools/deploycheck
# 期望 404（不是 200、不是 403）

# 4) sitemap 与 robots
curl -s https://dirtool.com/robots.txt
curl -s https://dirtool.com/sitemap.xml | grep -o "<url>" | wc -l   # 192 起，只增不减
curl -s https://dirtool.com/sitemap.xml | grep -o "\.html" | wc -l  # 必须是 0
```

清理测试数据：

```bash
npx wrangler d1 execute product-atlas --remote \
  --command "DELETE FROM submissions WHERE slug='deploycheck'"
```

---

## 2026-11-06 这次部署的增量

本次推送的是后台全套按源码移植、前台 8 页移植、`/pricing` 重做、Blog 入口隐藏、
支付接入 waffo + creem。照常按第 1→9 步走，只有三处判据变了：

1. **线上库要补表**：`schema.sql` 从 5 张表长到 17 张。第 3 步的 `npm run db:remote`
   一定要重跑（全是 `IF NOT EXISTS`，不清数据）。缺 `payment_order` / `ticket` /
   `dir_tool` 会让新页面直接 500。
2. **在线支付仍然是关的**：没有设 `NUXT_PAYMENT_PROVIDER`，站点继续走人工收款。
   这是刻意的——waffo 的真实商户凭证还没给。上线后 `/api/payments/config` 应回
   `ready:false`，webhook 应回 404（第 5 步验收里有）。等凭证齐了再写 secret：
   ```bash
   npx wrangler secret put NUXT_PAYMENT_PROVIDER     # waffo
   npx wrangler secret put NUXT_WAFFO_MERCHANT_ID
   npx wrangler secret put NUXT_WAFFO_PRIVATE_KEY    # 整个 PEM，多行
   npx wrangler secret put NUXT_WAFFO_ENVIRONMENT    # test | prod
   npx wrangler secret put NUXT_WAFFO_PRODUCT_ID     # 或 NUXT_WAFFO_PRODUCT_IDS（JSON）
   ```
   同时在 Waffo Dashboard 把 webhook 指到 `https://dirtool.com/api/payments/webhook`。
   secret 写完即刻生效，不用重新 deploy。
3. **typecheck 还有 3 条 Blog 报错**（`blog/index.vue:54`、
   `shared/content/blog.ts:114/115`），Blog 按决定暂不上线。`nuxt build` 不跑 `tsc`，
   不阻塞部署，别把它当成构建失败。

---

## 回滚

```bash
npx wrangler deployments list        # 找到上一个版本 id
npx wrangler rollback <deployment-id>
```

回滚只回代码，不动 D1 数据。表结构是加表式的（`IF NOT EXISTS`），旧版本代码不认识新表也不影响运行。

---

## 常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 部署成功但全站 500 | `database_id` 没填 / 表没建 | 回第 2、3 步 |
| `/admin` 一直 404 | `NUXT_ADMIN_TOKEN` 没设或为空 | 第 6 步重设（secret 写完即刻生效，不用重新 deploy） |
| 提交 201 但没收到邮件 | `NUXT_MAIL_API_KEY` / `NUXT_MAIL_FROM` 没配，或发件域未在 Resend 验证 | `wrangler tail` 看 `[mail] delivery failed` |
| 周一没归档 | cron 表达式错 / Worker 没重新部署 | 第 7 步手动跑一次，能跑通就是 cron 没注册 |
| 详情页 410 | 后台「收录管理」里该条被下架 | 后台点「已下架」按钮恢复 |

---

## 补充：`/admin/submissions` 提交审核（2026-11-06 已部署并验收）

### 现状问题

`/submit` 落库到 `submissions` 表，而源码后台 `/admin/directory/tools` 只读
`dir_tool` + 静态 catalogue，两套表没有接通。结果是站长在后台看不到用户提交、
也没有可点击的审核入口；能审这批记录的只有 `GET /api/admin/submissions` 和
`POST /api/admin/review` 两个**没有 UI** 的接口。这是本站移植自身的断链。

### 改动范围（2 个代码文件，未动任何接口、表结构或前台）

- 新增 `app/pages/admin/submissions.vue`：状态 tab（全部 / 待审核 / 已通过 / 已拒绝）、
  搜索、分页、详情面板，以及通过 / 拒绝（可填原因）/ 确认收款（可填参考号）三个动作。
  只调用上面两个既有接口；组件复用已移植的 shadcn Vue / reka-ui
  （`DataTable`、`UiCard`、`UiDialog`、`UiBadge` 等），版式照 `app/pages/admin/guest-posts.vue`。
  页面文案放本地双语字典，不改源码生成的 `shared/content/settings-i18n.ts`。
- `app/layouts/admin.vue`：Directory 组加一个「提交审核 / Submissions」入口。
- 门禁不变：`server/middleware/admin-token.ts` 对 `/admin/*` 统一答 404；
  `server/api/admin/` 下 90 个接口逐个都有 `isAdmin()`。

### 为什么这样改 / 对 SEO 与关键词的影响

选「补 UI 接现有接口」而不是「把 `/submit` 改写到 `dir_tool`」：后者要同时改
「我的提交」、支付、邮件与首页合并逻辑，牵动面大且线上已在跑；前者不动任何
现有链路，随时可回退。后台页面本就不进 sitemap，被 `robots.txt` 的
`Disallow: /admin` 排除，无 cookie 一律 404 ⇒ **不影响收录，不影响前台
页面结构、关键词与内链**；本次也没有新增表，不需要重跑 `db:remote`。

### 本地测试结果（2026-11-06，dev server `127.0.0.1:3109`，测完已关闭）

| 检查 | 结果 |
|---|---|
| `env -u NODE_OPTIONS npm run typecheck` | 只剩 3 条既有 Blog 报错（`blog/index.vue:54`、`blog.ts:114/115`），新页面 **0 错误** |
| 无 cookie `GET /admin/submissions` / `GET /api/admin/submissions` | 均 **404** |
| `/admin/submissions?token=…` | **302** + `Set-Cookie: atlas_admin=…; HttpOnly; SameSite=Lax`，且 Location 已剥离 token |
| 带 cookie `GET /admin/submissions` | **200**，SSR 已渲染标题、描述、stats、4 个 tab、表头与真实待审数据行 |
| 带 cookie 队列接口 | `{"ok":true,"items":[…],"stats":{…}}` |
| `reject` | `status=rejected`，`notes` 落库 |
| `approve` | `status=approved`，`/api/tools/<slug>` 由 404 变 **200**（前台立即上线） |
| 付费档 `approve` → `payment` | 先 **409 `payment_required`**，再确认收款后 `status=approved` 且 `paid_at` 有值 |
| 本地探针数据 | 3 条测试记录已用 `wrangler d1 execute --local` 删除，`success: true` |

**已于 2026-11-06 10:02 部署并验收通过**：commit `fd1da8b`，部署时 Version
`35ee3d44-ca4d-4527-9d9d-18af9e12bca9`。详见本节末尾「本次部署记录」。

### 上线后验收探针

```bash
BASE=https://dirtool.com
TOKEN='你的 NUXT_ADMIN_TOKEN'

curl -s -o /dev/null -w '%{http_code}\n' "$BASE/admin/submissions"
# 期望 404（无 cookie）
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/admin/submissions?status=pending"
# 期望 404
curl -s -o /dev/null -w '%{http_code}\n' -H "cookie: atlas_admin=$TOKEN" "$BASE/admin/submissions"
# 期望 200
curl -s -H "cookie: atlas_admin=$TOKEN" "$BASE/api/admin/submissions?status=pending" | head -c 200
# 期望 {"ok":true,"items":[…],"stats":{…}}
```

### 已知限制

- `GET /api/admin/submissions` 单次最多 200 条（`listSubmissions` 上限），
  搜索与分页都在浏览器内完成；队列超过 200 条时才需要补后端分页接口。
- 付费档不能点「通过」，必须「确认收款」；在线支付仍是关的，继续人工收款。
- 审核邮件依赖 `NUXT_MAIL_*`，未配置时静默跳过，审核动作照常生效。

**部署前置**：本节改动先交 owner 确认；确认前不构建、不推送、不部署。
确认后照第 1→9 步走，本次没有新表、不需要重跑 `db:remote`。

### 本次上线的分步终端命令清单（存档；对话里一次发一步）

本次和上次部署不同，第 2、3、6、8 步都**不用重跑**：D1 已建好且 17 张表齐全、
secrets 已写、`dirtool.com` 已 Active，本次代码没有新增表也没有改配置。
实际要跑的只有下面 6 小步，顺序不要跳。

**S1 · 提交前最后确认（仓库根目录）**

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone"
git status --short
git rev-parse --short HEAD
cd nuxt && env -u NODE_OPTIONS npm run typecheck
```

**为什么**：确认待提交的就是那 3 个文件，且新页面没引入类型错误。

**怎么算成功**：`git status` 恰好是
`M nuxt/DEPLOY-部署手册.md`、`M nuxt/app/layouts/admin.vue`、
`?? nuxt/app/pages/admin/submissions.vue`；HEAD 为 `357f02e`；
typecheck 只剩 3 条既有 Blog 报错（`app/pages/blog/index.vue:54`、
`shared/content/blog.ts:114`、`shared/content/blog.ts:115`），
**没有** `admin/submissions.vue` 的报错。

**失败怎么办**：多出别的文件 → 先查清楚再提交，不要 `git add .`；
typecheck 出现新页面相关报错 → 停下来发我原文，先修再继续。

---

**S2 · 提交并推送（仓库根目录）**

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone"
git add nuxt/app/pages/admin/submissions.vue nuxt/app/layouts/admin.vue nuxt/DEPLOY-部署手册.md
git commit -m "feat(admin): add the submissions review queue"
git push origin main
```

**为什么**：让远端代码和本地一致，否则部署的是旧版本。

**怎么算成功**：`git push` 输出 `357f02e..<新哈希> main -> main`；
再跑 `git rev-parse --short HEAD` 与 `git rev-parse --short origin/main` 两者相同。

**失败怎么办**：`rejected / non-fast-forward` → 先 `git pull --rebase origin main`
再看有没有冲突，别用 `--force`。

---

**S3 · 本地构建（`nuxt/` 目录）**

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone/nuxt"
NITRO_PRESET=cloudflare_module npm run build
ls -lh .output/server/index.mjs
```

**为什么**：`cloudflare_module` 才产出 wrangler 认识的 `.output/server/index.mjs`；
先在本地构建通过，再谈部署。

**怎么算成功**：结尾出现构建成功提示（`Build complete`），且
`.output/server/index.mjs` 存在。**不要拿入口文件体积当判据**：它正常只有几百字节
（本次 253 B），代码都在 `.output/server/chunks/` 里；总大小看构建结尾的
`Σ Total size`（本次 3.68 MB / 1.06 MB gzip）。

**失败怎么办**：`EPIPE` / 进程被 kill → 换一个干净终端重跑；
`ENOENT ... ?raw` 之类 → 发我报错原文（上次的 `?raw` 问题已修，不应复现）。

---

**S4 · 部署（`nuxt/` 目录）**

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone/nuxt"
npm run deploy
```

**怎么算成功**：`Uploaded ... files`、`Worker Startup Time` 有值、
`env.DB (product-atlas)` 在绑定列表里、cron `0 3 * * 1` 已注册；
**记下结尾的 Version ID**，回滚要用。

**失败怎么办**：`database_id` 报错 → 回第 2 步；其他 → 把结尾 20 行发我，
先别重复 deploy。

---

**S5 · 线上探针（三层交叉验证）**

```bash
BASE=https://dirtool.com
TOKEN='你的 NUXT_ADMIN_TOKEN'

# ① 前台没被带坏
for p in / /tools /categories /tags /submit /pricing /zh; do printf '%-16s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$BASE$p"; done

# ② 后台仍然只对站长开放
curl -s -o /dev/null -w 'no-cookie page   %{http_code}\n' "$BASE/admin/submissions"
curl -s -o /dev/null -w 'no-cookie api    %{http_code}\n' "$BASE/api/admin/submissions?status=pending"
curl -s -o /dev/null -w 'with-cookie page %{http_code}\n' -H "cookie: atlas_admin=$TOKEN" "$BASE/admin/submissions"
curl -s -H "cookie: atlas_admin=$TOKEN" "$BASE/api/admin/submissions?status=pending" | head -c 200; echo

# ③ 收录面没有变化
curl -s "$BASE/sitemap.xml" | grep -o '<url>' | wc -l
curl -s "$BASE/sitemap.xml" | grep -o '\.html' | wc -l
curl -s "$BASE/robots.txt" | grep -n 'Disallow: /admin'
curl -s "$BASE/api/payments/config"
```

> 单引号必须保留：`<` `>` 在 zsh 里是重定向符号，写成 `TOKEN=<...>` 会让整块命令
> 一条都不执行、末尾报 `parse error near '\n'`。for 循环压成单行，避免多行粘贴被拆坏。

**怎么算成功**：① 全部 200；② 依次 `404 / 404 / 200` 且接口回
`{"ok":true,"items":[…],"stats":{…}}`；③ `<url>` 数量与部署前一致（只增不减）、
`.html` 为 `0`、能 grep 到 `Disallow: /admin`、支付仍是 `ready:false`。

**失败怎么办**：带 cookie 仍 404 → `NUXT_ADMIN_TOKEN` 和你填的 `TOKEN` 不一致，
用 `npx wrangler secret list` 确认；页面 500 → `npx wrangler tail` 看报错。

---

**S6 · 收尾（人工看一眼 + 记录回滚点）**

```bash
npx wrangler deployments list | head -n 12
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone" && git log -1 --oneline
```

然后用浏览器打开 `https://dirtool.com/admin?token=<TOKEN>`，在侧栏
**Directory → 提交审核 / Submissions** 点进去，确认 tab、stats 和真实提交记录都在，
再随便点一条「详情」看弹窗。确认完把 URL 里的 token 清掉（会自动 302 剥离）。

**怎么算成功**：侧栏能看到入口，页面能加载队列，浏览器地址栏没有 `?token=`。

**失败怎么办**：需要立即回退就 `npx wrangler rollback <上一个 Version ID>`；
线上仍是上一版 `71d2fe8e-a98c-44a8-a7b0-b111e9f08679`。

**注意**：本次没有新增表，`db:remote` 不要重跑；本次唯一动过的 secret 是
`NUXT_ADMIN_TOKEN`（旧值与线上不一致、读不出明文，已换新 32 位），其余 secret 都没动，
不要重跑 `wrangler secret put`。线上写路径（真提交一条再审核）本次未跑冒烟，
部署后建议手动用一条测试提交走一遍「提交 → 通过 → 详情页 200」，跑完按第 9 步
删掉测试数据。

---

### 本次部署记录（2026-11-06 10:02，已完成）

| 项 | 值 |
|---|---|
| commit | `fd1da8b feat(admin): add the submissions review queue`（3 文件，+724 行） |
| 构建 | `Build complete in 27.3s`，`Σ Total size 3.68 MB (1.06 MB gzip)` |
| 部署 | `Uploaded product-atlas (19.63 sec)`，`Worker Startup Time: 40 ms` |
| 部署时 Version ID | `35ee3d44-ca4d-4527-9d9d-18af9e12bca9` |
| 上一版（回滚目标） | `71d2fe8e-a98c-44a8-a7b0-b111e9f08679` |
| 后台口令 | 重设过 `NUXT_ADMIN_TOKEN`（旧 15 位值与线上 secret 不一致，换新后门禁恢复 200） |

线上验收（2026-11-06 10:25，主域 `dirtool.com`）：

- 前台 `/`、`/tools`、`/categories`、`/tags`、`/submit`、`/pricing`、`/zh` 全部 **200**
- 无 cookie `/admin/submissions`、`/api/admin/submissions` 均 **404**
- 带 cookie 页面与接口均 **200**，队列返回 `{"ok":true,"items":[…]}`（含真实待审记录）
- `sitemap.xml` 条目 **184**、`.html` 计数 **0**、robots 含 `Disallow: /admin`、支付仍 `ready:false`
- 184 的说明：本次 commit 只动 3 个文件，`sitemap.xml.ts` 与前台内容都没改，所以这就是
  部署前的既有值；手册早前写的「192 起」是更早的旧基准，判断收录面以 `.html = 0` 与 robots 为准

**回滚**：

```bash
npx wrangler rollback 71d2fe8e-a98c-44a8-a7b0-b111e9f08679
```

secret 重设会额外生成一个 version，`deployments list` 的条目会叠一层；回滚前先
`npx wrangler deployments list` 确认目标 ID。部署输出里的
`Current Version ID: 35ee3d44…` 是权威值。

---

## 补充 2：后台固定中文 + 提交自动补全（2026-11-06，已部署并验收）

### owner 反馈的三件事

1. 「整个后台是给我一个人用的，可以固定成中文。」
2. 「提交应用部分保持现有样式，但用户只需要输入链接就可以自动补全产品信息。」
3. 「审核通过的产品没有产品页面展示、标签等信息，参考源码里已添加的产品详情。」

### 现状诊断

- **后台英文的根因**：i18n 是 `defaultLocale: 'en'` + `prefix_except_default`，
  `/admin/...` 解析出的 locale 恒为 `en`，`useSettingsI18n()` 与 `pick(zh, en)`
  都取了英文那一半。中文文案本来就在字典里，只是没被选中。
- **详情页「缺信息」的根因**：`POST /api/submit` 写入 `submissions`，
  而 `publicTool()` 把这条记录映射成 `Tool` 时，`logo` / `maker` / `tags`
  三列虽然存在，提交表单却从来没传过值 ⇒ 审核通过后详情页只有首字母占位，
  没有 logo、没有标签、没有制作者。详情页版式本身与预设产品共用同一个
  `[slug].vue`，不是渲染 bug。
- **七分区详情是另一个问题**：源码里 30 个预设产品的
  `detail_en/detail_zh`（How to use / Features / Use cases / Pros & cons / FAQ）
  与 `shots` 是人工撰写和上传的；`submissions` 表没有这些列，`publicTool()`
  明确不伪造。所以自动补全能补齐「头部信息」，补不出七分区。

### 改动范围（7 个代码文件 + 本手册，已提交）

| 文件 | 改动 |
|---|---|
| `app/composables/useLang.ts` | `/admin`、`/zh/admin` 前缀强制 `lang = 'zh'` |
| `app/composables/useSettingsI18n.ts` | 后台路径强制中文；前台 `/settings` 不受影响 |
| `app/layouts/admin.vue` | 侧栏「提交审核」固定中文 |
| `app/pages/admin/submissions.vue` | `c()` 固定取 `COPY[key].zh` |
| `server/utils/admin-directory.ts` | 后台分类/标签下拉从 `locale='en'` 改读 `'zh'` |
| `server/api/tools/preview.post.ts` | **新增** `POST /api/tools/preview` |
| `app/components/directory/SubmitForm.vue` | URL 失焦自动补全，提交带 `tags` / `logo` / `maker` |

预览接口是纯规则解析（无模型）：只取 `og:*` / `<title>` / `keywords`，
**不搜整页正文**（首版把 python.org 猜成「音频」就是被页脚的 music/video
带偏了）；猜不出就留空让提交者自己选，比自信地猜错好。长描述只在
`og:description ≥ 120` 字时填，否则留空 —— 页面正文里的 cookie 提示、
「enable JavaScript」兜底文案不能当产品介绍发出去。防护：http(s) only、
拒绝私网/本机 host、6s 超时、600 KB 上限、仅 HTML、`no-store`、不落库。

### 对 SEO 与关键词的影响

- 后台页仍被 `robots.txt` 的 `Disallow: /admin` 排除、不进 sitemap，
  固定中文**不影响收录面**；`<html lang>` 由 i18n 自动变成 `zh-Hans`。
- `/api/tools/preview` 是 POST、不产页面、不进 sitemap，`no-store` 不缓存。
- 提交页 URL 与版式完全没变，前台页面结构、内链、结构化数据都没动。
- 自动补全让 `tags` / `category` 有值 ⇒ 审核通过的产品详情页会多出
  标签链接与分类面包屑，这是**增加**内链，不是改已有页面。

### 本地测试结果（dev 3121 + 无头 Chrome，测完端口已释放）

| 检查 | 结果 |
|---|---|
| typecheck | 只剩 3 条既有 Blog 报错，本轮 **0 新增** |
| 后台 `/admin/directory/tools` | 200，`<html lang="zh-Hans">`，侧栏/表头/分类全中文（AI 助手、工具分类、提交审核…） |
| 后台 `/admin/submissions` | 200，提交审核、待审核…全中文，无 `Submissions` |
| 预览接口 | `example.com` 200；`127.0.0.1` 私网 **400**；非法 URL 400 |
| 猜测质量 | python.org → `coding` + `Open Source`；MDN / Cloudflare / example.com → 留空不乱猜 |
| 浏览器实测自动补全 | 只粘贴 `https://www.python.org` ⇒ name `Python.org`、tagline 取自 og:description、分类 `Developer Tools`、logo、maker `Python.org` 全部自动填好 |
| 提交 → 审核 → 详情页 | 提交成功（Submission Received!）→ 队列字段齐全 → 通过后 `/tools/python-org` **200**，展示 logo `<img src="…opengraph-icon-200x200.png">`、`#Open Source`、`Maker: Python.org`、`Developer Tools`、同类推荐；`/api/tools` 已收录 |

### 已知限制 / 待 owner 拍板

七分区详情与截图仍缺。三个可选方向，**本次没有擅自实现**：

- **A（推荐，最小改动）**：维持现状。自动补全已把头部信息补齐，
  详情页对空 `detail` 会自动隐藏分区导航与截图集，不会留空白块。
- **B**：在审核台加「编辑详情」弹窗，给 `submissions` 增列存
  `detail_en/detail_zh` 与 `shots`，站长审核时顺手补内容。
  需要改表结构 + 新增写接口，牵动「我的提交」与邮件模板。
- **C**：审核通过时把记录同步进 `dir_tool` / `dir_tool_tr`，直接复用
  现成的 `/admin/directory/tools` 编辑器。改动最大，且要处理
  「submission 下架后 dir_tool 仍在」的双写一致性，风险最高。

在线支付仍关闭（`ready:false`），审核邮件未配置时静默跳过。

### 部署记录（2026-11-06 11:30 前后，已完成）

| 项 | 值 |
|---|---|
| commit | `3c5215f feat(submit): auto-fill from URL and pin the console to Chinese`（8 文件，+489 / -13） |
| 构建 | `Build complete in 29.4s`，`Σ Total size: 3.68 MB (1.06 MB gzip)`；`.output/server/index.mjs` 253 B（入口文件几百字节正常，总大小看 `Σ Total size`） |
| 部署 | `Uploaded product-atlas (20.71 sec)`，`Worker Startup Time: 45 ms`，`env.DB (product-atlas)` / `env.ASSETS` 绑定正常，cron `0 3 * * 1` |
| 部署时 Version ID | `0cbeb2d0-24e9-4e6f-b5e7-3e84e77f799b` |
| 上一版（回滚目标） | `35ee3d44-ca4d-4527-9d9d-18af9e12bca9` |
| D1 / secret | 本次没有新表，未重跑 `db:remote`；没有改 secret |

线上只读探针（S5 首轮，已通过）：

- 前台 `/`、`/tools`、`/categories`、`/tags`、`/submit`、`/pricing`、`/zh` 全 **200**
- 无 cookie `/admin/submissions`、`/api/admin/submissions` 均 **404**（门禁生效）
- `POST /api/tools/preview` 线上返回 `{"ok":true,…,"name":"Example Domain"}`
- `sitemap.xml` **188** 条、`.html` **0**、robots 含 `Disallow: /admin`、支付仍 `ready:false`
- 188 比上一版的 184 多 4 条：已审核通过的用户提交产品详情页进了 sitemap
  （末尾含 `callfreechat`、`private-1v1-video-chat-with-strangers-online` 等），
  **不是回归**。数 URL 用 `grep -o '<url>' | wc -l`；`grep -c '<url>'` 只数行数。

### ⚠️ 踩坑：`NUXT_ADMIN_TOKEN` ≠ Worker Version ID

1. Version ID 是 **36 位带连字符的 UUID**；admin token 是 **32 位纯 hex**
   （0-9a-f，无连字符）。把 `0cbeb2d0-24e9-…` 粘进 `TOKEN=` 会得到
   `token length: 36`（实测还出现过 **37**：UUID 第一段手抄多了一个字符），
   带 cookie 请求全部 404 —— 这是门禁**正确生效**，不是后台或中文化坏了；
   中文 grep 无输出也是因为拿到的是 404 页。**判据只看「32 位纯 hex」，
   不要靠肉眼比对 UUID 长得像不像。**
2. `BASE=https://dirtool.com` 必须**单独一行**。粘在
   `printf 'token length: %s\n' "${#TOKEN}"` 后面会被 shell 拼成同一个参数，
   输出 `token length: 36BASE=https://dirtool.com`，且 `BASE` 根本没被赋值。
3. 线上 secret 明文读不出；忘掉 32 位值只能
   `npx wrangler secret put NUXT_ADMIN_TOKEN` 重设（会生成新 version、
   旧 `atlas_admin` cookie 立即失效，**不需要重新 deploy**）。

### 线上带 cookie 复核（2026-11-06 11:56，已通过）

`token length: 32`、`with-cookie page 200`、`with-cookie api 200`；中文 grep 命中
`AI 助手` / `导航目录` / `工具分类` / `提交审核` / `管理后台` 各 1 次
⇒ 门禁与后台固定中文都已在 production 生效。命令存档：

```bash
BASE=https://dirtool.com
TOKEN='你的 32 位 NUXT_ADMIN_TOKEN'   # 单引号，不是 Version ID

printf 'token length: %s\n' "${#TOKEN}"
curl -s -o /dev/null -w 'with-cookie page %{http_code}\n' -H "cookie: atlas_admin=$TOKEN" "$BASE/admin/submissions"
curl -s -o /dev/null -w 'with-cookie api  %{http_code}\n' -H "cookie: atlas_admin=$TOKEN" "$BASE/api/admin/submissions?status=pending"
curl -s -H "cookie: atlas_admin=$TOKEN" "$BASE/admin/directory/tools" | grep -oE '管理后台|导航目录|工具分类|提交审核|AI 助手' | sort | uniq -c
```

判据同上，结果已验证通过。

**回滚**：

```bash
npx wrangler rollback 35ee3d44-ca4d-4527-9d9d-18af9e12bca9
```

---

## 补充 3：审核台可编辑产品详情与截图（B 方案，本地已验收，**未部署**）

> 状态：**代码已改完并完成本地实测；未提交、未构建、未推送、未部署。**
> 按 owner 规矩，先交这份说明，等明确点头后才开始分步终端操作。

### owner 的选择与理由

上一轮列出 A / B / C 后，owner 选 **B**，理由是：这是站长手动干的活，
而且增加这个对提交者是有益的——用户付费了应该享受这部分价值，
对口碑、站点差异化、健康度、完整度都有好处。
（A = 维持现状；C = 审核通过时双写进 `dir_tool` 复用现成编辑器，风险最高。）

### 现状问题

预设产品（catalogue / `dir_tool`）有源码同款七分区详情 + 截图集，
但 `/submit` 交上来的产品走 `submissions` 表，`publicTool()` 只映射头部字段，
`detail` 与 `shots` 恒为空 ⇒ 详情页自动隐藏分区导航和截图集。
`submissions` 与 `dir_tool` 是两套独立的表，所以 `/admin/directory/tools`
的编辑器够不着用户提交。免费与付费用户都吃亏，付费用户尤其明显。

### 改动范围（4 改 + 2 新增，共 6 个文件）

| 文件 | 改动 |
|---|---|
| `server/database/schema.sql` | `submissions` 增 `detail_en` / `detail_zh` / `shots` 三列，`TEXT NOT NULL DEFAULT ''` |
| `server/utils/submissions.ts` | `SubmissionRow` / `adminRecord()` 带出解析后的详情；`publicTool()` 仅在**确实有内容**时附 `detail_en` / `detail_zh`；新增 `normalizeDetail()` / `normalizeShots()` / `saveSubmissionDetail()` |
| `server/api/admin/submission-detail.post.ts` | **新建**独立写接口，复用后台门禁，只更新详情列 + `updated_at` |
| `app/components/admin/SubmissionDetailEditor.vue` | **新建** shadcn Vue 风格六分区编辑器（使用步骤 / 主要功能 / 适合谁用 / 优点 / 缺点 / 常见问题），每次编辑 emit 整块新 `DetailBlock` |
| `app/pages/admin/submissions.vue` | 操作列加 Pencil 按钮 + 编辑弹窗：中/英文切换、截图列表、保存 toast；actions 列宽 150→190px |
| `app/pages/tools/[slug].vue` | 截图 URL：`http(s)` 绝对地址原样用，bare filename 仍映射到 `/assets/img/screenshots/<name>` |

### 为什么这样设计

- **独立写接口，不复用 `/api/admin/review`**：填「使用步骤」不是审核动作。
  分开后，编辑详情**永远不可能**改 `status` / `reviewed_at` / `awaiting_payment`，
  也不会误发通过/拒绝/收款邮件；待审核、已通过、已拒绝的行都能编辑。
- **服务端清洗**：这些文案会渲染进公开页 HTML。`normalizeDetail()` 走
  `editorialText()` 去标签限量长；`normalizeShots()` 只放行
  `http(s)` 绝对 URL 或 `^[a-z0-9][a-z0-9._-]*\.(png|jpg|jpeg|webp|gif|avif)$`
  的 bare filename，挡掉 `javascript:`、路径穿越，最多 8 张。
- **不复用 `AdminDetailFields.vue`**：那个组件用 legacy `.admin-input` / `.btn` 类，
  本项目没有对应样式表；审核台是 shadcn Vue 页面，所以另写一份。
- **旧行零影响**：三列默认 `''`，`parseDetail()` / `safeShots()` 对空串与
  `undefined` 都返回空结构；`hasDetail()` 为假时不往 `Tool` 上挂字段，
  旧详情页渲染结果与改动前**逐字一致**。
- **中英回退沿用源码规则**：`detailFor()` 在中文块为空时回退英文块，
  站长只填一份也能两边都显示。
- 截图不提供上传：填 `public/assets/img/screenshots` 下的文件名，或站外绝对图片 URL。

### 对 SEO 与关键词的影响

- 详情页是**已有 URL**，不新增 sitemap 条目、不改内链、不改 canonical / 结构化数据
  （`SoftwareApplication` + `BreadcrumbList` 原样保留）。收录面不变。
- 增益在于**长尾内容**：使用步骤、功能、适用场景、优缺点、FAQ 都是围绕产品名
  自然展开的实体词与问答句式，比只有一句 tagline 的页面更容易覆盖
  「怎么用 / 适合谁 / 值不值 / 常见问题」类查询；中文块单独维护，
  避免机翻腔污染中文 SERP。
- 分区导航按**实际有内容**动态生成（`sectionTabs`），空内容不会产出空锚点，
  不会出现一堆 `#how-to-use` 指向空白块的薄内容信号。
- 截图 `<img>` 本身不是排名因素，但补全了页面完整度与停留时间；
  站点差异化靠的是「同类目录只有我们有人工写的使用说明」。

### ⚠️ 本地测试踩坑：`nuxt dev` 的 D1 不是 wrangler 的 D1

首次 probe 用 `npx wrangler d1 execute product-atlas --local` 插了一行，
wrangler 查得到、Nuxt API 却 404 `not_found`。根因不是代码：

- `nuxt dev` 走 `server/utils/db.ts` 的 `node:sqlite`，文件是 **`.data/local.sqlite`**；
- `wrangler d1 execute --local` 写的是 **`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`**；
- `wrangler.jsonc` 的注释本来也写了「Locally, `nuxt dev` ignores this file」。

⇒ 本地端到端测试必须**通过应用自己的 API 造数据**，或直接对
`.data/local.sqlite` 操作，别混用 `wrangler d1 --local`。
另一个连带结论：`CREATE TABLE IF NOT EXISTS` 不会给已存在的本地表加列，
所以本地也要先跑一次 `ALTER TABLE`（本次用 `/tmp/detail-local-db.mjs` 按
`PRAGMA table_info` 判空后补齐，线上同理）。

### 本地测试结果（dev 3122 / 3124 + 无头 Chrome，全部已释放）

**链路 probe**（真实 `/api/submit` → `/api/admin/review` → 新接口 → 公开页）：

| 检查 | 结果 |
|---|---|
| 无 cookie `POST /api/admin/submission-detail` | **404**（门禁生效） |
| 带 cookie 换票 | 302；`POST /api/submit` 201；`approve` 200 |
| 保存详情 | **200**；`detail_en` 223 B、`detail_zh` 154 B；`shots` 只剩 `https://example.com/shot.png` + `probe-b.png`，`javascript:alert(1)` 与 `../secret.png` **被丢弃** |
| 审核状态不受影响 | `status=approved`、`reviewer=admin`、`reviewed_at`、`notes` 保存前后**完全一致** |
| `/api/directory/<slug>` | 200，`source=submission`，中英 `DetailBlock` 与 `shots` 都在 |
| `/tools/<slug>` (SSR) | 200，`id="how-to-use"` / `features` / `pros-cons` / `faq` 各 1；英文文案与两张截图 URL 都在；恶意串 0 次 |
| `/zh/tools/<slug>` (SSR) | 200，中文文案全部命中 |
| 中文块清空后 | 中文页显示英文文案，中文文案 0 次 ⇒ 回退生效 |
| 待审核行保存详情 | 200，但 `status` 仍 `pending`、`/api/directory/<slug>` **404** ⇒ 编辑详情不会越权发布 |
| 审核队列接口 | 200，两行都能读到 `detail_zh` / `shots` |

**浏览器 UI probe**（真实点击铅笔 → 弹窗 → 输入 → 保存）：

| 检查 | 结果 |
|---|---|
| 后台 hydration / 语言 | 完成；`<html lang="zh-Hans">`；12 个「编辑详情」按钮 |
| 弹窗文案 | 使用步骤 / 优点 / 缺点 / 主要功能 / 适合谁用 / 常见问题 / 产品截图 / 保存详情 / 中文 全部命中 |
| 中英双草稿互相独立 | 英文写入 `English first step from the browser` → 切中文是空草稿（0 个 textarea）→ 切回英文内容**还在** → 中文另写 `浏览器里写入的第一步` |
| 截图输入 | `ui-probe.png` |
| 保存 | toast「详情已保存」，无错误；D1 里 `detail_en` / `detail_zh` / `shots` 三份都正确落库 |
| typecheck | 仍只有 3 条既有 Blog 报错（`blog/index.vue` 1 条、`shared/content/blog.ts` 2 条），本轮 **0 新增** |

探测数据已清空，3122 / 3124 / 9223 / 9224 端口均已释放。

### ⚠️ 上线前必须做的一次性 D1 迁移

`schema.sql` 里是 `CREATE TABLE IF NOT EXISTS`，**不会给线上已存在的表加列**。
所以 `npm run db:remote` 不能替代迁移。读路径对缺列是容错的
（`parseDetail(undefined)` 返回空块），但**写路径会直接报错**，
必须在开放「保存详情」之前补列：

```bash
npx wrangler d1 execute product-atlas --remote --command "PRAGMA table_info(submissions);"
```

输出里已经有三列就跳过；没有才逐条跑（每条一次，`ADD COLUMN` 没有
`IF NOT EXISTS`，重复跑会报 duplicate column）：

```bash
npx wrangler d1 execute product-atlas --remote --command "ALTER TABLE submissions ADD COLUMN detail_en TEXT NOT NULL DEFAULT '';"
npx wrangler d1 execute product-atlas --remote --command "ALTER TABLE submissions ADD COLUMN detail_zh TEXT NOT NULL DEFAULT '';"
npx wrangler d1 execute product-atlas --remote --command "ALTER TABLE submissions ADD COLUMN shots TEXT NOT NULL DEFAULT '';"
```

再跑一次 `PRAGMA table_info(submissions);` 确认三列都在。
`NOT NULL DEFAULT ''` 保证所有历史行原样保留，不需要改数据、不需要停机。

### 分步终端命令清单（存档；对话里一次只发一步，等贴输出再发下一步）

1. 复核改动：`git status --short` / `git diff --stat`，应看到 4 改 + 2 新
2. typecheck：`env -u NODE_OPTIONS npm run typecheck`（3 条既有 Blog 报错属预期）
3. 提交推送：`git add … && git commit -m "feat(admin): editable editorial detail and shots for submissions" && git push origin main`
4. 本地构建：`NITRO_PRESET=cloudflare_module npm run build`（看 `Σ Total size`，不看 `index.mjs`）
5. **线上 D1 迁移**：上面的 `PRAGMA` + 三条 `ALTER TABLE` + 复核
6. 部署：`npx wrangler deploy`，记下 Version ID 与上一版（回滚点）
7. 线上只读探针：无 cookie 新接口 404、带 cookie `/admin/submissions` 200、
   既有 `/tools/<slug>` 仍 200、`sitemap` URL 数不变、robots 仍 `Disallow: /admin`
8. 收尾：把部署记录与 Version ID 补进本文件，再提交一次

线上写冒烟（真填一条详情 → 详情页 200 → 删掉测试数据）建议单独做，
会改生产数据，需 owner 单独确认。

### 已知限制

- 详情只能站长写，提交者端不提供填写入口（B 方案的定义）。
- 纯文本，没有富文本 / markdown；每组最多 20 条，截图最多 8 张。
- bare filename 截图得先有文件放在 `public/assets/img/screenshots/`，
  没有上传 UI；想立刻生效就填绝对图片 URL。
- `nuxt/.env` 里本地 15 位 `NUXT_ADMIN_TOKEN` 与线上 32 位 secret 仍不一致，
  纯本地文件、不影响线上；本地测试用的是 `.env` 的值。
- 在线支付仍关闭（`ready:false`），审核邮件未配置时静默跳过。
- 队列接口单次最多 200 条，搜索/分页在浏览器内做；超过 200 条才需补后端分页。
