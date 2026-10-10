import { expect, test } from 'claude-code/testing'
import { streaks } from './register'

test('current streak counts back from today; longest scans every run', () => {
  const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-08', '2026-10-09', '2026-10-10']
  expect(streaks(days, '2026-10-10')).toEqual({ current: 3, longest: 4, total: 7 })
})

test('a streak survives until you start today, and breaks after a missed day', () => {
  expect(streaks(['2026-10-08', '2026-10-09'], '2026-10-10').current).toBe(2)
  expect(streaks(['2026-10-07', '2026-10-08'], '2026-10-10').current).toBe(0)
})
