import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, api: vi.fn() }
})

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

function withProvider({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth(), { wrapper })).toThrow('useAuth debe usarse dentro de AuthProvider')
  })
})

describe('AuthProvider', () => {
  it('starts with no user when localStorage is empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user).toBeNull()
    expect(result.current.role).toBeNull()
  })

  it('restores a valid stored user on init', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 1, email: 'coordinador@miyura.com', fullName: 'Coordinación', role: 'COORDINATOR', companyId: null }),
    )
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user?.email).toBe('coordinador@miyura.com')
    expect(result.current.role).toBe('COORDINATOR')
  })

  it('ignores a corrupted stored user instead of throwing', () => {
    localStorage.setItem('user', '{not-json')
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user).toBeNull()
  })

  it('login stores the token and user, and updates the context', async () => {
    vi.mocked(api).mockResolvedValue({
      accessToken: 'tok-123',
      user: { id: 5, email: 'empresa0@miyura.com', fullName: 'Empresa 0', role: 'COMPANY', companyId: 1 },
    })
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })

    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    expect(api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'empresa0@miyura.com', password: 'yura1234' }),
    })
    expect(localStorage.getItem('access_token')).toBe('tok-123')
    expect(result.current.user?.companyId).toBe(1)
    expect(result.current.role).toBe('COMPANY')
  })

  it('logout clears storage and the context', async () => {
    vi.mocked(api).mockResolvedValue({
      accessToken: 'tok-123',
      user: { id: 5, email: 'empresa0@miyura.com', fullName: 'Empresa 0', role: 'COMPANY', companyId: 1 },
    })
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('logout wipes local Dexie data, including the sync checkpoint, so the next session starts clean', async () => {
    // Simula datos dejados en el dispositivo por la sesión anterior: filas de
    // otro estudiante y el checkpoint global de sync (db.ts) que, sin
    // espacio de nombres por usuario, filtraría lo que la siguiente sesión
    // puede recibir del pull si sobreviviera al logout.
    await db.placements.put({
      id: 1,
      studentId: 99,
      tutorId: 1,
      companyId: 1,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      requiredHours: 200,
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.meta.put({ key: 'syncCheckpoint', value: '2026-01-01T00:00:00.000Z' })

    vi.mocked(api).mockResolvedValue({
      accessToken: 'tok-123',
      user: { id: 5, email: 'empresa0@miyura.com', fullName: 'Empresa 0', role: 'COMPANY', companyId: 1 },
    })
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(await db.placements.count()).toBe(0)
    expect(await db.meta.count()).toBe(0)
  })
})
