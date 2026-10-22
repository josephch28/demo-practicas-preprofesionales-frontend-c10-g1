import type { LocalVoiceNote } from '@/offline/db'
import { useVoiceNotes } from '@/offline/hooks/useVoiceNotes'
import { Section } from '@/components/Panel'
import { VoiceNoteRow } from './voice/VoiceNoteRow'

export interface VoiceNotesPanelProps {
  onReview: (note: LocalVoiceNote) => void
  notes?: LocalVoiceNote[]
}

export function VoiceNotesPanel({ onReview, notes: propNotes }: VoiceNotesPanelProps) {
  const liveNotes = useVoiceNotes()
  const notes = propNotes ?? liveNotes

  if (!notes || notes.length === 0) {
    return null
  }

  return (
    <Section
      title="Notas de voz"
      aside={
        <span className="font-data text-12 text-inkSoft">
          {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
        </span>
      }
      className="mb-4"
    >
      <div className="flex flex-col">
        {notes.map((note) => (
          <VoiceNoteRow key={note.id} note={note} onReview={onReview} />
        ))}
      </div>
    </Section>
  )
}
