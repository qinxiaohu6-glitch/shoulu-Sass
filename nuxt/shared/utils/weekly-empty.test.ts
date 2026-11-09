import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { WEEKLY_EMPTY_COPY } from '../content/weekly-empty.ts'

const here = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(join(here, '../../app/pages/weekly.vue'), 'utf8')

test('empty weekly copy lives in one replaceable object', () => {
  assert.equal(WEEKLY_EMPTY_COPY.title.zh, '本周还没有上榜产品')
  assert.equal(WEEKLY_EMPTY_COPY.title.en, 'No products on the board this week')
  assert.ok(WEEKLY_EMPTY_COPY.body.zh.length > 0)
  assert.ok(WEEKLY_EMPTY_COPY.body.en.length > 0)
  assert.ok(WEEKLY_EMPTY_COPY.cta.zh.length > 0)
  assert.ok(WEEKLY_EMPTY_COPY.cta.en.length > 0)
})

test('an empty week renders the dashed placeholder instead of a bare table head', () => {
  assert.match(page, /WEEKLY_EMPTY_COPY/)
  assert.match(page, /v-if="panel\.rows\.length"/)
  assert.match(page, /class="board-empty"/)
  assert.match(page, /localePath\('\/submit'\)/)
  assert.match(page, /border:\s*2px dashed oklch\(40% 0\.025 70\)/)
  assert.match(page, /border-radius:\s*18px/)
  // The header row stays inside the table that only mounts when there are rows.
  const tableAt = page.indexOf('<table')
  const guardAt = page.lastIndexOf('panel.rows.length', tableAt)
  assert.ok(tableAt > -1 && guardAt > -1 && guardAt < tableAt)
})
