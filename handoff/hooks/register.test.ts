import { expect, test } from 'claude-code/testing'
import { prompt } from './register'

test('an optional focus is appended to the steps', () => {
  expect(prompt('steps', '')).toBe('steps')
  expect(prompt('steps', 'the Mac app spike')).toBe('steps\n\nFocus for this handoff: the Mac app spike')
})
