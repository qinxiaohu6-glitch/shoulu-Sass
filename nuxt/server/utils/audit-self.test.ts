/**
 * Own-host audit must not use the public fetch that Cloudflare answers 522.
 *
 * The production transport is Nitro's localFetch, injected by `auditForRequest`.
 * These tests pass a fake of that function and a public fetch that returns 522,
 * which is what the edge does today for `fetch("https://dirtool.com/")`.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuditError, audit, isOwnAuditHost, type OwnSiteFetch } from './audit.ts'

const PAGE = `<!doctype html><html lang="zh"><head>
<title>Product Atlas 收录站首页标题</title>
<meta name="description" content="${'这是一段足够长的描述，用来通过描述长度检查。'.repeat(3)}">
</head><body><main>
<h1>Dirtool 是什么？</h1>
<p>${'正文 '.repeat(400)}</p>
</main></body></html>`

function textFile(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

test('own hosts are the apex, www, and the request host when it is this worker', () => {
  assert.equal(isOwnAuditHost('dirtool.com'), true)
  assert.equal(isOwnAuditHost('DIRTOOL.COM'), true)
  assert.equal(isOwnAuditHost('www.dirtool.com.'), true)
  assert.equal(isOwnAuditHost('https://dirtool.com'), false)
  assert.equal(isOwnAuditHost('example.com'), false)
  assert.equal(isOwnAuditHost('dirtool.com.evil'), false)
  assert.equal(isOwnAuditHost('notdirtool.com'), false)
  // A subdomain is in-process only when this request arrived there.
  assert.equal(isOwnAuditHost('beta.dirtool.com', 'dirtool.com'), false)
  assert.equal(isOwnAuditHost('beta.dirtool.com', 'beta.dirtool.com'), true)
  assert.equal(isOwnAuditHost('product-atlas.workers.dev', 'product-atlas.workers.dev'), true)
  assert.equal(isOwnAuditHost('example.com', 'example.com'), false)
})

test('www.dirtool.com is read in-process, including the apex redirect and the three probes', async () => {
  const publicUrls: string[] = []
  const local: { path: string; host?: string; redirect?: RequestRedirect }[] = []

  const localFetch: OwnSiteFetch = async (path, init) => {
    local.push({ path, host: init?.host, redirect: init?.redirect })
    if (init?.host === 'www.dirtool.com') {
      return new Response(null, {
        status: 301,
        headers: { location: 'https://dirtool.com/zh' },
      })
    }
    if (path === '/robots.txt') return textFile('user-agent: *\nallow: /\n')
    if (path === '/llms.txt') return textFile('# dirtool\n\nthis file is long enough to count')
    if (path === '/sitemap.xml') return textFile('<urlset></urlset>')
    return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }

  const result = await audit('https://www.dirtool.com/zh', 'zh', {
    requestHost: 'dirtool.com',
    localFetch,
    publicFetch: async (input) => {
      publicUrls.push(String(input))
      return new Response('cloudflare', { status: 522 })
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.equal(result.final_url, 'https://dirtool.com/zh')
  assert.deepEqual(publicUrls, [])
  assert.deepEqual(
    local.map((call) => `${call.host}${call.path}`),
    [
      'www.dirtool.com/zh',
      'dirtool.com/zh',
      'dirtool.com/llms.txt',
      'dirtool.com/robots.txt',
      'dirtool.com/sitemap.xml',
    ],
  )
  assert.ok(local.every((call) => call.redirect === 'manual'))
  const robots = result.checks.find((check) => check.id === 'robots')
  assert.equal(robots?.status, 'pass')
})

test('an external site still uses public fetch and never the in-process reader', async () => {
  const seen: { url: string; redirect?: RequestRedirect; accept?: string }[] = []
  const html = PAGE.replace('lang="zh"', 'lang="en"')

  const result = await audit('https://example.com/docs', 'en', {
    requestHost: 'dirtool.com',
    localFetch: async () => {
      throw new Error('own-site fetch must not run for example.com')
    },
    publicFetch: async (input, init) => {
      const headers = new Headers(init?.headers)
      seen.push({
        url: String(input),
        redirect: init?.redirect,
        accept: headers.get('accept') ?? '',
      })
      const url = String(input)
      if (url === 'https://example.com/docs') {
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
      }
      return textFile('user-agent: *\nallow: /\n')
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.final_url, 'https://example.com/docs')
  assert.deepEqual(
    seen.map((call) => call.url),
    [
      'https://example.com/docs',
      'https://example.com/llms.txt',
      'https://example.com/robots.txt',
      'https://example.com/sitemap.xml',
    ],
  )
  assert.ok(seen.every((call) => call.redirect === 'follow'))
  assert.match(seen[0]!.accept, /text\/html/)
  assert.match(seen[1]!.accept, /text\/plain/)
})

test('without the in-process reader a 522 is still reported as http_error', async () => {
  await assert.rejects(
    () =>
      audit('https://dirtool.com/', 'en', {
        publicFetch: async () => new Response('timeout', { status: 522 }),
      }),
    (err: unknown) => {
      assert.ok(err instanceof AuditError)
      assert.equal(err.code, 'http_error')
      assert.equal(err.upstream, 522)
      return true
    },
  )
})

test('a self-check of the workers.dev host that served the request stays in-process', async () => {
  const hosts: string[] = []
  await audit('https://product-atlas.example.workers.dev/', 'en', {
    requestHost: 'product-atlas.example.workers.dev',
    localFetch: async (path, init) => {
      hosts.push(init?.host ?? '')
      if (path === '/robots.txt' || path === '/llms.txt' || path === '/sitemap.xml') return textFile('x')
      return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html' } })
    },
    publicFetch: async () => {
      throw new Error('workers.dev self-check must not leave the worker')
    },
  })
  assert.ok(hosts.includes('product-atlas.example.workers.dev'))
})
