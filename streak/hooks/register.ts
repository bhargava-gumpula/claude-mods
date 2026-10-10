import type { EngineInterface, Register } from 'claude-code'

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// Current streak counts back from today (or yesterday, so it survives until you start today).
export const streaks = (days: readonly string[], today: string) => {
  const set = new Set(days)
  const t = Date.parse(today)
  const start = set.has(today) ? t : t - DAY
  let current = 0
  while (set.has(iso(start - current * DAY))) current++

  let longest = 0
  let run = 0
  let prev = NaN
  for (const d of [...set].sort()) {
    const ms = Date.parse(d)
    run = ms - prev === DAY ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = ms
  }
  return { current, longest, total: set.size }
}

const localToday = (now: number) => {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const load = async ($: EngineInterface) => {
  const ran = await $.process.run(['python3', '-I', `${$.plugin.root}/hooks/days.py`])
  const days = ran.exitCode === 0 ? (JSON.parse(ran.stdout) as { days: string[] }).days : []
  return streaks(days, localToday(await $.clock.now()))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({ name: 'streak', description: 'Show your Claude Code day streak' })
    const s = await load($).catch(() => undefined)
    if (s) $.ui.status(`🔥 ${s.current}-day streak`)
    return ran
  })

  on('command.run', { command: 'streak' }, async $ => {
    const s = await load($)
    $.ui.status(`🔥 ${s.current}-day streak`)
    return { text: `🔥 ${s.current}-day streak · longest ${s.longest} days · ${s.total} days with Claude in all` }
  })
}
