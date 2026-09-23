import { beforeEach, describe, expect, it, vi } from 'vitest'

 // Simula dos pestañas cargando el mismo módulo: cada `vi.resetModules()` +
 // import dinámico da una copia nueva y aislada de `status.ts` (su propio
 // `state`, su propio Set de listeners), tal como pasa en dos pestañas reales.
 // Ambas copias hablan por el mismo BroadcastChannel('sync-status'), que sí
 // es compartido a nivel de proceso/navegador.
 
async function openTab() {
  vi.resetModules()
  return import('./status')
}

function waitForUpdate(tab: Awaited<ReturnType<typeof openTab>>): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = tab.subscribe(() => {
      unsubscribe()
      resolve()
    })
  })
}

describe('status entre pestañas (E1-08)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('una pestaña ve el pending y el lastSyncAt que puso la otra', async () => {
    const tabA = await openTab()
    const tabB = await openTab()

    const updated = waitForUpdate(tabB)
    tabA.setStatus({ pending: 4, lastSyncAt: '2026-09-18T10:00:00.000Z' })
    await updated

    expect(tabB.getStatus()).toMatchObject({
      pending: 4,
      lastSyncAt: '2026-09-18T10:00:00.000Z',
    })
  })

  it('sincronizar en una pestaña notifica a los listeners de la otra sin recargar', async () => {
    const tabA = await openTab()
    const tabB = await openTab()

    const listenerB = vi.fn()
    tabB.subscribe(listenerB)

    const updated = waitForUpdate(tabB)
    tabA.setStatus({ syncing: true })
    await updated

    expect(listenerB).toHaveBeenCalled()
    expect(tabB.getStatus().syncing).toBe(true)
  })

  it('no reenvía el estado "online", que es local a cada pestaña', async () => {
    const tabA = await openTab()
    const tabB = await openTab()

    tabA.setStatus({ online: false })

    const updated = waitForUpdate(tabB)
    tabA.setStatus({ pending: 1 })
    await updated

    expect(tabB.getStatus().online).toBe(true)
  })
})