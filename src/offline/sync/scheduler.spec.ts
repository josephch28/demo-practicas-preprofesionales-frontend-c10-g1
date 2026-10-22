import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { processVoiceNotes } from '@/offline/voice/process'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import { startSync, syncNow, syncSoon } from './scheduler'
import { getStatus } from './status'

vi.mock('./pull', () => ({ pullChanges: vi.fn() }))
vi.mock('./push', () => ({ pushOutbox: vi.fn() }))
vi.mock('@/offline/voice/process', () => ({ processVoiceNotes: vi.fn() }))

const mockedPull = vi.mocked(pullChanges)
const mockedPush = vi.mocked(pushOutbox)
const mockedProcessVoiceNotes = vi.mocked(processVoiceNotes)

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  mockedPull.mockReset()
  mockedPush.mockReset()
  mockedProcessVoiceNotes.mockReset()
})

describe('syncNow', () => {
  it('no sincroniza sin sesión activa', async () => {
    await syncNow()

    expect(mockedPull).not.toHaveBeenCalled()
    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('hace pull hasta agotar hasMore y luego push cuando hay sesión', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull
      .mockResolvedValueOnce({ applied: 1, hasMore: true })
      .mockResolvedValueOnce({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await syncNow()

    expect(mockedPull).toHaveBeenCalledTimes(2)
    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(getStatus().syncing).toBe(false)
  })

  it('reutiliza la corrida en curso si ya hay una sincronización en vuelo', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await Promise.all([syncNow(), syncNow()])

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })

  it('atrapa errores de red y deja de sincronizar sin propagar la excepción', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockRejectedValue(new Error('sin conexión'))

    await expect(syncNow()).resolves.toBeUndefined()
    expect(getStatus().syncing).toBe(false)
  })

  it('invoca processVoiceNotes después de push y cierra el estado con lastSyncAt', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await syncNow()

    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(mockedProcessVoiceNotes).toHaveBeenCalledTimes(1)
    expect(getStatus().syncing).toBe(false)
    expect(getStatus().lastSyncAt).not.toBeNull()
  })

  it('cierra el estado atómico con éxito aunque processVoiceNotes lance una excepción', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })
    mockedProcessVoiceNotes.mockRejectedValueOnce(new Error('error en audio'))

    await syncNow()

    expect(getStatus().syncing).toBe(false)
    expect(getStatus().lastSyncAt).not.toBeNull()
  })

  it('el contador de pendientes del indicador de sync solo cuenta la cola de outbox y no notas de voz', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await db.voiceNotes.add({
      audio: new Blob(['audio'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 2000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
    })

    await syncNow()

    expect(getStatus().pending).toBe(0)
  })
})

describe('startSync', () => {
  it('registra los listeners de online/offline y los retira al desmontar', () => {
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const stop = startSync()
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    stop()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})

describe('syncSoon', () => {
  beforeEach(() => {
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })
  })

  it('con conexión y sesión sincroniza de inmediato', async () => {
    localStorage.setItem('access_token', 'tok')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    await syncSoon()

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })

  it('sin conexión no hace nada: el cambio espera al siguiente ciclo', async () => {
    localStorage.setItem('access_token', 'tok')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await syncSoon()

    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('sin sesión no hace nada', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    await syncSoon()

    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('si ya hay una corrida en curso pide una más al terminar, una sola aunque se llame varias veces', async () => {
    localStorage.setItem('access_token', 'tok')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    let release: () => void = () => undefined
    mockedPush.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ applied: 0, failed: 0 }) }))

    const first = syncNow()
    const second = syncSoon()
    const third = syncSoon()
    await vi.waitFor(() => expect(mockedPush).toHaveBeenCalledTimes(1))
    release()
    await Promise.all([first, second, third])

    expect(mockedPush).toHaveBeenCalledTimes(2)
  })
})
