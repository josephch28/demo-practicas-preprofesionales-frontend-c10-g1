import { db, type LocalVoiceNote } from '@/offline/db'

export type NewVoiceNote = Pick<LocalVoiceNote, 'audio' | 'mimeType' | 'durationMs'> & {
  recordedAt?: string
}

export type VoiceNoteChanges = Partial<Omit<LocalVoiceNote, 'id'>>

export function addVoiceNote(input: NewVoiceNote): Promise<number> {
  return db.voiceNotes.add({
    audio: input.audio,
    mimeType: input.mimeType,
    durationMs: input.durationMs,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  })
}

export function listVoiceNotes(): Promise<LocalVoiceNote[]> {
  if (!db?.voiceNotes) return Promise.resolve([])
  return db.voiceNotes.orderBy('recordedAt').reverse().toArray()
}

export async function updateVoiceNote(id: number, changes: VoiceNoteChanges): Promise<boolean> {
  if (!db?.voiceNotes) return false
  const updated = await db.voiceNotes.update(id, changes)
  return updated > 0
}

export function deleteVoiceNote(id: number): Promise<void> {
  if (!db?.voiceNotes) return Promise.resolve()
  return db.voiceNotes.delete(id)
}