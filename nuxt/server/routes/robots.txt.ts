export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // /settings and /admin are session-gated and /api is machine-only — none of
  // them belong in an index. /submit and /sign-in are crawlable but stay out of
  // the sitemap: they are transactional, not content.
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /settings',
    'Disallow: /dashboard',
    '',
    'Sitemap: https://dirtool.com/sitemap.xml',
    '',
  ].join('\n')
})
