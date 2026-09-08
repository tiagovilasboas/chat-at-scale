// Auth global store — single source of truth for session state.
// The `persist` middleware handles localStorage automatically, eliminating manual get/setItem calls.
// Any component in the tree can read session without prop-drilling.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@/shared/types'

type AuthStore = {
  session: Session | null
  login: (session: Session) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      login: (session: Session) => set({ session }),
      // Local UI cleanup only. HTTP logout (cookie + DB revoke) lives in App.
      logout: () => {
        // Dynamically import to avoid circular dependency
        import('@/chat/store/chatStore').then(({ useChatStore }) => {
          useChatStore.getState().reset()
        })
        set({ session: null })
      },
    }),
    {
      name: 'chat-auth',
      partialize: (state): Pick<AuthStore, 'session'> => ({ session: state.session }),
    }
  )
)
