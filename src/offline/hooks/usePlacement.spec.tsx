import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { db, type LocalPlacement } from '@/offline/db'
import { usePlacement } from './usePlacement'

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    )
  }
}

const samplePlacement: LocalPlacement = {
  id: 101,
  studentId: 5,
  tutorId: 2,
  companyId: 3,
  startDate: '2026-03-01',
  endDate: '2026-08-31',
  requiredHours: 240,
  status: 'ACTIVE',
  version: 1,
  updatedAt: '2026-03-01T08:00:00.000Z',
}

const otherPlacement: LocalPlacement = {
  id: 102,
  studentId: 99,
  tutorId: 2,
  companyId: 4,
  startDate: '2026-03-01',
  endDate: '2026-08-31',
  requiredHours: 240,
  status: 'ACTIVE',
  version: 1,
  updatedAt: '2026-03-01T08:00:00.000Z',
}

function setLoggedUser(user: { id: number; role: string; email?: string; fullName?: string; companyId?: number | null } | null) {
  if (user) {
    localStorage.setItem(
      'user',
      JSON.stringify({
        email: 'test@miyura.com',
        fullName: 'Test User',
        companyId: null,
        ...user,
      }),
    )
  } else {
    localStorage.removeItem('user')
  }
}

describe('usePlacement', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('devuelve undefined inicialmente (estado de carga)', () => {
    setLoggedUser({ id: 5, role: 'STUDENT' })
    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })
    expect(result.current).toBeUndefined()
  })

  it('devuelve null cuando la colección de placements está vacía', async () => {
    setLoggedUser({ id: 5, role: 'STUDENT' })
    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })

    expect(result.current).toBeUndefined()

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('devuelve el placement del estudiante cuando existe en la base local', async () => {
    setLoggedUser({ id: 5, role: 'STUDENT' })
    await db.placements.bulkPut([samplePlacement, otherPlacement])

    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current).toEqual(samplePlacement)
    })
  })

  it('devuelve null si no hay sesión activa', async () => {
    setLoggedUser(null)
    await db.placements.put(samplePlacement)

    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('devuelve null si el usuario autenticado no tiene rol STUDENT', async () => {
    setLoggedUser({ id: 2, role: 'TUTOR' })
    await db.placements.put(samplePlacement)

    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('reacciona en tiempo real cuando se actualiza el placement en la base local', async () => {
    setLoggedUser({ id: 5, role: 'STUDENT' })
    await db.placements.put(samplePlacement)

    const { result } = renderHook(() => usePlacement(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current).toEqual(samplePlacement)
    })

    const updatedPlacement = { ...samplePlacement, status: 'COMPLETED', requiredHours: 300 }
    await act(async () => {
      await db.placements.put(updatedPlacement)
    })

    await waitFor(() => {
      expect(result.current).toEqual(updatedPlacement)
    })
  })
})
