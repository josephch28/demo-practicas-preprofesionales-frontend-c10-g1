import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('db', () => {
  it('stores and reads an hour log by placement', async () => {
    await db.hourLogs.put({
      id: 1, placementId: 7, date: '2026-04-01', startTime: '08:00', endTime: '12:00',
      hours: 4, activity: 'Soporte', status: 'SUBMITTED', version: 1,
      updatedAt: '2026-04-01T12:00:00.000Z', syncState: 'synced',
    })

    await expect(db.hourLogs.where('placementId').equals(7).count()).resolves.toBe(1)
  })

  it('keeps the sync checkpoint in meta', async () => {
    await db.meta.put({ key: 'checkpoint', value: 'abc' })

    await expect(db.meta.get('checkpoint')).resolves.toEqual({ key: 'checkpoint', value: 'abc' })
  })
})
