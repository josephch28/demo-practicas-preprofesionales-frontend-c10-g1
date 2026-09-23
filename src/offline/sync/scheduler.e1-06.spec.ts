import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import {
  cancelRetry,
  getCurrentSync,
  getRetryConfig,
  getRetryState,
  resetRetryState,
  setRetryConfig,
  startSync,
  syncNow,
} from './scheduler'
import { getStatus, setStatus } from './status'

vi.mock('./pull', () => ({ pullChanges: vi.fn() }))
vi.mock('./push', () => ({ pushOutbox: vi.fn() }))

const mockedPull = vi.mocked(pullChanges)
const mockedPush = vi.mocked(pushOutbox)

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  localStorage.setItem('access_token', 'mock-token')
  mockedPull.mockReset()
  mockedPush.mockReset()
  resetRetryState()
  setStatus({ online: true, syncing: false })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})

afterEach(() => {
  cancelRetry()
  vi.useRealTimers()
})

describe('E1-06: Scheduler con reintentos de espera creciente (backoff exponencial)', () => {
  it('reintenta con esperas crecientes (1s, 2s, 4s...) cuando el push falla y hay items pendientes', async () => {
    // Agregamos una entrada pendiente en outbox
    await db.outbox.add({
      clientOpId: 'op-1',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 1 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    })

    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Network failure'))

    // Primer intento fallido
    await syncNow()

    expect(getRetryState().hasScheduledRetry).toBe(true)
    expect(getRetryState().attempt).toBe(1)

    // Avanzamos 999ms (aún no debería dispararse el retry de 1000ms)
    vi.advanceTimersByTime(999)
    expect(mockedPush).toHaveBeenCalledTimes(1)

    // Completamos el 1s (1000ms): dispara el segundo intento
    await vi.advanceTimersByTimeAsync(1)
    await getCurrentSync()
    expect(mockedPush).toHaveBeenCalledTimes(2)
    expect(getRetryState().attempt).toBe(2)

    // El siguiente delay debe ser de 2000ms (2s)
    vi.advanceTimersByTime(1999)
    expect(mockedPush).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    await getCurrentSync()
    expect(mockedPush).toHaveBeenCalledTimes(3)
  })

  it('resetea el contador de reintentos y cancela timers tras una sincronización exitosa', async () => {
    await db.outbox.add({
      clientOpId: 'op-2',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 2 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    })

    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValueOnce(new Error('Transient failure'))

    // Falla la primera vez -> programa retry a 1s
    await syncNow()
    expect(getRetryState().hasScheduledRetry).toBe(true)
    expect(getRetryState().attempt).toBe(1)

    // El segundo intento (retry) tiene éxito
    mockedPush.mockResolvedValueOnce({ applied: 1, failed: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    await getCurrentSync()

    expect(getRetryState().hasScheduledRetry).toBe(false)
    expect(getRetryState().attempt).toBe(0)
  })

  it('cancela los reintentos al perder la conexión y los reanuda al recuperarla', async () => {
    await db.outbox.add({
      clientOpId: 'op-3',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 3 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    })

    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Network error'))

    const stop = startSync()
    await getCurrentSync()

    // Falla el sync inicial de startSync
    expect(getRetryState().hasScheduledRetry).toBe(true)

    // Se dispara el evento 'offline'
    window.dispatchEvent(new Event('offline'))
    expect(getStatus().online).toBe(false)
    expect(getRetryState().hasScheduledRetry).toBe(false)

    // Avanzamos el tiempo: ningún reintento debe ejecutarse mientras estamos offline
    const previousPushCalls = mockedPush.mock.calls.length
    vi.advanceTimersByTime(10000)
    expect(mockedPush.mock.calls.length).toBe(previousPushCalls)

    // Se dispara el evento 'online': reanuda la sincronización de inmediato
    mockedPush.mockResolvedValueOnce({ applied: 1, failed: 0 })
    window.dispatchEvent(new Event('online'))
    expect(getStatus().online).toBe(true)

    await getCurrentSync()
    expect(mockedPush.mock.calls.length).toBe(previousPushCalls + 1)

    stop()
  })

  it('no programa más reintentos si las operaciones en cola agotaron el tope configurado', async () => {
    setRetryConfig({ maxAttempts: 2 })

    // Entrada que ya agotó los intentos (attempts = 2 >= maxAttempts)
    await db.outbox.add({
      clientOpId: 'op-4',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 4 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 2,
      lastError: 'Permanent failure',
    })

    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Server error'))

    await syncNow()

    // Al no haber items con attempts < maxAttempts, no debe programar retry
    expect(getRetryState().hasScheduledRetry).toBe(false)
  })

  it('evita el solapamiento de dos ciclos de sincronización a la vez', async () => {
    let finishPull!: () => void
    const slowPullPromise = new Promise<{ applied: number; hasMore: boolean }>((resolve) => {
      finishPull = () => resolve({ applied: 0, hasMore: false })
    })

    mockedPull.mockReturnValueOnce(slowPullPromise)
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    const firstRun = syncNow()
    const secondRun = syncNow()

    // Deben retornar la misma promesa en vuelo
    expect(firstRun).toBe(secondRun)

    finishPull()
    await firstRun

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })

  it('permite leer y modificar la configuración de reintentos', () => {
    setRetryConfig({ initialDelayMs: 2000, maxAttempts: 5 })
    expect(getRetryConfig()).toMatchObject({
      initialDelayMs: 2000,
      maxAttempts: 5,
    })
  })

  it('ejecuta syncNow periódicamente según el intervalo configurado', async () => {
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    const stop = startSync()
    await getCurrentSync()
    expect(mockedPush).toHaveBeenCalledTimes(1)

    // Avanzamos 60s (SYNC_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(60000)
    await getCurrentSync()
    expect(mockedPush).toHaveBeenCalledTimes(2)

    stop()
  })
})

