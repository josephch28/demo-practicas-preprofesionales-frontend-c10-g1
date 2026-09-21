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

vi.mock('@/offline/db', () => ({
  db: { hourLogs: { update: hourLogsUpdateMock } },
}))

const PLACEMENT = { id: 1, studentId: 5, tutorId: 7, companyId: 1, startDate: '2026-01-01', endDate: '2026-12-31', requiredHours: 240, status: 'ACTIVE', version: 1, updatedAt: '2026-01-01T00:00:00.000Z' }

function makeLog(overrides: Partial<{ id: number; status: string; syncState: string; reviewNote: string | null }> = {}) {
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
})
