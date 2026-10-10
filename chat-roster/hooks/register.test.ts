import { expect, test } from 'claude-code/testing'
import { ago, clip } from './register'

test('ages read short', () => {
  expect([5, 90, 3700].map(ago)).toEqual(['now', '1m', '1h'])
})

test('long text is clipped to the pane', () => {
  expect(clip('hello world', 6)).toBe('hello…')
  expect(clip('hi', 6)).toBe('hi')
})
