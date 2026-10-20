export type Task = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'elevenlabs-call': { isLive: boolean }
  }
}
