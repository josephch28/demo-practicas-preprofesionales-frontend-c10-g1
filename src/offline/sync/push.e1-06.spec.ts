import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { enqueue, pushOutbox } from './push'

vi.mock('@/api/client', () => ({ api: vi.fn() }))

const mockedApi = vi.mocked(api)

const baseHourLog = {
  placementId: 1,
  date: '2026-04-01',
  startTime: '08:00',
  endTime: '12:00',
  hours: 4,
  activity: 'Soporte',
  status: 'SUBMITTED' as const,
  version: 1,
  updatedAt: '2026-04-01T00:00:00.000Z',
  syncState: 'local' as const,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockedApi.mockReset()
})

describe('E1-06: registro de intentos, errores y marcado como fallido tras agotar reintentos', () => {
  it('registra el incremento de attempts y el ultimo error en el outbox tras un envio fallido', async () => {
    await db.hourLogs.put({ ...baseHourLog, id: 101 })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 101, hours: 4 },
      baseVersion: null,
    })

    mockedApi.mockRejectedValue(new Error('Network error: connection lost'))

    await expect(pushOutbox()).rejects.toThrow('Network error: connection lost')

    const [entry] = await db.outbox.toArray()
    expect(entry.attempts).toBe(1)
    expect(entry.lastError).toBe('Network error: connection lost')

    // Como todavía no agotó reintentos (1 < DEFAULT_RETRY_CONFIG.maxAttempts), sigue en 'queued'
    const log = await db.hourLogs.get(101)
    expect(log?.syncState).toBe('queued')
  })

  it('marca la operacion como fallida y visible al agotar el tope de reintentos, sin descartarla del outbox', async () => {
    await db.hourLogs.put({ ...baseHourLog, id: 102 })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 102, hours: 4 },
      baseVersion: null,
    })

    const customMaxAttempts = 3
    mockedApi.mockRejectedValue(new Error('503 Service Unavailable'))

    // Simulamos fallos hasta agotar los intentos
    for (let i = 1; i <= customMaxAttempts; i++) {
      await expect(pushOutbox(customMaxAttempts)).rejects.toThrow('503 Service Unavailable')
      const [entry] = await db.outbox.toArray()
      expect(entry.attempts).toBe(i)
      expect(entry.lastError).toBe('503 Service Unavailable')
    }

    // La operación en hourLogs queda en syncState 'failed' y con reviewNote para visibilidad en UI
    const log = await db.hourLogs.get(102)
    expect(log?.syncState).toBe('failed')
    expect(log?.reviewNote).toContain('503 Service Unavailable')

    // El outbox NO se descarta (la entrada sigue existiendo)
    const outboxCount = await db.outbox.count()
    expect(outboxCount).toBe(1)
  })

  it('no reenvía automáticamente operaciones que ya agotaron el tope de reintentos', async () => {
    await db.hourLogs.put({ ...baseHourLog, id: 103 })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 103, hours: 4 },
      baseVersion: null,
    })

    // Agotamos reintentos con maxAttempts = 2
    mockedApi.mockRejectedValue(new Error('Timeout'))
    await expect(pushOutbox(2)).rejects.toThrow('Timeout')
    await expect(pushOutbox(2)).rejects.toThrow('Timeout')

    // Al haber alcanzado attempts === 2 (maxAttempts), la próxima llamada no envía nada y no lanza
    mockedApi.mockClear()
    const result = await pushOutbox(2)

    expect(result).toEqual({ applied: 0, failed: 0 })
    expect(mockedApi).not.toHaveBeenCalled()
  })
})
