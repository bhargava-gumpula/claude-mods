import { expect, test } from 'claude-code/testing'
import { EVENTS } from './register'

test('sizes map to WCA event ids', () => {
  expect(EVENTS).toEqual({ '2': '222', '3': '333', '4': '444' })
})
