import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const
const RAN = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const json = (body: object) => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } })

// The engine beneath the plugin: a running bridge with one voice task queued.
function world(on: On) {
  const ran: string[][] = []
  const done: object[] = []
  const typed: string[] = []
  let isServed = false
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { ...RAN, stdout: e.argv[0] === '/bin/sh' && e.argv[2]?.startsWith('cat') ? 'tok' : '' } }
  })
  on('http.fetch', (_, e) => {
    const path = e.url.replace('http://127.0.0.1:8787', '')
    if (!e.init?.headers?.Authorization) return { value: { status: 401, ok: false, headers: {}, text: '' } }
    if (path === '/poll') {
      const task = isServed ? null : { id: 't1', text: 'edit the README' }
      isServed = true
      return json({ task, orb: { mode: 'speaking' } })
    }
    done.push(JSON.parse(e.init.body ?? '{}'))
    return json({ ok: true })
  })
  on('prompt.submit', (_, e) => {
    typed.push(e.text)
    return { text: e.text } as never
  })
  on('command.register', () => ({ value: { command: 'call' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }) as never)
  on('turn.complete', (_, e) => ({ text: e.answer }) as never)
  on('ui.toast', () => ({ value: undefined }))
  return { ran, done, typed }
}

test('the Call button puts this chat on the call', { options: { agentId: 'agent_test' } }, async ($, on) => {
  const { ran } = world(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'desktop', ...BAND })
  await ui.press({ key: 'call' })
  expect(ran.some(a => a.join(' ').includes('call.py'))).toBe(true)
  expect(ran.some(a => a[0] === 'open' || a[0] === 'osascript')).toBe(false)
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
})

test('/call puts this chat on the call: orb, a voice task typed here, its reply sent back, hang up', { options: { agentId: 'agent_test' } }, async ($, on) => {
  const clock = mock.clock(on)
  const { ran, done, typed } = world(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'call', args: '' } as never)
  expect(ran.some(a => a.join(' ').includes('call.py'))).toBe(true)

  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()

  await clock.advance(500)
  expect(typed).toEqual(['🎙️ edit the README'])

  await $.turn.complete({ reason: 'answer', answer: 'README updated.', turnId: 'x', durationMs: 1, isAborted: false } as never)
  expect(done).toEqual([{ id: 't1', text: 'README updated.' }])

  await ui.press({ key: 'hangup' })
  expect(ran.at(-1)?.join(' ')).toContain('kill')
  expect(await ui.find({ key: 'call' })).toBeDefined()
})

test('Call without an agent ID runs nothing', async ($, on) => {
  const { ran } = world(on)
  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'terminal', ...BAND })
  await ui.press({ key: 'call' })
  expect(ran).toEqual([])
})
