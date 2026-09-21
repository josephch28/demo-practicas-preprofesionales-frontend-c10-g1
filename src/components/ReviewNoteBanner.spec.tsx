import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalHourLog } from '@/offline/db'
import { ReviewNoteBanner } from './ReviewNoteBanner'

const { hourLogsUpdateMock } = vi.hoisted(() => ({
  hourLogsUpdateMock: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/offline/db', () => ({
  db: {
    hourLogs: { update: hourLogsUpdateMock },
  },
}))

function makeLog(overrides: Partial<LocalHourLog> = {}): LocalHourLog {
  return {
    id: 10,
    placementId: 1,
    date: '2026-04-01',
    startTime: '08:00',
    endTime: '12:00',
    hours: 4,
    activity: 'Soporte',
    status: 'APPROVED',
    version: 2,
    updatedAt: '2026-04-01T00:00:00.000Z',
    syncState: 'failed',
    reviewNote: 'Tus cambios no se guardaron porque el tutor ya aprobó este registro.',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReviewNoteBanner', () => {
  it('renders review note text, warning icon and dismiss button when syncState is failed and reviewNote exists', () => {
    const log = makeLog()
    render(<ReviewNoteBanner log={log} />)

    expect(screen.getByText('Tus cambios no se guardaron porque el tutor ya aprobó este registro.')).toBeInTheDocument()
    expect(screen.getByText('⚠')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeInTheDocument()
  })

  it('renders nothing when syncState is not failed', () => {
    const log = makeLog({ syncState: 'synced' })
    const { container } = render(<ReviewNoteBanner log={log} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when reviewNote is empty or null', () => {
    const log = makeLog({ reviewNote: null })
    const { container } = render(<ReviewNoteBanner log={log} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('calls db.hourLogs.update to reset syncState to synced and reviewNote to null on click', () => {
    const log = makeLog({ id: 99 })
    render(<ReviewNoteBanner log={log} />)

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))

    expect(hourLogsUpdateMock).toHaveBeenCalledWith(99, {
      syncState: 'synced',
      reviewNote: null,
    })
  })
})
