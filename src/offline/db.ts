import Dexie, { type EntityTable } from 'dexie'
import type { SyncState } from '@/components/ledger/SyncGutter'

export interface LocalHourLog {
  id: number
  placementId: number
  date: string
  startTime: string
  endTime: string
  hours: number
  activity: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  reviewNote?: string | null
  version: number
  updatedAt: string
  syncState: SyncState
}

export interface LocalPlacement {
  id: number
  studentId: number
  tutorId: number
  companyId: number
  startDate: string
  endDate: string
  requiredHours: number
  status: string
  version: number
  updatedAt: string
}

export interface LocalDocument {
  id: number
  placementId: number
  kind: string
  filename: string
  status: string
  version: number
  updatedAt: string
}

export interface LocalEvaluation {
  id: number
  placementId: number
  kind: string
  period: string
  scores: unknown
  updatedAt: string
}

export interface OutboxEntry {
  id?: number
  clientOpId: string
  entity: 'hourLog'
  op: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  baseVersion: number | null
  createdAt: string
  attempts: number
  lastError: string | null
}

export const db = new Dexie('practicas') as Dexie & {
  placements: EntityTable<LocalPlacement, 'id'>
  hourLogs: EntityTable<LocalHourLog, 'id'>
  documents: EntityTable<LocalDocument, 'id'>
  evaluations: EntityTable<LocalEvaluation, 'id'>
  outbox: EntityTable<OutboxEntry, 'id'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  placements: 'id, studentId, tutorId, status, updatedAt',
  hourLogs: 'id, placementId, status, date, syncState, updatedAt',
  documents: 'id, placementId, kind, status, updatedAt',
  evaluations: 'id, placementId, kind, updatedAt',
  outbox: '++id, clientOpId, entity, createdAt',
  meta: 'key',
})
