import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LONG_MIN, NAME_MIN, PAID_MIN, SHORT_MIN, textFloor } from './submit-limits.ts'

test('a paid tier drops every length floor to "something was typed"', () => {
  for (const floor of [NAME_MIN, SHORT_MIN, LONG_MIN]) {
    assert.equal(textFloor(true, floor), PAID_MIN)
  }
})

test('the free queue keeps the floors that make a listing reviewable', () => {
  // A free listing costs a review slot and nothing else, so the gate stays.
  assert.equal(textFloor(false, NAME_MIN), NAME_MIN)
  assert.equal(textFloor(false, SHORT_MIN), SHORT_MIN)
  assert.equal(textFloor(false, LONG_MIN), LONG_MIN)
})

test('an optional field keeps its zero floor instead of gaining one', () => {
  // `maker` and `pricing_label` pass 0; a paid order must not turn "optional"
  // into "at least one character".
  assert.equal(textFloor(false, 0), 0)
  assert.equal(textFloor(true, 0), 0)
})

test('paid is stated, never inferred, so an unknown plan stays strict', () => {
  // The caller decides with `isPaidPlan()`. A misspelled tier reaching this
  // helper as `false` keeps the gate rather than unlocking the relaxed one.
  assert.equal(textFloor(false, SHORT_MIN), SHORT_MIN)
})

/* -------------------------------------------------------------------------
   wiring
   ------------------------------------------------------------------------- */

const here = dirname(fileURLToPath(import.meta.url))
const submissionsSource = readFileSync(join(here, '../../server/utils/submissions.ts'), 'utf8')

/** The body of `validate()`, so a match elsewhere in the file cannot pass this. */
function validateBody(): string {
  const start = submissionsSource.indexOf('export function validate(')
  assert.ok(start > -1, 'validate() must exist')
  const end = submissionsSource.indexOf('\n}\n', start)
  assert.ok(end > start, 'validate() must end at column 0')
  return submissionsSource.slice(start, end)
}

test('validate() decides paid-ness before it measures the copy', () => {
  const body = validateBody()
  const decide = body.indexOf('const paid = isPaidPlan(plan)')
  const measure = body.indexOf("cleanText(body.short, 'short'")
  assert.ok(decide > -1, 'validate() must call isPaidPlan(plan)')
  assert.ok(measure > -1, "validate() must still measure `short`")
  // Reading the plan after the first cleanText would mean the floor was already
  // chosen without knowing whether the buyer is paying.
  assert.ok(decide < measure, 'the plan must be read before the copy is measured')
})

test('no field is measured against a bare free-tier floor', () => {
  const body = validateBody()
  for (const field of ['name', 'short', 'long']) {
    assert.ok(
      body.includes(`cleanText(body.${field}, '${field}', textFloor(paid,`),
      `${field} must use textFloor(paid, …) — a bare minimum blocks paying buyers`,
    )
  }
})

