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
})
