# 15 · 定价体系去重与 Waffo 商品配置

日期：2026-11-18
范围：`shoulu-Sass/nuxt`（全站定价项 + Waffo 生产商品）
状态：**代码已完成本地验证，未部署、未推 GitHub**（等 owner 说「上线」/「推」）

---

## 一、一句话结论

全站原来只有「一个价格」这一个概念，导致同一个 SKU 在不同页面显示不同金额、后台和结账各算一套；现在改成 **常规价（list）+ 活动价（sale）双字段**，所有页面和结账都从 `effectiveQuote()` 取同一个数；Waffo 侧原来只有 1 个命名错误的商品（`Featured Directory Listing (30 days)` / $39），现已按 SKU 建齐 6 个商品，常规价入库、活动价由服务端 `priceSnapshot` 传，**活动到期自动回常规价，不需要再动 Waffo**。

---

## 二、定价模型：常规价 + 活动价

改动文件：`shared/content/pricing.ts`、`shared/utils/pricing-effective.ts`、`shared/content/campaign.ts`

| SKU | 名称 | 常规价 | 活动价（现在实收） | 2026-12-01 06:59 后 |
|---|---|---|---|---|
| `free` | 免费 / Free | $0 | $0 | $0 |
| `boost` | 加速 / Boost | **$10** | **$4.99** | $10 |
| `standard` | 标准 / Standard | **$19** | **$9** | $19 |
| `featured` | 精选 / Featured | **$39** | **$19** | $39 |
| `pro` | 专业 / Pro | **$69** | **$29** | $69 |
| `billboard` | Billboard（自己出价） | 地板 $10 | 地板 $10（不参与活动） | $10 |
| `ad` | 右栏广告 / Right sidebar ad | **$19/周**、4 周 $76 | **$9/周**、4 周 $32 | $19 / $76 |

关键设计：

- `price` / `amountCents` = 常规价，`saleCents` = 活动价，两个字段并存，不再用「百分比折扣」推算（`CAMPAIGN.off` 保持 0，四档折扣率不同，用百分比会算出假价）。
- `effectiveAmountCents()` 是**唯一**决定实收金额的函数：活动期内返回 `saleCents`，`CAMPAIGN.endsAt` 之后自动返回 `amountCents`。结账页读它，浏览器传不了金额。
- `effectiveQuote()` 同时给出 `priceLabel`（实收）、`strikeLabel`（划线常规价，无活动时为 `null`）、`active`。
- 新增 `planSaleAmountCents()` / `adSalePriceCents()`，与 `planAmountCents()` / `adPriceCents()` 成对。
- `anchorAmountCents()` 不再手写常数，改为「常规价 > 活动价」自动推导——以后改价只改一处。

---

## 三、全站去重与命名统一（逐项）

| # | 位置 | 原来的问题 | 处理 |
|---|---|---|---|
| 1 | `/submit` 的 FAQ | 写着「Premium 一次性 $19，精选推荐 30 天」——**$19/30 天这个商品根本不存在**（Featured 是 7 天置顶，$39 常规 / $19 活动） | 文案改为不写死金额与天数：付费方案一次性、付款即上线、永久 dofollow，置顶天数按方案（精选 7 天 / 专业 90 天），金额看上面的方案卡 |
| 2 | `app/utils/directory-ui.ts` | 还留着一张源码时代的 `SUBMIT_TIERS` 表（`$19 / featuredDays: 30`），全站无人引用但会被后人当定价源 | **整表删除**，并在文件头写明「`/submit` 只认 `shared/content/pricing.ts`」 |
| 3 | 「我的提交」徽章 | 任何付费行都显示 **Premium**，而站点没有 Premium 这个档 | 改用 `planLabelOf()`，显示真实方案名（加速/标准/精选/专业） |
| 4 | `planLabelOf()` | `pro` → 「专业版」、`featured` → 英文 `Featured`（中文界面也出英文）、`standard`/`ad` 都 → `Standard` | 统一从 `tiers` 表取名，中英各一份，`paid`/`ad` 别名映射到 `featured`/`standard` |
| 5 | `planPriceOf()` | 用 `planAmountCents()` = 常规价，于是「我的提交」的付款按钮显示 $39，结账实际扣 $19 | 改用 `effectiveQuote().priceLabel`，与结账同源 |
| 6 | `/legal` 计费条款 | 写死「右栏 $19/周，4 周 $76」，与实收 $9 / $32 冲突 | 改用 `effectiveQuote`，活动期内输出 `$9 (regular $19)`；四档收录价同样输出「实收（常规 $X）」 |
| 7 | `/sponsor` | 第一个位置叫 **Featured spot**，与「精选收录」档同名，买家分不清买的是广告还是收录 | 改名为 **Billboard**（id 也改为 `billboard`），CTA 改「认领 Billboard」；H1 从「赞助一周」改为「投放广告」；页脚说明「Billboard 一次付清，右栏按周；收录方案另计」 |
| 8 | `/book-ad` | 位置卡价格写死 `$9`（来自静态 `entry.price`），与活动价脱钩 | 改为 `weekQuote.priceLabel` + 划线价；4 周按钮上直接显示 `$32`，不再等选中才看得到 |
| 9 | `/book-ad` 投放时长 | 两个按钮只有「1 周 / 连投 4 周」，没有金额 | 按钮上补金额（`$9` / `$32`） |
| 10 | 右栏广告命名 | 三种叫法混用：`右栏位`（pricing 表）、`右栏广告`（pricing/sponsor 页）、`Sidebar slot`（rules/book-ad） | 统一为 **右栏广告 / Right sidebar ad**，`AdPlan.name` 一处改，book-ad、rules、offer slot 全部跟随 |
| 11 | `homeOfferSlots()` | 首页广告位卡用 `tier.price`（常规价），活动期会显示 $39 而实际扣 $19 | 改用 `effectiveQuote`，卡上金额永远等于结账金额 |
| 12 | `/pricing` 标题 | 写死「$4.99 加速」 | 改为 `effectiveQuote('listing','boost').priceLabel` 动态拼接 |
| 13 | `/pricing` 右栏小广告卡 | 写死 `$9 / week` | 改为 `effectiveQuote('sidebar','1').priceLabel` |
| 14 | `/faq`、`/rules` | 写死 `$9`、`$19` 与 `sidebar.price`（字符串） | 全部改 `effectiveQuote`，`price` → `priceLabel` |
| 15 | `/alternatives` | CTA 写死 `$4.99` | 改为 `boostLabel` 动态 |
| 16 | 定价 FAQ | 旧 5 条，缺少「加速会不会买票」「能不能退款」等买家真正会问的 | 重写为 7 条：是否买票 / 何时上线 / 怎样拿 dofollow / 能否换方案 / 广告位怎么运作 / 有没有订阅 / 能否退款 |

**确认无重复的项**（核对过，不需要动）：

- Billboard 的 `entry $15 / standard $29 / prime $49` 只是历史订单的存储标签，**没有任何页面在卖这三档**，页面只卖「从 $10 起自己出价」。
- `billboard` 与 `ad`（右栏）是两个不同位置：前者一次性出价进 Top10，后者按周租右栏，结账入口分别是 `/billboard` 与 `/book-ad`，不重叠。
- 收录四档（Boost/Standard/Featured/Pro）是递进关系（Boost 加徽章、Featured 加 7 天置顶、Pro 90 天），不是并列的重复项。

---

## 四、Waffo 商品：直接通过 API 建齐

### 4.1 改造前

账号里只有 1 个一次性商品：

```
PROD_5HQOX0laZm15SKWQTSgYEB
Featured Directory Listing (30 days)   USD 39.00   active
```

三个问题：① 名字写「30 days」，而精选是 **7 天置顶**；② $39 现在是**常规价**，实收 $19，名字会误导对账；③ 一个商品卖六个 SKU，后台分不清谁买的是 Boost 谁买的是 Pro。

### 4.2 改造后

| SKU | Waffo 商品 ID | 商品名 | 商品内价格（常规价） |
|---|---|---|---|
| `boost` | `PROD_4eD1iGfl1bqdhaGul01hor` | Product Atlas — Boost | $10.00 |
| `standard` | `PROD_421o8REQUoFO0L0PlvWhXx` | Product Atlas — Standard listing | $19.00 |
| `featured` | `PROD_5HQOX0laZm15SKWQTSgYEB` | Product Atlas — Featured listing (7-day pin) | $39.00 |
| `pro` | `PROD_6RYnnSdwxk4IRXMEkETtqd` | Product Atlas — Pro listing (90-day pin) | $69.00 |
| `billboard` | `PROD_76I8otMCarp0AiIoKtdYLf` | Product Atlas — Billboard placement | $10.00（地板） |
| `ad` | `PROD_44caej1VRQG0QqYBWuvrBh` | Product Atlas — Sidebar ad (1 week) | $19.00 |

- 旧商品**复用**为 Featured（改名 + 改描述 + 写 metadata），ID 不变 ⇒ 已部署的 `NUXT_WAFFO_PRODUCT_ID` 仍然指向一个正确命名的商品，线上不会因为改名而中断。
- 每个商品的 `metadata` 都带 `sku` / `regular_amount` / `campaign_amount` / `campaign_ends_at` / `note`，后台点开就知道这一档现在的活动价与到期时间。
- 已写入 Worker 密钥 **`NUXT_WAFFO_PRODUCT_IDS`**（JSON）：

```json
{"boost":"PROD_4eD1iGfl1bqdhaGul01hor","standard":"PROD_421o8REQUoFO0L0PlvWhXx","featured":"PROD_5HQOX0laZm15SKWQTSgYEB","paid":"PROD_5HQOX0laZm15SKWQTSgYEB","pro":"PROD_6RYnnSdwxk4IRXMEkETtqd","billboard":"PROD_76I8otMCarp0AiIoKtdYLf","ad":"PROD_44caej1VRQG0QqYBWuvrBh"}
```

`paid` 是提交表单的历史别名（= Featured），一并映射，避免老订单落到兜底商品上。

### 4.3 活动价为什么不写进 Waffo

Waffo 商品里放的是**常规价**，活动价由结账时 `priceSnapshot` 传入：

```
effectiveAmountCents('listing', submission.plan)   →   priceSnapshot.amount
```

原因：写进商品就意味着到期要再调一次 API，漏调就会在 12 月 1 日之后继续按 $4.99 收款。现在到期后 `effectiveAmountCents()` 自动返回常规价，`priceSnapshot` 传的也是常规价，与商品价一致，**不需要任何人工操作**。

Waffo 侧的活动券（`client.coupons.create`）没有启用：券会和 `priceSnapshot` 叠加，容易出现「以为收 $9 实际收 $4」这类不可控结果，收益不抵风险。活动只由站点时钟控制。

---

## 五、验证结果

| 项目 | 结果 |
|---|---|
| `npm test` | **104 / 104 通过**（含新增「Boost 常规 $10、活动 $4.99、到期回 $10」专项断言） |
| `npx nuxi typecheck` | **10 条既有基线错误，零新增**（admin/billboard 3、admin/tools 2、submissions 1、blog.ts 2、batch2-copy.test 2） |
| 页面巡检（16 个页面 × 4 个宽度 = 64 次加载） | **横向溢出 0、console 异常 0、页面报错 0**（宽度 1440/1280/768/390；含 `/pricing`、`/faq`、`/rules`、`/sponsor`、`/advertise`、`/book-ad`、`/submit`、`/billboard` 中英双语） |
| 每页出现的金额 | `/pricing` 与 `/zh/pricing` 均为 `$0 $4.99 $9 $10 $19 $29 $39 $69`，与定价表逐项一致；`/faq`、`/rules` 多出 `$32`（4 周活动价）与 `$15`（Billboard「此前从 $15 起」的历史说明），符合预期 |
| Waffo 结账会话 | **12 / 12 成功**：6 个 SKU × 2 种金额（活动价 / 常规价）全部能开出 `checkoutUrl`，说明商品 ID 与金额都被 Waffo 接受 |
| 线上支付配置 | `https://dirtool.com/api/payments/config` 返回 `{"ok":true,"ready":true,"provider":"waffo"}` |

---

## 六、没做的事（等 owner 决定）

1. **没有部署**，也没有推 GitHub —— 代码改动全部在本地工作树。
2. **没有停用任何旧商品**：旧的 `PROD_5HQOX0laZm15SKWQTSgYEB` 现在就是 Featured，仍在服役；等新版部署验证通过后，如果确认不再需要兜底，可以再决定是否停用。
3. **没有开启 Waffo 侧优惠券**（理由见 4.3）。
4. `/pricing` 存在一个**既有的间歇性 hydration 警告**（来自 `BlackFridayDeal.vue` 的 `now = ref(Date.now())`），不是本次改动引入，未处理。
5. 首页「免费 vs 加速」对比表里 Boost 只显示实收 `$4.99`，没有同时列常规价 `$10`；上方卡片已有划线价，判断为可接受，未改。

---

## 七、脚本位置（可重跑）

```
scripts/waffo/waffo-products.mjs   # 建/改商品；默认 dry run，加 --apply 才写
scripts/waffo/waffo-verify.mjs     # 6 SKU × 2 金额开结账会话，验证商品与金额
```

两者都读 `WAFFO_KEY_PATH`（默认 `/Users/mac/waffo-prod.pem`），密钥不进仓库。
