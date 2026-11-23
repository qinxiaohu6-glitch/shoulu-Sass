# SEO Roast Roadmap: dirtool.com (2026-11-21)

Verdict: Google, Bing, and the AI crawlers can fetch the site. The homepage snippet promises a dofollow link on a free submit, and the paid ladder charges less for a higher placement.

Checked live on 2026-11-21. No Google Search Console property and no Ahrefs or DataForSEO connection, so index coverage, keyword volume, DR, and referring domains are not in this file.

| # | Tier | Issue | Revenue impact | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| 1 | REVENUE | Homepage title, description, and hero said a free submit includes a dofollow link. Pricing, FAQ, and llms.txt say free is nofollow. | The search snippet sells a benefit the free plan does not deliver. | Homepage copy now separates nofollow (free) from dofollow (paid). | agent | edited locally, not deployed |
| 2 | REVENUE | While the campaign is open (until 2026-12-01 06:59 Asia/Shanghai), Boost was $4.99 and Standard was $9, and Boost sat above Standard. | A buyer comparing the cards had no reason to choose Standard. | New sales are Free, Boost, a weekly launch-board ad, and the sidebar. Standard, Featured, and Pro are no longer sold. Pins and Billboard rows already paid for stay until their original end. | founder | edited locally, not deployed |
| 3 | COMPOUNDING | Domain is dirtool.com. Visible brand was Product Atlas. No referring-domain count is available. | Brand searches and citations can split. Link gap cannot be sized. | Public name in the app is dirtool. The domain stays dirtool.com. Measure links only after Ahrefs or DataForSEO is connected. | founder | edited locally, not deployed |

## What passed

- `robots.txt` allows `User-agent: *` and names Bingbot, DuckDuckBot, and the AI search bots. It disallows `/api/`, `/admin`, `/settings`, `/dashboard`. Sitemap URL returns XML (159 URLs on 2026-11-21).
- Locales are English and Chinese only. Homepage hreflang lists `en`, `zh-Hans`, and `x-default`.
- `https://dirtool.com/no-such-page-xyz` returns 404 with noindex.
- `https://www.dirtool.com/` returns 301 to `https://dirtool.com/`.
- Pricing HTML on the live site, checked before this edit, contained Boost $4.99, Standard $9, Featured $19, Pro $29. The local pricing page now sells Free, Boost, the weekly launch-board ad, and the sidebar.
- llms.txt states 86 products across 8 categories and the same free/paid link rule as the FAQ.

## Fluff (ignore until the rows above ship)

- Title length and heading order were not scored.
- Alt text was not audited.
