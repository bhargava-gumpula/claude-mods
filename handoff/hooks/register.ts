import type { Register } from 'claude-code'

export const prompt = (steps: string, focus: string) =>
  focus ? `${steps}\n\nFocus for this handoff: ${focus}` : steps

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'handoff', description: 'Write the phase handoff: checks, dev log, HANDOFF.md, commit, summary' })
    return next(e)
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const steps = await $.fs.read(`${$.plugin.root}/handoff.md`)
    void $.prompt.submit({ text: prompt(steps, e.args.trim()) })
    return { text: 'Writing the handoff…' }
  })
}
