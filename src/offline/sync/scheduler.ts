import { db } from '@/offline/db'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import { getStatus, setStatus } from './status'

const SYNC_INTERVAL_MS = 60_000
// Tope de rondas de pull por corrida: evita que un servidor que siempre
// responda hasMore:true cuelgue el scheduler en un bucle infinito.
const MAX_PULL_ROUNDS = 20

function hasSession(): boolean {
  return Boolean(localStorage.getItem('access_token'))
}

let currentSync: Promise<void> | null = null

async function runSync(): Promise<void> {
  if (!hasSession()) return

  setStatus({ syncing: true })

  try {
    let hasMore = true
    let rounds = 0
    while (hasMore && rounds < MAX_PULL_ROUNDS) {
      const result = await pullChanges()
      hasMore = result.hasMore
      rounds += 1
    }

    await pushOutbox()

    setStatus({ syncing: false, lastSyncAt: new Date().toISOString() })
    setStatus({ pending: await db.outbox.count() })
  } catch (err) {
    console.error('sincronización falló', err)
    setStatus({ syncing: false })
  }
}


 // Corre pull + push. Si ya hay una corrida en curso EN ESTA pestaña, la
 // reutiliza en vez de duplicarla. Si `syncing` ya está en `true` porque
 // OTRA pestaña lo puso ahí (nos llega por BroadcastChannel vía status.ts),
 // no arrancamos una corrida nueva sobre la misma cola: la dejamos para el
 // próximo ciclo. `currentSync` por sí solo no alcanza porque cada pestaña
 // tiene su propia copia de este módulo.
export function syncNow(): Promise<void> {
  if (currentSync) return currentSync
  if (getStatus().syncing) return Promise.resolve()

  currentSync = runSync().finally(() => {
    currentSync = null
  })
  return currentSync
}

/**
 * Arranca el scheduler: sincroniza al montar, al recuperar conexión, y cada
 * 60s. Debe llamarse una sola vez (desde un useEffect en AppLayout) — llamar
 * en cada hook crearía un timer y un listener por cada consumidor.
 */
export function startSync(): () => void {
  void syncNow()

  const handleOnline = () => {
    setStatus({ online: true })
    void syncNow()
  }
  const handleOffline = () => {
    setStatus({ online: false })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  const intervalId = window.setInterval(() => {
    void syncNow()
  }, SYNC_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.clearInterval(intervalId)
  }
}
