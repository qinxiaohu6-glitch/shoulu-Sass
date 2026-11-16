import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { createRouter } from 'radix3'
import { productMarkdownSlug } from './product-markdown-route.ts'

const here = import.meta.dirname

/**
 * The same transform Nitro 2.13.6 uses in `scanServerRoutes`
 * (`nitropack/dist/core/index.mjs`). A route section that starts with `:`
 * is a whole-segment placeholder in radix3, which is what swallowed
 * `/products/:slug` when the handler file was `[slug].md.ts`.
 */
const suffixRegex = /(\.(?<method>connect|delete|get|head|options|patch|post|put|trace))?(\.(?<env>dev|prod|prerender))?$/

function scanRoute(filePath: string): string {
  let route = filePath
    .replace(/\\/g, '/')
    .replace(/\.[A-Za-z]+$/, '')
    .replace(/\(([^(/\\]+)\)[/\\]/g, '')
    .replace(/\[\.{3}]/g, '**')
    .replace(/\[\.{3}(\w+)]/g, '**:$1')
    .replace(/\[([^/\]]+)]/g, ':$1')
  if (!route.startsWith('/')) route = `/${route}`
  const suffixMatch = route.match(suffixRegex)
  if (suffixMatch?.index && suffixMatch.index >= 0) route = route.slice(0, suffixMatch.index)
  return route.replace(/\/index$/, '') || '/'
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, acc)
    else acc.push(path)
  }
  return acc
}

test('markdown URLs do not claim the English HTML product path', () => {
  assert.equal(productMarkdownSlug('/products/chatgpt'), null)
  assert.equal(productMarkdownSlug('/products/chatgpt.md'), 'chatgpt')
  assert.equal(productMarkdownSlug('/products/free-anonymous-video-chat-with-strangers-omewisp.md'), 'free-anonymous-video-chat-with-strangers-omewisp')
  assert.equal(productMarkdownSlug('/products/chatgpt.md/'), 'chatgpt')
  assert.equal(productMarkdownSlug('/products/chatgpt.html'), null)
  assert.equal(productMarkdownSlug('/zh/products/chatgpt'), null)
  assert.equal(productMarkdownSlug('/zh/products/chatgpt.md'), null)
  assert.equal(productMarkdownSlug('/products'), null)
  assert.equal(productMarkdownSlug('/products/.md'), null)
  assert.equal(productMarkdownSlug('/products/a%2F..%2Fb.md'), null)
})

test('no scanned server route matches /products/:slug or /products/:slug.md', () => {
  const routesDir = join(here, '../../server/routes')
  const files = walk(routesDir).filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file))
  const router = createRouter()
  for (const file of files) {
    const route = scanRoute(relative(routesDir, file))
    router.insert(route, { route, file })
  }

  assert.equal(router.lookup('/products/chatgpt'), null)
  assert.equal(router.lookup('/products/chatgpt.md'), null)
  assert.equal(router.lookup('/products/agentos'), null)
  assert.equal(router.lookup('/zh/products/chatgpt'), null)
  assert.equal(router.lookup('/products'), null)
  assert.equal(router.lookup('/sitemap.xml')?.route, '/sitemap.xml')

  const stolen = files.filter((file) => /\/products\/\[[^\]]+\]\.[a-z]+\.[cm]?[jt]sx?$/.test(file.replaceAll('\\', '/')))
  assert.deepEqual(stolen, [])
})
