import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Task } from '../types'

const BRIDGE = 'http://127.0.0.1:8787'
// run.sh keeps the bridge + tunnel alive after this session ends
const START_BRIDGE = ['/bin/sh', '-c', 'cd "$HOME/Projects/claude-voice" && nohup ./run.sh > bridge.log 2>&1 &']
const READ_TOKEN = ['/bin/sh', '-c', 'cat "$HOME/Projects/claude-voice/.token"']

const isLive = atom({ plugin: 'elevenlabs-call', key: 'isLive' } as const, false)

let token = ''
let isOnCall = false // the session.start ticker polls the bridge only while true
let isPolling = false
// ponytail: replies are matched to voice tasks in order; a prompt you type mid-call shifts them
const inflight: string[] = []

function post($: Engine, path: string, body: object) {
  return $.http.fetch(BRIDGE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// The bridge answers 401 without its token: that means it is up.
async function isBridgeUp($: Engine) {
  try {
    return (await $.http.fetch(BRIDGE + '/status', { method: 'POST' })).status === 401
  } catch {
    return false
  }
}

// A voice task becomes a prompt in this chat, as if typed.
async function pollOnce($: Engine) {
  if (isPolling) return
  isPolling = true
  try {
    const res = await post($, '/poll', {})
    const task = res.ok ? (JSON.parse(res.text).task as Task | null) : null
    if (task) {
      inflight.push(task.id)
      void $.prompt.submit({ text: `🎙️ ${task.text}`, asUser: true })
    }
  } catch {
    // bridge restarting: try again next tick
  } finally {
    isPolling = false
  }
}

async function hangUp($: Engine) {
  isOnCall = false
  inflight.length = 0
  await update($, isLive, () => false)
}

async function call($: Engine, agentId: string) {
  if (!agentId) {
    $.ui.toast('Set your ElevenLabs agent ID: /config → elevenlabs-call')
    return
  }
  if (!(await isBridgeUp($))) {
    await $.process.run(START_BRIDGE)
    $.ui.toast('Starting the Claude Code voice bridge')
  }
  token = (await $.process.run(READ_TOKEN)).stdout.trim()
  isOnCall = true
  await update($, isLive, () => true)
  await $.process.run(['open', `https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(agentId)}`])
}

export const register: Register = (on, options) => {
  const agentId = String(options.agentId ?? '').trim()

  on('session.start', async ($, e, next) => {
    $.clock.every(1000, () => {
      if (isOnCall) void pollOnce($)
    })
    await $.command.register({ name: 'call', description: 'Put this chat on a voice call (ElevenLabs); /call again hangs up' })
    return next(e)
  })

  on('command.run', { command: 'call' }, async $ => {
    if (await read($, isLive)) {
      await hangUp($)
      return { text: 'Voice call ended for this chat.' }
    }
    await call($, agentId)
    return { text: agentId ? 'This chat is on the call. Talk, and watch it work here.' : 'Set your ElevenLabs agent ID first: /config → elevenlabs-call.' }
  })

  // The chat's answer to a voice task goes back to be spoken.
  on('turn.complete', async ($, e, next) => {
    const id = e.agentId === undefined ? inflight.shift() : undefined
    if (id) {
      try {
        await post($, '/done', { id, text: e.answer })
      } catch {
        // bridge gone: the call has ended
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    if (await read($, isLive)) {
      return (
        <Box>
          <Text color="red">● On a voice call: what you say is typed here </Text>
          <Button key="hangup" label="Hang up" onPress={() => hangUp($)} />
        </Box>
      )
    }
    return (
      <Box>
        <Button key="call" label="📞 Call Claude Code" onPress={() => call($, agentId)} />
      </Box>
    )
  })
}
