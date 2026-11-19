<script setup lang="ts">
/**
 * /spotlights/guidelines — the content template and the review standards.
 *
 * This page is the quality gate, not a marketing page. The template is the same
 * one a maker fills in; the standards below it are the list a draft is actually
 * checked against, written as pass/fail so "we will review it" is not the only
 * thing a submitter is told.
 *
 * The download link points at `public/spotlight-template.md` so the file can be
 * filled in offline and mailed back — asking someone to write 1,000 words in a
 * web textarea is how you get 300 words.
 *
 * Bilingual: the section shipped English-only and 301'd `/zh/...` back to
 * English. The three lists below are data, so they are `computed` through
 * `pick()` rather than translated in the template.
 */
const { pick } = useLang()
const localePath = useLocalePath()

useSeo({
  title: computed(() =>
    pick('聚光灯模板与审核标准 · Product Atlas', 'Product Spotlight template and review standards · Product Atlas'),
  ),
  description: computed(() =>
    pick(
      '产品聚光灯的写作模板：八个小节、800 到 1,500 字，以及稿子实际被逐条对照的通过/退回清单。',
      'The template for a Product Spotlight: eight sections, 800 to 1,500 words, and the pass/fail list a draft is reviewed against.',
    ),
  ),
  type: 'article',
})

const sections = computed(() => [
  {
    n: '1',
    title: pick('文章标题', 'Article title'),
    words: '—',
    body: pick(
      '建议句式：`[产品名] 聚光灯：[它改变的那一件事]`。控制在 70 个字符以内，搜索结果里才不会被截断。',
      'Suggested shape: `[Product Name] Spotlight: [the one thing it changes]`. Keep it under 70 characters so it survives a search result.',
    ),
  },
  {
    n: '2',
    title: pick('开头', 'Introduction'),
    words: '100–150',
    body: pick(
      '产品是什么、给谁用、问题用一句话说清，再加一句价值主张。读到这儿就停下的人，也应该知道这东西干什么。',
      'What the product is, who it is for, the problem in one sentence, and a single-sentence value proposition. A reader who stops here should still know what the thing does.',
    ),
  },
  {
    n: '3',
    title: pick('问题', 'The problem'),
    words: '150–200',
    body: pick(
      '读者在用这个产品之前的具体处境：试过什么、为什么没成。具体胜过全面——一个真实场景抵五个假设。',
      'The specific situation the reader is in before the product. What they tried, and why it did not work. Concrete beats comprehensive: one real scenario is worth five hypotheticals.',
    ),
  },
  {
    n: '4',
    title: pick('方案与它怎么工作', 'The solution and how it works'),
    words: '200–300',
    body: pick(
      '产品怎么处理那个处境。写真实的工作流程，不是功能清单。挑一两点说明它和显而易见的替代方案有什么不同，以及这为什么重要。',
      'How the product addresses that situation. The actual workflow, not a feature dump. Name one or two things it does differently from the obvious alternative, and say why that matters.',
    ),
  },
  {
    n: '5',
    title: pick('关键功能或好处', 'Key features or benefits'),
    words: '150–250',
    body: pick(
      '三到五条，每条一两句，写用户看得见的结果，不写内部机制。',
      'Three to five items, one or two sentences each, written as the outcome the user sees rather than the internal mechanism.',
    ),
  },
  {
    n: '6',
    title: pick('使用场景或故事', 'Use cases or story'),
    words: '150–250',
    body: pick(
      '一到两个真实场景，或者产品是怎么来的。有真实的用户原话或数字就放这儿——前提是真的。',
      'One or two real scenarios, or how the product came to exist. If you have a user quote or a number, this is where it goes — and only if it is real.',
    ),
  },
  {
    n: '7',
    title: pick('行动号召', 'Call to action'),
    words: '—',
    body: pick(
      '一个明确的下一步。写上产品网址和收录页地址，文章两处都会链。',
      'One clear next step. Include the product URL and the listing URL; the article will link to both.',
    ),
  },
  {
    n: '8',
    title: pick('可选信息', 'Optional details'),
    words: '—',
    body: pick(
      '50 字以内的创始人简介、一行价格概括、最适合谁用。这些会显示在文章顶部的产品卡里。',
      'Founder bio under 50 words, a one-line pricing summary, and who the product is best for. These render in the product card at the top of the article.',
    ),
  },
])

const passes = computed(() => [
  pick('原创文字，或大幅重写。直接贴官网文案不通过。', 'Original text, or a substantial rewrite. Pasting the homepage copy fails.'),
  pick('全文 800 到 1,500 字。', '800 to 1,500 words in total.'),
  pick(
    '每个小节都有实际内容——没有「待补」，没有一句话撑一个小标题。',
    'Every section has real content — no "TBD", no headings with one sentence under them.',
  ),
  pick('同时包含产品网址和收录页地址。', 'Contains both the product URL and the listing URL.'),
  pick(
    '没有编造的用户评价、用户数、营收数字或排名。',
    'No invented quotes, user counts, revenue figures or rankings.',
  ),
  pick(
    '没有无法核实的最高级说法：「最好」「唯一」「第一」。',
    'No superlatives that cannot be checked: "the best", "the only", "#1".',
  ),
  pick('没有医疗、金融或法律方面的断言。', 'No medical, financial or legal claims.'),
  pick('链接指向的页面能打开。', 'Links point to pages that load.'),
])

const fails = computed(() => [
  pick(
    '改写过的推广文案，或者同一篇投给多个产品。',
    'Rewritten affiliate copy, or the same article submitted for several products.',
  ),
  pick('堆关键词，或者标题读起来像搜索词。', 'Keyword stuffing, or a title that reads like a search query.'),
  pick('隐藏链接、伪装链接，或与产品无关的链接。', 'Hidden links, cloaked links, or links unrelated to the product.'),
  pick(
    '拿别的产品名字做贬低式对比。',
    "Another product's name used for comparison as a put-down.",
  ),
  pick('机器翻译没有经过人工校对。', 'Machine translation with no editing pass.'),
  pick(
    '要求链到与所写产品无关的网站。',
    'Requests to link to a different site than the product being written about.',
  ),
])
</script>

<template>
  <div class="container gd-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/spotlights')">{{ pick('产品聚光灯', 'Product Spotlights') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('模板与标准', 'Template and standards') }}</span>
    </nav>

    <header class="gd-head">
      <p class="gd-kicker">{{ pick('模板与标准', 'TEMPLATE AND STANDARDS') }}</p>
      <h1>{{ pick('一篇产品聚光灯怎么写', 'How to write a Product Spotlight') }}</h1>
      <p class="gd-lead">
        {{ pick(
          '把下面的模板填好，把文件发回来，我们来审。再往下的标准，就是稿子被逐条对照的同一份清单——所以你在发送之前就能判断它能不能过。',
          'Fill in the template below, mail the file back, and we review it. The standards further down are the same list the draft is checked against, so you can tell before you send whether it will pass.',
        ) }}
      </p>
      <div class="gd-actions">
        <a class="gd-btn gd-btn--primary" href="/spotlight-template.md" download>
          {{ pick('下载模板（.md）', 'Download the template (.md)') }}
        </a>
        <NuxtLink class="gd-btn" :to="localePath('/pricing')">{{ pick('哪些档位包含聚光灯', 'Which plans include a Spotlight') }}</NuxtLink>
      </div>
    </header>

    <section aria-labelledby="gd-what">
      <h2 id="gd-what">{{ pick('聚光灯是什么', 'What a Spotlight is') }}</h2>
      <p>
        {{ pick('一篇只讲一个收录产品的长文，挂在', 'A long-form article about one listed product, published at its own URL under') }}
        <code>/spotlights/</code>
        {{ pick(
          '下自己独立的网址。它不是第二个收录页，也不是新闻稿：它必须值得一个还没决定要不要买的人读下去。',
          '. It is not a second listing page and not a press release: it has to be worth reading by someone who has not decided to buy yet.',
        ) }}
      </p>
      <p>
        {{ pick(
          '长度 800 到 1,500 字。低于 800 是没话可说；高于 1,500 通常是注水。写给从搜索结果点进来的人，不是写给已经在用的老客户。',
          "Length is 800 to 1,500 words. Below 800 there is not enough to say; above 1,500 it is usually padding. Write for a reader who found the page from a search, not for the product's existing customers.",
        ) }}
      </p>
    </section>

    <section aria-labelledby="gd-structure">
      <h2 id="gd-structure">{{ pick('结构', 'The structure') }}</h2>
      <ol class="gd-sections">
        <li v-for="section in sections" :key="section.n">
          <div class="gd-sections__head">
            <span class="gd-sections__n">{{ section.n }}</span>
            <strong>{{ section.title }}</strong>
            <em v-if="section.words !== '—'">{{ pick(`${section.words} 字`, `${section.words} words`) }}</em>
          </div>
          <p>{{ section.body }}</p>
        </li>
      </ol>
    </section>

    <section aria-labelledby="gd-pass">
      <h2 id="gd-pass">{{ pick('什么样的稿子能过', 'What passes review') }}</h2>
      <ul class="gd-list gd-list--pass">
        <li v-for="item in passes" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section aria-labelledby="gd-fail">
      <h2 id="gd-fail">{{ pick('什么会被退回来', 'What gets it sent back') }}</h2>
      <ul class="gd-list gd-list--fail">
        <li v-for="item in fails" :key="item">{{ item }}</li>
      </ul>
      <p class="gd-warn">
        {{ pick(
          '这份清单这么严，原因很简单：一个开始发改写文案的目录站会先掉出索引，然后那篇文章对你也就一文不值。一篇好文章胜过五篇薄文。',
          'The reason this list is strict: a directory that publishes rewritten copy stops being indexed, and then the article is worth nothing to you either. One good article is worth more than five thin ones.',
        ) }}
      </p>
    </section>

    <section aria-labelledby="gd-links">
      <h2 id="gd-links">{{ pick('链接怎么处理', 'How the links work') }}</h2>
      <div class="gd-table-wrap">
        <table class="gd-table">
          <thead>
            <tr>
              <th scope="col">{{ pick('链接', 'Link') }}</th>
              <th scope="col">{{ pick('位置', 'Where') }}</th>
              <th scope="col">rel</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{{ pick('产品官网', 'Product website') }}</th>
              <td>{{ pick('文章顶部的产品卡', 'The product card at the top of the article') }}</td>
              <td><code>dofollow</code></td>
            </tr>
            <tr>
              <th scope="row">{{ pick('收录页', 'Listing page') }}</th>
              <td>{{ pick('产品卡、行动号召、面包屑', 'Card, call to action, breadcrumb') }}</td>
              <td>{{ pick('站内', 'internal') }}</td>
            </tr>
            <tr>
              <th scope="row">{{ pick('其它任何外链', 'Any other external link') }}</th>
              <td>{{ pick('正文里', 'Inside the article body') }}</td>
              <td><code>nofollow noopener</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        {{ pick('一条声明过的 dofollow 链接就是权益本身；正文里挂满就是链接买卖。正文里的链接还会带', 'One declared dofollow link is the benefit; a body full of them is a link scheme. Links in the body also carry') }}
        <code>utm_source=product-atlas</code>
        {{ pick('，你在自己的统计里就能看到这部分流量。', ' so you can see the traffic in your own analytics.') }}
      </p>
    </section>

    <section aria-labelledby="gd-submit">
      <h2 id="gd-submit">{{ pick('怎么提交', 'How to submit') }}</h2>
      <ol class="gd-steps">
        <li>{{ pick('下载模板填好。Markdown 或纯文本都行，不用排版。', 'Download the template and fill it in. Markdown or plain text; no design needed.') }}</li>
        <li>
          {{ pick('发到页脚的联系邮箱，主题写', 'Mail it to the contact address in the site footer, with the subject') }}
          <code>Spotlight: &lt;{{ pick('产品名', 'product name') }}&gt;</code>。
        </li>
        <li>
          {{ pick(
            '五个工作日内给你一个「可以」，或者一份具体的修改清单。不通过会写明原因，第二稿不用猜。',
            'You get a yes or a specific list of changes within five working days. A no comes with the reason, so a second draft is not a guess.',
          ) }}
        </li>
        <li>
          {{ pick('通过后只改错别字和注水段落，然后发布在', 'On approval the article is edited for typos and padding only, then published at') }}
          <code>/spotlights/&lt;slug&gt;</code>{{ pick('，当天进 sitemap。', ' and added to the sitemap the same day.') }}
        </li>
      </ol>
      <p class="gd-note">
        {{ pick(
          '改稿范围是刻意限定的：不加你没说过的说法，也不软化你说过的。某句话需要的事实我们核不了，就把那句删掉，并告诉你是哪一句。',
          'Editing is limited on purpose: we do not add claims you did not make, and we do not soften what you did say. If a sentence needs a fact we cannot verify, it comes out and you are told which one.',
        ) }}
      </p>
    </section>

    <section aria-labelledby="gd-badge">
      <h2 id="gd-badge">{{ pick('徽章是可选的', 'The badge is optional') }}</h2>
      <p>
        {{ pick('发布之后你可以在自己站上挂一枚「Featured on Product Atlas」徽章。它是方便，不是条件：徽章撤了不会下架，徽章没挂也不会压着不发。嵌入代码在', 'After publication you can put a "Featured on Product Atlas" badge on your site. It is a convenience, not a condition: nothing is unpublished if the badge comes down, and no listing is held back until it goes up. The embed code is on the') }}
        <NuxtLink :to="localePath('/spotlights/badge')">{{ pick('徽章页', 'badge page') }}</NuxtLink>。
      </p>
    </section>

    <p class="gd-foot">
      <NuxtLink :to="localePath('/spotlights')">{{ pick('← 全部产品聚光灯', '← All Product Spotlights') }}</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.gd-page { padding-top: 28px; padding-bottom: 64px; max-width: 820px; }
.gd-head { margin: 12px 0 34px; }
.gd-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.gd-head h1 { margin: 8px 0 14px; font-size: 34px; line-height: 1.2; letter-spacing: -0.03em; }
.gd-lead { margin: 0 0 18px; font-size: 17px; line-height: 1.65; }
.gd-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.gd-btn { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); font-size: 14px; font-weight: 600; text-decoration: none; color: inherit; }
.gd-btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
h2 { margin: 38px 0 12px; font-size: 22px; letter-spacing: -0.02em; }
p { font-size: 15px; line-height: 1.75; margin: 0 0 12px; }
code { font-size: 0.9em; padding: 1px 5px; border-radius: 5px; background: var(--muted, #f4f4f2); }
.gd-sections { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.gd-sections li { padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
.gd-sections__head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.gd-sections__n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: #14161a; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.gd-sections__head strong { font-size: 15px; }
.gd-sections__head em { margin-left: auto; font-style: normal; font-size: 11px; letter-spacing: 0.04em; color: var(--muted-foreground); }
.gd-sections p { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.gd-list { margin: 0 0 12px; padding: 0 0 0 22px; display: grid; gap: 7px; }
.gd-list li { font-size: 14px; line-height: 1.65; }
.gd-list--pass li::marker { color: #15803d; }
.gd-list--fail li::marker { color: #b91c1c; }
.gd-warn { padding: 14px 16px; border-left: 3px solid #d9a03a; background: #fff8e8; border-radius: 0 10px 10px 0; font-size: 13px; line-height: 1.7; color: #6b531f; }
.gd-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; margin-bottom: 12px; }
.gd-table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 14px; }
.gd-table th, .gd-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
.gd-table thead th { font-size: 12px; letter-spacing: 0.04em; color: var(--muted-foreground); background: var(--muted, #f6f6f4); }
.gd-table tbody tr:last-child th, .gd-table tbody tr:last-child td { border-bottom: 0; }
.gd-steps { margin: 0 0 12px; padding: 0 0 0 22px; display: grid; gap: 8px; }
.gd-steps li { font-size: 14px; line-height: 1.7; }
.gd-note { font-size: 13px; line-height: 1.7; color: var(--muted-foreground); }
.gd-foot { margin-top: 40px; font-size: 13px; }
.gd-foot a { color: var(--muted-foreground); text-decoration: none; }
.gd-foot a:hover { color: #b45309; }
@media (max-width: 640px) {
  .gd-head h1 { font-size: 26px; }
}
</style>
