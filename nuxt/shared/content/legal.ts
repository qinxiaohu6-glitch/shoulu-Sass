import type { Pair, PairList } from './pricing'
import { CONTACT_EMAIL, LEGAL_NAME, SOCIAL_X_HANDLE, SOCIAL_X_URL } from './site-contact'

/**
 * Legal copy. The original sections were ported from the live site
 * (dist/privacy-policy.html and dist/zh/privacy-policy.html, likewise for
 * terms) so the rebuild would not silently reword an offer.
 *
 * 2026-11-06: rewritten against Waffo's own TOS / AUP templates. The TOS
 * template says "Sections 1–3 & 8–16 (use in every version)" and "Pick the one
 * block that matches your billing model and slot it between Section 3 and
 * Section 8. Delete the other two". It offers exactly three blocks — V1
 * Subscription, V2 Credits/Top-up, V3 Hybrid — and no V0 for a merchant that
 * only ever charges once. So the common sections are kept, a one-time-payment
 * block is written for 4–7, and all three template blocks are omitted rather
 * than misdescribing the business. The template itself says "Deleted the
 * sections that don't apply".
 *
 * Two more template rules drive the rest: "Keep 2.3 only if you depend on
 * third-party AI providers" / "9. AI Output & Intellectual Property (if you
 * ship AI)", and "Better to list fewer real [contact channels] than six
 * unmonitored". Facts were checked against this codebase, not invented:
 *
 *  - every paid option is a ONE-TIME purchase (pricing.ts uses unit:
 *    'one-time'; ads are $29/$19 per fixed 7-day week, with $99/$65 four-week
 *    bundles). No subscription, recurring charge, auto top-up, credits or
 *    converting trial exists anywhere in the payment code.
 *  - paid tiers DO change the outbound link from nofollow to dofollow, exactly
 *    as the pricing page says. An earlier draft wrongly denied this; do not
 *    reintroduce that contradiction. We promise no ranking or traffic outcome.
 *  - this is a directory with no generative capability and no third-party AI
 *    model provider, so the AI-output / model-dependency sections are omitted
 *    and no model name is (or can honestly be) listed.
 *  - review takes 7–14 days and is not guaranteed; paid goes live the day the
 *    operator confirms payment. Delivery is by a human, not instantaneous.
 *  - Waffo Pancake is named as the processor (TOS checklist, Section 11).
 *
 * Have a lawyer read any further change — especially the refund policy, the
 * response/payout times and the governing-law wording. Those are operating
 * commitments, not just copy.
 */

export interface LegalSection {
  heading: Pair
  /** Stable anchor, so a section can be cited from inside either policy page. */
  id?: string
  /** Either prose paragraphs or a bullet list, never both. */
  body?: Pair
  bullets?: PairList
}

export interface LegalDoc {
  title: Pair
  lead: Pair
  updated: string
  /** Waffo asks for a version number alongside the effective date. */
  version?: string
  sections: LegalSection[]
}

/**
 * The operator identity is spliced in at module load rather than baked into
 * prose, so filling in one constant updates every place that needs it.
 *
 * `{contact}` is the owner's real, monitored inbox. If it is ever cleared, it
 * falls back to the in-site ticket system — a working channel — rather than
 * rendering an empty string or a made-up address. `{legalName}` is still a
 * brand-level placeholder until the registered entity is supplied; inventing a
 * company name inside a legal document would be a false statement. `{x}` and
 * `{xUrl}` point at the owner's second monitored channel.
 */
const CONTACT_TEXT: Pair = CONTACT_EMAIL
  ? { en: CONTACT_EMAIL, zh: CONTACT_EMAIL }
  : {
      en: 'the in-site support ticket system at https://dirtool.com/settings/tickets',
      zh: '站内工单系统 https://dirtool.com/settings/tickets',
    }

function fillText(text: string, lang: 'en' | 'zh'): string {
  return text
    .replaceAll('{contact}', CONTACT_TEXT[lang])
    .replaceAll('{legalName}', LEGAL_NAME)
    .replaceAll('{x}', SOCIAL_X_HANDLE)
    .replaceAll('{xUrl}', SOCIAL_X_URL)
}

function fill(pair: Pair): Pair {
  return { en: fillText(pair.en, 'en'), zh: fillText(pair.zh, 'zh') }
}

function section(input: LegalSection): LegalSection {
  return {
    ...input,
    heading: fill(input.heading),
    ...(input.body ? { body: fill(input.body) } : {}),
    ...(input.bullets
      ? {
          bullets: {
            en: input.bullets.en.map((line) => fillText(line, 'en')),
            zh: input.bullets.zh.map((line) => fillText(line, 'zh')),
          },
        }
      : {}),
  }
}

export const privacyPolicy: LegalDoc = {
  title: { en: 'Privacy Policy', zh: '隐私政策' },
  lead: {
    en: 'How we collect, use and protect your personal information.',
    zh: '我们如何收集、使用与保护你的个人信息。',
  },
  updated: '2026-11-06',
  version: '1.0',
  sections: [
    {
      heading: { en: 'Introduction', zh: '引言' },
      body: {
        en: '{legalName} ("we") operates Product Atlas, a directory of third-party software. We respect your privacy and are committed to protecting your personal data. This policy explains what we collect, why, how long we keep it, and who else is involved in running the site.',
        zh: '{legalName}（下称「我们」）运营 Product Atlas —— 一个第三方软件目录站。我们尊重你的隐私，并致力于保护你的个人数据。本政策说明我们收集哪些信息、用途、保留期限，以及还有哪些参与运行本站的第三方。',
      },
    },
    {
      heading: { en: 'Information We Collect', zh: '我们收集的信息' },
      bullets: {
        en: [
          'Account information — if you sign in with Google, we receive your Google account identifier, email address, display name and avatar URL. There is no password stored on this site.',
          'Usage data — pages and listings viewed, and votes cast while signed in. Votes are stored against an internal identifier so one account cannot vote twice in the same week. We do not build advertising profiles.',
          'Submission data — the product name, description, website URL, logo URL, tags, contact email and screenshots you send us for review.',
          'Support data — the content of tickets you open and our replies.',
          'Payment data — the plan, order reference, amount and payment status. Card numbers are collected by the payment processor, never by us; a verified payment webhook settles the order and publishes the placement automatically. Where no processor is enabled, the operator confirms receipt by hand.',
          'Technical data — IP address and request metadata processed by our hosting provider for security and delivery, and the cookie / local-storage values described in the next section.',
        ],
        zh: [
          '账号信息 —— 若你使用 Google 登录，我们会收到 Google 账号标识、邮箱、显示名与头像地址。本站不存储密码。',
          '使用数据 —— 浏览的页面与登录后投出的票。投票按内部标识记录，用于防止同一账号在一周内重复投票；我们不构建广告画像。',
          '提交数据 —— 你提交审核的产品名称、简介、网址、图标地址、标签、联系邮箱与截图。',
          '工单数据 —— 你提交的工单内容以及我们的回复。',
          '支付数据 —— 方案、订单号、金额与支付状态。银行卡号由支付服务商收集，本站不接触；支付回调验签后由系统自动完成订单并发布展示。未启用在线支付时由站长人工确认收款。',
          '技术数据 —— 托管服务商为安全与交付处理的 IP 与请求元信息，以及下一节列出的 Cookie 与本地存储值。',
        ],
      },
    },
    {
      heading: { en: 'Cookies and Local Storage', zh: 'Cookie 与本地存储' },
      bullets: {
        en: [
          'atlas_session — a signed, HttpOnly session cookie that keeps you signed in. It holds your account identifier, email, name, avatar and expiry, and expires after 30 days.',
          'atlas_admin — an HttpOnly cookie used only by the site operator to reach the private console. It is never set for ordinary visitors.',
          'sidebar_state and a few local-storage keys — interface preferences such as the open sidebar groups, the email-verification cooldown and the colour theme. These stay in your browser and are not sent to us as profile data.',
          'We do not set advertising or cross-site tracking cookies. If the operator enables Google Analytics or Plausible in the console, an optional third-party statistics script may load; that provider then applies its own policy. You can clear all of the above from your browser settings at any time.',
        ],
        zh: [
          'atlas_session —— 经过签名、HttpOnly 的会话 Cookie，用于保持登录。内容为账号标识、邮箱、名称、头像与过期时间，30 天后过期。',
          'atlas_admin —— 仅站长访问私有后台时使用的 HttpOnly Cookie，普通访客不会被设置。',
          'sidebar_state 及若干本地存储键 —— 侧栏展开状态、邮箱验证冷却时间、深浅色主题等界面偏好。这些数据留在你的浏览器里，不会作为画像数据上传。',
          '我们不设置广告或跨站追踪 Cookie。若站长在后台启用 Google Analytics 或 Plausible，可能加载可选的第三方统计脚本，届时适用该服务商自身的政策。你随时可以在浏览器设置中清除上述数据。',
        ],
      },
    },
    {
      heading: { en: 'How We Use It', zh: '使用方式' },
      body: {
        en: 'To publish and maintain listings, run the weekly vote, record manual payments, prevent abuse and duplicate votes, answer tickets, and send transactional email about your own submission when the operator has enabled mail. We do not sell personal data and we do not use it for targeted advertising.',
        zh: '用于发布与维护收录、运行每周投票、记录人工收款、防止滥用与重复投票、回复工单，以及在站长启用邮件服务后就你自己的提交发送事务邮件。我们不出售个人数据，也不将其用于定向广告。',
      },
    },
    {
      heading: { en: 'Processors and Sharing', zh: '第三方处理方与共享' },
      bullets: {
        en: [
          'Cloudflare — hosts the application and its database on Workers / D1 and delivers the pages.',
          'Google — provides the OAuth sign-in flow.',
          'Resend — delivers transactional email, only when the operator has configured a mail key. With no key, no mail leaves the site.',
          'Waffo Pancake (Waffo) is the payment processor for this merchant account; Stripe and Creem are optional alternative providers in our code. Only the single provider the operator has enabled processes a payment. Payment card data is collected exclusively by that PCI-DSS certified processor and is never stored on our servers; its own privacy policy governs the card data it collects.',
          'Google Analytics or Plausible — optional, only if the operator switches them on in the console.',
          'We share the minimum needed for those functions and otherwise disclose data only where the law requires it, or to report illegal material to the competent authorities. We do not sell personal data.',
        ],
        zh: [
          'Cloudflare —— 通过 Workers / D1 托管应用与数据库并交付页面。',
          'Google —— 提供 OAuth 登录流程。',
          'Resend —— 仅在站长配置了邮件密钥时投递事务邮件；未配置时本站不发出任何邮件。',
          'Waffo Pancake（Waffo）是本站商户账号的支付处理方；代码中另保留 Stripe、Creem 作为可选替代处理方，实际仅站长启用的那一家处理付款。银行卡资料由该 PCI-DSS 认证的处理方独家收集，本站服务器不存储；卡资料适用该服务商自身的隐私政策。',
          'Google Analytics 或 Plausible —— 可选，仅在站长于后台开启时启用。',
          '我们只共享完成上述功能所必需的最少数据；除此之外仅在法律要求时、或为向主管机关举报违法内容时披露。我们不出售个人数据。',
        ],
      },
    },
    {
      heading: { en: 'Data Retention', zh: '数据保留期限' },
      bullets: {
        en: [
          'Session and admin cookies expire after 30 days; clearing them in your browser ends the session immediately.',
          'A published listing and the submission behind it are kept while the listing is public. If a listing is removed, the underlying submission can be deleted on request.',
          'Support tickets and submission records are kept for as long as needed to operate the service and resolve disputes.',
          'Payment and accounting records are kept for the period required by applicable tax and accounting rules.',
          'You can ask us to delete your data at {contact}; we action deletion requests unless a legal obligation requires us to keep a specific record.',
        ],
        zh: [
          '会话与后台 Cookie 在 30 天后过期；在浏览器中清除即可立即结束会话。',
          '已发布的收录及其对应提交记录，在页面公开展示期间保留；页面下架后，可按要求删除底层提交记录。',
          '工单与提交记录的保留时间以运行服务、处理争议所需为限。',
          '支付与账务记录按适用税务与会计规定要求的期限保留。',
          '你可以发邮件至 {contact} 要求删除数据；除法律义务要求保留的特定记录外，我们会执行删除请求。',
        ],
      },
    },
    {
      heading: { en: 'International Transfers', zh: '跨境传输' },
      body: {
        en: 'Our hosting provider operates a global network and the processors above may be established in other jurisdictions, so your data may be processed outside your country of residence. We limit what is transferred to the minimum described in this policy; we do not transfer card numbers, which never reach our systems.',
        zh: '我们的托管服务商运行全球网络，上述处理方也可能位于其他司法辖区，因此你的数据可能在居住国之外被处理。我们只传输本政策所述的最少必要数据；银行卡号从不进入我们的系统，因此不存在该数据的跨境传输。',
      },
    },
    {
      heading: { en: 'Children', zh: '儿童隐私' },
      body: {
        en: 'This service is not directed at children under 13, and we do not knowingly collect their personal information. Where local law sets a higher age of digital consent, that age applies. If you believe a child has provided data, write to {contact} and we will remove it.',
        zh: '本服务不面向 13 岁以下儿童，也不会故意收集其个人信息；当地法律规定更高的数字同意年龄时，从其规定。若你认为儿童提供了数据，请发邮件至 {contact}，我们会删除。',
      },
    },
    {
      heading: { en: 'Your Rights', zh: '你的权利' },
      body: {
        en: 'You can access, correct, export or delete your data from your account, or by writing to {contact}. You may also object to processing and withdraw consent where processing is based on consent. We answer requests from a human, not an automated workflow.',
        zh: '你可以在账号中访问、更正、导出或删除数据，也可以发邮件至 {contact} 提出请求。在基于同意的处理场景下，你还可以反对处理或撤回同意。所有请求由人工回复，而非自动化流程。',
      },
    },
    {
      heading: { en: 'Moderation, Reporting and Enforcement', zh: '内容审核与举报' },
      bullets: {
        en: [
          'Prohibited content and the full Acceptable Use Policy are part of the Terms of Service: https://dirtool.com/terms-of-service#acceptable-use',
          'How listings and submissions are screened by a human operator: https://dirtool.com/terms-of-service#content-moderation',
          'How to report a listing, request a takedown, or appeal a decision — read by a human at {contact}: https://dirtool.com/terms-of-service#reporting',
          'The actions we can take when a rule is broken: https://dirtool.com/terms-of-service#enforcement',
        ],
        zh: [
          '禁止内容与完整的可接受使用政策属于服务条款的一部分：https://dirtool.com/terms-of-service#acceptable-use',
          '收录与提交由人工审核的具体流程：https://dirtool.com/terms-of-service#content-moderation',
          '举报收录、申请下架或申诉的渠道（由人工在 {contact} 阅读）：https://dirtool.com/terms-of-service#reporting',
          '违规时本站可执行的处置措施：https://dirtool.com/terms-of-service#enforcement',
        ],
      },
    },
    {
      heading: { en: 'Contact', zh: '联系方式' },
      body: {
        en: '{legalName} operates this site. Privacy questions, data requests, Acceptable Use Policy reports and appeals: {contact} (or a DM to {x} at {xUrl}). Support tickets: https://dirtool.com/settings/tickets. The full Acceptable Use Policy is published at https://dirtool.com/terms-of-service#acceptable-use.',
        zh: '{legalName} 运营本站。隐私咨询、数据请求、可接受使用政策举报与申诉：{contact}（也可私信 {x}：{xUrl}）。工单入口：https://dirtool.com/settings/tickets。完整的可接受使用政策见 https://dirtool.com/terms-of-service#acceptable-use。',
      },
    },
  ].map(section),
}

export const termsOfService: LegalDoc = {
  title: { en: 'Terms of Service', zh: '服务条款' },
  lead: {
    en: 'The rules for using this site and its services.',
    zh: '使用本站及其服务的规则。',
  },
  updated: '2026-11-06',
  version: '1.0',
  sections: [
    {
      heading: { en: 'Introduction', zh: '引言' },
      body: {
        en: 'These Terms of Service ("Terms") govern your use of Product Atlas at https://dirtool.com, operated by {legalName} ("we" / "us"). By using the site, creating an account, submitting a listing or completing a purchase, you confirm that you are at least 18 years old, have read and agree to these Terms, to the Acceptable Use Policy on this page (https://dirtool.com/terms-of-service#acceptable-use), and to the Privacy Policy at https://dirtool.com/privacy-policy. If you do not agree, you may not use the service. These Terms apply to this directory service only; the third-party products we list have their own terms.',
        zh: '本服务条款（下称「本条款」）适用于你对 https://dirtool.com 上 Product Atlas 的使用，本站由 {legalName}（下称「我们」）运营。使用本站、注册账号、提交收录或完成付款，即表示你确认已年满 18 周岁、已阅读并同意本条款、本页的可接受使用政策（https://dirtool.com/terms-of-service#acceptable-use）以及隐私政策 https://dirtool.com/privacy-policy。若不同意，请勿使用本服务。本条款仅约束本站的目录服务；我们收录的第三方产品适用其各自的条款。',
      },
    },
    {
      heading: { en: 'Nature of the Service', zh: '服务性质' },
      body: {
        en: 'Product Atlas is an editorial directory of third-party software. We publish listings, categories, tags and weekly rankings. We do not generate content, do not operate or call any underlying AI model, accept no prompts, produce no image, audio, video or generated text, and offer no upload flow for photographs or voice recordings of real people. Category labels such as "Image Generation", "Video Generation" and "Text to Speech" describe third-party products; they are not features of this site. We do not host those products, and following an outbound link leaves this service. Because we depend on no third-party AI model provider and generate no outputs, the template sections on AI-output ownership, AI-output accuracy and third-party model dependency do not apply and are deliberately omitted: there is no underlying model to name, and naming one here would be a false description of this service. For the same reason no model name is shown on the pricing page or on any listing page — this site has no generation feature to disclose.',
        zh: 'Product Atlas 是一个第三方软件的编辑型目录站，发布收录页、分类、标签与每周榜单。我们不生成内容、不运行也不调用任何底层 AI 模型、不接受提示词、不产出图像／音频／视频／生成文本，也不提供真人照片或语音的上传通道。「Image Generation」「Video Generation」「Text to Speech」等分类名称描述的是第三方产品，并非本站功能。我们不托管这些产品，点击外链即离开本服务。由于我们不依赖任何第三方 AI 模型服务商、也不产出任何生成结果，模板中关于「AI 输出权属」「AI 输出准确性」「第三方模型依赖」的章节不适用于本站，已按模板规则删除：本站没有可供披露的底层模型，在此列出任何模型名称都会构成对本站的虚假描述。同理，定价页与收录页也不显示模型名称 —— 本站根本没有生成功能。',
      },
    },
    {
      id: 'no-generative-features',
      heading: {
        en: 'No Generative Features — Category Labels Are Not Site Capabilities',
        zh: '本站不提供生成功能 —— 分类标签不是本站能力',
      },
      bullets: {
        en: [
          'Explicit statement. Product Atlas does NOT provide "Image Generation", "Image generation", "Text to Speech", "Text-to-speech", "Video Generation", "voice cloning" or any other content-generation feature. We publish an editorial directory of third-party software. There is no prompt box, no generation button, no model selector, no upload flow for photographs or voice recordings, and no generated image, audio, video or text anywhere on this site. Our only automated URL feature reads public page metadata to pre-fill a submission form; it executes nothing and generates nothing.',
          'Where the flagged words come from. "Image Generation", "Video Generation" and "Text to Speech" are category and tag names in our catalogue, used to group third-party products such as Midjourney, Runway and ElevenLabs. The phrase "text-to-speech, voice cloning and dubbing" is the published description of the third-party product ElevenLabs, not a description of this site. These words describe products we link to; we neither host nor operate them, and following an outbound link leaves this service.',
          'Why no underlying AI model is named. We call no model and depend on no model provider. We do not use Flux, Seedream, Nano Banana (Gemini), GPT Image, Veo, Kling, or any other image, video or speech model. Waffo\'s AUP template instructs merchants to "Delete any category, channel, or action that doesn\'t apply to your product"; naming a model we do not use would be a false description of the service and a misrepresentation to our customers. There is therefore no model list to publish on an about page, a pricing page, a listing page or a generation interface — this site has no generation interface.',
          'What is actually sold. One-time editorial listings, a permanent dofollow outbound link, a fixed 7-day or 90-day pinned position, and fixed 7-day or four-week advertising slots. See https://dirtool.com/pricing and the Billing, Refunds and Cancellation section at https://dirtool.com/terms-of-service#billing. There is no subscription, no credits and no metered generation.',
          'Content rules still apply. Although we generate nothing, the six prohibited categories, the zero-tolerance list, our human submission screening, the reporting channel and the enforcement ladder are published in the Acceptable Use Policy at https://dirtool.com/terms-of-service#acceptable-use and apply to every listing, description, icon, screenshot and outbound link on this site.',
        ],
        zh: [
          '明确声明。Product Atlas 不提供「Image Generation / 图像生成」「Text to Speech / 语音合成」「Video Generation / 视频生成」「voice cloning / 声音克隆」或任何内容生成功能。本站发布的是第三方软件的编辑型目录：站内没有提示词输入框、没有生成按钮、没有模型切换列表、没有真人照片或语音上传通道，也不产出任何生成的图像、音频、视频或文本。唯一的自动化 URL 功能是读取公开网页元信息以预填提交表单，该过程不执行代码、不生成内容。',
          '被标记的这些词来自哪里。「Image Generation」「Video Generation」「Text to Speech」是我们产品库中的分类名与标签，用于归类 Midjourney、Runway、ElevenLabs 等第三方产品；「text-to-speech, voice cloning and dubbing」出现在第三方产品 ElevenLabs 的简介里，不是对本站的描述。这些词描述的是我们外链到的产品，我们不托管、不运营它们，点击外链即离开本服务。',
          '为什么不披露底层 AI 模型。本站不调用任何模型，也不依赖任何模型服务商；我们没有使用 Flux、Seedream、Nano Banana (Gemini)、GPT Image、Veo、Kling 或任何其他图像／视频／语音模型。Waffo 的 AUP 模板要求「删除任何不适用于你产品的类别、渠道或动作」；列出我们并未使用的模型名称，会构成对本站服务的虚假描述与对用户的误导。因此关于页、定价页、收录页或所谓「生成界面」都不存在模型清单 —— 本站根本没有生成界面。',
          '本站实际售卖的内容。一次性编辑型收录、永久 dofollow 外链、固定 7 天或 90 天的置顶位置，以及固定 7 天／4 周窗口的广告位。见 https://dirtool.com/pricing 与 https://dirtool.com/terms-of-service#billing 的「计费、退款与取消」。没有订阅、没有积分、没有按量计费的生成服务。',
          '内容规则依然适用。虽然本站不生成任何内容，六类禁止内容、零容忍清单、人工提交筛查、举报渠道与处置阶梯仍完整发布于 https://dirtool.com/terms-of-service#acceptable-use 的可接受使用政策中，并适用于站内每一条收录、描述、图标、截图与外链。',
        ],
      },
    },
    {
      heading: { en: 'Use of the Service', zh: '服务使用' },
      body: {
        en: 'Use the service lawfully and keep your account secure. Sign-in uses Google OAuth, so we never hold a password for you; you are responsible for activity under your account and for keeping your billing email current. Report unauthorised use to {contact}. If you submit on behalf of a company, you confirm you have authority to bind it. Your submissions and listings must comply with the Acceptable Use Policy in the later section of this page (https://dirtool.com/terms-of-service#acceptable-use), which forms part of these Terms.',
        zh: '请合法使用本服务并妥善保管账号。本站使用 Google OAuth 登录，不保存你的密码；账号下的行为由你负责，并请保持账单邮箱有效。发现账号被冒用请发邮件至 {contact}。代表企业提交时，你确认已获得授权。你的提交与收录必须遵守本页后文的可接受使用政策（https://dirtool.com/terms-of-service#acceptable-use），该政策是本条款的组成部分。',
      },
    },
    {
      heading: { en: 'Listings and Submissions', zh: '收录与提交' },
      body: {
        en: 'We may edit, decline or remove listings that are inaccurate, misleading, duplicated, or link to a site that does not work — including after publication. Free listings go live after manual review and carry a nofollow link; that review usually takes 7–14 days, is not guaranteed, and takes longer in busy periods. Paid placements are published automatically as soon as the payment succeeds: a signed webhook settles the order and publishes the listing or schedules the ad slot, with no operator confirming each receipt. Approval of a free listing is never guaranteed.',
        zh: '对于不准确、误导、重复或链接失效的收录，我们可以编辑、拒绝或下架，上线之后同样适用。免费收录经人工审核后展示，外链为 nofollow；审核通常需 7–14 天，不保证时限，繁忙期可能更久。付费展示在付款成功后由系统自动发布：支付回调验签后完成订单并发布收录或排期广告位，不需要站长逐笔确认收款。免费提交不保证一定通过。',
      },
    },
    {
      id: 'billing',
      heading: { en: 'Billing, Refunds and Cancellation (One-time Payments)', zh: '计费、退款与取消（一次性付款）' },
      bullets: {
        en: [
          'Billing model. Every paid option on this site is a ONE-TIME purchase, never a subscription, except the sidebar ad which is still rented by the week. The listing tiers are Free $0, Standard $19, Featured $39 and Pro $69; the paid submission upgrade is $39. Billboard is one-time: Entry $15, Standard $29, Prime $49. Standard replaces the former board rental of $29 per seven-day week, which is no longer sold. The sidebar remains $19 per seven-day week, or $65 for four weeks. Prices and the exact display period are shown at checkout and at https://dirtool.com/pricing. There is no recurring billing, no automatic renewal, no auto top-up, no credits or credit expiry, and no free trial that converts into a paid plan.',
          'Why there is no subscription section. Waffo\'s Terms of Service template offers three billing blocks — V1 Subscription, V2 Credits/Top-up and V3 Hybrid — and instructs merchants to "Pick the one block that matches your billing model" and "Delete the other two". None of the three describes this business, so the recurring-billing authorisation, renewal notice, in-product subscription cancellation, credit validity, rollover and auto-top-up clauses are deliberately omitted under the template\'s own rule "Deleted the sections that don\'t apply". A completed checkout authorises ONE charge for the amount displayed at that checkout; nothing further is charged without a new, separate purchase.',
          'Payment processor. Online payments for this merchant account are handled by Waffo Pancake as the payment processor; Stripe and Creem are optional alternative providers in our code. A signed payment webhook settles each order and publishes the paid placement automatically. When no processor is enabled, the operator confirms receipt by hand as a fallback and no card data reaches this site. Payment card data is collected exclusively by the processor and is never stored on our servers. See the Privacy Policy at https://dirtool.com/privacy-policy. Prices are exclusive of applicable taxes unless stated otherwise at checkout.',
          'Delivery. What is delivered is an editorial listing, a change of the outbound link attribute from nofollow to dofollow, a pinned position (7 or 90 days, depending on the tier), or an advertising slot for a fixed seven-day or four-week window. Free submissions enter a manual review queue that usually takes 7–14 days and is not guaranteed. Paid placements are delivered automatically as soon as the payment succeeds: the verified webhook settles the order and publishes the listing or schedules the ad slot, with no manual step.',
          'Link attributes and SEO. Paid tiers change the outbound link from nofollow to permanent dofollow, exactly as described on the pricing page. We do not promise any search-engine ranking, traffic, indexing, domain-authority increase or other SEO outcome. The fee buys on-site editorial display and the stated link attribute, not a guaranteed result.',
          'Refund policy and eligible cases. Paid placements are one-time purchases. Fees are generally non-refundable once the purchased placement has been delivered — that is, once the listing has been published under the purchased plan, or once the purchased pin, feature or advertising period has started. A full refund is given only for a confirmed duplicate charge or a payment made in error, or if we fail to deliver the purchased placement (including if we decline the submission at review before any paid placement starts, or if a paid pin or listing never goes live for a reason attributable to us). Nothing in these Terms limits any non-waivable withdrawal or refund right that applicable law grants you.',
          'Non-refundable cases. After delivery, the following are not refunded: a change of mind; dissatisfaction with traffic, ranking, clicks or results; partial use of a period that has already started; inaccurate information you submitted; and a paid placement removed because it violates the Acceptable Use Policy at https://dirtool.com/terms-of-service#acceptable-use.',
          'How to apply. Write to {contact} (or send a DM to {x} at {xUrl}) with the subject line "Refund request", your account email, transaction ID, order reference, listing URL and the reason. You can also open a ticket at https://dirtool.com/settings/tickets. An unpaid order needs no cancellation — simply do not complete the payment, because we never charge automatically; you can check its status at https://dirtool.com/settings/submissions.',
          'Response and payout time. We acknowledge every refund or cancellation request within 2 business days, complete the review within 5 business days, and initiate approved refunds within 5–10 business days. Refunds go back to the original payment method; the time until the credit appears on your statement depends on your bank or card issuer and is outside our control.',
          'Billing disputes. If you believe a charge is wrong or you do not recognise it, contact {contact} before disputing it with your bank: we respond within 2 business days and resolve confirmed billing errors within 5 business days. The same monitored inbox handles general support, billing, refunds, legal, privacy and security reports; we list only channels we actually read.',
        ],
        zh: [
          '计费模式。收录与 Billboard 均为**一次性购买，不是订阅**；右栏广告仍按周租。收录四档为免费 $0、标准 $19、精选 $39、专业 $69；提交页的付费升级为 $39。Billboard 一次性三档：入门 $15、标准 $29、优先 $49。标准档替代原来的榜单 $29 / 7 天，该周租不再出售。右栏仍为 $19 / 7 天，连投 4 周 $65。价格与具体展示周期以结账页及 https://dirtool.com/pricing 为准。**没有订阅制**、没有周期性扣款、没有自动续费、没有自动充值、没有积分及其有效期，也没有会自动转为付费的免费试用。',
          '为什么没有订阅章节。Waffo 服务条款模板只提供「V1 订阅」「V2 积分／充值」「V3 混合」三种计费区块，并要求「选一个与计费模式匹配的区块」且「删掉另外两个」。三者均不符合本站业务，因此循环扣款授权、续费提醒、站内订阅取消、积分有效期、积分结转与自动充值等条款，均按模板自身的「删除不适用章节」规则删除。每次结账仅授权当次显示金额的**一次**扣款；除非你再次单独购买，不会产生任何后续扣费。',
          '支付处理方。本站商户账号的在线支付由 Waffo Pancake 处理；代码中另保留 Stripe、Creem 作为可选替代处理方。支付回调验签后由系统自动完成订单并发布付费展示。未启用在线支付时由站长人工确认收款作为兜底，卡资料不进入本站。银行卡资料由 PCI-DSS 认证的处理方独家收集，本站服务器不存储。隐私政策见 https://dirtool.com/privacy-policy。除结账页另有说明外，价格不含适用税费。',
          '交付内容。交付的是约定期限内的编辑型收录、外链由 nofollow 变更为 dofollow、置顶位置（按档位 7 天或 90 天），或固定 7 天／4 周窗口内的广告位。免费提交进入人工审核队列，通常需 7–14 天且不保证。付费展示在付款成功后自动交付：支付回调验签后完成订单并发布收录或排期广告位，无需人工介入。',
          '链接属性与 SEO。付费档会把外链从 nofollow 变更为永久 dofollow，与定价页描述一致。我们不承诺任何搜索排名、流量、收录、域名权重提升或其他 SEO 效果；费用购买的是站内编辑展示位与上述链接属性，而非保证的结果。',
          '退款政策与可退情形。付费项均为一次性购买。**一旦已购展示已经交付，原则上不予退款** —— 交付是指付费收录已按所购档位发布，或所购置顶／精选／广告周期已经开始。全额退款仅适用于：经确认的重复扣款或误扣；以及本站未能兑现已购展示（包括付费提交在任何付费展示开始前被审核拒绝，或因本站原因导致付费置顶／收录始终未能上线）。本条款不限制适用法律强制赋予、不可放弃的撤回或退款权利。',
          '不予退款的情形。交付之后，以下情形不予退款：改主意；对流量、排名、点击或效果不满意；已开始的展示周期只用了一部分；你提交的信息不准确；以及因违反可接受使用政策（https://dirtool.com/terms-of-service#acceptable-use）被下架的付费收录。',
          '申请方式。发邮件至 {contact}，或私信 {x}（{xUrl}），标题写「Refund request」，并附账号邮箱、交易 ID、订单号、收录网址与原因。也可在 https://dirtool.com/settings/tickets 开工单。**未付款的订单无需取消** —— 不完成付款即可，本站从不自动扣款；订单状态可在 https://dirtool.com/settings/submissions 查看。',
          '响应与到账时间。退款／取消申请在 **2 个工作日内**确认收到，**5 个工作日内**完成审核，审核通过的退款在 **5–10 个工作日内**发起。退款原路退回；到账时间取决于你的银行或发卡机构，不在本站可控范围内。',
          '账单争议。若认为扣款有误或不认识某笔扣款，请先联系 {contact} 再向银行发起拒付：我们在 2 个工作日内回复，并在 5 个工作日内解决确认属实的账单错误。一般支持、账单、退款、法务、隐私与安全举报共用同一个有人查看的邮箱；我们只公布确实会查看的渠道。',
        ],
      },
    },
    {
      heading: { en: 'Content', zh: '内容' },
      body: {
        en: 'You keep ownership of what you submit and grant us a licence to display it on the service. You confirm that you have the right to submit it, that it is accurate, and that it contains none of the material prohibited by the Acceptable Use Policy.',
        zh: '你保留所提交内容的所有权，并授权我们在本服务中展示。你确认自己有权提交该内容、内容属实，且不含可接受使用政策禁止的任何材料。',
      },
    },
    {
      id: 'acceptable-use',
      heading: { en: 'Acceptable Use Policy', zh: '可接受使用政策' },
      bullets: {
        en: [
          'A. Scope. This policy is part of the Terms of Service and applies to every listing, submission, logo, screenshot, outbound link, support ticket and account. Because this site is a directory with no generative capability, categories, channels and actions that do not apply to this product are deliberately omitted rather than claimed.',
          'A. Scope (continued). Category names such as "Image Generation", "Video Generation" and "Text to Speech" are editorial labels describing third-party products. They are neither capabilities of this site nor a description of any model we run.',
          'B. Prohibited content. The following must not appear in material you submit, link to, or ask us to display:',
          '1. Pornographic or sexually explicit material, including NSFW imagery and services whose primary purpose is adult content.',
          '2. Graphic violence or gore, and instructions that facilitate physical harm to people or animals.',
          '3. Hate speech, harassment, or content that incites discrimination on grounds of race, ethnicity, religion, gender, sexual orientation, disability or nationality.',
          '4. Child sexual abuse material (CSAM), any sexualisation of minors, grooming, or links to such material.',
          '5. Deepfakes and non-consensual impersonation, including synthetic depictions of real individuals used to deceive, defame or defraud.',
          '6. Copyright or trademark infringement, counterfeit offers, scraped or stolen content, malware or phishing destinations, and knowingly false claims about a product.',
          'C. Zero tolerance. CSAM, terrorism and violent extremism, weapons of mass destruction, genocide or ethnic hatred, non-consensual deepfakes of real individuals, and anything unlawful under applicable local law are refused outright. Where required, such cases are referred to the competent authorities.',
          'D. No prohibited content may be approved by paying for a placement. Payment buys display only; editorial review applies equally to free and paid submissions.',
          'E. The rest of this policy is on this same page: moderation at https://dirtool.com/terms-of-service#content-moderation, reporting and appeals at https://dirtool.com/terms-of-service#reporting, and enforcement actions at https://dirtool.com/terms-of-service#enforcement.',
        ],
        zh: [
          'A. 适用范围。本政策是服务条款的组成部分，适用于每一条收录、提交、图标、截图、外链、工单与账号。本站是无生成能力的目录站，因此模板中不适用于本产品的类别、渠道与处置动作一律删去，而非照搬宣称。',
          'A. 适用范围（续）。「Image Generation」「Video Generation」「Text to Speech」等分类名称是描述第三方产品的编辑标签，既非本站能力，也不是对本站所运行模型的描述。',
          'B. 禁止内容。你提交、外链至或要求我们展示的材料中，不得出现以下任一类别：',
          '1. 色情或露骨性内容，包括 NSFW 图像以及以成人内容为主要目的的服务。',
          '2. 血腥暴力、残害画面，以及教唆或便利对人或动物造成身体伤害的内容。',
          '3. 仇恨言论、骚扰，或基于种族、族群、宗教、性别、性取向、残障、国籍煽动歧视的内容。',
          '4. 儿童性虐待材料（CSAM）、任何对未成年人的性化、诱导，或指向此类材料的链接。',
          '5. 深度伪造与非自愿冒充，包括用于欺骗、诽谤或诈骗的真人合成形象。',
          '6. 侵犯著作权或商标、假冒商品、抓取或盗取的内容、恶意软件或钓鱼落地页，以及对产品的明知虚假陈述。',
          'C. 零容忍。CSAM、恐怖主义与暴力极端主义、大规模杀伤性武器、种族灭绝或族群仇恨、非自愿的真人深度伪造，以及适用当地法律认定为违法的一切内容，一律拒绝；在法律要求时移交主管机关。',
          'D. 付费不能使禁止内容获得通过。付款购买的仅是展示位；免费与付费提交适用同一套编辑审核标准。',
          'E. 本政策其余部分均在本页：内容审核 https://dirtool.com/terms-of-service#content-moderation，举报与申诉 https://dirtool.com/terms-of-service#reporting，处置措施 https://dirtool.com/terms-of-service#enforcement。',
        ],
      },
    },
    {
      id: 'content-moderation',
      heading: { en: 'Content Moderation', zh: '内容审核' },
      bullets: {
        en: [
          'This site has no generative capability, so model-input filtering and model-output filtering do not apply and are intentionally omitted. Naming an underlying model or a safety classifier here would be a false statement about this product.',
          'What we do instead: every submission is checked against the standards above; a human operator reviews each listing, its description, its logo and its destination URL before publication; published listings are audited periodically and re-checked whenever a report arrives; material that fails is edited, hidden or removed.',
          'We accept no prompts, host no third-party tools, and receive no user-generated media uploads. Outbound URLs are read only by a metadata preview that parses public page metadata; it executes nothing and generates nothing.',
          'When a submission is refused or a listing removed, the submitter is told through the submission status or via {contact}.',
        ],
        zh: [
          '本站没有生成能力，因此「模型输入审核」与「模型输出审核」不适用，并已按模板规则明确删除。在此列出任何底层模型或安全分类器名称，都会构成对本站产品的虚假陈述。',
          '我们实际执行的措施：每条提交先按上述标准筛查；上线前由站长人工审核收录文案、图标与目标网址；已发布内容定期复查，收到举报时立即复核；不合格内容予以编辑、隐藏或删除。',
          '我们不接受提示词、不托管第三方工具、不接收用户上传的媒体文件。外链仅由 metadata 预览功能读取公开网页元信息，该过程不执行任何代码、不生成任何内容。',
          '提交被拒绝或收录被下架时，我们会通过提交状态或 {contact} 告知提交者。',
        ],
      },
    },
    {
      id: 'reporting',
      heading: { en: 'Reporting', zh: '举报渠道' },
      bullets: {
        en: [
          'Reports, takedown requests and appeals are read by a human at {contact}; a DM to {x} at {xUrl} reaches the same person. Please use the subject line "AUP report" and include the listing URL, the reason and any supporting detail. The in-site ticket form at https://dirtool.com/settings/tickets is also monitored.',
          'Reports are handled confidentially and impartially. We do not disclose the identity of a reporter to the subject of a report except where the law requires it. Repeated or deliberately false reports are treated as abuse of the channel.',
          'We acknowledge reports and act on substantiated ones without undue delay. We do not promise a fixed response time, because every review is performed by a human operator.',
          'If you believe a decision was wrong, write again with the subject line "AUP appeal" and the original reference; a second, separate review is performed.',
        ],
        zh: [
          '举报、下架请求与申诉由人工在 {contact} 阅读；私信 {x}（{xUrl}）由同一人处理。请在邮件标题写「AUP report」，并附上收录网址、理由与相关依据。站内工单 https://dirtool.com/settings/tickets 同样有人查看。',
          '举报按保密、公正原则处理。除法律要求外，我们不会向被举报方披露举报人身份；反复或故意的虚假举报视为滥用渠道。',
          '我们会确认收到举报，并对成立的举报及时处置。由于所有审核均由人工完成，我们不承诺固定响应时限。',
          '若你认为处理结果有误，请以「AUP appeal」为标题并附原编号再次来信，我们会进行一次独立的复核。',
        ],
      },
    },
    {
      id: 'enforcement',
      heading: { en: 'Enforcement Actions', zh: '处置措施' },
      bullets: {
        en: [
          'These are the actions this site can actually take, applied in proportion to severity and repetition: warning the submitter; editing or removing a listing, logo or screenshot; rejecting or hiding a submission; restricting the ability to submit further listings; suspending or permanently closing an account; and referring a case to the competent authorities where the law requires it.',
          'Actions that do not apply to a directory — such as disabling a generation feature, filtering a model output or revoking model credits — are not claimed here.',
          'A paid placement removed because it violates this policy is not refunded. Enforcement is recorded with the listing so that a repeat submission can be recognised.',
        ],
        zh: [
          '以下是本站确实能够执行的处置动作，按严重程度与是否重复酌情适用：警告提交者；编辑或删除收录、图标、截图；拒绝或隐藏提交；限制继续提交的权限；暂停或永久关闭账号；以及在法律要求时移交主管机关。',
          '不适用于目录站的动作（例如停用生成功能、过滤模型输出、收回模型额度）不在此宣称。',
          '因违反本政策被下架的付费置顶不予退款。处置结果会随收录一并记录，以便识别重复提交。',
        ],
      },
    },
    {
      id: 'data-privacy',
      heading: { en: 'Data, Privacy and Security', zh: '数据、隐私与安全' },
      body: {
        en: 'Your use of the service is governed by our Privacy Policy at https://dirtool.com/privacy-policy. Payment card data is processed exclusively by Waffo Pancake, our PCI-DSS certified payment processor, and is not stored on our servers. The only cookies we set are a signed session cookie and a private operator cookie; we set no advertising or cross-site tracking cookies. Session data expires after 30 days and published listing data is retained while the listing stays public, as described in the Privacy Policy. Report a security issue to {contact}.',
        zh: '你对本服务的使用受隐私政策 https://dirtool.com/privacy-policy 约束。银行卡资料仅由我们的 PCI-DSS 认证支付处理方 Waffo Pancake 处理，本站服务器不存储。本站只设置一枚签名会话 Cookie 与一枚站长专用后台 Cookie，不设置广告或跨站追踪 Cookie。会话数据 30 天后过期，已发布收录数据在页面公开期间保留，详见隐私政策。安全问题请报告至 {contact}。',
      },
    },
    {
      heading: { en: 'Disclaimers and Limitation of Liability', zh: '免责声明与责任限制' },
      body: {
        en: 'The directory is provided "as is" and "as available", without warranties of any kind. We do not control third-party tools and are not responsible for their content, availability, pricing or practices. A listing is an editorial reference, not an endorsement, and does not promise any search-engine or commercial outcome. To the maximum extent permitted by law, we are not liable for indirect, incidental, consequential or punitive damages, and our total liability shall not exceed the amount you paid us in the 12 months preceding the event giving rise to the claim. Nothing here limits rights that mandatory consumer law gives you.',
        zh: '本目录按「现状」「可用状态」提供，不作任何明示或默示担保。我们不控制第三方工具，也不对其内容、可用性、定价或经营行为负责。收录只是编辑性索引，不构成背书，也不承诺任何搜索引擎或商业效果。在法律允许的最大范围内，我们不对间接、附带、后果性或惩罚性损害负责，且我们的全部责任不超过引发索赔的事件发生前 12 个月内你向我们支付的金额。本条不限制强制性消费者法律赋予你的权利。',
      },
    },
    {
      heading: { en: 'Term and Termination', zh: '期限与终止' },
      body: {
        en: 'These Terms remain effective while you use the service. We may suspend or terminate an account or remove a listing if you materially breach these Terms, if we suspect fraudulent activity, or where the law requires it; the enforcement ladder actually available to us is listed at https://dirtool.com/terms-of-service#enforcement. Because there is no subscription, there is no renewal to cancel and no unused prepaid period. You may request deletion of your account and data at any time by writing to {contact}.',
        zh: '本条款在你使用本服务期间持续有效。若你实质违反本条款、我们怀疑存在欺诈，或法律有要求，我们可暂停／终止账号或下架收录；本站实际可执行的处置阶梯见 https://dirtool.com/terms-of-service#enforcement。由于本站没有订阅制，不存在需要取消的续费，也不存在未使用的预付费周期。你可以随时发邮件至 {contact} 要求删除账号与数据。',
      },
    },
    {
      heading: { en: 'Governing Law and Disputes', zh: '适用法律与争议解决' },
      body: {
        en: 'These terms are governed by the law of the jurisdiction in which {legalName} is established. If a dispute arises, please first write to {contact}; we will try to resolve it through good-faith discussion. If that fails, the dispute is submitted to the courts with jurisdiction at the place where the operator is established. Nothing here limits rights that mandatory consumer law gives you.',
        zh: '本条款适用 {legalName} 设立地的法律。发生争议时，请先发邮件至 {contact}，我们会先通过善意协商解决；协商不成的，提交经营者设立地有管辖权的法院处理。本条不限制强制性消费者法律赋予你的权利。',
      },
    },
    {
      heading: { en: 'Changes', zh: '变更' },
      body: {
        en: 'We may update these Terms. Each revision carries a version number and an effective date at the top of this page, and we keep a version log. For material changes we notify account holders by email at least 14 days before they take effect and post a notice on this page; continued use after the effective date means you accept the revised Terms. If any provision is found unenforceable, the remainder stays in full effect.',
        zh: '我们可能更新本条款。每次修订都会在页首标注版本号与生效日期，并保留版本记录；重大变更会在生效前至少 14 天以邮件通知账号持有人，并在本页发布公告。生效日后继续使用即表示接受修订后的版本。若某一条款被认定不可执行，其余条款继续完全有效。',
      },
    },
    {
      heading: { en: 'Contact', zh: '联系方式' },
      body: {
        en: '{legalName} operates this site. General support, billing, refunds, AUP reports, appeals, legal, privacy and security questions all reach the same monitored inbox: {contact}. A second monitored channel is {x} at {xUrl}. In-site support tickets: https://dirtool.com/settings/tickets. Website: https://dirtool.com. We publish only the channels we actually read; there is no phone line or separate billing department.',
        zh: '{legalName} 运营本站。一般支持、账单、退款、AUP 举报、申诉、法务、隐私与安全问题，均通过同一个有人查看的邮箱处理：{contact}；第二个有人查看的渠道是 {x}（{xUrl}）。站内工单：https://dirtool.com/settings/tickets。站点：https://dirtool.com。我们只公布确实会查看的渠道，没有电话热线或独立的账单部门。',
      },
    },
  ].map(section),
}
