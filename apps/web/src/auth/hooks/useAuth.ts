import { useState } from 'react'
import type { Session } from '@/shared/types'

const KEYS = { token: 'chat_token', userId: 'chat_userId', username: 'chat_username' } as const

function readSession(): Session | null {
  const token = localStorage.getItem(KEYS.token)
  const userId = localStorage.getItem(KEYS.userId)
  const username = localStorage.getItem(KEYS.username)
  return token && userId && username ? { token, userId, username } : null
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(readSession)

  const login = (s: Session) => {
    localStorage.setItem(KEYS.token, s.token)
    localStorage.setItem(KEYS.userId, s.userId)
    localStorage.setItem(KEYS.username, s.username)
    setSession(s)
  }

  const logout = () => {
    localStorage.clear()
    setSession(null)
  }

  return { session, login, logout }
}
