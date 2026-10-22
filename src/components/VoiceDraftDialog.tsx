import { type FormEvent, useEffect, useState } from 'react'
import {
  validateHourLogForm,
  validateHourLogInput,
} from '@/components/hour-log/hour-log-form-helpers'
import type { FormErrors, HourLogFormValues } from '@/components/hour-log/hour-log-form-state'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createLocalHourLog } from '@/offline/createLocalHourLog'
import type { LocalVoiceNote } from '@/offline/db'
import { validateHoursValue } from '@/offline/hour-log-rules'
import { deleteVoiceNote } from '@/offline/voice/voiceNotes'

export type VoiceDraftFieldName = keyof HourLogFormValues

const DRAFT_FIELDS: VoiceDraftFieldName[] = ['date', 'startTime', 'endTime', 'hours', 'activity']

export interface VoiceDraftDialogProps {
  note: LocalVoiceNote | null
  onClose: () => void
  placementId?: number
}

function readDraftField(
  missing: Set<string>,
  field: VoiceDraftFieldName,
  raw: string | number | undefined,
): string {
  if (missing.has(field) || raw === undefined || raw === null) return ''
  return String(raw)
}

function initialValuesFromNote(note: LocalVoiceNote | null): HourLogFormValues {
  const missing = new Set(note?.missing ?? [])
  const draft = note?.draft

  return {
    date: readDraftField(missing, 'date', draft?.date),
    startTime: readDraftField(missing, 'startTime', draft?.startTime),
    endTime: readDraftField(missing, 'endTime', draft?.endTime),
    hours: readDraftField(missing, 'hours', draft?.hours),
    activity: readDraftField(missing, 'activity', draft?.activity),
  }
}

function isFieldIncomplete(values: HourLogFormValues, field: VoiceDraftFieldName): boolean {
  return values[field].trim().length === 0
}

function computeHoursWarning(values: HourLogFormValues): string | null {
  if (!values.hours) return null
  return (
    validateHoursValue(values.hours) ??
    validateHourLogInput(values.hours, values.startTime, values.endTime)
  )
}

interface DraftFieldProps {
  id: string
  field: VoiceDraftFieldName
  label: string
  type?: 'date' | 'time' | 'number' | 'textarea'
  value: string
  missing: boolean
  error?: string
  warning?: string | null
  onChange: (field: VoiceDraftFieldName, value: string) => void
}

function DraftControl({
  id,
  field,
  type = 'date',
  value,
  missing,
  invalid,
  onChange,
}: {
  id: string
  field: VoiceDraftFieldName
  type?: 'date' | 'time' | 'number' | 'textarea'
  value: string
  missing: boolean
  invalid: boolean
  onChange: (field: VoiceDraftFieldName, value: string) => void
}) {
  const highlight = missing ? 'border-pending bg-chipPending/30 ring-1 ring-pending' : ''
  const missingAttr = missing ? 'true' : undefined

  if (type === 'textarea') {
    return (
      <Textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        aria-invalid={invalid}
        data-missing={missingAttr}
        className={cn(highlight)}
      />
    )
  }

  return (
    <Input
      id={id}
      type={type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      step={type === 'number' ? '0.5' : undefined}
      value={value}
      onChange={(e) => onChange(field, e.target.value)}
      aria-invalid={invalid}
      data-missing={missingAttr}
      className={cn('font-data', type === 'number' && 'tabular-nums', highlight)}
    />
  )
}

function DraftField(props: DraftFieldProps) {
  const { id, field, label, type, value, missing, error, warning, onChange } = props
  const invalid = Boolean(error) || missing

  return (
    <div className="flex flex-col gap-1.5" data-field={id} data-missing={missing ? 'true' : undefined}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {missing ? (
          <span className="font-data text-11 font-semibold text-pending">Falta completar</span>
        ) : null}
      </div>
      <DraftControl
        id={id}
        field={field}
        type={type}
        value={value}
        missing={missing}
        invalid={invalid}
        onChange={onChange}
      />
      {warning && !error ? <p className="text-12 text-pending">{warning}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-12 text-void">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function VoiceDraftDialog({ note, onClose, placementId }: VoiceDraftDialogProps) {
  const [values, setValues] = useState<HourLogFormValues>(() => initialValuesFromNote(note))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setValues(initialValuesFromNote(note))
    setErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [note])

  const missingSet = new Set(note?.missing ?? [])
  const isMissing = (field: VoiceDraftFieldName): boolean =>
    missingSet.has(field) && isFieldIncomplete(values, field)

  const hasAnyIncompleteField = DRAFT_FIELDS.some((field) => isFieldIncomplete(values, field))
  const hoursWarning = computeHoursWarning(values)

  const updateField = (field: VoiceDraftFieldName, nextValue: string) => {
    setValues((prev) => ({ ...prev, [field]: nextValue }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateHourLogForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      await createLocalHourLog({
        placementId,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        hours: Number(values.hours),
        activity: values.activity,
      })
      await deleteVoiceNote(note!.id)
      onClose()
    } catch {
      setSubmitting(false)
      setSubmitError('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.')
    }
  }

  const transcriptText = note?.transcript || 'Sin transcripción disponible'

  return (
    <Dialog open={note !== null} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revisar borrador de horas</DialogTitle>
          <DialogDescription>
            Verifica y corrige los datos antes de confirmar tu registro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} noValidate>
          <DialogBody>
            <div className="rounded-lg border border-line bg-soft px-3.5 py-2.5">
              <p className="font-display text-12 font-semibold text-inkMid">Lo que entendió Yura</p>
              <p className="mt-1 text-13 text-inkBody">{transcriptText}</p>
            </div>

            <DraftField
              id="voicedraft-date"
              field="date"
              label="Fecha"
              type="date"
              value={values.date}
              missing={isMissing('date')}
              error={errors.date}
              onChange={updateField}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DraftField
                id="voicedraft-start"
                field="startTime"
                label="Hora de inicio"
                type="time"
                value={values.startTime}
                missing={isMissing('startTime')}
                error={errors.startTime}
                onChange={updateField}
              />

              <DraftField
                id="voicedraft-end"
                field="endTime"
                label="Hora de fin"
                type="time"
                value={values.endTime}
                missing={isMissing('endTime')}
                error={errors.endTime}
                onChange={updateField}
              />
            </div>

            <DraftField
              id="voicedraft-hours"
              field="hours"
              label="Horas"
              type="number"
              value={values.hours}
              missing={isMissing('hours')}
              error={errors.hours}
              warning={hoursWarning}
              onChange={updateField}
            />

            <DraftField
              id="voicedraft-activity"
              field="activity"
              label="Actividad"
              type="textarea"
              value={values.activity}
              missing={isMissing('activity')}
              error={errors.activity}
              onChange={updateField}
            />

            {submitError ? (
              <p role="alert" className="text-14 text-void">
                {submitError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={hasAnyIncompleteField || submitting}>
              {submitting ? 'Confirmando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
