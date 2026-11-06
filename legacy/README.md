# legacy/ — 旧站实现，只读

这个目录是**上一代实现**的归档。它不再运行，不再被任何东西引用，也不再接受改动。

```
legacy/
├── deploy/                      ← 旧站部署配置（nginx + systemd），已被 Workers 取代
│   ├── VPS-部署手册.md
│   ├── nginx.conf
│   └── product-atlas.service
├── build.py         3,575 行  静态构建：data/mvp.json → 204 个 HTML
├── serve.py         1,516 行  HTTP 服务：API、OAuth、后台、运行时注入
├── submissions.py     655 行  提交记录的校验 / 存储 / 状态机
├── audit.py           479 行  SEO 审计（抓取 + 打分）
├── auth.py            383 行  Google OAuth + HMAC 会话
├── report_page.py     246 行  审计报告页渲染
├── reports.py         242 行  审计报告存储
├── mvp_data.py        228 行  种子数据生成器
├── ads.py             218 行  周广告位数据层
├── mail.py            157 行  SMTP 事务邮件
├── drcheck.py         129 行  域名权重查询
├── prep.py            125 行  内容预处理
├── make_dist.py       111 行  静态部署包打包
├── overrides.py        90 行  置顶 / 下架覆盖
├── votes.py            88 行  周榜投票
└── tool_page.py        87 行  渲染「构建后新增」的产品页
```

## 为什么归档而不是删掉

1. **现在的实现是从它移植过来的。** `nuxt/server/utils/*.ts` 的注释里多处写着「ported from the old file store」，指的正是这里的文件。想知道某条规则为什么长这样，答案往往在这个目录里。
2. **历史可以逐行追。** 移动用的是 `git mv`，所以 `git log --follow legacy/submissions.py` 能看到它在旧位置的全部提交。删掉就查不到了。
3. **它的数据还在被参考。** 根目录那些旧的 `*.html`、`assets/`、`zh/`、`tools/` 是它生成的产物，用于对照旧文案与旧 URL。

## 三条硬规则

1. **不要修改这里的任何文件。** 改了不会影响线上，也不会影响 `nuxt/`，只会让「这是历史快照」这句话变成假话。
2. **不要从这里启动服务。** `python3 legacy/serve.py` 仍可能跑起来（它按相对路径找 `data/`），但它服务的是旧站，和 `dirtool.com` 上跑的东西无关。
3. **要改行为，改 `nuxt/`。** 现行实现在 `nuxt/server/`（后端）和 `nuxt/app/`（前端），入口见 [`../docs/02-技术架构.md`](../docs/02-技术架构.md)。

## 顺带说一句：根目录的 `data/`

`data/` **不在**这个目录里，但它是同一代的东西——旧站的运行时数据（`mvp.json` 是 `nuxt/shared/content/catalog.json` 的来源，留着当参考）。

⚠️ 里面有四个密钥文件，**性质不一样，别一律当废纸**：

| 文件 | 状态 |
|---|---|
| `admin-token.txt` | 2026-11-05 重设过，现在记录的是**线上在用的** `NUXT_ADMIN_TOKEN`（权限 600，`.gitignore` 挡住了） |
| `session-secret.txt` | 旧 Python 进程的，**已失效**。线上用 `wrangler secret` 里的 `NUXT_SESSION_SECRET` |
| `ip-salt.txt` | 同上，**已失效** |
| `google-oauth.json` | **仍然有效**，而且线上用的就是这一对。OAuth 客户端是 Google 侧的对象，换服务器不会让它失效——2026-11-05 就是靠它把生产登录接通的 |

所以：前三个按「旧凭据」处理，`google-oauth.json` 不是。它记录的 `redirect_uri` 只是**期望值**，Google 侧真正登记了什么要以控制台为准（这里踩过坑，见 [`../GOOGLE-OAUTH-接入说明.md`](../GOOGLE-OAUTH-接入说明.md)）。


## 它为什么被替换

旧的方案是「Python 编译静态 HTML + Python 长驻进程在请求时注入」。它工作过，但有三件事一直绕不过去：

- **写入路径依赖一台常开的机器。** 换机器要重装 Python、重配 systemd、重签证书。
- **「构建后新增」的东西要靠注入点 hack。** `<!--community:all-->` 这类标记是运行时字符串替换，不是数据驱动。
- **没有真正的数据库。** 一条提交一个 JSON 文件，列表页要读全目录再排序。

现在的实现是 Nuxt 4 + Cloudflare Workers + D1（SQLite），这几件事都成了常规做法。细节见 `../docs/02-技术架构.md`。
