# Waffo 开户自检合规改造说明

> 状态：**已完成本地改动 + 本地验证，未提交、未构建、未部署、未改线上。**
> 日期：2026-11-06 · 范围：`nuxt/` 子站 · 域名 TXT 验证已在 Cloudflare 完成。
> 客服邮箱 `qinxiaohu6@gmail.com`、X `@qinxiaohu1029` 已落地。
> Waffo 后台**只有服务条款 / 隐私政策两个 URL 字段**，AUP、内容审核、举报、处置全部内嵌在这两页里并做了页内可点击互链。
> 22:11 自检报告 4 条的逐条回应见 **第 0 节**；可直接复制给 Waffo 的英文说明见 **第 10 节**。
>
> **2026-11-08 更新**：生产已接入 Waffo Pancake 在线支付，付费档由**验签后的 webhook 自动完成订单并发布收录／排期广告位**，不再是人工确认收款；服务条款与隐私政策的「交付」章节已同步改写。本文下方凡描述「人工确认收款／人工交付／不宣称即时交付」的段落，均为**开户当时的历史状态**，不代表当前线上实现；人工确认只作为「未启用在线支付或回调丢失」时的兜底。

---

## 0. 针对 22:11 自检报告的逐条回应（先看这一节）

### 前提：这份自检抓的是**线上旧版**，不是本地已改好的新版

本地改动按约定**尚未部署**。只读探测线上 `https://dirtool.com/terms-of-service` 的结果：

| 本地新版特征 | 线上命中数 |
|---|---|
| `Version 1.0` | 0 |
| `qinxiaohu6@gmail.com` | 0 |
| `Waffo Pancake` | 0 |
| `acceptable-use` | 0 |
| `7 days` / `退款` / `Refund` | 0 |

线上隐私政策的邮箱、`Waffo Pancake`、`Moderation` 也都是 0，首页页脚邮箱同样是 0。**自检看到的仍是改动前的两页简版**，所以前三条「缺内容」的结论对旧版成立，对本地新版不成立。

### 四条结论

| # | Waffo 自检 | 判断 | 本地新版现状 |
|---|---|---|---|
| 1 | 服务条款没有退款政策 | ✅ **已写好，只差部署** | `#billing`「计费、退款与取消（一次性付款）」共 10 条：7 天首次购买全额退、上线前随时退、6 类仍可退情形、不予退款情形、申请方式（邮箱/X/工单）、2/5/5–10 工作日时限、账单争议 |
| 2 | 没有 AUP／六类禁止内容／审核／举报／处置 | ✅ **已写好，只差部署** | `#acceptable-use` 六类逐条 + 零容忍清单；`#content-moderation` 人工筛查 + 定期复查；`#reporting` 真实渠道 + 保密/申诉；`#enforcement` 警告→删除→限制提交→封号→移交机关。两页政策都有页内可点击链接 |
| 3 | 未披露图片/视频/语音生成的底层 AI 模型 | ❌ **误判，不能按建议改** | 本站**没有任何生成功能**：无 prompt 输入框、无生成接口、无模型 SDK 调用、无模型切换、无真人照片/语音上传、无生成输出。触发词来自 `shared/content/catalog.json` 的**第三方产品分类名**（第 105/111/171 行 `Video Generation` / `Image Generation` / `Text to Speech`）与 ElevenLabs 的产品简介（第 788/790 行 `text-to-speech, voice cloning and dubbing`）。按建议写 Flux / Seedream / Nano Banana / GPT Image / Veo / Kling 会构成**对产品的虚假陈述**，比缺项更严重 |
| 4 | 页脚与全站无有效客服联系方式 | ✅ **已写好，只差部署** | 页脚 `qinxiaohu6@gmail.com`（mailto）+ X `@qinxiaohu1029` + 站内工单；隐私政策 Contact 章节同步写明；EN / `/zh` 双语均验证 |

### 本轮为第 3 条额外补的消歧（主动补，超出原确认范围）

不编模型名，改成把「不是生成平台」这句话放到机器和人工都能看到的位置：

- 服务条款新增独立章节 `#no-generative-features`（中英双语、5 条要点）：逐条点名自检里的触发词并**明确否定**、说明这些词来自第三方产品标签、解释为何不列模型名（引用 Waffo AUP 模板 `Delete any category, channel, or action that doesn't apply`）、列出本站实际售卖的东西、指向 AUP 与 `#billing`。
- 全站共享页脚新增一行站点性质声明，任何页面（含 `/tags/*`、`/tools`）都会带上；Resources 栏新增「非生成平台声明 / Not a generation platform」直达该锚点。
- 页脚链接与锚点都经 `linkHref()` / `localePath()` 处理，中文页自动带 `/zh`。

> 第 3 条最终能否消掉，还取决于 **Waffo 侧把开户业务类型从「AI 生成/内容生成类」改成目录 / 信息服务 / 推广位**，或直接把第 10 节的英文说明交给人工复核。代码能做的是把事实讲清楚，不能替审核员改分类。

### 顺手修掉一个真实渲染瑕疵

服务条款中文文案里用了 `**加粗**` 标记，但 `LegalDocument.vue` 原来只解析 URL/邮箱，页面上会**把星号原样打印出来**（例如「均为**一次性购买，不是订阅**」）。现在渲染器先切粗体片段再分词，输出真正的 `<strong>`，链接与 `/zh` 处理不受影响。

---

## 1. 这一轮依据的 Waffo 原文（认真核对过，不是套模板）

Waffo 的 `Terms of Service Template` 原文明确：

- `Sections 1–3 & 8–16 (use in every version)` —— 通用章节每个版本都要。
- `Pick the one block that matches your billing model and slot it between Section 3 and Section 8. Delete the other two.`
- 只提供三个计费块：**V1 Subscription / V2 Credits, Top-up / V3 Hybrid**，标题就叫 `Terms of Service — AI-Powered Services`。
- 模板自己还写了 `Deleted the sections that don't apply`、`Keep 2.3 only if you depend on third-party AI providers`、`9. AI Output & Intellectual Property (if you ship AI)`。
- `Have a lawyer review before publishing if your jurisdiction or business model is unusual.`

**本站不属于这三种计费模式的任何一种**：所有付费项都是一次性购买，没有订阅、没有积分、没有自动充值、没有自动续费。**模板没有 V0 / one-time-only 块**，所以正确做法是保留通用章节、自己写一段「一次性付款」的 4–7 块，并按模板的删除规则把 V1/V2/V3 全部删掉 —— 而不是把 V1 订阅条款照抄进服务条款。

### Waffo 章节 → 本站处理对照

| Waffo 模板章节 | 本站处理 |
|---|---|
| 1 Introduction & Acceptance | 保留：年满 18 岁、同意本条款 + AUP + 隐私政策、结账即视为同意 |
| 2 Service Description | 保留：明确是第三方软件**目录**，不生成内容、不调用模型 |
| 2.3 AI Model Dependency (optional) | **删除**：不依赖任何第三方 AI 模型 |
| 3 Account Registration | 保留：Google OAuth（本站不存密码）、账号安全、企业提交授权 |
| 4–7 **V1 Subscription** | **删除**：无订阅、无循环扣款授权、无续费提醒、无站内取消流程 |
| 4–7 **V2 Credits / Top-up** | **删除**：无积分、无积分有效期、无自动充值 |
| 4–7 **V3 Hybrid** | **删除**：无 rollover / consumption order 三选一 |
| 4–7 **自定义一次性付款块** | **新增**：真实价格、Waffo Pancake、交付内容、dofollow、7 天退款、响应与到账时限、账单争议、税费 |
| 8 Billing Disputes | 保留：2 工作日回复 / 5 工作日解决 |
| 9 AI Output & IP (if you ship AI) | **删除**：本站不产出 AI 输出，没有可披露的模型名 |
| 10 Acceptable Use Policy | 保留：六类禁止内容 + 零容忍清单 |
| 11 Data, Privacy & Security | 保留：**点名 Waffo Pancake**、PCI-DSS、Cookie、保留期限、隐私政策链接 |
| 12 Disclaimers & Limitation | 保留：补 12 个月责任上限；删除 AI-output disclaimer |
| 13 Term & Termination | 保留：说明无订阅可取消、账号/数据可要求删除 |
| 14 Governing Law | 保留 |
| 15 General Provisions | 补**重大变更提前至少 14 天邮件通知** + 版本记录 |
| 16 Contact Information | 只列真实有人看的渠道：邮箱、X、站内工单（不编 6 个部门） |

### 发布前 Checklist 对照

| Waffo 🔴 Must be done | 本站 |
|---|---|
| Legal name filled in | ⚠️ 仍为品牌占位，**待你提供注册/经营主体** |
| Recurring / auto-top-up authorization (if you charge automatically) | 不适用，条款明写从不自动扣款 |
| In-product cancel flow (not email-only) | 不适用；条款写明「未付款订单无需取消，不付款即可，从不自动扣款」 |
| Refund policy filled in **and shown at checkout** | ✅ 条款已写；⚠️ **Waffo Pancake 后台 store settings 里还要存一份**，结账页会自动带上（见第 8 节） |
| Third-party AI providers declared (if you use them) | 不适用，本站没有模型 |
| Prohibited-uses list matches your actual product | ✅ AUP 按目录站适配 |
| Payment processor named **Waffo Pancake** | ✅ 服务条款与隐私政策都点名 |
| Every contact channel listed is real and monitored | ✅ 邮箱 + X + 工单，全部真实 |
| 🟡 Billing descriptor | ⚠️ Waffo 后台设置，避免持卡人不认识扣款方（拒付首要原因） |
| Final pass: version + effective date / 删除不适用章节 | ✅ `Version 1.0`、生效日 `2026-11-06`、V1/V2/V3 全删 |

---

## 2. 按真实产品与定价改了什么

所有价格、交付周期、能力都对照代码核过，没有编：

- **收录四档**：Free `$0` / Standard `$19` / Featured `$39` / Pro `$69`，`unit: 'one-time'`（`shared/content/pricing.ts`）。
- **提交页付费升级**：`$39`（`SUBMIT_TIERS.premium`）。
- **广告位**：榜单位 `$29 / 7 天`、右栏位 `$19 / 7 天`；连投 4 周分别 `$99`、`$65`。固定窗口、到期下架，**不是订阅**。
- **dofollow 属实**：Standard 及以上把外链从 nofollow 改成永久 dofollow。旧版条款曾写「不卖 dofollow 链接」，与定价页自相矛盾，**本轮已纠正**；同时明确不承诺排名/流量/收录/权重等结果。
- **交付时间**：免费审核通常 7–14 天、不保证；付费在站长确认收款当天上线。人工交付，**不宣称即时交付**（模板那句 `access is granted immediately` 不符合本站）。
- **支付处理方**：Waffo Pancake；代码中另有 Stripe / Creem 可选；未启用时人工确认收款。卡资料不进本站服务器。
- **退款**：首次购买者自首次扣款起 7 天内全额退款；上线前随时可退；重复扣款、误付、审核未通过、无法交付、≥72 小时服务中断全额退款；欧盟/英国 14 天撤回权保留。**不采用「概不退款」**。
- **响应时限**：2 工作日确认、5 工作日完成审核、5–10 工作日发起退款；账单争议 2 工作日回复 / 5 工作日解决。
- **AUP / 内容审核 / 举报 / 处置**四块仍然完整，并按 Waffo AUP 模板「删不适用项」的规则，只写目录站真能做的事，不伪造模型名或安全分类器。
- **联系方式**：邮箱 `qinxiaohu6@gmail.com`、X `@qinxiaohu1029`（`https://x.com/qinxiaohu1029`）、站内工单。页脚与两份政策的 Contact / Reporting / Refund 章节都可见。

---

## 3. ⚠️ 核对时发现的两处站内自相矛盾（本轮**未改**，需你拍板）

这两处不是 URL 问题，是**站内说法与条款打架**，Waffo 审站或人工复核可能挑出来：

1. **`/advertise` 仍在宣称月度订阅**。该页移植自 git 源码，写着「支付月度订阅」「按月自动续订，可随时在设置→我的广告中取消」「Billed monthly. Cancel anytime」「$49 / $149 / $299 每月」，`useSeo` 描述里也有 `billed monthly`。而 `/pricing` 是 `$29/周`、`$19/周` 且明写「不订阅、不自动续费」。
   - 现状：该页**不在 sitemap**、不在公开导航/页脚，只从两个 `/settings/*`（`noindex`）页面链过去，但 URL 公开可达，且 `/advertise` 的表单 `book()` 本来就是永远失败的占位。
   - 本轮**没动它**：你明确要求「其他页面按 git 源码来做」「先不删任何东西，等看过再决定隐藏哪些功能」，改它的档位价格和 CTA 属于改源码商业文案，应由你决定。
   - 建议二选一：① 把该页文案改成真实的一次性周租档位并指向 `/pricing#ads`；② 暂时加 `noindex` 并加一条「实际方案以定价页为准」的说明，等你决定隐藏哪些功能时再处理。
2. **`/pricing` 的退款 FAQ 与新条款冲突**。FAQ 现在答「上线前可以全额退，上线后不支持退款——反链已经生效，撤不回来」；服务条款按 Waffo 要求写的是「首次购买者 7 天内全额退款」。Waffo 模板明确 `Don't go with "no refunds"; at minimum give first-time buyers 7 days`。
   - 改 FAQ 等于改商业承诺，本轮**没动**，列在第 8 节请你选。

> 另外：条款里原有一句「可在 `/settings/submissions` 取消未生效订单」是错的 —— 实测该页只有状态展示和「去付款」，**没有取消按钮**。已改成「未付款订单无需取消，不完成付款即可，因为本站从不自动扣款」。

---

## 4. 改了哪些文件

| 文件 | 变化 |
|---|---|
| `shared/content/site-contact.ts` | 新建。集中 `CONTACT_EMAIL` / `LEGAL_NAME` / `SOCIAL_X_HANDLE` / `SOCIAL_X_URL` / `contactHref()`。邮箱与 X 已填真实值；改一个常量即全站生效；邮箱留空时不渲染任何假 `mailto:`。 |
| `shared/content/legal.ts` | 两页政策按 Waffo TOS/AUP 重写：`LegalDoc` 加 `version`；`fillText()` 注入 `{contact}` / `{legalName}` / `{x}` / `{xUrl}`；服务条款新增 `#billing` 一次性付款块、`#data-privacy`、责任上限、Term & Termination、14 天变更通知；隐私政策点名 Waffo Pancake + PCI-DSS；AUP 四锚点保留；Contact / Reporting / Refund 都加 X 渠道。**本轮补** `#no-generative-features` 独立章节（中英各 5 条，逐条否定自检触发词并解释为何不列模型名）。 |
| `app/components/LegalDocument.vue` | 渲染 `:id` 与 `Version 1.0 / 生效日期 / 经营主体 / 站点 URL`；段落里的 URL 与邮箱自动转可点击链接并经 `localePath()` 保持 `/zh`；**修复外部链接被误送进 `localePath()` 的 bug**（X 链接在中文页不会被拼成 `/zh/https://x.com/...`），外部链接加 `target=_blank` + `noopener noreferrer`。**本轮补** `**bold**` → `<strong>` 渲染，不再把星号打印到页面上。 |
| `app/layouts/default.vue` | Resources 栏加 AUP / 举报锚点链接；`footer__bottom` 渲染真实 `mailto:` **与 X 链接**，两者互相独立（清空邮箱不会顺带弄丢 X）；`linkHref()` 处理 `/zh` + hash。**本轮补** 全站页脚站点性质声明 + 「非生成平台声明」直达 `#no-generative-features`。 |

服务条款页内锚点：`#no-generative-features`、`#billing`、`#acceptable-use`、`#content-moderation`、`#reporting`、`#enforcement`、`#data-privacy`。**全部是服务条款页面内部跳转，不是 Waffo 后台要另填的 URL。**

没有新增页面、没有新增 URL、没改 sitemap / robots / D1 / 路由。

---

## 5. 本地验证结果

| 检查 | 结果 |
|---|---|
| `env -u NODE_OPTIONS npm run typecheck` | 只剩 3 条**既有** Blog 错误（`blog/index.vue` TS2551、`shared/content/blog.ts` TS2677/TS2345）；**本轮新增代码 0 错误** |
| 本地 `nuxt dev` 两阶段起服务 | 7 个 URL 全部 200 |
| EN / ZH 四个法律页 SSR HTML | 一次性付款声明、真实四档价格、广告位价格、Waffo Pancake、7 天退款、2/5/5–10 工作日、14 天变更通知、12 个月责任上限、dofollow、六类禁止内容、零容忍、非 AIGC 声明、Cookie 清单、儿童隐私、跨境传输、`Version 1.0`、`2026-11-06` 全部命中 |
| 六个页内锚点 `id=` | 全部命中 |
| 页脚邮箱 + X（EN 与 `/zh`） | 全部命中；中文页 X 链接仍是绝对 `https://x.com/...`，没有被拼坏 |
| 页内互链（两页 → 四个 AUP 锚点） | 全部命中；中文页自动带 `/zh` |
| `{contact}` / `{legalName}` / `{x}` / `{xUrl}` 占位符残留 | 0 |
| V1/V2/V3 残留（`Recurring Billing Authorization` / `Auto Top-up` / `Credits Validity` / `Your subscription renews automatically`） | 0 |
| 旧的假「取消未生效订单」措辞 | 0 |
| 新增 `#no-generative-features`（EN / `/zh`） | 锚点、章节标题、触发词否定句、模型名否定句、`#billing` 链接全部命中 |
| 全站页脚消歧声明（EN / `/zh`） | 首页、中文首页、清空邮箱阶段均命中；Resources 新链接中英路径正确 |
| `**bold**` 渲染 | 输出 `<strong>一次性购买，不是订阅</strong>` / `<strong>7 天内</strong>`，不再打印星号 |
| **临时清空邮箱**再起服务 | 不出现假 `mailto:`；文案回退站内工单；**X 链接与页脚声明仍然保留**；测完已还原真实邮箱 |
| 端口 / 常量还原 | 无残留进程；`CONTACT_EMAIL` 已还原 |
| **探针合计** | **170 passed / 0 failed** |

> 本地探针脚本：`/tmp/compliance-probe.sh`（仅本地，未进仓库）。

---

## 6. Waffo 后台只填这两个 URL

| 字段 | 值 |
|---|---|
| 服务条款 URL | `https://dirtool.com/terms-of-service` |
| 隐私政策 URL | `https://dirtool.com/privacy-policy` |

中文镜像同样有效：`https://dirtool.com/zh/terms-of-service`、`https://dirtool.com/zh/privacy-policy`。

审核员从任一个 URL 进入，都能靠页内真链接走到 AUP、内容审核、举报申诉、处置措施；不需要（也没有）第三个字段。若备注栏允许附链接，可写 `https://dirtool.com/terms-of-service#acceptable-use`。

---

## 7. 对 SEO 与关键词的影响

1. **消除语义误判**。`catalog.json` 的 `Image Generation` / `Video Generation` / `Text to Speech` 等第三方产品标签容易让爬虫把本站读成 AIGC 生成平台。条款正文明确「本站是目录、不生成内容、不调用底层模型、这些词只是第三方产品标签」。
2. **不稀释权重**。没有为合规新增薄内容页；两个法律页本来就在 sitemap（priority 0.2），URL 与结构不变。
3. **信任信号**。真实联系方式、版本号与生效日期、政策互链、可引用的稳定锚点 URL。
4. **措辞纠正**：旧稿写「不卖 dofollow 链接」与定价页矛盾，现已改成「付费档确实把外链改为 dofollow，但不承诺排名/流量/收录/权重」，语义一致且避开「保证 SEO 效果」这类高风险表述。

---

## 8. ⚠️ 一次性列清楚：还需要你拍板的事

**已按你给的信息落地、无需再确认**：邮箱 `qinxiaohu6@gmail.com`；X 我按 `@qinxiaohu1029` / `https://x.com/qinxiaohu1029` 落地（你原文是 `@//qinxiaohu1029/`，**如果 handle 不是这个请纠正**）。

> 🔴 **当前唯一卡点是「新版没上线」**，不是文案没写好：22:11 自检抓的是线上旧版，重跑还会是同样 4 条。在你明确点头之前我不会构建或部署。确认后我按「一次一步」把终端命令发给你，由你在终端执行；上线后再把第 10 节的英文说明交给 Waffo。

1. **法定经营主体名称**（硬缺）。`LEGAL_NAME = 'Product Atlas (Dirtool)'` 只是品牌占位；Waffo 🔴 要求公司全称+注册地址，或个人经营者法定姓名。代码里刻意没编造。给我准确名称（个人经营者不需要地址）。
2. **退款规则请定稿**。现条款首次购买者 7 天内全额退款（Waffo 最低要求），但 `/pricing` FAQ 仍写「上线后不退」。二选一：**A** 改 FAQ 与条款一致（推荐，过审更稳）；**B** 告诉我你的真实退款做法，我改条款。
3. **`/advertise` 的月度订阅文案**怎么处理：按第 3 节二选一（改成真实周租 / 暂时加 noindex + 说明）。
4. **争议解决法域**。现写「适用经营者设立地法律，先协商，不成提交设立地有管辖权法院」。要写具体国家/地区或仲裁机构就给我准确表述。
5. **Waffo 后台两件事（不是代码）**：① 在 Pancake **store settings 保存退款政策**，结账页会自动展示（模板明确说不用维护两份）；② 设置 **billing descriptor**，让持卡人认得出扣款名称。
6. **开户资料业务类型**：若选了「AI 生成 / 内容生成类」，改成目录 / 信息服务 / 推广位。自检若强制要「底层 AI 模型名称」，**不要编 OpenAI / Runway / Stability AI** —— 本站确实没有模型，页面补不了这个，只能请 Waffo 按非 AIGC 商户审核或在备注说明。
7. 模板提示 `business model is unusual` 时建议律师复核；7 天退款窗口、2/5/5–10 工作日时限、争议解决措辞都是**经营承诺**，不只是文案，上线前请确认能兑现。

---

## 9. 明确没有做的事

未 `git commit`、未 `git push`、未构建、未部署、未改线上任何配置或 D1、未新增页面、未改 sitemap / robots、未隐藏或删除任何功能。工作树里同时存在上一轮 B 方案（`submissions` 详情编辑）的未提交改动，两者相互独立。

> ⚠️ **「未部署」正是 22:11 自检仍报 4 条的根因。** 自检抓的是线上旧版；本地新版已覆盖第 1、2、4 条，并为第 3 条补了消歧。**在这份新版上线之前，重跑自检还会得到同样 4 条结果。**

按约定：等你确认第 8 节各项并明确点头后，我再**一步一步**把构建与部署命令发给你，由你在终端执行。

---

## 10. 可直接复制给 Waffo 的英文说明（**部署上线后再发**）

用于备注栏、申诉或人工复核对接。里面引用的页内锚点在部署后才生效。

```text
Subject: Site review clarification - Product Atlas (dirtool.com) is a directory, not an AIGC product

Hello Waffo review team,

We would like to clarify the business model of https://dirtool.com (Product Atlas)
in response to the automated site check.

1. Nature of the service
Product Atlas is an editorial directory / catalogue of third-party software. We
publish listings, categories, tags and weekly rankings, and sell one-time listing
placements, a permanent dofollow outbound link, 7/90-day pinned positions and
fixed 7-day or four-week advertising slots. We do not operate a content-generation
product. There is no prompt input, no generation button, no model selector, no
upload flow for photos or voice recordings, and no generated image, audio, video
or text on the site. We call no AI model and depend on no model provider. Our only
automated URL feature parses public page metadata to pre-fill a submission form;
it executes nothing and generates nothing.

2. Why the check saw "Image Generation", "Text to Speech", "Video Generation"
   and "voice cloning"
These are category and tag names in our catalogue used to group third-party
products such as Midjourney, Runway and ElevenLabs. The phrase "text-to-speech,
voice cloning and dubbing" is the published description of the third-party
product ElevenLabs. They describe products we link to; we neither host nor
operate them, and following an outbound link leaves our service.

3. Why no underlying model is disclosed
There is no underlying model. We do not use Flux, Seedream, Nano Banana (Gemini),
GPT Image, Veo, Kling or any other image, video or speech model. Your AUP template
instructs merchants to "Delete any category, channel, or action that doesn't apply
to your product". Listing a model we do not use would be a false description of
our service and a misrepresentation to our customers. Please review this merchant
under "directory / information service / advertising placement" rather than an
AI content-generation category.

4. Policies (two URLs only; everything else is an in-page section)
Terms of Service:  https://dirtool.com/terms-of-service
Privacy Policy:    https://dirtool.com/privacy-policy
  - Billing, refunds and cancellation (one-time payments):
      https://dirtool.com/terms-of-service#billing
  - Acceptable Use Policy (six prohibited categories + zero-tolerance list):
      https://dirtool.com/terms-of-service#acceptable-use
  - Content moderation:
      https://dirtool.com/terms-of-service#content-moderation
  - Reporting and appeals:
      https://dirtool.com/terms-of-service#reporting
  - Enforcement actions:
      https://dirtool.com/terms-of-service#enforcement
  - Explicit no-generative-features statement:
      https://dirtool.com/terms-of-service#no-generative-features

5. Billing and contact
All payments are one-time. There is no subscription, no recurring billing, no
auto top-up, no credits and no metered generation. Waffo Pancake is named as the
payment processor in both policies. Monitored contacts: qinxiaohu6@gmail.com,
X @qinxiaohu1029 (https://x.com/qinxiaohu1029), and the in-site ticket system at
https://dirtool.com/settings/tickets. The email and X handle are displayed in the
footer of every page and in both policies.

Please let us know if a manual review or an additional declaration is required.
Thank you.
```
