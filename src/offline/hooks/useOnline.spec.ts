import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOnline } from './useOnline'

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

describe('useOnline', () => {
  afterEach(() => setOnLine(true))

  it('reflects navigator.onLine on mount', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(false)
  })

  it('updates when the browser fires online/offline events', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('balances its online/offline listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOnline())
    const added = addSpy.mock.calls.filter(([event]) => event === 'online' || event === 'offline').length

    unmount()

    const removed = removeSpy.mock.calls.filter(([event]) => event === 'online' || event === 'offline').length
    expect(removed).toBe(added)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
