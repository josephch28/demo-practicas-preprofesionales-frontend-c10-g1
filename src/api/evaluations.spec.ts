import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'
import { submitEvaluation } from './evaluations'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, api: vi.fn() }
})

afterEach(() => vi.clearAllMocks())

describe('evaluations api', () => {
  it('submits via POST /evaluations with the exact dto', async () => {
    vi.mocked(api).mockResolvedValue({ id: 1 })
    const dto = {
      placementId: 7,
      kind: 'TUTOR' as const,
      period: '2026-1',
      scores: { technical: 4, communication: 5, punctuality: 3 },
      comment: 'Buen desempeño',
    }

    await submitEvaluation(dto)

    expect(api).toHaveBeenCalledWith('/evaluations', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  })

  it('propagates ApiError from the client', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(403, 'rol no autorizado'))
    await expect(
      submitEvaluation({
        placementId: 7,
        kind: 'TUTOR',
        period: '2026-1',
        scores: { technical: 1, communication: 1, punctuality: 1 },
      }),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
