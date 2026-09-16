import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'
import { reportForPeriod } from './accreditation'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, api: vi.fn() }
})

afterEach(() => vi.clearAllMocks())

describe('accreditation api', () => {
  it('requests the report via GET /placements/accreditation with the period as query', async () => {
    vi.mocked(api).mockResolvedValue([])
    await reportForPeriod('2026-1')
    expect(api).toHaveBeenCalledWith('/placements/accreditation?period=2026-1')
  })

  it('encodes the period in the query string', async () => {
    vi.mocked(api).mockResolvedValue([])
    await reportForPeriod('2026-2')
    expect(api).toHaveBeenCalledWith('/placements/accreditation?period=2026-2')
  })

  it('propagates ApiError from the client', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(400, 'period debe tener el formato AAAA-1 o AAAA-2'))
    await expect(reportForPeriod('')).rejects.toBeInstanceOf(ApiError)
  })
})
