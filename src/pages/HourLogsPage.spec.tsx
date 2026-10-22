import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HourLogsPage } from './HourLogsPage'

const { usePlacementMock, useHourLogsMock, hourLogsUpdateMock } = vi.hoisted(() => ({
  usePlacementMock: vi.fn(),
  useHourLogsMock: vi.fn(),
  hourLogsUpdateMock: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/offline/hooks/usePlacement', () => ({ usePlacement: () => usePlacementMock() }))
vi.mock('@/offline/hooks/useHourLogs', () => ({ useHourLogs: (...args: unknown[]) => useHourLogsMock(...args) }))

import { formatShortDate } from '@/lib/date'
import { summarizeHours } from '@/lib/hours'
import type { LocalHourLog } from '@/offline/db'

// Envuelven la implementación real: sirven para contar llamadas sin cambiar el resultado.
vi.mock('@/lib/hours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hours')>()
  return { ...actual, summarizeHours: vi.fn(actual.summarizeHours) }
})

vi.mock('@/lib/date', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/date')>()
  return { ...actual, formatShortDate: vi.fn(actual.formatShortDate) }
})

vi.mock('@/offline/db', () => ({
  db: { hourLogs: { update: hourLogsUpdateMock } },
}))

const PLACEMENT = { id: 1, studentId: 5, tutorId: 7, companyId: 1, startDate: '2026-01-01', endDate: '2026-12-31', requiredHours: 240, status: 'ACTIVE', version: 1, updatedAt: '2026-01-01T00:00:00.000Z' }

function makeLog(overrides: Partial<LocalHourLog> = {}): LocalHourLog {
  return {
    id: 10,
    placementId: 1,
    date: '2026-04-01',
    startTime: '08:00',
    endTime: '12:00',
    hours: 4,
    activity: 'Soporte',
    status: 'SUBMITTED',
    version: 1,
    updatedAt: '2026-04-01T00:00:00.000Z',
    syncState: 'synced',
    reviewNote: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HourLogsPage', () => {
  it('shows loading state when placement is undefined', () => {
    usePlacementMock.mockReturnValue(undefined)
    render(<HourLogsPage />)
    expect(screen.getByText(/Cargando tu práctica/i)).toBeInTheDocument()
  })

  it('shows empty state when placement is null', () => {
    usePlacementMock.mockReturnValue(null)
    render(<HourLogsPage />)
    expect(screen.getByText(/No tienes una práctica activa todavía/i)).toBeInTheDocument()
  })

  it('shows loading state when logs are undefined', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue(undefined)
    render(<HourLogsPage />)
    expect(screen.getByText(/Cargando registros de horas/i)).toBeInTheDocument()
  })

  it('shows empty state when logs list is empty', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([])
    render(<HourLogsPage />)
    expect(screen.getByText(/Todavía no has registrado horas/i)).toBeInTheDocument()
  })

  it('shows the voice record button next to "Registrar horas"', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([])
    render(<HourLogsPage />)
    expect(screen.getByRole('button', { name: 'Dictar horas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar horas' })).toBeInTheDocument()
  })

  it('shows the review note banner when a log has syncState failed', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([
      makeLog({ id: 10, status: 'APPROVED', syncState: 'failed', reviewNote: 'El tutor ya aprobó este registro.' }),
    ])

    render(<HourLogsPage />)

    expect(screen.getByText('El tutor ya aprobó este registro.')).toBeInTheDocument()
    expect(screen.getByText('Entendido')).toBeInTheDocument()
  })

  it('does not show the banner for synced logs without reviewNote', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([makeLog({ id: 11 })])

    render(<HourLogsPage />)

    expect(screen.queryByText('Entendido')).not.toBeInTheDocument()
  })

  it('calls db.hourLogs.update to clear the failed state when the student clicks Entendido', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([
      makeLog({ id: 99, status: 'APPROVED', syncState: 'failed', reviewNote: 'Rechazado por el tutor.' }),
    ])

    render(<HourLogsPage />)

    fireEvent.click(screen.getByText('Entendido'))

    expect(hourLogsUpdateMock).toHaveBeenCalledWith(99, { syncState: 'synced', reviewNote: null })
  })

  describe('rendimiento con muchos registros (E6)', () => {
    const manyLogs = () => Array.from({ length: 50 }, (_, i) => makeLog({ id: i + 1, activity: `Actividad ${i + 1}` }))

    // Criterio: "los totales no se recalculan en cada renderizado".
    it('no recalcula los totales al re-renderizar con los mismos registros', () => {
      const logs = manyLogs()
      usePlacementMock.mockReturnValue(PLACEMENT)
      useHourLogsMock.mockReturnValue(logs)
      const { rerender } = render(<HourLogsPage />)
      expect(summarizeHours).toHaveBeenCalledTimes(1)
      rerender(<HourLogsPage />)
      rerender(<HourLogsPage />)
      expect(summarizeHours).toHaveBeenCalledTimes(1)

      // sí se recalculan cuando los registros cambian de verdad
      useHourLogsMock.mockReturnValue([...logs, makeLog({ id: 999, status: 'APPROVED' })])
      rerender(<HourLogsPage />)
      expect(summarizeHours).toHaveBeenCalledTimes(2)
    })

    // Criterio: "el comportamiento no cambia" + rendimiento: una sola fila
    // actualizada por la sincronización no debe re-dibujar las otras 49.
    it('al cambiar un solo registro re-dibuja solo esa fila, no toda la lista', () => {
      const logs = manyLogs()
      usePlacementMock.mockReturnValue(PLACEMENT)
      useHourLogsMock.mockReturnValue(logs)
      const { rerender } = render(<HourLogsPage />)
      expect(formatShortDate).toHaveBeenCalledTimes(50)
      vi.mocked(formatShortDate).mockClear()

      // Dexie entrega objetos nuevos en cada emisión: se clonan los 50 y cambia uno.
      const next = logs.map((log) => ({ ...log }))
      next[10] = { ...next[10], activity: 'Actividad modificada por la sincronización' }
      useHourLogsMock.mockReturnValue(next)
      rerender(<HourLogsPage />)
      expect(formatShortDate).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Actividad modificada por la sincronización')).toBeInTheDocument()
      expect(screen.queryByText('Actividad 11')).not.toBeInTheDocument()
    })

    it('si la emisión trae los mismos datos en objetos nuevos, no re-dibuja ninguna fila', () => {
      const logs = manyLogs()
      usePlacementMock.mockReturnValue(PLACEMENT)
      useHourLogsMock.mockReturnValue(logs)
      const { rerender } = render(<HourLogsPage />)
      vi.mocked(formatShortDate).mockClear()
      useHourLogsMock.mockReturnValue(logs.map((log) => ({ ...log })))
      rerender(<HourLogsPage />)
      expect(formatShortDate).not.toHaveBeenCalled()
    })

    it('muestra los registros más recientes primero, igual que antes', () => {
      usePlacementMock.mockReturnValue(PLACEMENT)
      // useHourLogs los entrega ascendentes por fecha
      useHourLogsMock.mockReturnValue([
        makeLog({ id: 1, activity: 'Primera jornada' }),
        makeLog({ id: 2, activity: 'Segunda jornada' }),
        makeLog({ id: 3, activity: 'Tercera jornada' }),
      ])
      render(<HourLogsPage />)
      const text = document.body.textContent ?? ''
      expect(text.indexOf('Tercera jornada')).toBeLessThan(text.indexOf('Segunda jornada'))
      expect(text.indexOf('Segunda jornada')).toBeLessThan(text.indexOf('Primera jornada'))
    })
  })
})