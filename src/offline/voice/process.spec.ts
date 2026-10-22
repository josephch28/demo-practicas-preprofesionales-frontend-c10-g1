import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/api/client'
import { db } from '@/offline/db'
import { inFlightVoiceNoteIds, processVoiceNotes } from './process'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    api: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

function audioBlob(mimeType = 'audio/webm'): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: mimeType })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockedApi.mockReset()
  inFlightVoiceNoteIds.clear()
})

describe('processVoiceNotes', () => {
  it('envía nota pending con FormData y al tener éxito pasa a draft', async () => {
    const id = await db.voiceNotes.add({
      audio: audioBlob(),
      mimeType: 'audio/webm',
      durationMs: 4000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
    })

    const draftResult = {
      transcript: 'Trabajé 4 horas en soporte',
      draft: { date: '2026-10-21', hours: 4, activity: 'Soporte' },
      missing: [],
      warnings: [],
    }
    mockedApi.mockResolvedValueOnce(draftResult)

    await processVoiceNotes()

    expect(mockedApi).toHaveBeenCalledTimes(1)
    const [path, init] = mockedApi.mock.calls[0]
    expect(path).toBe('/hour-logs/voice-draft')
    expect(init?.body).toBeInstanceOf(FormData)
    const formData = init?.body as FormData
    expect(formData.get('recordedAt')).toBe('2026-10-21T10:00:00.000Z')
    expect(formData.get('audio')).toBeDefined()

    const saved = await db.voiceNotes.get(id)
    expect(saved?.status).toBe('draft')
    expect(saved?.transcript).toBe('Trabajé 4 horas en soporte')
    expect(saved?.draft).toEqual(draftResult.draft)
    expect(saved?.missing).toEqual([])
  })

  it('en error de red o 5xx mantiene pending y suma 1 a attempts', async () => {
    const id = await db.voiceNotes.add({
      audio: audioBlob(),
      mimeType: 'audio/webm',
      durationMs: 2000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 1,
    })

    mockedApi.mockRejectedValueOnce(new ApiError(500, 'Error interno del servidor'))

    await processVoiceNotes()

    const saved = await db.voiceNotes.get(id)
    expect(saved?.status).toBe('pending')
    expect(saved?.attempts).toBe(2)
  })

  it('en error 4xx pasa directamente a failed con mensaje legible', async () => {
    const id = await db.voiceNotes.add({
      audio: audioBlob(),
      mimeType: 'audio/webm',
      durationMs: 2000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
    })

    mockedApi.mockRejectedValueOnce(new ApiError(400, 'Audio inaudible'))

    await processVoiceNotes()

    const saved = await db.voiceNotes.get(id)
    expect(saved?.status).toBe('failed')
    expect(saved?.error).toBe('Audio inaudible')
  })

  it('pasa a failed al alcanzar el tope de intentos por fallos continuos', async () => {
    const id = await db.voiceNotes.add({
      audio: audioBlob(),
      mimeType: 'audio/webm',
      durationMs: 2000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 3, // Tope es 4
    })

    mockedApi.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await processVoiceNotes()

    const saved = await db.voiceNotes.get(id)
    expect(saved?.status).toBe('failed')
    expect(saved?.attempts).toBe(4)
    expect(saved?.error).toBe('Failed to fetch')
  })

  it('no procesa una nota dos veces a la vez (evita concurrencia)', async () => {
    const id = await db.voiceNotes.add({
      audio: audioBlob(),
      mimeType: 'audio/webm',
      durationMs: 3000,
      recordedAt: '2026-10-21T10:00:00.000Z',
      status: 'pending',
      attempts: 0,
    })

    inFlightVoiceNoteIds.add(id)

    await processVoiceNotes()

    expect(mockedApi).not.toHaveBeenCalled()
    const saved = await db.voiceNotes.get(id)
    expect(saved?.status).toBe('pending')
  })
})
