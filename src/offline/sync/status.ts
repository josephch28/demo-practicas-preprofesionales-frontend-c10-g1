export interface SyncStatus {
  online: boolean
  pending: number
  lastSyncAt: string | null
  syncing: boolean
}

type Listener = () => void

let state: SyncStatus = {
  online: navigator.onLine,
  pending: 0,
  lastSyncAt: null,
  syncing: false,
}

const listeners = new Set<Listener>()

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sync-status') : null

channel?.addEventListener('message', (event: MessageEvent<Partial<SyncStatus>>) => {
  applyLocally(event.data)
})

function applyLocally(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function getStatus(): SyncStatus {
  return state
}

export function setStatus(patch: Partial<SyncStatus>): void {
  applyLocally(patch)

  const shared: Partial<SyncStatus> = {}
  if (patch.pending !== undefined) shared.pending = patch.pending
  if (patch.lastSyncAt !== undefined) shared.lastSyncAt = patch.lastSyncAt
  if (patch.syncing !== undefined) shared.syncing = patch.syncing

  if (Object.keys(shared).length > 0) {
    channel?.postMessage(shared)
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}