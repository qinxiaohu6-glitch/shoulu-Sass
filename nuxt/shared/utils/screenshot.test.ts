import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ogImageFromHtml, pickBillboardShot, screenshotSrc } from './screenshot.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('screenshot URLs keep their host and bare filenames map to the screenshots directory', () => {
  assert.equal(screenshotSrc(''), '')
  assert.equal(screenshotSrc('   '), '')
  assert.equal(screenshotSrc('javascript:alert(1)'), '')
  assert.equal(screenshotSrc('data:image/png;base64,aaaa'), '')
  assert.equal(screenshotSrc('../secret.png'), '')
  assert.equal(screenshotSrc('/etc/passwd'), '')
  assert.equal(screenshotSrc('shot.png'), '/assets/img/screenshots/shot.png')
  assert.equal(
    screenshotSrc('/assets/img/screenshots/shot.png'),
    '/assets/img/screenshots/shot.png',
  )
  assert.equal(
    screenshotSrc('https://talkmiochat.com/og-image.jpg'),
    'https://talkmiochat.com/og-image.jpg',
  )
  assert.equal(
    screenshotSrc('https://cdn.example/img.png?alt=media&token=abc'),
    'https://cdn.example/img.png?alt=media&token=abc',
  )
})

test('a stored shot wins, then a directory filename, then the homepage og:image', () => {
  assert.equal(
    pickBillboardShot('', ['hero.png'], 'https://example.com/og.jpg'),
    '/assets/img/screenshots/hero.png',
  )
  assert.equal(
    pickBillboardShot('https://cdn.example/real.jpg', ['hero.png'], 'https://example.com/og.jpg'),
    'https://cdn.example/real.jpg',
  )
  assert.equal(
    pickBillboardShot('', [], 'https://talkmiochat.com/og-image.jpg'),
    'https://talkmiochat.com/og-image.jpg',
  )
  assert.equal(pickBillboardShot('', ['not a file'], 'javascript:alert(1)'), '')
})

test('og:image is read from the homepage head, including a relative URL', () => {
  const html = `<html><head>
    <meta property="og:image" content="/og-image.jpg">
    <meta name="twitter:image" content="https://cdn.example/other.jpg">
  </head></html>`
  assert.equal(ogImageFromHtml(html, 'https://talkmiochat.com/'), 'https://talkmiochat.com/og-image.jpg')
  assert.equal(ogImageFromHtml('<html></html>', 'https://example.com/'), '')
})

test('the Billboard card binds screenshotSrc and the claim pill cannot wrap into the rank column', () => {
  const grid = readFileSync(join(here, '../../app/components/BillboardGrid.vue'), 'utf8')
  const page = readFileSync(join(here, '../../app/pages/billboard.vue'), 'utf8')
  const css = readFileSync(join(here, '../../app/assets/css/legacy.css'), 'utf8')
  const home = readFileSync(join(here, '../../app/pages/index.vue'), 'utf8')
  assert.match(grid, /screenshotSrc/)
  assert.equal(grid.includes('logoSrc(shotOf'), false)
  assert.match(page, /class="bb-rank__side"/)
  assert.match(css, /\.bb-rank__go\s*\{[^}]*white-space:\s*nowrap/)
  assert.match(css, /\.bb-rank__side\s*\{[^}]*nowrap/)
  assert.match(home, /<VoteButton/)
  assert.equal(home.includes('launch-row__votes'), false)
})
