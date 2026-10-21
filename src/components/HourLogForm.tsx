import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useHourLogForm } from './hour-log/useHourLogForm'

export interface HourLogFormProps {
  placementId: number
  onSaved?: () => void
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={id} role="alert" className="text-12 text-void">
      {error}
    </p>
  )
}

function TimeRangeFields({
  startTime,
  endTime,
  errors,
  onChange,
}: {
  startTime: string
  endTime: string
  errors: { startTime?: string; endTime?: string }
  onChange: (field: 'startTime' | 'endTime', value: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-start">Hora de inicio</Label>
        <Input
          id="hourlog-start"
          type="time"
          value={startTime}
          onChange={(e) => onChange('startTime', e.target.value)}
          aria-invalid={Boolean(errors.startTime)}
          aria-describedby={errors.startTime ? 'hourlog-start-error' : undefined}
          className="font-data"
        />
        <FieldError id="hourlog-start-error" error={errors.startTime} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-end">Hora de fin</Label>
        <Input
          id="hourlog-end"
          type="time"
          value={endTime}
          onChange={(e) => onChange('endTime', e.target.value)}
          aria-invalid={Boolean(errors.endTime)}
          aria-describedby={errors.endTime ? 'hourlog-end-error' : undefined}
          className="font-data"
        />
        <FieldError id="hourlog-end-error" error={errors.endTime} />
      </div>
    </div>
  )
}

export function HourLogForm({ placementId, onSaved }: HourLogFormProps) {
  const form = useHourLogForm({ placementId, onSaved })

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-date">Fecha</Label>
        <Input
          id="hourlog-date"
          type="date"
          value={form.date}
          onChange={(e) => form.setField('date', e.target.value)}
          aria-invalid={Boolean(form.errors.date)}
          aria-describedby={form.errors.date ? 'hourlog-date-error' : undefined}
          className="font-data"
        />
        {form.confirmationLabel && (
          <p className="font-data text-12 text-inkSoft">{form.confirmationLabel}</p>
        )}
        <FieldError id="hourlog-date-error" error={form.errors.date} />
      </div>

      <TimeRangeFields
        startTime={form.startTime}
        endTime={form.endTime}
        errors={form.errors}
        onChange={form.setField}
      />

      {form.durationLabel && (
        <p className="-mt-2 font-data text-12 text-inkSoft">{form.durationLabel}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-hours">Horas</Label>
        <Input
          id="hourlog-hours"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={form.hours}
          onChange={(e) => form.setField('hours', e.target.value)}
          aria-invalid={Boolean(form.errors.hours)}
          aria-describedby={form.errors.hours ? 'hourlog-hours-error' : undefined}
          className="font-data tabular-nums"
        />
        {form.liveHoursWarning && !form.errors.hours && (
          <p className="text-12 text-pending">{form.liveHoursWarning}</p>
        )}
        <FieldError id="hourlog-hours-error" error={form.errors.hours} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-activity">Actividad</Label>
        <Textarea
          id="hourlog-activity"
          value={form.activity}
          onChange={(e) => form.setField('activity', e.target.value)}
          aria-invalid={Boolean(form.errors.activity)}
          aria-describedby={form.errors.activity ? 'hourlog-activity-error' : undefined}
          rows={3}
          placeholder="Qué hiciste durante este bloque de horas"
        />
        <FieldError id="hourlog-activity-error" error={form.errors.activity} />
      </div>

      <FieldError id="hourlog-submit-error" error={form.submitError ?? undefined} />

      <p className="text-12 text-inkSoft">
        Se guarda en este dispositivo aunque no tengas conexión. Se sincroniza solo cuando vuelvas a estar en línea
      </p>

      <Button type="submit" disabled={form.submitting}>
        {form.submitting ? 'Guardando…' : 'Guardar horas'}
      </Button>
    </form>
  )
}
