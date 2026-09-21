import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { enqueue, pushOutbox } from './push'

vi.mock('@/api/client', () => ({ api: vi.fn() }))

const mockedApi = vi.mocked(api)

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockedApi.mockReset()
})

describe('spike E1-01: perdida de horas cuando la red falla a mitad del envio', () => {

  it.fails('conserva la hora en el outbox si /sync/push falla, para poder reintentarla', async () => {
    await db.hourLogs.put({
      id: 11,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'local',
    })

    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 11, hours: 4 },
      baseVersion: null,
    })

    mockedApi.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(pushOutbox()).rejects.toThrow()

    await expect(db.outbox.count()).resolves.toBe(1)
  })
})