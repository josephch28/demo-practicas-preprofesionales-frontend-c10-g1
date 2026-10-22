import { formatShortDate } from '@/lib/date'
import type { VoiceNoteStatus } from '@/offline/db'

export function formatAudioDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatVoiceNoteDate(isoString: string): string {
  return formatShortDate(isoString)
}

export const STATUS_LABELS: Record<VoiceNoteStatus, string> = {
  pending: 'Pendiente de interpretar (sin señal)',
  processing: 'Interpretando…',
  draft: 'Borrador listo',
  failed: 'No se pudo interpretar',
}
