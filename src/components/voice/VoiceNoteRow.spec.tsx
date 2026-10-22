import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalVoiceNote } from '@/offline/db'
import { processVoiceNotesNow } from '@/offline/voice/process'
import { VoiceNoteRow } from './VoiceNoteRow'

const { deleteVoiceNoteMock, updateVoiceNoteMock } = vi.hoisted(() => ({
  deleteVoiceNoteMock: vi.fn().mockResolvedValue(undefined),
  updateVoiceNoteMock: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/offline/voice/process', () => ({ processVoiceNotesNow: vi.fn() }))

vi.mock('@/offline/voice/voiceNotes', () => ({
  deleteVoiceNote: (...args: unknown[]) => deleteVoiceNoteMock(...args),
  updateVoiceNote: (...args: unknown[]) => updateVoiceNoteMock(...args),
}))

const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-audio-url')
const revokeObjectURLMock = vi.fn()

const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()

class AudioMock {
  src = ''
  onended: (() => void) | null = null
  play = playMock
  pause = pauseMock
  constructor(src?: string) {
    this.src = src ?? ''
  }
}

function makeNote(overrides: Partial<LocalVoiceNote> = {}): LocalVoiceNote {
  return {
    id: 42,
    audio: new Blob(['audio-content'], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    durationMs: 4200,
    recordedAt: '2026-10-21T10:00:00.000Z',
    status: 'pending',
    attempts: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLMock, revokeObjectURL: revokeObjectURLMock })
  vi.stubGlobal('Audio', AudioMock)
})

describe('VoiceNoteRow', () => {
  it('renderiza fecha, duración y estado pending', () => {
    render(<VoiceNoteRow note={makeNote({ status: 'pending', durationMs: 5000 })} onReview={vi.fn()} />)
    expect(screen.getByText('0:05')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de interpretar (sin señal)')).toBeInTheDocument()
  })

  it('renderiza estado processing', () => {
    render(<VoiceNoteRow note={makeNote({ status: 'processing' })} onReview={vi.fn()} />)
    expect(screen.getByText('Interpretando…')).toBeInTheDocument()
  })

  it('renderiza estado draft con botón Revisar y llama onReview al pulsar', () => {
    const onReview = vi.fn()
    const note = makeNote({ status: 'draft' })
    render(<VoiceNoteRow note={note} onReview={onReview} />)

    expect(screen.getByText('Borrador listo')).toBeInTheDocument()
    const reviewBtn = screen.getByRole('button', { name: 'Revisar' })
    fireEvent.click(reviewBtn)
    expect(onReview).toHaveBeenCalledWith(note)
  })

  it('renderiza estado failed con motivo y permite reintentar devolviendo a pending', async () => {
    const note = makeNote({ status: 'failed', attempts: 2, error: 'Ruido excesivo' })
    render(<VoiceNoteRow note={note} onReview={vi.fn()} />)

    expect(screen.getByText('No se pudo interpretar')).toBeInTheDocument()
    expect(screen.getByText('(Ruido excesivo)')).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: 'Reintentar' })
    fireEvent.click(retryBtn)
    expect(updateVoiceNoteMock).toHaveBeenCalledWith(42, { status: 'pending', attempts: 0 })
    await waitFor(() => expect(processVoiceNotesNow).toHaveBeenCalled())
  })

  it('descartar pide confirmación en la propia fila, sin usar el diálogo del navegador, y borra al confirmar', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<VoiceNoteRow note={makeNote({ id: 99 })} onReview={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(deleteVoiceNoteMock).not.toHaveBeenCalled()
    expect(screen.getByText('¿Descartar esta nota?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }))
    expect(deleteVoiceNoteMock).toHaveBeenCalledWith(99)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('no borra si se cancela el descarte y vuelven las acciones de la fila', () => {
    render(<VoiceNoteRow note={makeNote({ id: 99 })} onReview={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(deleteVoiceNoteMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument()
    expect(screen.queryByText('¿Descartar esta nota?')).not.toBeInTheDocument()
  })

  it('reproduce el audio con createObjectURL y revoca la URL al desmontar', () => {
    const { unmount } = render(<VoiceNoteRow note={makeNote({ id: 10 })} onReview={vi.fn()} />)

    const playBtn = screen.getByRole('button', { name: 'Reproducir' })
    fireEvent.click(playBtn)

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(playMock).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()

    unmount()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-audio-url')
  })

  it('revoca la URL y vuelve al estado Reproducir cuando el audio termina', () => {
    render(<VoiceNoteRow note={makeNote({ id: 11 })} onReview={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }))
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()

    // Simula evento onended del audio
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-audio-url')
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument()
  })
})
