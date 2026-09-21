import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalHourLog } from '@/offline/db'
import { MyPlacementPage } from './MyPlacementPage'

const { usePlacementMock, useHourLogsMock, hourLogsUpdateMock, useLiveQueryMock } = vi.hoisted(() => ({
  usePlacementMock: vi.fn(),
  useHourLogsMock: vi.fn(),
  hourLogsUpdateMock: vi.fn().mockResolvedValue(1),
  useLiveQueryMock: vi.fn(),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: unknown, deps: unknown[]) => useLiveQueryMock(fn, deps),
}))

vi.mock('@/offline/hooks/usePlacement', () => ({
  usePlacement: () => usePlacementMock(),
}))

vi.mock('@/offline/hooks/useHourLogs', () => ({
  useHourLogs: (...args: unknown[]) => useHourLogsMock(...args),
}))

vi.mock('@/offline/db', () => ({
  db: {
    documents: { where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }) },
    hourLogs: { update: hourLogsUpdateMock },
  },
}))

const PLACEMENT = {
  id: 1,
  studentId: 5,
  tutorId: 7,
  companyId: 1,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  requiredHours: 240,
  status: 'ACTIVE',
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

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

describe('MyPlacementPage', () => {
  it('shows loading state when placement is undefined', () => {
    usePlacementMock.mockReturnValue(undefined)
    render(
      <MemoryRouter>
        <MyPlacementPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/Cargando tu práctica/i)).toBeInTheDocument()
  })

  it('shows empty state when placement is null', () => {
    usePlacementMock.mockReturnValue(null)
    render(
      <MemoryRouter>
        <MyPlacementPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/No tienes una práctica activa todavía/i)).toBeInTheDocument()
  })

  it('renders placement info and recent logs', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([makeLog({ id: 10, hours: 4 })])
    useLiveQueryMock.mockReturnValue([])

    render(
      <MemoryRouter>
        <MyPlacementPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Mi práctica')).toBeInTheDocument()
    expect(screen.getByText('Soporte')).toBeInTheDocument()
  })

  it('shows review note banner on failed logs and allows dismissing it', () => {
    usePlacementMock.mockReturnValue(PLACEMENT)
    useHourLogsMock.mockReturnValue([
      makeLog({
        id: 42,
        status: 'APPROVED',
        syncState: 'failed',
        reviewNote: 'El tutor ya aprobó este registro.',
      }),
    ])
    useLiveQueryMock.mockReturnValue([])

    render(
      <MemoryRouter>
        <MyPlacementPage />
      </MemoryRouter>
    )

    expect(screen.getByText('El tutor ya aprobó este registro.')).toBeInTheDocument()
    const dismissBtn = screen.getByText('Entendido')
    expect(dismissBtn).toBeInTheDocument()

    fireEvent.click(dismissBtn)
    expect(hourLogsUpdateMock).toHaveBeenCalledWith(42, {
      syncState: 'synced',
      reviewNote: null,
    })
  })
})
