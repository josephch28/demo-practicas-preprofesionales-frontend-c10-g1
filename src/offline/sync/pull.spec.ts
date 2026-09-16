import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { pullChanges } from './pull'

vi.mock('@/api/client', () => ({
  api: vi.fn(),
}))

const mockedApi = vi.mocked(api)

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockedApi.mockReset()
})

describe('pullChanges', () => {
  it('escribe las filas que llegan en Dexie con syncState synced', async () => {
    mockedApi.mockResolvedValue({
      changes: {
        placements: [],
        hourLogs: [
          {
            id: 1,
            placementId: 7,
            date: '2026-04-01',
            startTime: '08:00',
            endTime: '12:00',
            hours: 4,
            activity: 'Soporte a planta',
            status: 'SUBMITTED',
            version: 1,
            updatedAt: '2026-04-01T12:00:00.000Z',
          },
        ],
        documents: [],
        evaluations: [],
      },
      checkpoint: 'cp-1',
      hasMore: false,
    })

    await pullChanges()

    const stored = await db.hourLogs.get(1)
    expect(stored).toMatchObject({ id: 1, placementId: 7, syncState: 'synced' })
  })

  it('borra la fila local cuando llega un tombstone (deletedAt)', async () => {
    await db.hourLogs.put({
      id: 2,
      placementId: 7,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte a planta',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T12:00:00.000Z',
      syncState: 'synced',
    })

    mockedApi.mockResolvedValue({
      changes: {
        placements: [],
        hourLogs: [
          {
            id: 2,
            placementId: 7,
            date: '2026-04-01',
            startTime: '08:00',
            endTime: '12:00',
            hours: 4,
            activity: 'Soporte a planta',
            status: 'SUBMITTED',
            version: 2,
            updatedAt: '2026-04-02T09:00:00.000Z',
            deletedAt: '2026-04-02T09:00:00.000Z',
          },
        ],
        documents: [],
        evaluations: [],
      },
      checkpoint: 'cp-2',
      hasMore: false,
    })

    await pullChanges()

    await expect(db.hourLogs.get(2)).resolves.toBeUndefined()
  })

  it('guarda el checkpoint devuelto por el servidor en meta', async () => {
    mockedApi.mockResolvedValue({
      changes: { placements: [], hourLogs: [], documents: [], evaluations: [] },
      checkpoint: 'checkpoint-nuevo',
      hasMore: false,
    })

    await pullChanges()

    await expect(db.meta.get('checkpoint')).resolves.toEqual({ key: 'checkpoint', value: 'checkpoint-nuevo' })
  })

  it('reenvía el checkpoint guardado como since en la siguiente llamada', async () => {
    await db.meta.put({ key: 'checkpoint', value: 'checkpoint-previo' })
    mockedApi.mockResolvedValue({
      changes: { placements: [], hourLogs: [], documents: [], evaluations: [] },
      checkpoint: 'checkpoint-siguiente',
      hasMore: false,
    })

    await pullChanges()

    const [path] = mockedApi.mock.calls[0]
    expect(path).toContain('since=checkpoint-previo')
  })

  it('escribe placements, documents y evaluations, y borra los que llegan con tombstone', async () => {
    await db.placements.put({
      id: 20, studentId: 1, tutorId: 2, companyId: 3, startDate: '2026-03-01', endDate: '2026-07-31',
      requiredHours: 240, status: 'ACTIVE', version: 1, updatedAt: '2026-04-01T00:00:00.000Z',
    })
    await db.documents.put({
      id: 30, placementId: 7, kind: 'AGREEMENT', filename: 'convenio.pdf', status: 'PENDING',
      version: 1, updatedAt: '2026-04-01T00:00:00.000Z',
    })
    await db.evaluations.put({
      id: 40, placementId: 7, kind: 'TUTOR', period: '2026-1', scores: {}, updatedAt: '2026-04-01T00:00:00.000Z',
    })

    mockedApi.mockResolvedValue({
      changes: {
        placements: [
          {
            id: 21, studentId: 1, tutorId: 2, companyId: 3, startDate: '2026-03-01', endDate: '2026-07-31',
            requiredHours: 240, status: 'ACTIVE', version: 1, updatedAt: '2026-04-02T00:00:00.000Z',
          },
          {
            id: 20, studentId: 1, tutorId: 2, companyId: 3, startDate: '2026-03-01', endDate: '2026-07-31',
            requiredHours: 240, status: 'ACTIVE', version: 2, updatedAt: '2026-04-02T00:00:00.000Z',
            deletedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
        hourLogs: [],
        documents: [
          {
            id: 31, placementId: 7, kind: 'INSURANCE', filename: 'seguro.pdf', status: 'PENDING',
            version: 1, updatedAt: '2026-04-02T00:00:00.000Z',
          },
          {
            id: 30, placementId: 7, kind: 'AGREEMENT', filename: 'convenio.pdf', status: 'PENDING',
            version: 2, updatedAt: '2026-04-02T00:00:00.000Z', deletedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
        evaluations: [
          { id: 41, placementId: 7, kind: 'COMPANY', period: '2026-1', scores: {}, updatedAt: '2026-04-02T00:00:00.000Z' },
          {
            id: 40, placementId: 7, kind: 'TUTOR', period: '2026-1', scores: {}, updatedAt: '2026-04-02T00:00:00.000Z',
            deletedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
      },
      checkpoint: 'cp-3',
      hasMore: false,
    })

    await pullChanges()

    await expect(db.placements.get(21)).resolves.toMatchObject({ id: 21, status: 'ACTIVE' })
    await expect(db.placements.get(20)).resolves.toBeUndefined()
    await expect(db.documents.get(31)).resolves.toMatchObject({ id: 31, kind: 'INSURANCE' })
    await expect(db.documents.get(30)).resolves.toBeUndefined()
    await expect(db.evaluations.get(41)).resolves.toMatchObject({ id: 41, kind: 'COMPANY' })
    await expect(db.evaluations.get(40)).resolves.toBeUndefined()
  })
})
