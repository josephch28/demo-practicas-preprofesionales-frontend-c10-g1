import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import { syncNow } from './scheduler'
import { getStatus, setStatus, subscribe, type SyncStatus } from './status'

vi.mock('./pull', () => ({ pullChanges: vi.fn() }))
vi.mock('./push', () => ({ pushOutbox: vi.fn() }))

const mockedPull = vi.mocked(pullChanges)
const mockedPush = vi.mocked(pushOutbox)

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  mockedPull.mockReset()
  mockedPush.mockReset()
  // El store es un modulo global: lo dejamos en un estado limpio para que
  // los snapshots de este test no arrastren pendientes de otras suites.
  setStatus({ online: true, syncing: false, pending: 0, lastSyncAt: null })
})

describe('E1-07 (D-08): el indicador no puede decir sincronizado con pendientes', () => {

  it(
    'no emite ningun estado con syncing:false y un pending distinto al contenido real de la cola',
    async () => {
      localStorage.setItem('access_token', 'tok')

      // Sembramos tres operaciones en el outbox que sobreviven al ciclo
      // (por ejemplo, porque el servidor las rechazo y este mock ni siquiera
      // las tocaria). Lo importante es que db.outbox.count() al terminar
      // runSync sea 3, mientras que el pending que ya vivia en el store era 0.
      await db.outbox.bulkAdd([
        {
          clientOpId: 'a',
          entity: 'hourLog',
          op: 'create',
          payload: { id: 1 },
          baseVersion: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          attempts: 0,
          lastError: null,
        },
        {
          clientOpId: 'b',
          entity: 'hourLog',
          op: 'create',
          payload: { id: 2 },
          baseVersion: null,
          createdAt: '2026-04-01T00:00:01.000Z',
          attempts: 0,
          lastError: null,
        },
        {
          clientOpId: 'c',
          entity: 'hourLog',
          op: 'create',
          payload: { id: 3 },
          baseVersion: null,
          createdAt: '2026-04-01T00:00:02.000Z',
          attempts: 0,
          lastError: null,
        },
      ])

      mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
      mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

      const snapshots: SyncStatus[] = []
      const unsubscribe = subscribe(() => snapshots.push({ ...getStatus() }))

      try {
        await syncNow()
      } finally {
        unsubscribe()
      }

      const realPending = await db.outbox.count()
      const invalid = snapshots.find((s) => s.syncing === false && s.pending !== realPending)

      expect(
        invalid,
        `estado intermedio invalido tras el cierre del sync: ${JSON.stringify(invalid)}`,
      ).toBeUndefined()
    },
  )
})
