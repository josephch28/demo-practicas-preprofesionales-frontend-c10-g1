import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { LocalVoiceNote } from '@/offline/db'
import { processVoiceNotesNow } from '@/offline/voice/process'
import { deleteVoiceNote, updateVoiceNote } from '@/offline/voice/voiceNotes'
import {
  STATUS_LABELS,
  formatAudioDuration,
  formatVoiceNoteDate,
} from './voice-note-helpers'

interface VoiceNoteRowProps {
  note: LocalVoiceNote
  onReview: (note: LocalVoiceNote) => void
}

export function VoiceNoteRow({ note, onReview }: VoiceNoteRowProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
    }
  }, [note.id])

  const handlePlayToggle = () => {
    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
      return
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
    }

    const url = URL.createObjectURL(note.audio)
    audioUrlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio

    audio.onended = () => {
      setIsPlaying(false)
      URL.revokeObjectURL(url)
      audioUrlRef.current = null
    }

    audio.play().catch(() => {
      setIsPlaying(false)
      URL.revokeObjectURL(url)
      audioUrlRef.current = null
    })

    setIsPlaying(true)
  }

  const handleRetry = async () => {
    await updateVoiceNote(note.id, { status: 'pending', attempts: 0 })
    void processVoiceNotesNow()
  }

  const handleDiscard = async () => {
    await deleteVoiceNote(note.id)
  }

  return (
    <div className="flex flex-col gap-2 border-b border-paperRule px-[18px] py-3 transition-colors hover:bg-well sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="font-data text-13 text-inkSoft">
          {formatVoiceNoteDate(note.recordedAt)}
        </span>
        <span className="font-data text-13 font-medium text-ink">
          {formatAudioDuration(note.durationMs)}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-13">
          <span className="text-inkBody">{STATUS_LABELS[note.status]}</span>
          {note.status === 'failed' && note.error ? (
            <span className="text-void">({note.error})</span>
          ) : null}
        </div>
      </div>

      {confirmingDiscard ? (
        <div role="group" aria-label="Confirmar descarte" className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-ink">¿Descartar esta nota?</span>
          <Button type="button" variant="destructive" size="sm" onClick={handleDiscard}>
            Sí, descartar
          </Button>
          <Button type="button" variant="outline" size="sm" autoFocus onClick={() => setConfirmingDiscard(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePlayToggle}>
            {isPlaying ? 'Pausar' : 'Reproducir'}
          </Button>

          {note.status === 'draft' ? (
            <Button type="button" size="sm" onClick={() => onReview(note)}>
              Revisar
            </Button>
          ) : null}

          {note.status === 'failed' ? (
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              Reintentar
            </Button>
          ) : null}

          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDiscard(true)}>
            Descartar
          </Button>
        </div>
      )}
    </div>
  )
}
