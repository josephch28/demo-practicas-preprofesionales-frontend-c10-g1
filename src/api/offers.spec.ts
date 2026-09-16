import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'
import { getOffer, listOffers } from './offers'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, api: vi.fn() }
})

afterEach(() => vi.clearAllMocks())

describe('offers api', () => {
  it('lists offers via GET /offers', async () => {
    vi.mocked(api).mockResolvedValue([])
    await listOffers()
    expect(api).toHaveBeenCalledWith('/offers')
  })

  it('gets a single offer via GET /offers/:id', async () => {
    vi.mocked(api).mockResolvedValue({ id: 2 })
    await getOffer(2)
    expect(api).toHaveBeenCalledWith('/offers/2')
  })

  it('propagates ApiError from the client', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(404, 'oferta no encontrada'))
    await expect(getOffer(999)).rejects.toBeInstanceOf(ApiError)
  })
})
