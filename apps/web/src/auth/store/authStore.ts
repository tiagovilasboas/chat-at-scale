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
      login: (session) => set({ session }),
      logout: () => set({ session: null }),
    }),
    {
      name: 'chat-auth', // localStorage key
    }
  )
)
