import type { EngineInterface, Register } from 'claude-code'

// The org chart lives in its own floating Mac window (dashboard/OrgChart.app), built on
// first use and started once: a window already running from any copy of the mod is kept.
const openDashboard = async ($: EngineInterface) => {
  const running = await $.process.run(['pgrep', '-f', 'OrgChart.app/Contents/MacOS/OrgChart'])
  if (running.exitCode === 0) return
  const dir = `${$.plugin.root}/dashboard`
  if (!(await $.fs.exists(`${dir}/OrgChart.app/Contents/MacOS/OrgChart`))) {
    await $.process.run(['sh', `${dir}/build.sh`], { timeoutMs: 180_000 })
  }
  await $.process.run(['open', '-g', `${dir}/OrgChart.app`])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await openDashboard($).catch(() => {})
    return ran
  })
}
