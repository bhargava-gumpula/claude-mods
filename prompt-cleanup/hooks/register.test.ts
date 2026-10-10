import { expect, test } from 'claude-code/testing'
import { isTypoFix, shouldClean } from './register'

test('commands, shell lines, code and long pastes are left alone', () => {
  expect(shouldClean('add a ring to show the usgae')).toBe(true)
  expect(shouldClean('/cube 4')).toBe(false)
  expect(shouldClean('!ls')).toBe(false)
  expect(shouldClean('fix this ```const a = 1```')).toBe(false)
  expect(shouldClean('x'.repeat(2000))).toBe(false)
  expect(shouldClean('ok')).toBe(false)
})

test('only a close-length reply counts as a typo fix', () => {
  expect(isTypoFix('the dollar amoutna dn the emoji', 'the dollar amount and the emoji')).toBe(true)
  expect(isTypoFix('fix it', 'Sure! Here is the corrected text: fix it')).toBe(false)
  expect(isTypoFix('fix it', '')).toBe(false)
})
