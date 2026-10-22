import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LocalVoiceNote } from '@/offline/db'
import { VoiceNotesPanel } from './VoiceNotesPanel'

const { useVoiceNotesMock } = vi.hoisted(() => ({
  useVoiceNotesMock: vi.fn(),
}))

vi.mock('@/offline/hooks/useVoiceNotes', () => ({
  useVoiceNotes: () => useVoiceNotesMock(),
}))

function makeNote(overrides: Partial<LocalVoiceNote> = {}): LocalVoiceNote {
  return {
    id: 1,
    audio: new Blob(['audio-data'], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    durationMs: 4200,
    recordedAt: '2026-10-21T10:00:00.000Z',
    status: 'pending',
    attempts: 0,
    ...overrides,
  }
}

describe('VoiceNotesPanel', () => {
  it('no se muestra si no hay notas (undefined o lista vacía)', () => {
    useVoiceNotesMock.mockReturnValue(undefined)
    const { container: c1 } = render(<VoiceNotesPanel onReview={vi.fn()} />)
    expect(c1).toBeEmptyDOMElement()

    useVoiceNotesMock.mockReturnValue([])
    const { container: c2 } = render(<VoiceNotesPanel onReview={vi.fn()} />)
    expect(c2).toBeEmptyDOMElement()
  })

  it('muestra el panel con el conteo y las filas si hay notas', () => {
    const notes = [
      makeNote({ id: 1, status: 'pending' }),
      makeNote({ id: 2, status: 'draft' }),
    ]
    useVoiceNotesMock.mockReturnValue(notes)

    render(<VoiceNotesPanel onReview={vi.fn()} />)

    expect(screen.getByText('Notas de voz')).toBeInTheDocument()
    expect(screen.getByText('2 notas')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de interpretar (sin señal)')).toBeInTheDocument()
    expect(screen.getByText('Borrador listo')).toBeInTheDocument()
  })

  it('permite pasar notas por prop directamente', () => {
    const notes = [makeNote({ id: 3, status: 'processing' })]
    render(<VoiceNotesPanel onReview={vi.fn()} notes={notes} />)

    expect(screen.getByText('1 nota')).toBeInTheDocument()
    expect(screen.getByText('Interpretando…')).toBeInTheDocument()
  })
})
