import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceRecorderState } from '@/offline/voice/useVoiceRecorder'
import { VoiceRecordButton } from './VoiceRecordButton'

const { useVoiceRecorderMock, startMock, stopMock } = vi.hoisted(() => ({
  useVoiceRecorderMock: vi.fn(),
  startMock: vi.fn(),
  stopMock: vi.fn(),
}))

vi.mock('@/offline/voice/useVoiceRecorder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/offline/voice/useVoiceRecorder')>()),
  useVoiceRecorder: () => useVoiceRecorderMock(),
}))

function mockRecorder(state: VoiceRecorderState, extra: { elapsedMs?: number; errorMessage?: string | null } = {}) {
  useVoiceRecorderMock.mockReturnValue({
    state,
    elapsedMs: 0,
    errorMessage: null,
    start: startMock,
    stop: stopMock,
    ...extra,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VoiceRecordButton', () => {
  it('en reposo muestra "Dictar horas" y al hacer clic empieza a grabar', () => {
    mockRecorder('idle')
    render(<VoiceRecordButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Dictar horas' }))

    expect(startMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('grabando muestra el contador y el botón "Detener"', () => {
    mockRecorder('recording', { elapsedMs: 7400 })
    render(<VoiceRecordButton />)

    expect(screen.getByRole('timer')).toHaveTextContent('0:07 / 1:00')
    expect(screen.getByRole('status')).toHaveTextContent('Grabando')

    fireEvent.click(screen.getByRole('button', { name: 'Detener' }))

    expect(stopMock).toHaveBeenCalledTimes(1)
    expect(startMock).not.toHaveBeenCalled()
  })

  it('mientras guarda lo avisa y deshabilita el botón', () => {
    mockRecorder('saving', { elapsedMs: 4000 })
    render(<VoiceRecordButton />)

    expect(screen.getByRole('status')).toHaveTextContent('Guardando nota…')
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })

  it('con error muestra el mensaje y deja reintentar', () => {
    mockRecorder('error', { errorMessage: 'No se encontró un micrófono en este dispositivo.' })
    render(<VoiceRecordButton />)

    expect(screen.getByRole('alert')).toHaveTextContent('No se encontró un micrófono en este dispositivo.')

    fireEvent.click(screen.getByRole('button', { name: 'Dictar horas' }))

    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('devuelve el foco al botón cuando termina de guardar', () => {
    mockRecorder('saving')
    const { rerender } = render(<VoiceRecordButton />)
    expect(document.body).toHaveFocus()

    mockRecorder('idle')
    rerender(<VoiceRecordButton />)

    expect(screen.getByRole('button', { name: 'Dictar horas' })).toHaveFocus()
  })
})