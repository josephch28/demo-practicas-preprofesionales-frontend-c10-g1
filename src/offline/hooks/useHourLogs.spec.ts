import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type LocalHourLog } from '@/offline/db'
import { useHourLogs } from './useHourLogs'

const sampleLog1: LocalHourLog = {
  id: 1,
  placementId: 10,
  date: '2026-04-01',
  startTime: '08:00',
  endTime: '12:00',
  hours: 4,
  activity: 'Desarrollo de módulos',
  status: 'SUBMITTED',
  version: 1,
  updatedAt: '2026-04-01T12:00:00.000Z',
  syncState: 'synced',
}

const sampleLog2: LocalHourLog = {
  id: 2,
  placementId: 10,
  date: '2026-04-02',
  startTime: '09:00',
  endTime: '13:00',
  hours: 4,
  activity: 'Pruebas unitarias',
  status: 'APPROVED',
  version: 1,
  updatedAt: '2026-04-02T13:00:00.000Z',
  syncState: 'synced',
}

const sampleLogOtherPlacement: LocalHourLog = {
  id: 3,
  placementId: 99,
  date: '2026-04-03',
  startTime: '10:00',
  endTime: '14:00',
  hours: 4,
  activity: 'Otra práctica',
  status: 'SUBMITTED',
  version: 1,
  updatedAt: '2026-04-03T14:00:00.000Z',
  syncState: 'synced',
}

describe('useHourLogs', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('devuelve undefined inicialmente (estado de carga)', () => {
    const { result } = renderHook(() => useHourLogs(10))
    expect(result.current).toBeUndefined()
  })

  it('devuelve un arreglo vacío cuando la colección está vacía', async () => {
    const { result } = renderHook(() => useHourLogs(10))

    expect(result.current).toBeUndefined()

    await waitFor(() => {
      expect(result.current).toEqual([])
    })
  })

  it('devuelve los registros filtrados por placementId y ordenados por fecha', async () => {
    // Insertamos en orden inverso de fecha y agregamos un registro de otra práctica
    await db.hourLogs.bulkPut([sampleLog2, sampleLogOtherPlacement, sampleLog1])

    const { result } = renderHook(() => useHourLogs(10))

    await waitFor(() => {
      expect(result.current).toEqual([sampleLog1, sampleLog2])
    })
  })

  it('reacciona en tiempo real a cambios en la base de datos local', async () => {
    await db.hourLogs.put(sampleLog1)

    const { result } = renderHook(() => useHourLogs(10))

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
    })

    // Agregamos un segundo registro mientras el hook está montado
    await act(async () => {
      await db.hourLogs.put(sampleLog2)
    })

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
      expect(result.current).toEqual([sampleLog1, sampleLog2])
    })
  })
})
