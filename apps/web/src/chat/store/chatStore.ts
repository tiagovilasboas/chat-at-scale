// Chat global store — owns the messages list and connection status.
// useWebSocket hook is a side-effect manager that dispatches actions here.
// This decoupling enables future features (notifications, multi-room) without touching the hook.

import { create } from 'zustand'
import type { Message } from '@/shared/types'

type ChatStore = {
  messages: Message[]
  connected: boolean
  addMessage: (msg: Message) => void
  mergeBackfill: (msgs: Message[]) => void
  setConnected: (v: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  connected: false,

  addMessage: (msg) => {
    const { messages } = get()
    if (messages.some(m => m.id === msg.id)) return
    set({ messages: [...messages, msg] })
  },

  mergeBackfill: (msgs) => {
    const { messages } = get()
    const fresh = msgs.filter(m => !messages.some(p => p.id === m.id))
    const combined = [...messages, ...fresh].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
    )
    set({ messages: combined })
  },

  setConnected: (connected) => set({ connected }),

  reset: () => set({ messages: [], connected: false }),
}))
