import '@/test-utils/node-blob'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/offline/db'
import { addVoiceNote, deleteVoiceNote, updateVoiceNote } from '@/offline/voice/voiceNotes'
import { useVoiceNotes } from './useVoiceNotes'

const audio = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
const newNote = (recordedAt: string) => ({ audio: audio(), mimeType: 'audio/webm', durationMs: 1000, recordedAt })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('useVoiceNotes', () => {
  it('empieza en undefined mientras Dexie responde y luego devuelve la lista vacía', async () => {
    const { result } = renderHook(() => useVoiceNotes())

    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('devuelve las notas de la más reciente a la más antigua', async () => {
    await addVoiceNote(newNote('2026-04-02T10:00:00.000Z'))
    await addVoiceNote(newNote('2026-04-03T10:00:00.000Z'))
    await addVoiceNote(newNote('2026-04-01T10:00:00.000Z'))

    const { result } = renderHook(() => useVoiceNotes())

    await waitFor(() => expect(result.current).toHaveLength(3))
    expect(result.current?.map((n) => n.recordedAt)).toEqual([
      '2026-04-03T10:00:00.000Z',
      '2026-04-02T10:00:00.000Z',
      '2026-04-01T10:00:00.000Z',
    ])
  })

  it('se actualiza sola al agregar, modificar y borrar una nota', async () => {
    const { result } = renderHook(() => useVoiceNotes())
    await waitFor(() => expect(result.current).toEqual([]))

    let id = 0
    await act(async () => {
      id = await addVoiceNote(newNote('2026-04-01T10:00:00.000Z'))
    })
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]).toMatchObject({ id, status: 'pending', attempts: 0 })

    await act(async () => {
      await updateVoiceNote(id, { status: 'processing', attempts: 1 })
    })
    await waitFor(() => expect(result.current?.[0]).toMatchObject({ status: 'processing', attempts: 1 }))

    await act(async () => {
      await deleteVoiceNote(id)
    })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('coloca arriba una nota nueva más reciente que las que ya estaban', async () => {
    await addVoiceNote(newNote('2026-04-01T10:00:00.000Z'))
    const { result } = renderHook(() => useVoiceNotes())
    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await addVoiceNote(newNote('2026-04-05T10:00:00.000Z'))
    })

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current?.[0].recordedAt).toBe('2026-04-05T10:00:00.000Z')
  })
})