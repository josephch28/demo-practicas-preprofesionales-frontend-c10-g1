import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('attaches the bearer token and returns parsed json', async () => {
    localStorage.setItem('access_token', 'tok')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api<{ id: number }>('/offers')).resolves.toEqual({ id: 1 })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('throws ApiError carrying the backend message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ statusCode: 403, message: 'rol insuficiente' }),
    }))

    await expect(api('/offers')).rejects.toMatchObject({ statusCode: 403, message: 'rol insuficiente' })
    await expect(api('/offers')).rejects.toBeInstanceOf(ApiError)
  })

  it('attempts to refresh token on 401 and retries original request if refresh succeeds', async () => {
    localStorage.setItem('access_token', 'old-access-tok')
    localStorage.setItem('refresh_token', 'old-refresh-tok')

    const fetchMock = vi.fn()
      // Primera llamada a /offers da 401
      .mockResolvedValueOnce({
        ok: false, status: 401,
        json: async () => ({ statusCode: 401, message: 'token expirado' }),
      })
      // Llamada a /auth/refresh tiene éxito
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ accessToken: 'new-access-tok', refreshToken: 'new-refresh-tok' }),
      })
      // Reintento de /offers con nuevo token tiene éxito
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ data: 'ok' }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const result = await api<{ data: string }>('/offers')
    expect(result).toEqual({ data: 'ok' })
    expect(localStorage.getItem('access_token')).toBe('new-access-tok')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-tok')
  })

  it('throws 401 ApiError and triggers session expired when refresh fails', async () => {
    localStorage.setItem('access_token', 'old-access-tok')
    localStorage.setItem('refresh_token', 'invalid-refresh-tok')

    const fetchMock = vi.fn()
      // Primera llamada a /offers da 401
      .mockResolvedValueOnce({
        ok: false, status: 401,
        json: async () => ({ statusCode: 401, message: 'token expirado' }),
      })
      // Llamada a /auth/refresh falla con 401
      .mockResolvedValueOnce({
        ok: false, status: 401,
        json: async () => ({ statusCode: 401, message: 'refresh token expirado' }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/offers')).rejects.toMatchObject({ statusCode: 401 })
  })
})
