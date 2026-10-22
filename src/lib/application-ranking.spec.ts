import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import type { ApplicationRanking, OfferApplication } from '@/api/companies'
import { orderByRanking, rankingErrorMessage } from './application-ranking'

function app(id: number): OfferApplication {
  return {
    id,
    offerId: 7,
    studentId: id,
    status: 'SUBMITTED',
    motivation: `motivo ${id}`,
    submittedAt: '2026-10-20T10:00:00.000Z',
    decidedAt: null,
    student: { id, fullName: `Estudiante ${id}`, email: `e${id}@x.com` },
  }
}

const ranking = (items: [number, number][], unranked: number[] = []): ApplicationRanking => ({
  offerId: 7,
  ranking: items.map(([applicationId, score]) => ({ applicationId, score, reason: `r${applicationId}` })),
  unranked,
  truncated: false,
})

describe('orderByRanking (IA-02)', () => {
  it('sin sugerencia deja el orden original y no agrega sugerencias', () => {
    const rows = orderByRanking([app(1), app(2)], null)

    expect(rows.map((row) => row.application.id)).toEqual([1, 2])
    expect(rows.every((row) => row.suggestion === undefined)).toBe(true)
  })

  it('pone primero a los puntuados, de mayor a menor, y deja el resto en su orden', () => {
    const rows = orderByRanking([app(1), app(2), app(3), app(4)], ranking([[3, 90], [1, 40]], [2, 4]))

    expect(rows.map((row) => row.application.id)).toEqual([3, 1, 2, 4])
    expect(rows[0].suggestion).toMatchObject({ score: 90, reason: 'r3' })
    expect(rows[2].suggestion).toBeUndefined()
  })

  it('ignora sugerencias de postulaciones que ya no están en la lista y no quita ninguna', () => {
    const rows = orderByRanking([app(1), app(2)], ranking([[99, 100], [2, 50]]))

    expect(rows.map((row) => row.application.id)).toEqual([2, 1])
  })
})

describe('rankingErrorMessage (IA-02)', () => {
  it.each([
    [new ApiError(503, 'x'), 'La función de IA no está disponible.'],
    [new ApiError(429, 'x'), 'Espera un momento antes de volver a intentar.'],
    [new ApiError(502, 'x'), 'No se pudo obtener la sugerencia, intenta de nuevo.'],
    [new TypeError('Failed to fetch'), 'No se pudo obtener la sugerencia, intenta de nuevo.'],
  ])('traduce %s', (error, message) => {
    expect(rankingErrorMessage(error)).toBe(message)
  })
})
