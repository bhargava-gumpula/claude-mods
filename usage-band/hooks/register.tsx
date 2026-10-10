import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null)

const tokens = atom({ plugin: 'usage-band', key: 'tokens' } as const, 0)

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

export const slim = (u: Pick<SessionUsage, 'rateLimits' | 'cost'>): Usage => ({
  limits: u.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
  usd: u.cost?.usd,
})

const minsUntil = (iso: string | undefined, now: number) =>
  iso ? Math.max(0, Math.round((Date.parse(iso) - now) / 60000)) : undefined

const until = (iso: string | undefined, now: number) => {
  const mins = minsUntil(iso, now)
  if (mins === undefined) return ''
  if (mins >= 1440) return ` (${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h)`
  return mins >= 60 ? ` (${Math.floor(mins / 60)}h ${mins % 60}m)` : ` (${mins}m)`
}

const WIDTH = 7

// Solid blocks, the empty part drawn dim.
export const bar = (pct: number) => {
  const filled = Math.min(WIDTH, Math.max(0, Math.round((pct / 100) * WIDTH)))
  return { filled: '█'.repeat(filled), empty: '░'.repeat(WIDTH - filled) }
}

const MOODS: [number, string][] = [
  [1000, '🙀'],
  [500, '🤑'],
  [100, '😛'],
  [50, '🫪'],
  [25, '😮‍💨'],
  [10, '🥱'],
  [5, '😒'],
  [0, '💩'],
]

export const mood = (usd: number) => MOODS.find(([over]) => usd > over)?.[1] ?? '💩'

export const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

// Pacing against the 5-hour window: unused capacity is lost at reset, so spend
// freely near a reset with headroom; otherwise compare use with time elapsed.
export const pace = (pct: number, minsLeft: number) => {
  const expected = ((300 - minsLeft) / 300) * 100
  if (pct >= 90) return { text: '🛑 nearly out', color: 'error' }
  if (minsLeft <= 60 && pct <= 70) return { text: '🚀 spend freely', color: 'success' }
  if (pct > expected + 15) return { text: '🐢 slow down', color: 'warning' }
  return { text: '👌 on pace', color: 'subtle' }
}

const tone = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')

export const items = (u: Usage, now: number, spent = 0) => [
  ...u.limits.map(l => ({
    key: l.kind,
    label: LABELS[l.kind] ?? l.kind,
    bar: bar(l.percentUsed),
    color: tone(l.percentUsed),
    text: `${l.percentUsed}%${until(l.resetsAt, now)}`,
  })),
  ...(u.usd === undefined ? [] : [{ key: 'cost', bar: undefined, color: 'subtle', text: `$${u.usd.toFixed(2)}   ${mood(u.usd)}` }]),
  { key: 'tokens', bar: undefined, color: 'subtle', text: `${compact(spent)} tokens` },
  ...u.limits
    .filter(l => l.kind === 'five_hour')
    .flatMap(l => {
      const left = minsUntil(l.resetsAt, now)
      return left === undefined ? [] : [{ key: 'pace', bar: undefined, ...pace(l.percentUsed, left) }]
    }),
]

// Sums the whole session's transcripts, earlier turns and subagents included.
const recount = async ($: EngineInterface) => {
  const ran = await $.process.run(['python3', '-I', `${$.plugin.root}/hooks/tokens.py`, await $.session.id()])
  const n = Number(ran.stdout.trim())
  if (ran.exitCode === 0 && Number.isFinite(n)) await update($, tokens, () => n)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const u = await $.session.usage()
    await update($, usage, () => slim(u))
    // Cost moves with every API response mid-turn; poll it so the emoji flips at each milestone.
    let lastUsd = u.cost?.usd
    $.clock.every(3000, async () => {
      const now = await $.session.usage()
      if (now.cost?.usd === lastUsd) return
      lastUsd = now.cost?.usd
      await update($, usage, () => slim(now))
    })
    await recount($)
    return ran
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => slim(e))
    await recount($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    if (u === null || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    return (
      <Box flexDirection="row" columnGap={5} paddingX={1}>
        {items(u, now, await read($, tokens)).map(i => (
          <Box key={i.key} flexDirection="row" columnGap={1}>
            {'label' in i ? <Text dimColor>{i.label}</Text> : null}
            {i.bar ? (
              <Text>
                <Text color={i.color}>{i.bar.filled}</Text>
                <Text dimColor>{i.bar.empty}</Text>
              </Text>
            ) : null}
            <Text dimColor>{i.text}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
