import type { EngineInterface as Engine, Register } from 'claude-code'

const BRIDGE = 'http://127.0.0.1:8787/status'
// run.sh keeps the bridge + tunnel alive after this session ends
const START_BRIDGE = ['/bin/sh', '-c', 'cd "$HOME/Projects/claude-voice" && nohup ./run.sh > bridge.log 2>&1 &']

// The bridge answers 401 without its token: that means it is up.
async function isBridgeUp($: Engine) {
  try {
    return (await $.http.fetch(BRIDGE, { method: 'POST' })).status === 401
  } catch {
    return false
  }
}

async function startCall($: Engine, agentId: string) {
  if (!agentId) {
    $.ui.toast('Set your ElevenLabs agent ID: /config → elevenlabs-call')
    return
  }
  if (!(await isBridgeUp($))) {
    await $.process.run(START_BRIDGE)
    $.ui.toast('Starting the Claude Code voice bridge')
  }
  await $.process.run(['open', `https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(agentId)}`])
}

export const register: Register = (on, options) => {
  const agentId = String(options.agentId ?? '').trim()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'call', description: 'Start a voice call with Claude Code (ElevenLabs)' })
    return next(e)
  })

  on('command.run', { command: 'call' }, async $ => {
    await startCall($, agentId)
    return { text: agentId ? 'Opening the ElevenLabs call. Allow the microphone, then talk.' : 'Set your ElevenLabs agent ID first: /config → elevenlabs-call.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box>
        <Button key="call" label="📞 Call Claude Code" onPress={() => startCall($, agentId)} />
      </Box>
    )
  })
}
