import type { Session } from '@/shared/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type AuthResult = Session & { message?: string }

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export const authService = {
  register: (username: string, password: string) =>
    request<AuthResult>('/api/auth/register', { username, password }),

  login: (username: string, password: string) =>
    request<AuthResult>('/api/auth/login', { username, password }),
}
