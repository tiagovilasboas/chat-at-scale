import type { Session } from '@/shared/types'

type AuthResult = Session & { message?: string }

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const data: unknown = await res.json()
  if (!res.ok) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `HTTP ${res.status}`
    throw new Error(errorMessage)
  }
  return data as T
}

export const authService = {
  register: (username: string, password: string): Promise<AuthResult> =>
    request<AuthResult>('/api/auth/register', { username, password }),

  login: (username: string, password: string): Promise<AuthResult> =>
    request<AuthResult>('/api/auth/login', { username, password }),

  logout: (): Promise<{ message: string }> =>
    request<{ message: string }>('/api/auth/logout'),
}
