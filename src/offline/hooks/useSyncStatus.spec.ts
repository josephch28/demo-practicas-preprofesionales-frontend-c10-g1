import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getStatus, setStatus } from '@/offline/sync/status'
import { useSyncStatus } from './useSyncStatus'

describe('useSyncStatus', () => {
  beforeEach(() => {
    act(() => {
      setStatus({
        online: true,
        pending: 0,
        lastSyncAt: null,
        syncing: false,
      })
    })
  })

  afterEach(() => {
    act(() => {
      setStatus({
        online: true,
        pending: 0,
        lastSyncAt: null,
        syncing: false,
      })
    })
  })

  it('devuelve el estado actual de sincronización al montarse', () => {
    act(() => {
      setStatus({ pending: 2, syncing: false })
    })
    const { result, unmount } = renderHook(() => useSyncStatus())

    expect(result.current).toEqual(getStatus())
    expect(result.current.pending).toBe(2)
    unmount()
  })

  it('se actualiza cuando cambia el estado de sincronización', () => {
    const { result, unmount } = renderHook(() => useSyncStatus())
    expect(result.current.syncing).toBe(false)

    act(() => {
      setStatus({ syncing: true, pending: 5 })
    })

    expect(result.current.syncing).toBe(true)
    expect(result.current.pending).toBe(5)
    unmount()
  })

  it('deja de recibir actualizaciones tras desmontarse', () => {
    const { result, unmount } = renderHook(() => useSyncStatus())

    act(() => {
      setStatus({ pending: 1 })
    })
    expect(result.current.pending).toBe(1)

    unmount()

    act(() => {
      setStatus({ pending: 99 })
    })

    // El resultado capturado antes de unmount no debería cambiar a 99
    expect(result.current.pending).toBe(1)
  })
})
