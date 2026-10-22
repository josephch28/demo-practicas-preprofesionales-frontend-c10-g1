import '@/test-utils/node-blob'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'

const V1_SCHEMA = {
  placements: 'id, studentId, tutorId, status, updatedAt',
  hourLogs: 'id, placementId, status, date, syncState, updatedAt',
  documents: 'id, placementId, kind, status, updatedAt',
  evaluations: 'id, placementId, kind, updatedAt',
  outbox: '++id, clientOpId, entity, createdAt',
  meta: 'key',
}

const hourLog = (id: number, placementId: number, date: string, syncState: 'synced' | 'queued' = 'synced') => ({
  id,
  placementId,
  date,
  startTime: '08:00',
  endTime: '12:00',
  hours: 4,
  activity: `Jornada ${id}`,
  status: 'SUBMITTED' as const,
  version: 1,
  updatedAt: '2026-04-01T12:00:00.000Z',
  syncState,
})

/** Deja en disco una base 'practicas' tal como la tenía un dispositivo con la app en v1. */
async function createVersion1Database() {
  await db.delete()
  const v1 = new Dexie('practicas')
  v1.version(1).stores(V1_SCHEMA)
  await v1.open()
  await v1.table('hourLogs').bulkPut([
    hourLog(1, 7, '2026-04-01'),
    hourLog(2, 7, '2026-04-02'),
    hourLog(-1, 7, '2026-04-03', 'queued'), // registrada sin conexión, aún no sincronizada
  ])
  await v1.table('placements').put({
    id: 7, studentId: 5, tutorId: 3, companyId: 1, startDate: '2026-03-01', endDate: '2026-07-31',
    requiredHours: 240, status: 'ACTIVE', version: 1, updatedAt: '2026-04-01T12:00:00.000Z',
  })
  await v1.table('outbox').add({
    clientOpId: 'op-1', entity: 'hourLog', op: 'create', payload: { id: -1 }, baseVersion: null,
    createdAt: '2026-04-03T12:00:00.000Z', attempts: 0, lastError: null,
  })
  await v1.table('meta').put({ key: 'checkpoint', value: 'abc' })
  v1.close()
}

beforeEach(async () => {
  await createVersion1Database()
})

describe('migración de Dexie v1 → v2', () => {
  it('conserva las horas registradas al abrir la base con el esquema nuevo', async () => {
    await db.open()

    expect(db.verno).toBe(2)
    const logs = await db.hourLogs.orderBy('date').toArray()
    expect(logs.map((log) => [log.id, log.activity, log.syncState])).toEqual([
      [1, 'Jornada 1', 'synced'],
      [2, 'Jornada 2', 'synced'],
      [-1, 'Jornada -1', 'queued'],
    ])
  })

  it('conserva la cola de envío y el checkpoint (perderlos es perder horas sin sincronizar)', async () => {
    await db.open()

    await expect(db.outbox.count()).resolves.toBe(1)
    await expect(db.outbox.get(1)).resolves.toMatchObject({ clientOpId: 'op-1', entity: 'hourLog' })
    await expect(db.meta.get('checkpoint')).resolves.toEqual({ key: 'checkpoint', value: 'abc' })
    await expect(db.placements.get(7)).resolves.toMatchObject({ requiredHours: 240 })
  })

  it('mantiene los índices de la versión 1 (las consultas por índice siguen funcionando)', async () => {
    await db.open()

    await expect(db.hourLogs.where('placementId').equals(7).count()).resolves.toBe(3)
    await expect(db.hourLogs.where('syncState').equals('queued').count()).resolves.toBe(1)
    for (const [table, schema] of Object.entries(V1_SCHEMA)) {
      const expected = schema
        .split(',')
        .map((part) => part.trim())
        .slice(1)
        .sort()
      expect(db.table(table).schema.indexes.map((index) => index.name).sort()).toEqual(expected)
    }
  })

  it('agrega la tabla voiceNotes, vacía y lista para usarse', async () => {
    await db.open()

    expect(db.tables.map((table) => table.name)).toContain('voiceNotes')
    await expect(db.voiceNotes.count()).resolves.toBe(0)
    const id = await db.voiceNotes.add({
      audio: new Blob(['x']),
      mimeType: 'audio/webm',
      durationMs: 1,
      recordedAt: '2026-04-04T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
    })
    await expect(db.voiceNotes.get(id)).resolves.toMatchObject({ status: 'pending' })
    // y las horas siguen ahí después de escribir en la tabla nueva
    await expect(db.hourLogs.count()).resolves.toBe(3)
  })
})