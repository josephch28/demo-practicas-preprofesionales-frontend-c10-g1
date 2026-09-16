import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { db, type LocalHourLog } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'

interface HourLogFormProps {
  placementId: number
  onSaved?: () => void
}

interface FormErrors {
  date?: string
  startTime?: string
  endTime?: string
  hours?: string
  activity?: string
}

// Fecha de hoy en formato YYYY-MM-DD, tal como la espera un <input type="date">.
function todayAsInputValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Convierte la fecha elegida (YYYY-MM-DD) a una etiqueta legible en español
// para que el estudiante confirme, de un vistazo, qué día está registrando
// antes de guardar. Se recalcula en cada render: no hay useMemo aquí porque
// es una operación barata y el formulario no necesita esa complejidad.
function formatDateForConfirmation(dateValue: string): string {
  if (!dateValue) return ''
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return ''
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

// Duración calculada a partir de la hora de inicio y de fin, para que el
// estudiante pueda comparar contra lo que va a escribir en "Horas" antes de
// guardar. Puramente informativo: no toca las horas que finalmente se
// registran, esas siempre vienen del campo "Horas".
function computeDurationLabel(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
    return null
  }
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const diffMinutes = endMinutes - startMinutes
  if (diffMinutes <= 0) return null
  const diffHours = diffMinutes / 60
  return `Duración calculada: ${diffHours.toFixed(1)} h`
}

// D-06 (copia 3): límite de horas por registro. El DTO del backend acepta
// hasta 12 horas y su propio servicio corta en 10; aquí, en el formulario,
// el tope es 8. Los tres umbrales divergen a propósito y no se unifican.
function validateHoursOnSubmit(hours: string, startTime: string, endTime: string): string | null {
  const hoursValue = Number(hours)
  if (!hours || Number.isNaN(hoursValue)) {
    return 'Ingresa un número de horas válido'
  }
  if (hoursValue <= 0) {
    return 'Las horas deben ser mayores a 0'
  }
  if (hoursValue > 8) {
    return 'No puedes registrar más de 8 horas en un mismo día'
  }
  if (startTime && endTime && endTime <= startTime) {
    return 'La hora de fin debe ser posterior a la de inicio'
  }
  return null
}

// Mismo chequeo que arriba, copiado (no reutilizado) para el aviso que se
// muestra en vivo bajo el campo Horas mientras el estudiante escribe, antes
// de siquiera intentar guardar.
function validateHoursLive(hours: string, startTime: string, endTime: string): string | null {
  const hoursValue = Number(hours)
  if (!hours || Number.isNaN(hoursValue)) {
    return 'Ingresa un número de horas válido'
  }
  if (hoursValue <= 0) {
    return 'Las horas deben ser mayores a 0'
  }
  if (hoursValue > 8) {
    return 'No puedes registrar más de 8 horas en un mismo día'
  }
  if (startTime && endTime && endTime <= startTime) {
    return 'La hora de fin debe ser posterior a la de inicio'
  }
  return null
}

export function HourLogForm({ placementId, onSaved }: HourLogFormProps) {
  const [date, setDate] = useState(todayAsInputValue())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hours, setHours] = useState('')
  const [activity, setActivity] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const confirmationLabel = formatDateForConfirmation(date)
  const durationLabel = computeDurationLabel(startTime, endTime)
  const liveHoursWarning = hours ? validateHoursLive(hours, startTime, endTime) : null

  function resetForm() {
    setDate(todayAsInputValue())
    setStartTime('')
    setEndTime('')
    setHours('')
    setActivity('')
    setErrors({})
  }

  function buildErrors(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!date) {
      nextErrors.date = 'La fecha es obligatoria'
    }
    if (!startTime) {
      nextErrors.startTime = 'La hora de inicio es obligatoria'
    }
    if (!endTime) {
      nextErrors.endTime = 'La hora de fin es obligatoria'
    }
    if (!activity.trim()) {
      nextErrors.activity = 'Describe la actividad realizada'
    }

    const hoursMessage = validateHoursOnSubmit(hours, startTime, endTime)
    if (hoursMessage) {
      nextErrors.hours = hoursMessage
    }

    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors = buildErrors()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)

    // Id local temporal: negativo para no chocar jamás con un id real del
    // servidor (que siempre es positivo). Cuando el servidor confirme el
    // registro, applyResults lo reemplaza; hasta entonces vive solo aquí,
    // en este dispositivo, y la UI nunca lo muestra tal cual.
    const localId = -Date.now()
    const nowIso = new Date().toISOString()
    const hoursValue = Number(hours)
    const trimmedActivity = activity.trim()

    const row: LocalHourLog = {
      id: localId,
      placementId,
      date,
      startTime,
      endTime,
      hours: hoursValue,
      activity: trimmedActivity,
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: nowIso,
      syncState: 'local',
    }

    try {
      // Misma transacción para las dos escrituras: si enqueue() falla, la
      // fila no queda huérfana en 'local' sin que el usuario se entere.
      await db.transaction('rw', [db.hourLogs, db.outbox], async () => {
        // 1) Escribe local primero: esto es lo único que hace falta para que
        // el registro sobreviva a un refresh sin red — no depende de fetch.
        await db.hourLogs.add(row)

        // 2) Encola la operación para cuando haya conexión. enqueue() marca
        // la fila como 'queued' apenas se agrega a la cola de salida.
        await enqueue({
          entity: 'hourLog',
          op: 'create',
          payload: {
            id: row.id,
            placementId: row.placementId,
            date: row.date,
            startTime: row.startTime,
            endTime: row.endTime,
            hours: row.hours,
            activity: row.activity,
            status: row.status,
            reviewNote: row.reviewNote,
            version: row.version,
            updatedAt: row.updatedAt,
          },
          baseVersion: null,
        })
      })

      resetForm()
      onSaved?.()
    } catch {
      setSubmitError('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-date">Fecha</Label>
        <Input
          id="hourlog-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? 'hourlog-date-error' : undefined}
          className="font-data"
        />
        {confirmationLabel ? (
          <p className="font-data text-12 text-inkSoft">{confirmationLabel}</p>
        ) : null}
        {errors.date ? (
          <p id="hourlog-date-error" role="alert" className="text-12 text-void">
            {errors.date}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hourlog-start">Hora de inicio</Label>
          <Input
            id="hourlog-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            aria-invalid={Boolean(errors.startTime)}
            aria-describedby={errors.startTime ? 'hourlog-start-error' : undefined}
            className="font-data"
          />
          {errors.startTime ? (
            <p id="hourlog-start-error" role="alert" className="text-12 text-void">
              {errors.startTime}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hourlog-end">Hora de fin</Label>
          <Input
            id="hourlog-end"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            aria-invalid={Boolean(errors.endTime)}
            aria-describedby={errors.endTime ? 'hourlog-end-error' : undefined}
            className="font-data"
          />
          {errors.endTime ? (
            <p id="hourlog-end-error" role="alert" className="text-12 text-void">
              {errors.endTime}
            </p>
          ) : null}
        </div>
      </div>

      {durationLabel ? (
        <p className="-mt-2 font-data text-12 text-inkSoft">{durationLabel}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-hours">Horas</Label>
        <Input
          id="hourlog-hours"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          aria-invalid={Boolean(errors.hours)}
          aria-describedby={errors.hours ? 'hourlog-hours-error' : undefined}
          className="font-data tabular-nums"
        />
        {liveHoursWarning && !errors.hours ? (
          <p className="text-12 text-pending">{liveHoursWarning}</p>
        ) : null}
        {errors.hours ? (
          <p id="hourlog-hours-error" role="alert" className="text-12 text-void">
            {errors.hours}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-activity">Actividad</Label>
        <Textarea
          id="hourlog-activity"
          value={activity}
          onChange={(event) => setActivity(event.target.value)}
          aria-invalid={Boolean(errors.activity)}
          aria-describedby={errors.activity ? 'hourlog-activity-error' : undefined}
          rows={3}
          placeholder="Qué hiciste durante este bloque de horas"
        />
        {errors.activity ? (
          <p id="hourlog-activity-error" role="alert" className="text-12 text-void">
            {errors.activity}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" className="text-14 text-void">
          {submitError}
        </p>
      ) : null}

      <p className="text-12 text-inkSoft">
        Se guarda en este dispositivo aunque no tengas conexión. Se sincroniza solo cuando vuelvas a estar en línea
      </p>

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar horas'}
      </Button>
    </form>
  )
}
