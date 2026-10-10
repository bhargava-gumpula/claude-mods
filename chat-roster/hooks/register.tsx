import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Chat } from '../types'

const PANE = 'chat-roster'
const HOURS = '3'
const chats = atom({ plugin: 'chat-roster', key: 'chats' } as const, [])

export const ago = (sec: number) =>
  sec < 60 ? 'now' : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`

export const clip = (text: string, width: number) =>
  text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`

const refresh = async ($: EngineInterface) => {
  const ran = await $.process.run(['python3', '-I', `${$.plugin.root}/hooks/roster.py`, await $.session.id(), HOURS])
  if (ran.exitCode !== 0) return
  try {
    const list = JSON.parse(ran.stdout) as Chat[]
    await update($, chats, () => list)
  } catch {}
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({ name: 'roster', description: 'Show your other active Claude chats in a side pane' })
    await refresh($)
    $.clock.every(30_000, () => refresh($))
    void $.ui.open({ id: PANE, title: 'Chats' })
    return ran
  })

  on('command.run', { command: 'roster' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Chats' })
    return { text: 'Chat roster opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, chats)
    const width = Math.max(16, (e.viewport?.columns ?? 32) - 2)
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 1) / 3))

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No other chats in the last {HOURS}h.</Text>}
        {list.slice(0, room).map(c => (
          <Box key={c.id} flexDirection="column" marginBottom={1}>
            <Text>
              <Text color={c.agoSec < 120 ? 'success' : 'subtle'}>{c.agoSec < 120 ? '●' : '○'}</Text>{' '}
              {clip(c.title, width - 8)} <Text dimColor>{ago(c.agoSec)}</Text>
            </Text>
            <Text dimColor>  {clip(c.lastPrompt, width - 2)}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
