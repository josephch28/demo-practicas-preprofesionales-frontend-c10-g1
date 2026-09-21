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

describe('E1-02: no borrar la cola de envio hasta que el servidor confirme', () => {

  it('conserva todas las operaciones cuando /sync/push falla por red, sin importar cuantas hay en cola', async () => {
    for (const id of [20, 21, 22]) {
      await db.hourLogs.put({ ...baseHourLog, id })
      await enqueue({
        entity: 'hourLog',
        op: 'create',
        payload: { id, hours: 4 },
        baseVersion: null,
      })
    }

    mockedApi.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(pushOutbox()).rejects.toThrow()

    await expect(db.outbox.count()).resolves.toBe(3)
    for (const id of [20, 21, 22]) {
      await expect(db.hourLogs.get(id)).resolves.toMatchObject({ syncState: 'queued' })
    }
  })

  it('solo elimina de la cola las operaciones que el servidor confirmo, dejando el resto para reintentar', async () => {
    for (const id of [30, 31, 32]) {
      await db.hourLogs.put({ ...baseHourLog, id })
      await enqueue({
        entity: 'hourLog',
        op: 'create',
        payload: { id, hours: 4 },
        baseVersion: null,
      })
    }
    const entries = await db.outbox.orderBy('createdAt').toArray()

    // El servidor solo alcanza a procesar dos de las tres operaciones (la
    // tercera podria haber quedado por un timeout parcial o un error interno
    // en medio). La operacion no reconocida DEBE quedar en cola.
    mockedApi.mockResolvedValue({
      results: [
        { clientOpId: entries[0].clientOpId, status: 'applied', server: { id: 30, version: 2 }, reason: null },
        { clientOpId: entries[1].clientOpId, status: 'applied', server: { id: 31, version: 2 }, reason: null },
      ],
    })

    const result = await pushOutbox()

    expect(result).toEqual({ applied: 2, failed: 0 })
    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].clientOpId).toBe(entries[2].clientOpId)
  })

  it('marca la fila como fallida con el motivo del servidor cuando la rechaza, y la retira de la cola', async () => {
    await db.hourLogs.put({ ...baseHourLog, id: 40 })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 40, hours: 4 },
      baseVersion: null,
    })
    const [entry] = await db.outbox.toArray()

    mockedApi.mockResolvedValue({
      results: [
        {
          clientOpId: entry.clientOpId,
          status: 'rejected',
          server: { id: 40 },
          reason: 'la plaza asignada no es tuya',
        },
      ],
    })

    const result = await pushOutbox()

    expect(result).toEqual({ applied: 0, failed: 1 })
    await expect(db.outbox.count()).resolves.toBe(0)
    await expect(db.hourLogs.get(40)).resolves.toMatchObject({
      syncState: 'failed',
      reviewNote: 'la plaza asignada no es tuya',
    })
  })

  it('reintenta la misma operacion tras un fallo de red sin duplicarla cuando el servidor termina aceptandola', async () => {
    await db.hourLogs.put({ ...baseHourLog, id: 50 })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 50, hours: 4 },
      baseVersion: null,
    })
    const [entry] = await db.outbox.toArray()

    mockedApi.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(pushOutbox()).rejects.toThrow()

    // La operacion quedo en la cola con el MISMO clientOpId, asi que el
    // segundo intento la reenvia con la misma clave idempotente y el
    // servidor la resuelve una sola vez (deduplicacion de E1-04).
    const still = await db.outbox.toArray()
    expect(still).toHaveLength(1)
    expect(still[0].clientOpId).toBe(entry.clientOpId)

    mockedApi.mockResolvedValueOnce({
      results: [{ clientOpId: entry.clientOpId, status: 'applied', server: { id: 50, version: 2 }, reason: null }],
    })

    const result = await pushOutbox()

    expect(result).toEqual({ applied: 1, failed: 0 })
    await expect(db.outbox.count()).resolves.toBe(0)
    const rows = await db.hourLogs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 50, syncState: 'synced', version: 2 })
  })
})
