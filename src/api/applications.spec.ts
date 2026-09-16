import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'
import { apply, listMine } from './applications'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, api: vi.fn() }
})

afterEach(() => vi.clearAllMocks())

describe('applications api', () => {
  it('applies via POST /applications with offerId and motivation', async () => {
    vi.mocked(api).mockResolvedValue({ id: 1 })
    await apply(5, 'Quiero aplicar lo aprendido')
    expect(api).toHaveBeenCalledWith('/applications', {
      method: 'POST',
      body: JSON.stringify({ offerId: 5, motivation: 'Quiero aplicar lo aprendido' }),
    })
  })

  it('lists own applications via GET /applications/me', async () => {
    vi.mocked(api).mockResolvedValue([])
    await listMine()
    expect(api).toHaveBeenCalledWith('/applications/me')
  })

  it('propagates ApiError from the client', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(403, 'rol insuficiente'))
    await expect(listMine()).rejects.toBeInstanceOf(ApiError)
  })
})
