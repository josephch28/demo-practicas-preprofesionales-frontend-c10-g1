import { db, type LocalHourLog, type OutboxEntry } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'

export interface LocalHourLogValues {
  date: string
  startTime: string
  endTime: string
  hours: number | string
  activity: string
}

export interface CreateLocalHourLogInput extends LocalHourLogValues {
  placementId?: number
}

export interface CreateLocalHourLogOptions {
  id?: number
  nowIso?: string
}

export function buildLocalHourLog(
  placementId: number,
  values: LocalHourLogValues,
  options?: CreateLocalHourLogOptions,
): LocalHourLog {
  return {
    id: options?.id ?? -Date.now(),
    placementId,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    hours: Number(values.hours),
    activity: values.activity.trim(),
    status: 'SUBMITTED',
    reviewNote: null,
    version: 1,
    updatedAt: options?.nowIso ?? new Date().toISOString(),
    syncState: 'local',
  }
}

export function buildHourLogPushOperation(
  row: LocalHourLog,
): Omit<OutboxEntry, 'id' | 'clientOpId' | 'createdAt' | 'attempts' | 'lastError'> {
  return {
    entity: 'hourLog',
    op: 'create',
    payload: {
      id: row.id,
      placementId: row.placementId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      hours: row.hours,
      activity: row.activity,
      status: row.status,
      reviewNote: row.reviewNote,
      version: row.version,
      updatedAt: row.updatedAt,
    },
    baseVersion: null,
  }
}

async function resolvePlacementId(placementId?: number): Promise<number> {
  if (typeof placementId === 'number') return placementId
  const active = await db.placements.toCollection().first()
  return active?.id ?? 1
}

export async function createLocalHourLog(
  input: CreateLocalHourLogInput,
  options?: CreateLocalHourLogOptions,
): Promise<LocalHourLog>
export async function createLocalHourLog(
  placementId: number,
  values: LocalHourLogValues,
  options?: CreateLocalHourLogOptions,
): Promise<LocalHourLog>
export async function createLocalHourLog(
  inputOrPlacementId: CreateLocalHourLogInput | number,
  valuesOrOptions?: LocalHourLogValues | CreateLocalHourLogOptions,
  maybeOptions?: CreateLocalHourLogOptions,
): Promise<LocalHourLog> {
  const isNumericFirst = typeof inputOrPlacementId === 'number'
  const placementId = await resolvePlacementId(
    isNumericFirst ? inputOrPlacementId : inputOrPlacementId.placementId,
  )
  const values = isNumericFirst
    ? (valuesOrOptions as LocalHourLogValues)
    : inputOrPlacementId
  const options = isNumericFirst
    ? maybeOptions
    : (valuesOrOptions as CreateLocalHourLogOptions | undefined)

  const row = buildLocalHourLog(placementId, values, options)
  const op = buildHourLogPushOperation(row)

  await db.transaction('rw', [db.hourLogs, db.outbox], async () => {
    await db.hourLogs.add(row)
    await enqueue(op)
  })

  return { ...row, syncState: 'queued' }
}
