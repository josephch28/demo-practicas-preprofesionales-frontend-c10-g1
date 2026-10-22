import { useLiveQuery } from 'dexie-react-hooks'
import type { LocalVoiceNote } from '@/offline/db'
import { listVoiceNotes } from '@/offline/voice/voiceNotes'

export function useVoiceNotes(): LocalVoiceNote[] | undefined {
  return useLiveQuery(() => listVoiceNotes(), [])
}