export type Task = { id: string; text: string }
export type CallState = { mode: string }

declare module 'claude-code' {
  interface PluginState {
    'elevenlabs-call': { call: CallState | null }
  }
}
