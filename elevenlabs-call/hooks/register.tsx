import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { CallState, Task } from '../types'

const BRIDGE = 'http://127.0.0.1:8787'
const DIR = '"$HOME/Projects/claude-voice"'
// run.sh keeps the bridge + tunnel alive after this session ends
const START_BRIDGE = ['/bin/sh', '-c', `cd ${DIR} && nohup ./run.sh > bridge.log 2>&1 &`]
const READ_TOKEN = ['/bin/sh', '-c', `cat ${DIR}/.token`]
const HANG_UP = ['/bin/sh', '-c', `kill $(cat ${DIR}/.call.pid) 2>/dev/null; rm -f ${DIR}/.call.pid`]

const call = atom({ plugin: 'elevenlabs-call', key: 'call' } as const, null)

let token = ''
let isOnCall = false // the session.start ticker polls the bridge only while true
let isPolling = false
let hasTicker = false
let hasConnected = false // the call reported in once; 'ended' after that means it hung up
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

async function ensureBridge($: Engine) {
  if (!(await isBridgeUp($))) {
    await $.process.run(START_BRIDGE)
    await $.clock.sleep(2500)
  }
  token = (await $.process.run(READ_TOKEN)).stdout.trim()
}

// A voice task becomes a prompt in this chat, as if typed; the orb follows the call.
async function pollOnce($: Engine) {
  if (isPolling) return
  isPolling = true
  try {
    const res = await post($, '/poll', {})
    if (!res.ok) return
    const { task, orb } = JSON.parse(res.text) as { task: Task | null; orb: { mode: string } }
    if (task) {
      inflight.push(task.id)
      void $.prompt.submit({ text: `🎙️ ${task.text}`, asUser: true })
    }
    if (orb.mode !== 'ended') hasConnected = true
    else if (hasConnected) return void (await hangUp($)) // you said bye, or the call dropped
    const mode = orb.mode === 'ended' ? 'ended' : inflight.length > 0 && orb.mode === 'listening' ? 'working' : orb.mode
    const now = await read($, call)
    if (now && now.mode !== mode) await update($, call, () => ({ mode }))
  } catch {
    // bridge restarting: try again next tick
  } finally {
    isPolling = false
  }
}

async function hangUp($: Engine) {
  isOnCall = false
  hasConnected = false
  inflight.length = 0
  await $.process.run(HANG_UP)
  await update($, call, () => null)
}

// Call: this chat goes on the call, through this Mac's mic and speakers.
async function goOnCall($: Engine, agentId: string) {
  if (!agentId) {
    $.ui.toast('Set your ElevenLabs agent ID: /config → elevenlabs-call')
    return
  }
  await ensureBridge($)
  await $.process.run(['/bin/sh', '-c', `cd ${DIR} && nohup .venv/bin/python call.py '${agentId.replace(/[^\w-]/g, '')}' > call.log 2>&1 &`])
  isOnCall = true
  if (!hasTicker) {
    hasTicker = true
    $.clock.every(400, () => {
      if (isOnCall) void pollOnce($)
    })
  }
  await update($, call, () => ({ mode: 'listening' }))
}

// An ElevenLabs-style orb: soft blue, cyan and violet light turning inside a sphere.
function orb(mode: string) {
  const [spin, pulse, grow] =
    mode === 'speaking' ? [2.4, 0.7, 1.09] : mode === 'working' ? [4, 1.4, 1.04] : mode === 'ended' ? [0, 0, 1] : [9, 3.5, 1.03]
  const turn = (dir: number) =>
    spin ? `<animateTransform attributeName="transform" type="rotate" from="0 60 60" to="${360 * dir} 60 60" dur="${spin}s" repeatCount="indefinite"/>` : ''
  const breathe = pulse
    ? `<animateTransform attributeName="transform" type="scale" values="1;${grow};1" dur="${pulse}s" repeatCount="indefinite"/>`
    : ''
  const ring = mode === 'working'
    ? `<circle cx="60" cy="60" r="56" fill="none" stroke="#7CC4FA" stroke-width="1.5" stroke-dasharray="6 10" opacity=".7">${turn(1)}</circle>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs>
<radialGradient id="base" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#EAF6FF"/><stop offset=".45" stop-color="#8CCBFA"/><stop offset="1" stop-color="#3D5AFE"/></radialGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
<clipPath id="ball"><circle cx="60" cy="60" r="50"/></clipPath>
</defs>
${ring}
<g transform="translate(60 60)"><g>${breathe}<g transform="translate(-60 -60)">
<g clip-path="url(#ball)">
<circle cx="60" cy="60" r="50" fill="url(#base)"${mode === 'ended' ? ' opacity=".35"' : ''}/>
<g filter="url(#soft)">
<ellipse cx="42" cy="72" rx="36" ry="22" fill="#A78BFA" opacity=".85">${turn(1)}</ellipse>
<ellipse cx="78" cy="44" rx="32" ry="20" fill="#22D3EE" opacity=".8">${turn(-1)}</ellipse>
<ellipse cx="62" cy="90" rx="30" ry="14" fill="#F0ABFC" opacity=".55">${turn(1)}</ellipse>
</g>
<ellipse cx="44" cy="36" rx="20" ry="12" fill="#FFFFFF" opacity=".35"/>
</g>
<circle cx="60" cy="60" r="50" fill="none" stroke="#FFFFFF" stroke-opacity=".35"/>
</g></g></g>
</svg>`
}

const LABEL: Record<string, string> = {
  listening: 'Listening',
  speaking: 'Speaking',
  working: 'Working on it',
  ended: 'Call ended',
}

export const register: Register = (on, options) => {
  const agentId = String(options.agentId ?? '').trim()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'call', description: 'Put this chat on a voice call (ElevenLabs); /call again hangs up' })
    return next(e)
  })

  on('command.run', { command: 'call' }, async $ => {
    if (await read($, call)) {
      await hangUp($)
      return { text: 'Call ended.' }
    }
    await goOnCall($, agentId)
    return { text: agentId ? 'On the call. Talk; this chat does the work.' : 'Set your ElevenLabs agent ID first: /config → elevenlabs-call.' }
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
    const state: CallState | null = await read($, call)
    if (!state) {
      const { Box, Button } = $.ui.resolve(e)
      return (
        <Box>
          <Button key="call" label="📞 Call Claude Code" onPress={() => goOnCall($, agentId)} />
        </Box>
      )
    }
    const label = `${LABEL[state.mode] ?? 'On call'} `
    if (e.surface === 'desktop') {
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center" gap={2}>
          <Svg source={orb(state.mode)} alt={`Voice call: ${label}`} width={64} height={64} />
          <Text>{label}</Text>
          <Button key="hangup" label="Hang up" onPress={() => hangUp($)} />
        </Box>
      )
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color={state.mode === 'speaking' ? 'magenta' : 'cyan'}>● {label}</Text>
        <Button key="hangup" label="Hang up" onPress={() => hangUp($)} />
      </Box>
    )
  })
}
