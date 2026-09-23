import { api } from '@/api/client'
import { db, type OutboxEntry } from '@/offline/db'
import { applyResults, type SyncOperationResult } from './conflict'
import { DEFAULT_RETRY_CONFIG } from './retry'
import { setStatus } from './status'

export async function enqueue(
  op: Omit<OutboxEntry, 'id' | 'clientOpId' | 'createdAt' | 'attempts' | 'lastError'>,
): Promise<void> {
  const entry: OutboxEntry = {
    ...op,
    clientOpId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }

  await db.transaction('rw', [db.outbox, db.hourLogs], async () => {
    await db.outbox.add(entry)
    const rowId = entry.payload.id
    if (typeof rowId === 'number') {
      await db.hourLogs.update(rowId, { syncState: 'queued' })
    }
  })

  // Sin esto, el contador "N pendientes" solo se recalcula tras un push
  // exitoso (scheduler.ts:34) y jamás refleja lo que se acaba de encolar
  // mientras no hay conexión.
  setStatus({ pending: await db.outbox.count() })
}

async function recordPushFailures(
  entries: OutboxEntry[],
  errorMsg: string,
  maxAttempts: number,
): Promise<void> {
  for (const entry of entries) {
    if (entry.id == null) continue
    const nextAttempts = (entry.attempts ?? 0) + 1
    await db.outbox.update(entry.id, {
      attempts: nextAttempts,
      lastError: errorMsg,
    })

    // E1-06: Tras agotar los reintentos, la operación queda marcada como
    // fallida y visible para el usuario (syncState: 'failed', reviewNote con
    // el motivo del fallo). No se descarta del outbox.
    if (nextAttempts >= maxAttempts) {
      const rowId = Number(entry.payload.id)
      if (!isNaN(rowId)) {
        await db.hourLogs.update(rowId, {
          syncState: 'failed',
          reviewNote: errorMsg,
        })
      }
    }
  }
}

export async function pushOutbox(
  maxAttempts: number = DEFAULT_RETRY_CONFIG.maxAttempts,
): Promise<{ applied: number; failed: number }> {
  const entries = await db.outbox
    .orderBy('createdAt')
    .filter((e) => (e.attempts ?? 0) < maxAttempts)
    .limit(500)
    .toArray()
  if (entries.length === 0) return { applied: 0, failed: 0 }

  const ops = entries.map((e) => ({
    clientOpId: e.clientOpId,
    entity: e.entity,
    op: e.op,
    baseVersion: e.baseVersion,
    payload: e.payload,
  }))

  // El outbox es lo único que sabe qué id local le corresponde a cada operación,
  // así que el mapa se captura en memoria antes de tocar la cola.
  const localIds = new Map(entries.map((e) => [e.clientOpId, Number(e.payload.id)]))

  try {
    // E1-02: no borramos entradas del outbox antes de llamar al servidor. Si la
    // red se corta acá (o /sync/push lanza), las operaciones se quedan en cola
    // y se reintentan en la próxima corrida.
    const { results } = await api<{ results: SyncOperationResult[] }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ ops }),
    })

    await applyResults(results, localIds)

    // Solo se retiran del outbox las operaciones para las que el servidor emitió
    // veredicto (applied, conflict o rejected). Los rechazos no se reintentan:
    // el motivo ya quedó en hourLogs.reviewNote vía applyResults, así que el
    // estudiante lo ve en la UI. Las operaciones que el servidor no reconoció
    // en su respuesta permanecen en cola.
    const acknowledged = new Set(results.map((r) => r.clientOpId))
    const idsToDelete = entries
      .filter((e) => acknowledged.has(e.clientOpId))
      .map((e) => e.id as number)
    if (idsToDelete.length > 0) {
      await db.outbox.bulkDelete(idsToDelete)
    }

    return {
      applied: results.filter((r) => r.status === 'applied').length,
      failed: results.filter((r) => r.status !== 'applied').length,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await recordPushFailures(entries, errorMsg, maxAttempts)
    throw err
  }
}

