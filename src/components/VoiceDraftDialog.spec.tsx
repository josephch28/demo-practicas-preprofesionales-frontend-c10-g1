import '@/test-utils/node-blob'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type LocalVoiceNote } from '@/offline/db'
import { HOUR_LOG_RANGE_MESSAGE } from '@/offline/hour-log-rules'
import { VoiceDraftDialog } from './VoiceDraftDialog'

async function seedDraftVoiceNote(
  overrides: Partial<Omit<LocalVoiceNote, 'id'>> = {},
): Promise<LocalVoiceNote> {
  const base: Omit<LocalVoiceNote, 'id'> = {
    audio: new Blob(['audio-test'], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    durationMs: 4200,
    recordedAt: '2026-10-21T16:00:00.000Z',
    status: 'draft',
    attempts: 1,
    transcript: 'Hoy trabajé de ocho a doce en pruebas de integración del módulo de horas',
    draft: {
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Pruebas de integración del módulo de horas',
    },
    missing: [],
    ...overrides,
  }
  const id = await db.voiceNotes.add(base as LocalVoiceNote)
  return { ...base, id }
}

describe('VoiceDraftDialog — revisión y confirmación del borrador de voz (VOZ-06b)', () => {
  beforeEach(async () => {
    await db.hourLogs.clear()
    await db.outbox.clear()
    await db.voiceNotes.clear()
    await db.placements.clear()
    vi.restoreAllMocks()
  })

  it('no muestra el diálogo cuando note es null', () => {
    render(<VoiceDraftDialog note={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el transcript de Yura y los 5 campos precargados y editables', async () => {
    const note = await seedDraftVoiceNote()
    render(<VoiceDraftDialog note={note} onClose={vi.fn()} />)

    expect(
      screen.getByText('Hoy trabajé de ocho a doce en pruebas de integración del módulo de horas'),
    ).toBeInTheDocument()

    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-21')
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('08:00')
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('12:00')
    expect(screen.getByLabelText('Horas')).toHaveValue(4)
    expect(screen.getByLabelText('Actividad')).toHaveValue(
      'Pruebas de integración del módulo de horas',
    )
  })

  it('confirma un borrador completo, crea el registro en la cola de envío y borra la nota de voz', async () => {
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote()

    render(<VoiceDraftDialog note={note} onClose={onClose} placementId={55} />)

    fireEvent.change(screen.getByLabelText('Actividad'), {
      target: { value: 'Pruebas de integración corregidas por el estudiante' },
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const logs = await db.hourLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].id).toBeLessThan(0)
    expect(logs[0]).toMatchObject({
      placementId: 55,
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Pruebas de integración corregidas por el estudiante',
      status: 'SUBMITTED',
      syncState: 'queued',
    })

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entity).toBe('hourLog')
    expect(outbox[0].op).toBe('create')
    expect(outbox[0].payload.id).toBe(logs[0].id)

    const remainingNotes = await db.voiceNotes.toArray()
    expect(remainingNotes).toHaveLength(0)
  })

  it('resalta los campos en missing y mantiene Confirmar deshabilitado hasta completarlos', async () => {
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote({
      draft: {
        date: '2026-10-21',
        startTime: undefined,
        endTime: '12:00',
        hours: 4,
        activity: undefined,
      },
      missing: ['startTime', 'activity'],
    })

    render(<VoiceDraftDialog note={note} onClose={onClose} placementId={10} />)

    const startInput = screen.getByLabelText('Hora de inicio')
    const activityInput = screen.getByLabelText('Actividad')
    const dateInput = screen.getByLabelText('Fecha')
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i })

    expect(startInput).toHaveAttribute('aria-invalid', 'true')
    expect(startInput).toHaveAttribute('data-missing', 'true')
    expect(activityInput).toHaveAttribute('aria-invalid', 'true')
    expect(activityInput).toHaveAttribute('data-missing', 'true')
    expect(dateInput).not.toHaveAttribute('data-missing')
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(startInput, { target: { value: '08:00' } })
    expect(startInput).not.toHaveAttribute('data-missing')
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(activityInput, { target: { value: 'Documentación técnica' } })
    expect(activityInput).not.toHaveAttribute('data-missing')
    expect(confirmBtn).not.toBeDisabled()

    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    expect(await db.hourLogs.count()).toBe(1)
    expect(await db.voiceNotes.count()).toBe(0)
  })

  it('valida el rango de horas con validateHoursValue y muestra el mismo mensaje que el formulario normal', async () => {
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote()

    render(<VoiceDraftDialog note={note} onClose={onClose} />)

    const hoursInput = screen.getByLabelText('Horas')
    fireEvent.change(hoursInput, { target: { value: '12' } })

    expect(screen.getByText(HOUR_LOG_RANGE_MESSAGE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(HOUR_LOG_RANGE_MESSAGE)
    expect(onClose).not.toHaveBeenCalled()
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.voiceNotes.count()).toBe(1)

    fireEvent.change(hoursInput, { target: { value: '4' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra texto alternativo cuando la nota no trae transcript y permite cerrar con Escape', async () => {
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote({ transcript: undefined })

    render(<VoiceDraftDialog note={note} onClose={onClose} />)

    expect(screen.getByText('Sin transcripción disponible')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('al cancelar cierra el diálogo sin crear registros ni borrar la nota de voz', async () => {
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote()

    render(<VoiceDraftDialog note={note} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.voiceNotes.count()).toBe(1)
  })

  it('muestra error si falla la escritura local y conserva la nota de voz', async () => {
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Fallo IndexedDB'))
    const onClose = vi.fn()
    const note = await seedDraftVoiceNote()

    render(<VoiceDraftDialog note={note} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(
      await screen.findByText('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(await db.voiceNotes.count()).toBe(1)
  })
})
