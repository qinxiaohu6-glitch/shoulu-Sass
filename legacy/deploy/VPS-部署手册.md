# 迁移到自有域名（VPS）操作手册

目标：让站点跑在**自己的域名**上，不带分享码门禁，Googlebot 能正常抓取。

现状：内置托管给的是 `*.apps.workbuddy.host/?sharecode=…`，无分享码一律 403 且带 `noindex`，
`robots.txt` 也是 403 —— 搜索引擎完全看不到。所以必须换托管，这不是可选项。

---

## 0. 先决条件（两个都要买）

| 东西 | 建议 | 花费 |
|---|---|---|
| 域名 | Cloudflare Registrar 或 Namecheap，`.com` 即可 | 约 $10/年 |
| 服务器 | 1 核 1G 够用，Ubuntu 22.04/24.04 | 约 $5/月 |

**境内还是境外？**

- **境外（推荐先用）**：香港/新加坡/日本，免 ICP 备案，当天能上线。代价是大陆访问稍慢（香港通常 50–120ms）。
- **境内**：阿里云/腾讯云轻量，访问快，但**必须 ICP 备案**（需要实名域名 + 服务器，周期 1–3 周），未备案不能解析到 80/443。

先上线选境外；等有稳定流量再考虑备案回国。

---

## 1. DNS

在域名商处加两条 A 记录，指向服务器 IP：

```
A   @       <服务器IP>
A   www     <服务器IP>
```

等 `dig +short 你的域名` 能返回 IP 再往下走。

---

## 2. 服务器初始化

```bash
ssh root@<服务器IP>

apt update && apt upgrade -y
apt install -y python3 nginx certbot python3-certbot-nginx rsync
adduser --system --group --no-create-home www-data 2>/dev/null || true

mkdir -p /opt/product-atlas
chown -R www-data:www-data /opt/product-atlas
```

---

## 3. 上传代码

在**本机**执行（注意 `data/` 里是密钥，别传到公开仓库）：

```bash
cd "/Users/mac/WorkBuddy AI/建站UI/dir-shipany-clone"

# 先用新域名重新构建：canonical / sitemap / OG 都靠 SITE_BASE
SITE_BASE=https://你的域名 python3 build.py

rsync -avz \
  --exclude 'node_modules' --exclude '.git' --exclude '.DS_Store' \
  --exclude '__pycache__' \
  ./ root@<服务器IP>:/opt/product-atlas/
```

**第一次迁移不要加 `--delete`。** 它会删掉服务器上有、本机没有的文件 —— 而线上收到的真实提交
（`data/submissions/`）正好属于这一类，一加就全没了。等两边确认一致之后再用。

以后日常更新（只改页面，不动数据）可以加 `--delete`，但务必保留
`--exclude 'data'`，否则同样会清掉服务器上的提交记录。

---

## 4. 目录权限

```bash
chown -R www-data:www-data /opt/product-atlas
chmod 700 /opt/product-atlas/data
chmod 600 /opt/product-atlas/data/*.txt /opt/product-atlas/data/google-oauth.json
```

`data/` 必须是 `www-data` 可写，否则提交接口会返回 503（存储不可用）。

---

## 5. systemd

```bash
cp /opt/product-atlas/deploy/product-atlas.service /etc/systemd/system/
# 改三处：Environment=SITE_BASE=https://你的域名
nano /etc/systemd/system/product-atlas.service

systemctl daemon-reload
systemctl enable --now product-atlas
systemctl status product-atlas --no-pager
```

自检（本机）：

```bash
curl -s localhost:8898/api/health
# 期望：{"ok":true,...,"submissions_writable":true,"google_oauth":true}
```

`submissions_writable` 是 `false` 就是第 4 步的权限没对。

---

## 6. nginx + 证书

```bash
cp /opt/product-atlas/deploy/nginx.conf /etc/nginx/sites-available/product-atlas
# 把里面 4 处 example.com 换成你的域名
nano /etc/nginx/sites-available/product-atlas

ln -s /etc/nginx/sites-available/product-atlas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx -d 你的域名 -d www.你的域名
```

证书自动续期由 certbot 的 timer 负责，`systemctl list-timers | grep certbot` 可确认。

---

## 7. 切换 Google OAuth 的回调地址

**这一步不做，登录会直接失败（`redirect_uri_mismatch`）。**

1. 打开 https://console.cloud.google.com/auth/clients?project=august-lamp-513303-t9
2. 编辑 `product-atlas-web`
3. 在「已获授权的重定向 URI」里**新增**（不要删旧的，旧站还在跑）：
   ```
   https://你的域名/auth/google/callback
   ```
4. 保存后，改服务器上的 `/opt/product-atlas/data/google-oauth.json`：

```json
{
  "client_id": "…",
  "client_secret": "…",
  "redirect_uri": "https://你的域名/auth/google/callback"
}
```

5. `systemctl restart product-atlas`

---

## 8. 验收（按顺序，每条都要过）

```bash
# 1. 不带任何参数也能打开（这是迁移的全部意义）
curl -s -o /dev/null -w '%{http_code}\n' https://你的域名/
# 期望 200，不是 403

# 2. robots.txt 能读
curl -s https://你的域名/robots.txt | head -5

# 3. 用 Googlebot 的身份抓一次
curl -s -o /dev/null -w '%{http_code}\n' \
  -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://你的域名/
# 期望 200

# 4. canonical 指向新域名
curl -s https://你的域名/ | grep -o '<link rel="canonical"[^>]*>'

# 5. sitemap 里的地址是新域名
curl -s https://你的域名/sitemap.xml | grep -o '<loc>[^<]*</loc>' | head -3

# 6. 接口正常
curl -s https://你的域名/api/health

# 7. 后台仍然只有站长能进（无 token 应 404）
curl -s -o /dev/null -w '%{http_code}\n' https://你的域名/admin.html
```

第 3 条通过之后，再去 [Google Search Console](https://search.google.com/search-console) 添加域名、
提交 `https://你的域名/sitemap.xml`。**在这之前不要提交** —— 提交一个全是 403 的站点只会浪费时间。

---

## 9. 迁移时要带过去的东西

`data/` 里这些文件是运行时产生的，不在构建产物里，必须一起搬：

| 文件 | 为什么不能丢 |
|---|---|
| `data/submissions/*.json` | 真实提交记录，丢了就真丢了 |
| `data/session-secret.txt` | 换了它，所有已登录用户会被登出 |
| `data/admin-token.txt` | 后台入口的钥匙 |
| `data/google-oauth.json` | OAuth 凭据 |
| `data/ip-salt.txt` | 换掉会让限流计数重置 |
| `data/reports/*.json` | 已生成的 SEO 报告 |

如果服务器上已经有数据（比如先从旧站导过），**不要用 rsync `--delete` 覆盖**，改成：

```bash
rsync -avz root@<旧站>:/opt/product-atlas/data/ /opt/product-atlas/data/
```

---

## 10. 常见故障对照

| 现象 | 原因 |
|---|---|
| 502 Bad Gateway | `systemctl status product-atlas` 看进程；多半是端口或 Python 报错 |
| 提交返回 503 `storage_unavailable` | `data/` 不可写，见第 4 步 |
| 登录跳回 `?auth=redirect_mismatch` | 第 7 步的 Google 回调地址没加或没对上 |
| 登录跳回 `?auth=network` | 服务器出不了网（有些机房限制出站 443） |
| 页面样式全丢 | 构建时 `SITE_BASE` 没改，或 `/assets/` 的 nginx alias 路径不对 |
| 首页 403 | nginx 配到了别的 server 块，检查 `server_name` |
