export type Chat = { id: string; title: string; project: string; agoSec: number; lastPrompt: string }

declare module 'claude-code' {
  interface PluginState {
    'chat-roster': { chats: Chat[] }
  }
}
