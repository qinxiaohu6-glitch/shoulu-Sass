# Waffo 开户自检合规改造说明

> 状态：**已完成本地改动 + 本地验证，未提交、未构建、未部署、未改线上。**
> 日期：2026-11-06 · 范围：`nuxt/` 子站 · 域名验证已在 Cloudflare 完成。
> 客服邮箱已填 `qinxiaohu6@gmail.com`；Waffo 后台**只有服务条款 / 隐私政策两个 URL 字段**，
> 内容审核、举报、处置等内容已内嵌在这两个页面内，并做了页内可点击互链。

---

## 1. 现状问题（改之前）

Waffo 的域名 TXT 验证已经通过，接下来「运行自检」会逐项看两个政策页。原来这两页是从旧站搬来的**简版**，各 7 节，实测四个 URL（含 `/zh` 镜像）都是 200、`robots.txt` 也放行，所以**问题不在 URL 或可达性，而在页面内容**：

| 自检项 | 改造前 |
|---|---|
| 服务条款：经营主体 | 无 |
| 服务条款：有效联系邮箱 | 全站 grep 不到任何 `mailto:` 或邮箱 |
| 服务条款：退款与取消 | 只有「一次性费用、不自动续费」，无退款规则 |
| 服务条款：交付时间 | 无 |
| 服务条款：禁止事项 / AUP | 无 |
| 服务条款：争议解决与适用法律 | 无 |
| 隐私政策：具体联系邮箱 | 写的是「网站上列出的邮箱」，但站上并没有 |
| 隐私政策：Cookie / 追踪 | 无 |
| 隐私政策：数据保留期限 | 无 |
| 隐私政策：第三方处理方 | 只有一句「必要的处理方」，未点名 |
| 隐私政策：儿童隐私 / 跨境传输 | 无 |
| AUP 从 footer / 举报入口可链接 | 无 |

另外有一个**结构性矛盾**：Waffo 的 AUP 模板是为 AI/AIGC **生成类**产品写的，要求列出底层模型名称、模型输入/输出审核步骤与安全分类器。本站是目录站，不生成内容、不调用任何模型、不接受 prompt、不产出图像/音频/视频。照抄模板等于写虚假陈述，反而更难过审。模板自己写了 `Delete any category, channel, or action that doesn't apply to your product`，正确做法是**按业务实质删不适用项、保留适用项**。

---

## 2. 为什么这样优化

按 Waffo 文档四块要求逐条落地，但**只写本站真实存在的能力**：

- **Content Standards**：六类禁止内容逐条保留（色情/NSFW、血腥暴力、仇恨言论、CSAM、深度伪造与冒充、著作权商标侵权），加「零容忍」清单。
- **Content Moderation**：明确写出「本站无生成能力，模型输入/输出审核不适用、已按模板规则删除；点名任何底层模型或安全分类器都会是虚假陈述」。改用本站真在做的事：提交筛查 → 人工审核文案/图标/目标网址 → 定期复查 + 收到举报即复核 → 编辑/隐藏/删除。
- **Reporting**：一个真实、人工阅读的渠道，写清保密、公正、反滥用、申诉二次复核、主题行 `AUP report` / `AUP appeal`。
- **Enforcement Actions**：只列本站真的能做的（警告、编辑/删除收录、拒绝/隐藏提交、限制提交、暂停/永久关闭账号、必要时移交主管机关），并显式说明「停用生成功能」这类动作不适用。

服务条款同时补上**经营主体、退款与取消、交付时限、争议解决**，隐私政策补上 **Cookie 清单、保留期限、第三方处理方、儿童隐私、跨境传输**。所有事实都对照代码核过，没有编：

- 免费审核「通常 7–14 天、不保证，繁忙期更久」，付费「站长确认收款当天上线」——来自 `pricing.ts` 与 `server/utils/mail.ts`；
- Cookie 只有 `atlas_session`（HttpOnly、签名、30 天）、`atlas_admin`（仅站长）与侧栏/主题/验证冷却等本地存储；
- 处理方为 Cloudflare（Workers/D1）、Google（OAuth）、Resend（仅在配置密钥时）、Stripe / Waffo / Creem（仅启用的一家）；
- 不收集完整银行卡号；无订阅、无自动续费。

**没有新增页面、没有新增 URL、没有改 sitemap / robots / D1 / 路由**，AUP 作为服务条款内的锚点章节发布，页脚从 Resources 栏链接过去。

---

## 3. 对 SEO 与关键词的好处

1. **消除语义误判**。`catalog.json` 里有 `Image Generation` / `Video Generation` / `Text to Speech` 等第三方产品标签，ElevenLabs 简介里有 voice cloning 等词，容易被爬虫或风控把本站读成 AIGC 生成平台。现在条款正文明确「本站是目录、不生成内容、不调用底层模型、这些词只是第三方产品标签」，把站点主题拉回 directory / listing。
2. **不稀释权重**。没有为合规新增薄内容页；两个法律页本来就在 `sitemap.xml`（priority 0.2），URL 与结构不变，不会新增低质量可索引 URL。
3. **信任信号（E-E-A-T）**。真实联系方式、政策互链、明确更新日期、可引用的稳定锚点 URL，都是法律页与 About/Contact 类信任评估会读的信号。
4. **主动避开高风险关键词**。条款明写「不承诺排名/流量/反链、不卖 dofollow 链接或链接权重、付费只买站内展示」，既避开链接买卖类表述（支付风控敏感），也让页面语义更干净。

---

## 4. 改了哪些文件

| 文件 | 变化 |
|---|---|
| `shared/content/site-contact.ts` | **新建**。集中管理 `CONTACT_EMAIL` / `LEGAL_NAME`，提供 `contactHref()`；`CONTACT_EMAIL` 已填 `qinxiaohu6@gmail.com`。改这一个常量即可全站生效，留空时不渲染任何地址。 |
| `shared/content/legal.ts` | 两页政策重写/扩充；`LegalSection` 新增可选 `id`；新增 `fill()` / `section()` 注入 `{contact}`、`{legalName}`；服务条款「引言」与 AUP 的 E 段补页内互链；**隐私政策新增「内容审核与举报」一节**，四条链接分别指向服务条款的四个锚点。 |
| `app/components/LegalDocument.vue` | 渲染 `:id`；段落里的 URL 与邮箱自动变成可点击链接，并经 `localePath()` 保持 `/zh`，中文读者不会被丢到英文页。**不新增 UI 块**，沿用原版式。 |
| `app/layouts/default.vue` | Resources 栏新增「可接受使用政策」与「举报与申诉」两条带锚点的链接；`footer__bottom` 渲染真实 `mailto:`；新增 `linkHref()` 处理 `/zh` 前缀 + hash。 |

AUP 四个锚点：`#acceptable-use`、`#content-moderation`、`#reporting`、`#enforcement`。
它们是**同一个服务条款页面内部的跳转**，不是 Waffo 后台里要另填的字段。

---

## 5. 本地验证结果

| 检查 | 结果 |
|---|---|
| `env -u NODE_OPTIONS npm run typecheck` | 只剩 3 条**既有** Blog 错误（`blog/index.vue` TS2551、`shared/content/blog.ts` TS2677/TS2345）；**本轮新增代码 0 错误** |
| 本地 `nuxt dev` 起服务 | 两阶段均 200 |
| EN / ZH 四个法律页 SSR HTML | 六类禁止内容、零容忍、非 AIGC 声明、退款/交付、争议解决、Cookie 清单、第三方处理方、儿童隐私、跨境传输、2026-11-06 全部命中 |
| 四个 AUP 锚点 `id=` | 全部命中 |
| 页脚 AUP / 举报链接（EN 与 `/zh`） | 全部命中，`/zh` 前缀正确 |
| `{contact}` / `{legalName}` 占位符残留 | 0 |
| 真实邮箱的 `mailto:`（页脚 + 政策正文） | 全部命中 `qinxiaohu6@gmail.com` |
| 两页自包含：页内可点击链接 | 服务条款与隐私政策正文都含 `#acceptable-use` / `#content-moderation` / `#reporting` / `#enforcement` 的可点击链接；中文页全部自动带 `/zh` 前缀 |
| **临时清空邮箱**再起服务 | 不出现任何假 `mailto:`，文案回退到站内工单；**测完已还原为真实邮箱** |
| 探针合计 | **88 passed / 0 failed** |

> 本地探针脚本：`/tmp/compliance-probe.sh`（仅本地，未进仓库）。

---

## 6. ⚠️ 还需要你拍板的 3 件事

✅ **客服邮箱已填**：`qinxiaohu6@gmail.com`，页脚、两份政策、举报渠道同时生效，无需改文案。

1. **法定经营主体名称**（硬缺）。现在 `LEGAL_NAME = 'Product Atlas (Dirtool)'` 只是品牌占位，法律文档里应当是注册/经营主体；代码里刻意没有编造。
2. **退款规则** —— 这条是我按现有业务事实主动补的，**超出你原本确认的范围**，明确标注在此请确认：上线前可全额退款；重复扣款/误付/审核未通过/本站无法交付全额退款；**上线后不退**；违规被下架不退。和你的实际做法不同就告诉我改哪句。
3. **争议解决** —— 同样是我主动补的：目前写「适用经营者设立地法律，先协商，不成提交经营者设立地有管辖权法院」。如需写明具体国家/地区或仲裁机构，给我准确表述。

另外一件在 **Waffo 后台**（不是代码）：如果开户资料的「业务类型」选了 AI 生成 / 内容生成类，需改成目录 / 信息服务 / 推广位。自检若强制要求填「底层 AI 模型名称」，**不要编 OpenAI / Runway / Stability AI 之类**——本站确实没有模型，页面补不了这个，只能让 Waffo 按非 AIGC 商户审核或在备注里说明。

---

## 7. Waffo 后台只填这两个 URL

| 字段 | 值 |
|---|---|
| 服务条款 URL | `https://dirtool.com/terms-of-service` |
| 隐私政策 URL | `https://dirtool.com/privacy-policy` |

**后台没有第三个字段**，所以内容审核 / 举报 / 处置不是另填的 URL。它们已经作为服务条款页面内的四个章节存在，并且从两个页面内部互相链接（真链接、可点击，中文页自动带 `/zh`）：

- 服务条款页内：`#acceptable-use`（六类禁止内容 + 零容忍清单）、`#content-moderation`（人工审核流程）、`#reporting`（举报渠道、申诉、邮箱 `qinxiaohu6@gmail.com`）、`#enforcement`（处置阶梯）。
- 服务条款「引言」链到隐私政策；「服务使用」与 AUP 的 E 段链到上述章节。
- 隐私政策新增「内容审核与举报」一节，四条链接分别指向上面四个章节，并给出邮箱与站内工单入口。

⇒ 审核员无论从哪个 URL 进入，都能到达全部内容，不需要在后台另填 AUP 地址。若备注/补充说明允许附链接，可写 `https://dirtool.com/terms-of-service#acceptable-use`，但那只是页内跳转，不是必填字段。

中文镜像同样有效：`https://dirtool.com/zh/terms-of-service`、`https://dirtool.com/zh/privacy-policy`。

---

## 8. 明确没有做的事

未 `git commit`、未 `git push`、未构建、未部署、未改线上任何配置或 D1、未新增页面、未改 sitemap / robots、未隐藏或删除任何功能。工作树里同时还存在上一轮 B 方案（`submissions` 详情编辑）的未提交改动，两者相互独立。

按约定：等你确认第 6 节的三项后，我再一步步把构建与部署命令发给你，由你在终端执行。
