import type { Session } from '@/shared/types'

type AuthResult = Session & { message?: string }

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
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

  logout: () => request<{ message: string }>('/api/auth/logout'),
}
