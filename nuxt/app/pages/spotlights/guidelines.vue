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
 */
const { lang } = useLang()

if (lang.value === 'zh') {
  await navigateTo('/spotlights/guidelines', { redirectCode: 301 })
}

const canonical = 'https://dirtool.com/spotlights/guidelines'

const sections = [
  {
    n: '1',
    title: 'Article title',
    words: '—',
    body: 'Suggested shape: `[Product Name] Spotlight: [the one thing it changes]`. Keep it under 70 characters so it survives a search result.',
  },
  {
    n: '2',
    title: 'Introduction',
    words: '100–150',
    body: 'What the product is, who it is for, the problem in one sentence, and a single-sentence value proposition. A reader who stops here should still know what the thing does.',
  },
  {
    n: '3',
    title: 'The problem',
    words: '150–200',
    body: 'The specific situation the reader is in before the product. What they tried, and why it did not work. Concrete beats comprehensive: one real scenario is worth five hypotheticals.',
  },
  {
    n: '4',
    title: 'The solution and how it works',
    words: '200–300',
    body: 'How the product addresses that situation. The actual workflow, not a feature dump. Name one or two things it does differently from the obvious alternative, and say why that matters.',
  },
  {
    n: '5',
    title: 'Key features or benefits',
    words: '150–250',
    body: 'Three to five items, one or two sentences each, written as the outcome the user sees rather than the internal mechanism.',
  },
  {
    n: '6',
    title: 'Use cases or story',
    words: '150–250',
    body: 'One or two real scenarios, or how the product came to exist. If you have a user quote or a number, this is where it goes — and only if it is real.',
  },
  {
    n: '7',
    title: 'Call to action',
    words: '—',
    body: 'One clear next step. Include the product URL and the listing URL; the article will link to both.',
  },
  {
    n: '8',
    title: 'Optional details',
    words: '—',
    body: 'Founder bio under 50 words, a one-line pricing summary, and who the product is best for. These render in the product card at the top of the article.',
  },
]

const passes = [
  'Original text, or a substantial rewrite. Pasting the homepage copy fails.',
  '800 to 1,500 words in total.',
  'Every section has real content — no "TBD", no headings with one sentence under them.',
  'Contains both the product URL and the listing URL.',
  'No invented quotes, user counts, revenue figures or rankings.',
  'No superlatives that cannot be checked: "the best", "the only", "#1".',
  'No medical, financial or legal claims.',
  'Links point to pages that load.',
]

const fails = [
  'Rewritten affiliate copy, or the same article submitted for several products.',
  'Keyword stuffing, or a title that reads like a search query.',
  'Hidden links, cloaked links, or links unrelated to the product.',
  'Another product\'s name used for comparison as a put-down.',
  'Machine translation with no editing pass.',
  'Requests to link to a different site than the product being written about.',
]
</script>

<template>
  <div class="container gd-page">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink to="/">Discover</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink to="/spotlights">Product Spotlights</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>Template and standards</span>
    </nav>

    <header class="gd-head">
      <p class="gd-kicker">TEMPLATE AND STANDARDS</p>
      <h1>How to write a Product Spotlight</h1>
      <p class="gd-lead">
        Fill in the template below, mail the file back, and we review it. The standards further down
        are the same list the draft is checked against, so you can tell before you send whether it
        will pass.
      </p>
      <div class="gd-actions">
        <a class="gd-btn gd-btn--primary" href="/spotlight-template.md" download>
          Download the template (.md)
        </a>
        <NuxtLink class="gd-btn" to="/pricing">Which plans include a Spotlight</NuxtLink>
      </div>
    </header>

    <section aria-labelledby="gd-what">
      <h2 id="gd-what">What a Spotlight is</h2>
      <p>
        A long-form article about one listed product, published at its own URL under
        <code>/spotlights/</code>. It is not a second listing page and not a press release: it has to
        be worth reading by someone who has not decided to buy yet.
      </p>
      <p>
        Length is 800 to 1,500 words. Below 800 there is not enough to say; above 1,500 it is usually
        padding. Write for a reader who found the page from a search, not for the product's existing
        customers.
      </p>
    </section>

    <section aria-labelledby="gd-structure">
      <h2 id="gd-structure">The structure</h2>
      <ol class="gd-sections">
        <li v-for="section in sections" :key="section.n">
          <div class="gd-sections__head">
            <span class="gd-sections__n">{{ section.n }}</span>
            <strong>{{ section.title }}</strong>
            <em v-if="section.words !== '—'">{{ section.words }} words</em>
          </div>
          <p>{{ section.body }}</p>
        </li>
      </ol>
    </section>

    <section aria-labelledby="gd-pass">
      <h2 id="gd-pass">What passes review</h2>
      <ul class="gd-list gd-list--pass">
        <li v-for="item in passes" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section aria-labelledby="gd-fail">
      <h2 id="gd-fail">What gets it sent back</h2>
      <ul class="gd-list gd-list--fail">
        <li v-for="item in fails" :key="item">{{ item }}</li>
      </ul>
      <p class="gd-warn">
        The reason this list is strict: a directory that publishes rewritten copy stops being
        indexed, and then the article is worth nothing to you either. One good article is worth more
        than five thin ones.
      </p>
    </section>

    <section aria-labelledby="gd-links">
      <h2 id="gd-links">How the links work</h2>
      <div class="gd-table-wrap">
        <table class="gd-table">
          <thead>
            <tr>
              <th scope="col">Link</th>
              <th scope="col">Where</th>
              <th scope="col">rel</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Product website</th>
              <td>The product card at the top of the article</td>
              <td><code>dofollow</code></td>
            </tr>
            <tr>
              <th scope="row">Listing page</th>
              <td>Card, call to action, breadcrumb</td>
              <td>internal</td>
            </tr>
            <tr>
              <th scope="row">Any other external link</th>
              <td>Inside the article body</td>
              <td><code>nofollow noopener</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        One declared dofollow link is the benefit; a body full of them is a link scheme. Links in the
        body also carry <code>utm_source=product-atlas</code> so you can see the traffic in your own
        analytics.
      </p>
    </section>

    <section aria-labelledby="gd-submit">
      <h2 id="gd-submit">How to submit</h2>
      <ol class="gd-steps">
        <li>Download the template and fill it in. Markdown or plain text; no design needed.</li>
        <li>
          Mail it to the contact address in the site footer, with the subject
          <code>Spotlight: &lt;product name&gt;</code>.
        </li>
        <li>
          You get a yes or a specific list of changes within five working days. A no comes with the
          reason, so a second draft is not a guess.
        </li>
        <li>
          On approval the article is edited for typos and padding only, then published at
          <code>/spotlights/&lt;slug&gt;</code> and added to the sitemap the same day.
        </li>
      </ol>
      <p class="gd-note">
        Editing is limited on purpose: we do not add claims you did not make, and we do not soften
        what you did say. If a sentence needs a fact we cannot verify, it comes out and you are told
        which one.
      </p>
    </section>

    <section aria-labelledby="gd-badge">
      <h2 id="gd-badge">The badge is optional</h2>
      <p>
        After publication you can put a "Featured on Product Atlas" badge on your site. It is a
        convenience, not a condition: nothing is unpublished if the badge comes down, and no listing
        is held back until it goes up. The embed code is on the
        <NuxtLink to="/spotlights/badge">badge page</NuxtLink>.
      </p>
    </section>

    <p class="gd-foot">
      <NuxtLink to="/spotlights">← All Product Spotlights</NuxtLink>
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
