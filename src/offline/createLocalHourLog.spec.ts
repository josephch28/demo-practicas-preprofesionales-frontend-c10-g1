import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalHourLog } from './createLocalHourLog'
import { db } from './db'

describe('createLocalHourLog — guardado compartido e inserción en outbox', () => {
  beforeEach(async () => {
    await db.hourLogs.clear()
    await db.outbox.clear()
    await db.placements.clear()
  })

  it('crea una fila local con id negativo, syncState queued y operación create en la cola', async () => {
    const created = await createLocalHourLog({
      placementId: 42,
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: '  Desarrollo de interfaz  ',
    })

    expect(created.id).toBeLessThan(0)
    expect(created.syncState).toBe('queued')
    expect(created.activity).toBe('Desarrollo de interfaz')

    const storedLogs = await db.hourLogs.toArray()
    expect(storedLogs).toHaveLength(1)
    expect(storedLogs[0]).toMatchObject({
      id: created.id,
      placementId: 42,
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Desarrollo de interfaz',
      status: 'SUBMITTED',
      syncState: 'queued',
    })

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entity).toBe('hourLog')
    expect(outbox[0].op).toBe('create')
    expect(outbox[0].payload.id).toBe(created.id)
  })

  it('resuelve el placementId desde db.placements o usa 1 por defecto cuando no se especifica', async () => {
    const fallbackLog = await createLocalHourLog({
      date: '2026-10-21',
      startTime: '09:00',
      endTime: '11:00',
      hours: 2,
      activity: 'Pruebas unitarias',
    })
    expect(fallbackLog.placementId).toBe(1)

    await db.placements.put({
      id: 77,
      studentId: 10,
      tutorId: 20,
      companyId: 30,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      requiredHours: 240,
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const activePlacementLog = await createLocalHourLog({
      date: '2026-10-21',
      startTime: '14:00',
      endTime: '17:00',
      hours: 3,
      activity: 'Integración',
    })
    expect(activePlacementLog.placementId).toBe(77)
  })
})
