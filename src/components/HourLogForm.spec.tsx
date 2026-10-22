import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HourLogForm } from './HourLogForm'
import { db } from '@/offline/db'

describe('HourLogForm — componente visual e integración con guardado local', () => {
  beforeEach(async () => {
    await db.hourLogs.clear()
    await db.outbox.clear()
    vi.restoreAllMocks()
  })

  it('renderiza todos los campos del formulario', () => {
    render(<HourLogForm placementId={1} />)

    expect(screen.getByLabelText(/Fecha/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Hora de inicio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Hora de fin/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Horas/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Actividad/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar horas/i })).toBeInTheDocument()
  })

  it('muestra errores de validación si se envía vacío', async () => {
    render(<HourLogForm placementId={1} />)

    fireEvent.click(screen.getByRole('button', { name: /Guardar horas/i }))

    expect(await screen.findByText('La hora de inicio es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('La hora de fin es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('Describe la actividad realizada')).toBeInTheDocument()
    expect(screen.getByText('Ingresa un número de horas válido')).toBeInTheDocument()
  })

  it('guarda el registro en IndexedDB y llama onSaved al enviar datos válidos', async () => {
    const onSaved = vi.fn()
    render(<HourLogForm placementId={99} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText(/Hora de fin/i), { target: { value: '12:00' } })
    fireEvent.change(screen.getByLabelText(/Horas/i), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText(/Actividad/i), { target: { value: 'Refactorización y pruebas' } })

    fireEvent.click(screen.getByRole('button', { name: /Guardar horas/i }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
    })

    const logs = await db.hourLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      placementId: 99,
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Refactorización y pruebas',
      status: 'SUBMITTED',
      syncState: 'queued',
    })

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entity).toBe('hourLog')
    expect(outbox[0].op).toBe('create')
  })

  it('muestra mensaje de error cuando falla la transacción de guardado', async () => {
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('DB failure'))

    render(<HourLogForm placementId={1} />)

    fireEvent.change(screen.getByLabelText(/Hora de inicio/i), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText(/Hora de fin/i), { target: { value: '12:00' } })
    fireEvent.change(screen.getByLabelText(/Horas/i), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText(/Actividad/i), { target: { value: 'Tarea' } })

    fireEvent.click(screen.getByRole('button', { name: /Guardar horas/i }))

    expect(
      await screen.findByText('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.'),
    ).toBeInTheDocument()
  })
})
