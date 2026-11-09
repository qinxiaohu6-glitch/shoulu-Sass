/**
 * Guests can read the directory. Google login is required to submit, to open
 * an account page, and to cast a vote. A site-wide bounce to /sign-in is a
 * regression: this walks the source and fails if a new redirect appears
 * outside that list.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const nuxtRoot = join(here, '../..')

/** Redirects that are allowed to land on /sign-in. Anything else is a gate. */
const REDIRECT_ALLOW = new Set([
  // Account pages. Not a browse gate.
  'app/layouts/settings.vue',
  // The submit form, including the click that posts it.
  'app/components/directory/SubmitForm.vue',
  // A vote click, not a page load.
  'app/components/VoteButton.vue',
  // OAuth came back without a session.
  'app/pages/auth-callback.vue',
  // OAuth itself failed or is not configured. These are not page guards.
  'server/routes/auth/google/callback.get.ts',
  'server/routes/auth/google/start.get.ts',
])

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.nuxt' || name === '.output') continue
    const path = join(dir, name)
    const info = statSync(path)
    if (info.isDirectory()) out.push(...walk(path))
    else if (/\.(vue|ts|js|mjs)$/.test(name)) out.push(path)
  }
  return out
}

function rel(path: string): string {
  return relative(nuxtRoot, path).split('\\').join('/')
}

/** The call itself names /sign-in. A link elsewhere in the file does not count. */
function redirectsToSignIn(text: string): boolean {
  return /navigateTo\s*\([\s\S]{0,180}sign-in/.test(text)
    || /navigateTo\s*\(\s*signInHref/.test(text)
    || /sendRedirect\s*\([\s\S]{0,180}sign-in/.test(text)
}

test('no route middleware or routeRules send guests to sign-in', () => {
  assert.equal(existsSync(join(nuxtRoot, 'app/middleware')), false)
  const config = readFileSync(join(nuxtRoot, 'nuxt.config.ts'), 'utf8')
  assert.equal(config.includes('routeRules'), false)
  assert.equal(redirectsToSignIn(config), false)

  const middlewareDir = join(nuxtRoot, 'server/middleware')
  for (const file of walk(middlewareDir)) {
    const text = readFileSync(file, 'utf8')
    assert.equal(redirectsToSignIn(text), false, rel(file))
    assert.equal(/sign-in/.test(text), false, rel(file))
  }

  for (const dir of ['app/plugins', 'server/plugins']) {
    for (const file of walk(join(nuxtRoot, dir))) {
      assert.equal(redirectsToSignIn(readFileSync(file, 'utf8')), false, rel(file))
    }
  }
})

test('only submit, account, vote, and OAuth failure redirect to sign-in', () => {
  const offenders: string[] = []
  for (const root of ['app', 'server']) {
    for (const file of walk(join(nuxtRoot, root))) {
      const text = readFileSync(file, 'utf8')
      if (!redirectsToSignIn(text)) continue
      const name = rel(file)
      if (!REDIRECT_ALLOW.has(name)) offenders.push(name)
    }
  }
  assert.deepEqual(offenders, [])

  for (const name of REDIRECT_ALLOW) {
    assert.equal(redirectsToSignIn(readFileSync(join(nuxtRoot, name), 'utf8')), true, name)
  }

  const layout = readFileSync(join(nuxtRoot, 'app/layouts/default.vue'), 'utf8')
  assert.equal(/navigateTo\s*\(/.test(layout), false)

  const admin = readFileSync(join(nuxtRoot, 'server/middleware/admin-token.ts'), 'utf8')
  assert.equal(admin.includes('sign-in'), false)
  assert.match(admin, /isAdmin\(event\)/)
})

test('submitting a product still requires a Google session', () => {
  const form = readFileSync(join(nuxtRoot, 'app/components/directory/SubmitForm.vue'), 'utf8')
  assert.match(form, /path:\s*'\/sign-in'/)
  assert.match(form, /next:\s*route\.fullPath/)
  assert.match(form, /if \(!user\.value\)/)

  const api = readFileSync(join(nuxtRoot, 'server/api/submit.post.ts'), 'utf8')
  const gate = api.indexOf("if (!owner) throw new SubmissionError('submit_signin_required')")
  const create = api.indexOf('await createSubmission')
  assert.ok(gate > -1 && create > gate)

  for (const page of ['index.vue', 'pricing.vue', 'billboard.vue', 'advertise.vue', 'faq.vue', 'rules.vue', 'weekly.vue', 'stats.vue']) {
    const text = readFileSync(join(nuxtRoot, 'app/pages', page), 'utf8')
    assert.equal(/navigateTo\s*\(/.test(text), false, page)
  }
})
