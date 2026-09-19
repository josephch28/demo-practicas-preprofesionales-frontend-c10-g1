import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'

vi.mock('./pull', () => ({ pullChanges: vi.fn() }))
vi.mock('./push', () => ({ pushOutbox: vi.fn() }))

async function openTab() {
  vi.resetModules()
  const scheduler = await import('./scheduler')
  const status = await import('./status')
  return { scheduler, status }
}

/** Espera a que este tab observe `syncing: true`, venga de esta pestaña o de otra por BroadcastChannel. */
function waitForSyncingTrue(status: Awaited<ReturnType<typeof openTab>>['status']): Promise<void> {
  return new Promise((resolve) => {
    if (status.getStatus().syncing) {
      resolve()
      return
    }
    const unsubscribe = status.subscribe(() => {
      if (status.getStatus().syncing) {
        unsubscribe()
        resolve()
      }
    })
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  localStorage.setItem('access_token', 'tok')
  vi.resetModules()
})

describe('syncNow entre pestañas (E1-08)', () => {
  it('no dispara dos pushOutbox simultáneos desde pestañas distintas sobre la misma cola', async () => {
    const tabA = await openTab()
    const { pullChanges } = await import('./pull')
    const { pushOutbox } = await import('./push')
    const mockedPull = vi.mocked(pullChanges)
    const mockedPush = vi.mocked(pushOutbox)

    const pending: { resolve: (() => void) | null } = { resolve: null }
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.resolve = () => resolve({ applied: 0, failed: 0 })
        }),
    )

    const tabB = await openTab()

    const runA = tabA.scheduler.syncNow()

    // Espera a que a la pestaña B le llegue "syncing: true" desde A antes
    // de que B intente sincronizar también.
    await waitForSyncingTrue(tabB.status)

    await tabB.scheduler.syncNow()

    expect(mockedPush).toHaveBeenCalledTimes(1)

    pending.resolve?.()
    await runA
  })
})