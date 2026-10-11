import { expect, test } from 'claude-code/testing'
import { REFRESH_MS, bar, compact, items, mood, pace, slim } from './register'

test('bar fills with usage', () => {
  expect(bar(0)).toEqual({ filled: '', empty: '░░░░░░░' })
  expect(bar(52)).toEqual({ filled: '████', empty: '░░░' })
  expect(bar(130)).toEqual({ filled: '███████', empty: '' })
})

test('limits get a bar, time left and a tone; cost comes last', () => {
  const now = Date.parse('2026-10-10T10:00:00Z')
  const u = slim({
    rateLimits: [{ kind: 'five_hour', percentUsed: 92, resetsAt: '2026-10-10T11:30:00Z' }],
    cost: { usd: 1.234 },
  })
  expect(items(u, now, 1_234_567)).toEqual([
    { key: 'five_hour', label: '5h', bar: { filled: '██████', empty: '░' }, color: 'error', text: '92% (1h 30m)' },
    { key: 'cost', bar: undefined, color: 'subtle', text: '$1.23   💩' },
    { key: 'tokens', bar: undefined, color: 'subtle', text: '1.2M tokens' },
    { key: 'pace', bar: undefined, text: '🛑 nearly out', color: 'error' },
  ])
})

test('mood climbs with spend', () => {
  expect([0, 3, 5.5, 10.5, 30, 60, 150, 600, 1200].map(mood)).toEqual(['💩', '💩', '😒', '🥱', '😮‍💨', '🫪', '😛', '🤑', '🙀'])
})

test('token counts read short', () => {
  expect([0, 999, 12_345, 3_400_000, 2_100_000_000].map(compact)).toEqual(['0', '999', '12.3k', '3.4M', '2.1B'])
})

test('pace follows the 5-hour window', () => {
  expect(pace(60, 40).text).toBe('🚀 spend freely')
  expect(pace(80, 150).text).toBe('🐢 slow down')
  expect(pace(30, 200).text).toBe('👌 on pace')
  expect(pace(95, 30).text).toBe('🛑 nearly out')
})

test('a week-long window counts down in days and hours', () => {
  const now = Date.parse('2026-10-10T10:00:00Z')
  const u = slim({ rateLimits: [{ kind: 'seven_day', percentUsed: 23, resetsAt: '2026-10-13T15:00:00Z' }] })
  expect(items(u, now)[0]?.text).toBe('23% (3d 5h)')
})

test('the band refreshes every minute', () => {
  expect(REFRESH_MS).toBe(60_000)
})
