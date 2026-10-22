import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processVoiceNotesNow } from '@/offline/voice/process'
import { addVoiceNote } from '@/offline/voice/voiceNotes'
import { MAX_RECORDING_MS, useVoiceRecorder, VOICE_RECORDER_MESSAGES as MESSAGES } from './useVoiceRecorder'

vi.mock('@/offline/voice/voiceNotes', () => ({ addVoiceNote: vi.fn() }))
vi.mock('@/offline/voice/process', () => ({ processVoiceNotesNow: vi.fn() }))

const addVoiceNoteMock = vi.mocked(addVoiceNote)
const processNowMock = vi.mocked(processVoiceNotesNow)

let supportedTypes: string[] = []
const instances: FakeMediaRecorder[] = []

class FakeMediaRecorder {
  static isTypeSupported(type: string) {
    return supportedTypes.includes(type)
  }

  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  options: { mimeType: string }

  constructor(_stream: MediaStream, options: { mimeType: string }) {
    this.options = options
    instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio']) })
    this.onstop?.()
  }
}

const track = { stop: vi.fn() }
const getUserMedia = vi.fn()
const fetchMock = vi.fn()

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true })
}

const lastRecorder = () => instances[instances.length - 1]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-01T10:00:00.000Z'))
  instances.length = 0
  supportedTypes = ['audio/webm', 'audio/mp4']
  track.stop.mockClear()
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [track] })
  addVoiceNoteMock.mockReset().mockResolvedValue(1)
  processNowMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('fetch', fetchMock)
  setMediaDevices({ getUserMedia })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

async function startRecording() {
  const hook = renderHook(() => useVoiceRecorder())
  await act(async () => {
    await hook.result.current.start()
  })
  return hook
}

describe('useVoiceRecorder · flujo feliz', () => {
  it('empieza en reposo y pasa a grabando al pedir el micrófono', async () => {
    const { result } = await startRecording()

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(result.current.state).toBe('recording')
    expect(result.current.errorMessage).toBeNull()
  })

  it('cuenta el tiempo transcurrido mientras graba', async () => {
    const { result } = await startRecording()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.elapsedMs).toBe(3000)
  })

  it('al detener guarda la nota pending con recordedAt del inicio y su duración', async () => {
    const { result } = await startRecording()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4200)
    })

    await act(async () => {
      result.current.stop()
    })

    expect(addVoiceNoteMock).toHaveBeenCalledTimes(1)
    const note = addVoiceNoteMock.mock.calls[0][0]
    expect(note).toMatchObject({ mimeType: 'audio/webm', durationMs: 4200, recordedAt: '2026-04-01T10:00:00.000Z' })
    expect(note.audio.size).toBeGreaterThan(0)
    expect(result.current.state).toBe('idle')
    expect(result.current.elapsedMs).toBe(0)
  })

  it('al guardar la nota pide procesarla de inmediato, sin esperar al ciclo de sincronización', async () => {
    const { result } = await startRecording()

    await act(async () => {
      result.current.stop()
    })

    expect(processNowMock).toHaveBeenCalledTimes(1)
    expect(addVoiceNoteMock.mock.invocationCallOrder[0]).toBeLessThan(processNowMock.mock.invocationCallOrder[0])
  })

  it('libera el micrófono al terminar', async () => {
    const { result } = await startRecording()

    await act(async () => {
      result.current.stop()
    })

    expect(track.stop).toHaveBeenCalled()
  })

  it('no hace ninguna petición de red', async () => {
    const { result } = await startRecording()
    await act(async () => {
      result.current.stop()
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignora un segundo start mientras ya está grabando', async () => {
    const { result } = await startRecording()

    await act(async () => {
      await result.current.start()
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})

describe('useVoiceRecorder · tope de 60 segundos', () => {
  it('se detiene sola y guarda lo grabado', async () => {
    const { result } = await startRecording()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS)
    })

    expect(addVoiceNoteMock).toHaveBeenCalledTimes(1)
    expect(addVoiceNoteMock.mock.calls[0][0].durationMs).toBe(60_000)
    expect(result.current.state).toBe('idle')
    expect(track.stop).toHaveBeenCalled()
  })

  it('no se detiene antes de tiempo', async () => {
    const { result } = await startRecording()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS - 1000)
    })

    expect(result.current.state).toBe('recording')
    expect(addVoiceNoteMock).not.toHaveBeenCalled()
  })
})

describe('useVoiceRecorder · formato', () => {
  it('prefiere audio/webm cuando el navegador lo soporta', async () => {
    await startRecording()

    expect(lastRecorder().options.mimeType).toBe('audio/webm')
  })

  it('usa audio/mp4 si no hay webm (Safari)', async () => {
    supportedTypes = ['audio/mp4']
    const { result } = await startRecording()

    await act(async () => {
      result.current.stop()
    })

    expect(lastRecorder().options.mimeType).toBe('audio/mp4')
    expect(addVoiceNoteMock.mock.calls[0][0].mimeType).toBe('audio/mp4')
  })

  it('con un formato no soportado muestra el error y ni siquiera pide el micrófono', async () => {
    supportedTypes = []
    const { result } = await startRecording()

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe(MESSAGES.unsupportedFormat)
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})

describe('useVoiceRecorder · errores', () => {
  it.each([
    ['NotAllowedError', MESSAGES.denied],
    ['SecurityError', MESSAGES.denied],
    ['NotFoundError', MESSAGES.noMicrophone],
    ['NotReadableError', MESSAGES.busy],
    ['UnknownError', MESSAGES.generic],
  ])('si getUserMedia falla con %s muestra el mensaje en español', async (name, message) => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name }))

    const { result } = await startRecording()

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe(message)
    expect(addVoiceNoteMock).not.toHaveBeenCalled()
  })

  it('sin MediaRecorder en el navegador', async () => {
    vi.stubGlobal('MediaRecorder', undefined)

    const { result } = await startRecording()

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe(MESSAGES.unsupportedBrowser)
  })

  it('sin mediaDevices (p. ej. página sin HTTPS)', async () => {
    setMediaDevices(undefined)

    const { result } = await startRecording()

    expect(result.current.errorMessage).toBe(MESSAGES.unsupportedBrowser)
  })

  it('después de un error se puede volver a intentar y el mensaje desaparece', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    const { result } = await startRecording()
    expect(result.current.state).toBe('error')

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('recording')
    expect(result.current.errorMessage).toBeNull()
  })

  it('si falla el guardado, avisa y libera el micrófono', async () => {
    addVoiceNoteMock.mockRejectedValue(new Error('quota'))
    const { result } = await startRecording()

    await act(async () => {
      result.current.stop()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe(MESSAGES.saveFailed)
    expect(processNowMock).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('si la grabación queda vacía, avisa, no guarda y libera el micrófono', async () => {
    const { result } = await startRecording()
    lastRecorder().stop = function (this: FakeMediaRecorder) {
      this.state = 'inactive'
      this.onstop?.()
    }

    await act(async () => {
      result.current.stop()
    })

    expect(result.current.errorMessage).toBe(MESSAGES.empty)
    expect(addVoiceNoteMock).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('si el recorder falla a mitad de la grabación, avisa y libera el micrófono', async () => {
    const { result } = await startRecording()

    await act(async () => {
      lastRecorder().onerror?.()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.errorMessage).toBe(MESSAGES.generic)
    expect(track.stop).toHaveBeenCalled()
  })
})

describe('useVoiceRecorder · liberación del micrófono', () => {
  it('al salir de la pantalla grabando, suelta el micrófono y no guarda nada', async () => {
    const { unmount } = await startRecording()

    unmount()

    expect(track.stop).toHaveBeenCalled()
    expect(addVoiceNoteMock).not.toHaveBeenCalled()
  })

  it('si el permiso se resuelve después de salir de la pantalla, suelta el micrófono', async () => {
    let grant: (stream: unknown) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((resolve) => (grant = resolve)))
    const { result, unmount } = renderHook(() => useVoiceRecorder())
    act(() => {
      result.current.start()
    })

    unmount()
    await act(async () => grant({ getTracks: () => [track] }))

    expect(track.stop).toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })
})