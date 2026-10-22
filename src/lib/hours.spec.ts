import { describe, expect, it } from 'vitest'
import type { LocalHourLog } from '@/offline/db'
import { sameHourLogRow, summarizeHours } from './hours'

function makeLog(overrides: Partial<LocalHourLog> = {}): LocalHourLog {
  return {
    id: 1,
    placementId: 1,
    date: '2026-04-01',
    startTime: '08:00',
    endTime: '12:00',
    hours: 4,
    activity: 'Soporte',
    status: 'SUBMITTED',
    reviewNote: null,
    version: 1,
    updatedAt: '2026-04-01T00:00:00.000Z',
    syncState: 'synced',
    ...overrides,
  }
}

describe('sameHourLogRow', () => {
  it('considera iguales dos objetos distintos con el mismo contenido (así Dexie re-emite sin cambios)', () => {
    expect(sameHourLogRow(makeLog(), { ...makeLog() })).toBe(true)
  })

  it('ignora campos que la fila no muestra (version, updatedAt)', () => {
    expect(sameHourLogRow(makeLog(), makeLog({ version: 9, updatedAt: '2026-09-01T00:00:00.000Z' }))).toBe(true)
  })

  it.each<[string, Partial<LocalHourLog>]>([
    ['id', { id: 2 }],
    ['date', { date: '2026-04-02' }],
    ['startTime', { startTime: '09:00' }],
    ['endTime', { endTime: '13:00' }],
    ['hours', { hours: 3 }],
    ['activity', { activity: 'Otra' }],
    ['status', { status: 'APPROVED' }],
    ['syncState', { syncState: 'failed' }],
    ['reviewNote', { reviewNote: 'Rechazado por el tutor.' }],
  ])('detecta un cambio en %s', (_campo, cambio) => {
    expect(sameHourLogRow(makeLog(), makeLog(cambio))).toBe(false)
  })
})

describe('summarizeHours', () => {
  it('suma aprobadas y enviadas por separado y acota los porcentajes', () => {
    const summary = summarizeHours(
      [
        makeLog({ id: 1, status: 'APPROVED', hours: 60 }),
        makeLog({ id: 2, status: 'SUBMITTED', hours: 30 }),
        makeLog({ id: 3, status: 'REJECTED', hours: 99 }),
      ],
      240,
    )
    expect(summary.approvedHours).toBe(60)
    expect(summary.submittedHours).toBe(30)
    expect(summary.approvedPct).toBe(25)
    expect(summary.submittedPct).toBe(12.5)
  })

  it('acepta logs undefined (mientras Dexie carga)', () => {
    expect(summarizeHours(undefined, 240)).toMatchObject({ approvedHours: 0, submittedHours: 0, approvedPct: 0 })
  })
})