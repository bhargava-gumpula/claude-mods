import type { EngineInterface, Register } from 'claude-code'

// WCA event ids; cubing.js generates random-state scrambles for each, as TNoodle does.
export const EVENTS: Record<string, string> = { '2': '222', '3': '333', '4': '444' }

const scramble = async ($: EngineInterface, event: string) => {
  const dir = `${$.plugin.root}/scramble`
  if (!(await $.fs.exists(`${dir}/node_modules/cubing`))) {
    $.ui.toast('Installing the scrambler (first run only)…')
    const installed = await $.process.run(['npm', 'install', '--silent', '--no-audit', '--no-fund'], { cwd: dir, timeoutMs: 180_000 })
    if (installed.exitCode !== 0) throw new Error(installed.stderr.trim() || 'npm install failed')
  }
  const ran = await $.process.run(['node', `${dir}/scramble.mjs`, event], { cwd: dir, timeoutMs: 60_000 })
  const last = ran.stdout.trim().split('\n').pop() ?? ''
  if (ran.exitCode !== 0 || !last.startsWith('"')) throw new Error(ran.stderr.trim() || 'scrambler failed')
  return JSON.parse(last) as string
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cube', description: 'Print a WCA random-state scramble: /cube, /cube 2 or /cube 4' })
    return next(e)
  })

  on('command.run', { command: 'cube' }, async ($, e) => {
    const size = e.args.trim() || '3'
    const event = EVENTS[size]
    if (!event) return { text: 'Sizes: /cube 2, /cube (3x3) or /cube 4' }
    try {
      return { text: `🧊 ${size}x${size}: ${await scramble($, event)}` }
    } catch (err) {
      return { text: `cube: could not scramble (${err instanceof Error ? err.message : String(err)}). Needs node and npm.` }
    }
  })
}
