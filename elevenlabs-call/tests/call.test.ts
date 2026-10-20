import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const
const CALL = ['open', 'https://elevenlabs.io/app/talk-to?agent_id=agent_test']

for (const isUp of [true, false]) {
  test(`Call button ${isUp ? 'reuses the running bridge' : 'starts the bridge'} and opens the call`, { options: { agentId: 'agent_test' } }, async ($, on) => {
    const ran: string[][] = []
    on('http.fetch', () =>
      isUp ? { value: { status: 401, ok: false, headers: {}, text: '' } } : { deny: 'connection refused' })
    on('process.run', (_, e) => {
      ran.push([...e.argv])
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })

    for (const surface of ['terminal', 'desktop'] as const) {
      ran.length = 0
      const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface, ...BAND })
      await ui.press({ key: 'call' })
      expect(ran.length).toBe(isUp ? 1 : 2)
      expect(ran.at(-1)).toEqual(CALL)
      await ui.unmount()
    }
  })
}

test('Call button without an agent ID runs nothing', async ($, on) => {
  const ran: string[][] = []
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', () => ({ value: undefined }))
  const ui = await $.ui.mount({ plugin: 'elevenlabs-call', surface: 'desktop', ...BAND })
  await ui.press({ key: 'call' })
  expect(ran).toEqual([])
})
