import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'
import {
  closeOffer,
  createOffer,
  decideApplication,
  listApplicationsForOffer,
  listCompanies,
  listMyOffers,
  publishOffer,
} from './companies'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, api: vi.fn() }
})

afterEach(() => vi.clearAllMocks())

describe('companies api', () => {
  it('lists companies via GET /companies', async () => {
    vi.mocked(api).mockResolvedValue([])
    await listCompanies()
    expect(api).toHaveBeenCalledWith('/companies')
  })

  it('lists the offers of the authenticated company via GET /offers/me', async () => {
    vi.mocked(api).mockResolvedValue([])
    await listMyOffers()
    expect(api).toHaveBeenCalledWith('/offers/me')
  })

  it('creates an offer via POST /offers with the dto as body', async () => {
    vi.mocked(api).mockResolvedValue({ id: 1 })
    const dto = {
      companyId: 1,
      title: 'Practicante Backend',
      description: 'Descripción',
      modality: 'PRESENCIAL',
      seats: 3,
      requiredHours: 240,
      periodStart: '2026-03-01',
      periodEnd: '2026-07-31',
    }
    await createOffer(dto)
    expect(api).toHaveBeenCalledWith('/offers', { method: 'POST', body: JSON.stringify(dto) })
  })

  it('publishes an offer via PATCH /offers/:id/publish', async () => {
    vi.mocked(api).mockResolvedValue({ id: 5, status: 'PUBLISHED' })
    await publishOffer(5)
    expect(api).toHaveBeenCalledWith('/offers/5/publish', { method: 'PATCH' })
  })

  it('closes an offer via PATCH /offers/:id/close', async () => {
    vi.mocked(api).mockResolvedValue({ id: 5, status: 'CLOSED' })
    await closeOffer(5)
    expect(api).toHaveBeenCalledWith('/offers/5/close', { method: 'PATCH' })
  })

  it('lists applications for an offer via GET /offers/:offerId/applications', async () => {
    vi.mocked(api).mockResolvedValue([])
    await listApplicationsForOffer(5)
    expect(api).toHaveBeenCalledWith('/offers/5/applications')
  })

  it('decides an application via PATCH /applications/:id/decide with the status as body', async () => {
    vi.mocked(api).mockResolvedValue({ id: 9, status: 'ACCEPTED' })
    await decideApplication(9, 'ACCEPTED')
    expect(api).toHaveBeenCalledWith('/applications/9/decide', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ACCEPTED' }),
    })
  })

  it('propagates ApiError from the client', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(400, 'la oferta ya no tiene cupos'))
    await expect(decideApplication(9, 'ACCEPTED')).rejects.toBeInstanceOf(ApiError)
  })
})
