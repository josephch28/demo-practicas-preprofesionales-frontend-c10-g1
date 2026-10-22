import { ApiError, api } from '@/api/client'
import { db, type LocalVoiceNote, type VoiceNoteDraft } from '@/offline/db'
import { DEFAULT_RETRY_CONFIG } from '@/offline/sync/retry'
import { updateVoiceNote } from './voiceNotes'

export interface VoiceDraftResponse {
  transcript: string
  draft: VoiceNoteDraft
  missing: string[]
  warnings?: string[]
}

export const inFlightVoiceNoteIds = new Set<number>()

function isClientError(err: unknown): err is { statusCode: number; message: string } {
  if (err instanceof ApiError) {
    return err.statusCode >= 400 && err.statusCode < 500
  }
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = (err as { statusCode: unknown }).statusCode
    return typeof code === 'number' && code >= 400 && code < 500
  }
  return false
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

async function processSingleVoiceNote(note: LocalVoiceNote): Promise<void> {
  inFlightVoiceNoteIds.add(note.id)
  try {
    await updateVoiceNote(note.id, { status: 'processing' })

    const formData = new FormData()
    try {
      formData.append('audio', note.audio, 'voice-note.webm')
    } catch {
      formData.append('audio', note.audio)
    }
    formData.append('recordedAt', note.recordedAt)

    const response = await api<VoiceDraftResponse>('/hour-logs/voice-draft', {
      method: 'POST',
      body: formData,
    })

    await updateVoiceNote(note.id, {
      status: 'draft',
      transcript: response.transcript,
      draft: response.draft,
      missing: response.missing,
    })
  } catch (err: unknown) {
    if (isClientError(err)) {
      await updateVoiceNote(note.id, {
        status: 'failed',
        error: getErrorMessage(err, 'Error al interpretar el audio'),
      })
    } else {
      const newAttempts = (note.attempts ?? 0) + 1
      const isExhausted = newAttempts >= DEFAULT_RETRY_CONFIG.maxAttempts
      await updateVoiceNote(note.id, {
        status: isExhausted ? 'failed' : 'pending',
        attempts: newAttempts,
        ...(isExhausted ? { error: getErrorMessage(err, 'Límite de reintentos alcanzado') } : {}),
      })
    }
  } finally {
    inFlightVoiceNoteIds.delete(note.id)
  }
}

export async function processVoiceNotes(): Promise<void> {
  if (!db?.voiceNotes) return

  const pendingNotes = await db.voiceNotes
    .where('status')
    .equals('pending')
    .toArray()

  pendingNotes.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

  for (const note of pendingNotes) {
    if (!inFlightVoiceNoteIds.has(note.id)) {
      await processSingleVoiceNote(note)
    }
  }
}

/**
 * Procesa las notas pendientes sin esperar al ciclo de sincronización (cada
 * 60 s): se usa al terminar una grabación o al reintentar, para que el borrador
 * aparezca enseguida. Sin conexión o sin sesión no hace nada: la nota queda
 * pendiente y la toma el sincronizador al volver la señal.
 */
export async function processVoiceNotesNow(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  if (!localStorage.getItem('access_token')) return
  try {
    await processVoiceNotes()
  } catch (err) {
    console.error('procesamiento inmediato de notas de voz falló', err)
  }
}
