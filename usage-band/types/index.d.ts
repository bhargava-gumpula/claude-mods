export type Usage = {
  limits: { kind: string; percentUsed: number; resetsAt?: string }[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { usage: Usage | null; tokens: number; tick: number }
  }
}
