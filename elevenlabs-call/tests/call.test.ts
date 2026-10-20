import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const
const OPEN = ['open', 'https://elevenlabs.io/app/talk-to?agent_id=agent_test']
const RAN = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const json = (body: object) => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } })

test('Call puts the chat on the call: a voice task is typed here and the reply goes back', { options: { agentId: 'agent_test' } }, async ($, on) => {
  const clock = mock.clock(on)
  const ran: string[][] = []
  const done: object[] = []
  const typed: string[] = []
  let isServed = false
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { ...RAN, stdout: e.argv[0] === '/bin/sh' ? 'tok' : '' } }
  })
  on('http.fetch', (_, e) => {
    const path = e.url.replace('http://127.0.0.1:8787', '')
    if (!e.init?.headers?.Authorization) return { value: { status: 401, ok: false, headers: {}, text: '' } }
    expect(e.init.headers.Authorization).toBe('Bearer tok')
    if (path === '/poll') {
      const task = isServed ? null : { id: 't1', text: 'edit the README' }
      isServed = true
      return json({ task })
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

  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'desktop', ...BAND })
  await ui.press({ key: 'call' })
  expect(ran.at(-1)).toEqual(OPEN)
  expect(await ui.find({ key: 'hangup' })).toBeDefined()

  await clock.advance(1100)
  expect(typed).toEqual(['🎙️ edit the README'])

  await $.turn.complete({ reason: 'answer', answer: 'README updated.', turnId: 'x', durationMs: 1, isAborted: false } as never)
  expect(done).toEqual([{ id: 't1', text: 'README updated.' }])

  await ui.press({ key: 'hangup' })
  expect(await ui.find({ key: 'call' })).toBeDefined()
})

test('Call without an agent ID runs nothing', async ($, on) => {
  const ran: string[][] = []
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { ...RAN, stdout: '' } }
  })
  on('ui.toast', () => ({ value: undefined }))
  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'terminal', ...BAND })
  await ui.press({ key: 'call' })
  expect(ran).toEqual([])
})
