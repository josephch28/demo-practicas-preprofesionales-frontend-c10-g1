import { useCallback, useEffect, useRef, useState } from 'react'
import { addVoiceNote } from '@/offline/voice/voiceNotes'

export type VoiceRecorderState = 'idle' | 'recording' | 'saving' | 'error'

export const MAX_RECORDING_MS = 60_000

const TICK_MS = 250

const MIME_TYPES = ['audio/webm', 'audio/mp4']

export const VOICE_RECORDER_MESSAGES = {
  denied: 'No tenemos permiso para usar el micrófono. Actívalo en la configuración del navegador e inténtalo de nuevo.',
  noMicrophone: 'No se encontró un micrófono en este dispositivo.',
  busy: 'No se pudo acceder al micrófono. Revisa que otra aplicación no lo esté usando.',
  unsupportedBrowser: 'Este navegador no permite grabar audio. Prueba con una versión reciente de Chrome, Firefox o Safari.',
  unsupportedFormat: 'Este navegador no soporta un formato de audio compatible.',
  empty: 'La grabación quedó vacía. Inténtalo de nuevo.',
  saveFailed: 'No se pudo guardar la nota de voz en este dispositivo.',
  generic: 'No se pudo grabar el audio. Inténtalo de nuevo.',
} as const

const MICROPHONE_ERRORS: Record<string, string> = {
  NotAllowedError: VOICE_RECORDER_MESSAGES.denied,
  SecurityError: VOICE_RECORDER_MESSAGES.denied,
  NotFoundError: VOICE_RECORDER_MESSAGES.noMicrophone,
  OverconstrainedError: VOICE_RECORDER_MESSAGES.noMicrophone,
  NotReadableError: VOICE_RECORDER_MESSAGES.busy,
  AbortError: VOICE_RECORDER_MESSAGES.busy,
}

function microphoneErrorMessage(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  return MICROPHONE_ERRORS[name] ?? VOICE_RECORDER_MESSAGES.generic
}

type Support = { ok: true; mimeType: string } | { ok: false; message: string }

function checkSupport(): Support {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: VOICE_RECORDER_MESSAGES.unsupportedBrowser }
  }
  const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
  if (!mimeType) return { ok: false, message: VOICE_RECORDER_MESSAGES.unsupportedFormat }
  return { ok: true, mimeType }
}

interface Session {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  mimeType: string
  startedAt: number
  durationMs: number
  stopping: boolean
  tick?: ReturnType<typeof setInterval>
  limit?: ReturnType<typeof setTimeout>
}

function releaseStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function clearTimers(session: Session) {
  clearInterval(session.tick)
  clearTimeout(session.limit)
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sessionRef = useRef<Session | null>(null)
  const startingRef = useRef(false)
  const mountedRef = useRef(true)

  const fail = useCallback((message: string) => {
    if (!mountedRef.current) return
    setErrorMessage(message)
    setElapsedMs(0)
    setState('error')
  }, [])

  const abort = useCallback(
    (session: Session, message: string) => {
      clearTimers(session)
      releaseStream(session.stream)
      if (sessionRef.current === session) sessionRef.current = null
      fail(message)
    },
    [fail],
  )

  const finish = useCallback(
    async (session: Session) => {
      releaseStream(session.stream)
      if (sessionRef.current === session) sessionRef.current = null

      const audio = new Blob(session.chunks, { type: session.mimeType })
      if (audio.size === 0) return fail(VOICE_RECORDER_MESSAGES.empty)

      try {
        await addVoiceNote({
          audio,
          mimeType: session.mimeType,
          durationMs: session.durationMs,
          recordedAt: new Date(session.startedAt).toISOString(),
        })
      } catch {
        return fail(VOICE_RECORDER_MESSAGES.saveFailed)
      }
      if (!mountedRef.current) return
      setElapsedMs(0)
      setState('idle')
    },
    [fail],
  )

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.stopping) return

    clearTimers(session)
    session.stopping = true
    session.durationMs = Math.min(Date.now() - session.startedAt, MAX_RECORDING_MS)
    setElapsedMs(session.durationMs)
    setState('saving')
    try {
      session.recorder.stop()
    } catch {
      abort(session, VOICE_RECORDER_MESSAGES.generic)
    }
  }, [abort])

  const start = useCallback(async () => {
    if (startingRef.current || sessionRef.current) return
    startingRef.current = true
    try {
      setErrorMessage(null)
      setState('idle')

      const support = checkSupport()
      if (!support.ok) return fail(support.message)

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (error) {
        return fail(microphoneErrorMessage(error))
      }
      if (!mountedRef.current) return releaseStream(stream)

      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, { mimeType: support.mimeType })
      } catch {
        releaseStream(stream)
        return fail(VOICE_RECORDER_MESSAGES.generic)
      }

      const session: Session = {
        recorder,
        stream,
        chunks: [],
        mimeType: support.mimeType,
        startedAt: Date.now(),
        durationMs: 0,
        stopping: false,
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) session.chunks.push(event.data)
      }
      recorder.onstop = () => void finish(session)
      recorder.onerror = () => abort(session, VOICE_RECORDER_MESSAGES.generic)

      try {
        recorder.start()
      } catch {
        releaseStream(stream)
        return fail(VOICE_RECORDER_MESSAGES.generic)
      }

      sessionRef.current = session
      session.tick = setInterval(
        () => setElapsedMs(Math.min(Date.now() - session.startedAt, MAX_RECORDING_MS)),
        TICK_MS,
      )
      session.limit = setTimeout(stop, MAX_RECORDING_MS)
      setElapsedMs(0)
      setState('recording')
    } finally {
      startingRef.current = false
    }
  }, [abort, fail, finish, stop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const session = sessionRef.current
      if (!session || session.stopping) return
      sessionRef.current = null
      clearTimers(session)
      session.recorder.onstop = null
      session.recorder.onerror = null
      if (session.recorder.state === 'recording') session.recorder.stop()
      releaseStream(session.stream)
    }
  }, [])

  return { state, elapsedMs, start, stop, errorMessage }
}