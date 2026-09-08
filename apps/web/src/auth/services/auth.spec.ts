import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from './auth'

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends logout with credentials include so the HttpOnly cookie is attached', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Logged out' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(authService.logout()).resolves.toEqual({ message: 'Logged out' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('sends login with credentials include so Set-Cookie can be stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'usr_1', username: 'alice' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await authService.login('alice', 'longenough')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })
})
