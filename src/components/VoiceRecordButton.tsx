import { Mic, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MAX_RECORDING_MS, useVoiceRecorder, type VoiceRecorderState } from '@/offline/voice/useVoiceRecorder'

const BUTTON_LABEL: Record<VoiceRecorderState, string> = {
  idle: 'Dictar horas',
  error: 'Dictar horas',
  recording: 'Detener',
  saving: 'Guardando…',
}

const STATUS_TEXT: Partial<Record<VoiceRecorderState, string>> = {
  recording: 'Grabando',
  saving: 'Guardando nota…',
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export function VoiceRecordButton() {
  const { state, elapsedMs, start, stop, errorMessage } = useVoiceRecorder()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasSaving = useRef(false)

  useEffect(() => {
    if (wasSaving.current && state !== 'saving') buttonRef.current?.focus()
    wasSaving.current = state === 'saving'
  }, [state])

  const recording = state === 'recording'
  const label = BUTTON_LABEL[state]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {recording ? (
        <span role="timer" className="flex items-center gap-2 font-data text-14 text-ink">
          <span aria-hidden="true" className="inline-block size-2.5 animate-pulse rounded-full bg-void" />
          {formatClock(elapsedMs)} / {formatClock(MAX_RECORDING_MS)}
        </span>
      ) : null}

      <span role="status" className="text-13 text-inkSoft">
        {STATUS_TEXT[state]}
      </span>

      {state === 'error' ? (
        <p role="alert" className="max-w-sm text-13 text-void">
          {errorMessage}
        </p>
      ) : null}

      <Button
        ref={buttonRef}
        type="button"
        variant={recording ? 'destructive' : 'outline'}
        size={recording ? 'lg' : 'default'}
        className={recording ? 'h-12 min-w-36 px-6 text-15' : undefined}
        aria-label={label}
        disabled={state === 'saving'}
        onClick={recording ? stop : start}
      >
        {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        {label}
      </Button>
    </div>
  )
}