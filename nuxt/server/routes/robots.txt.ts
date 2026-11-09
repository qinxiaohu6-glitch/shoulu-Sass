/**
 * robots.txt — served from a route so it cannot drift from the rest of the site.
 *
 * Beyond the Allow/Disallow rules this file does one thing the old version did
 * not: it names the AI crawlers in their own group instead of leaving them to
 * the `User-agent: *` wildcard. A crawler that answers questions rather than
 * only indexing pages is told "yes, and here is where the map is" — several of
 * them read their own group and ignore the wildcard one.
 *
 * The header comments advertise `/llms.txt` and `/ai.txt`. Those two files are
 * the cheapest thing on the site to read: an assistant that finds them does not
 * have to parse a single page of HTML to know what this site is.
 */
const SITE = 'https://dirtool.com'

/**
 * Crawlers that fetch pages to answer questions, not only to index them. One
 * list, because they all get the same rules — spelling them out one
 * `User-agent:` line each is what makes the group apply to them.
 */
const AI_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'DuckAssistBot',
]

/**
 * The two classic engines are already covered by `User-agent: *`, but naming
 * them in the same Allow group makes the intent explicit and survives the case
 * where a site adds a stricter wildcard group later.
 *
 * We deliberately do NOT block `Bytespider` as productsfarm.com does. This
 * round is about maximising AI visibility; an assistant that reads the site
 * is a reader, not a cost, and the `/api/` + session routes stay closed
 * regardless of the agent.
 */
const SEARCH_AGENTS = ['Googlebot', 'Bingbot']

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // /settings and /admin are session-gated and /api is machine-only — none of
  // them belong in an index. /submit and /sign-in are crawlable but stay out of
  // the sitemap: they are transactional, not content.
  return [
    '# robots.txt for Product Atlas (https://dirtool.com/)',
    `# A map of the site for AI assistants: ${SITE}/llms.txt`,
    `# How AI systems may use and cite this content: ${SITE}/ai.txt`,
    '',
    'User-agent: *',
    ...SEARCH_AGENTS.map((agent) => `User-agent: ${agent}`),
    ...AI_AGENTS.map((agent) => `User-agent: ${agent}`),
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /settings',
    'Disallow: /dashboard',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ].join('\n')
})
