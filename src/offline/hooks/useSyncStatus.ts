import { useSyncExternalStore } from 'react'
import { getStatus, subscribe, type SyncStatus } from '@/offline/sync/status'

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getStatus)
}
