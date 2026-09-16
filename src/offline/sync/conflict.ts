import { db, type LocalHourLog } from '@/offline/db'

export interface SyncOperationResult {
  clientOpId: string
  status: 'applied' | 'conflict' | 'rejected'
  server: (Partial<LocalHourLog> & { id: number }) | null
  reason: string | null
}

// Escribe el resultado de una operación "applied". Si la fila vivía con un id
// local negativo (creada offline) y el servidor asignó uno positivo, la
// temporal se borra y la definitiva se escribe con el id real, en vez de
// intentar un update que nunca encontraría la fila (Dexie.update() en una
// clave inexistente es un no-op y la deja huérfana).
async function applyApplied(server: NonNullable<SyncOperationResult['server']>, localId: number | undefined) {
  const { id: serverId, ...serverFields } = server
  const isReconciledCreate = localId != null && localId < 0 && serverId > 0

  if (isReconciledCreate) {
    await db.hourLogs.delete(localId)
    await db.hourLogs.put({ ...serverFields, id: serverId, syncState: 'synced' } as LocalHourLog)
  } else {
    await db.hourLogs.update(localId ?? serverId, { ...serverFields, syncState: 'synced' })
  }
}

export async function applyResults(
  results: SyncOperationResult[],
  localIds: Map<string, number>,
): Promise<void> {
  for (const result of results) {
    const localId = localIds.get(result.clientOpId)

    if (result.status === 'applied' && result.server) {
      await applyApplied(result.server, localId)
      continue
    }

    const targetId = localId ?? result.server?.id
    if (targetId != null) {
      await db.hourLogs.update(targetId, { syncState: 'failed', reviewNote: result.reason })
    }
  }
}
