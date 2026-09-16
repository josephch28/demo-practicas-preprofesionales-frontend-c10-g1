import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { applyResults } from './conflict'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('applyResults', () => {
  it('marks the local row as synced when the server applied it', async () => {
    await db.hourLogs.put({
      id: 5,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'queued',
    })

    await applyResults(
      [{ clientOpId: 'a', status: 'applied', server: { id: 5, version: 2 }, reason: null }],
      new Map([['a', 5]]),
    )

    await expect(db.hourLogs.get(5)).resolves.toMatchObject({ syncState: 'synced', version: 2 })
  })

  it('marks the local row as failed and keeps the reason when rejected', async () => {
    await db.hourLogs.put({
      id: 6,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'queued',
    })

    await applyResults(
      [{ clientOpId: 'b', status: 'rejected', server: { id: 6 }, reason: 'el placement no es tuyo' }],
      new Map([['b', 6]]),
    )

    await expect(db.hourLogs.get(6)).resolves.toMatchObject({ syncState: 'failed', reviewNote: 'el placement no es tuyo' })
  })

  it('reconciles a negative local id with the id the server assigned on create, leaving a single row', async () => {
    await db.hourLogs.put({
      id: -1700000000000,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'queued',
    })

    await applyResults(
      [
        {
          clientOpId: 'c',
          status: 'applied',
          server: {
            id: 42,
            placementId: 1,
            date: '2026-04-01',
            startTime: '08:00',
            endTime: '12:00',
            hours: 4,
            activity: 'Soporte',
            status: 'SUBMITTED',
            version: 1,
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          reason: null,
        },
      ],
      new Map([['c', -1700000000000]]),
    )

    const rows = await db.hourLogs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 42, syncState: 'synced' })
  })
})
