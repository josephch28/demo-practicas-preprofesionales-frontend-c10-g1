import { validateHoursValue } from '@/offline/hour-log-rules'
import type { FormErrors, HourLogFormValues } from './hour-log-form-state'

export { buildHourLogPushOperation, buildLocalHourLog } from '@/offline/createLocalHourLog'

export function todayAsInputValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateForConfirmation(dateValue: string): string {
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

export function computeDurationLabel(startTime: string, endTime: string): string | null {
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

export function validateHourLogInput(hours: string, startTime: string, endTime: string): string | null {
  if (!hours) return 'Ingresa un número de horas válido'
  const rangeError = validateHoursValue(hours)
  if (rangeError) return rangeError
  if (startTime && endTime && endTime <= startTime) {
    return 'La hora de fin debe ser posterior a la de inicio'
  }
  return null
}

export function validateHourLogForm(values: HourLogFormValues): FormErrors {
  const errors: FormErrors = {}
  if (!values.date) {
    errors.date = 'La fecha es obligatoria'
  }
  if (!values.startTime) {
    errors.startTime = 'La hora de inicio es obligatoria'
  }
  if (!values.endTime) {
    errors.endTime = 'La hora de fin es obligatoria'
  }
  if (!values.activity.trim()) {
    errors.activity = 'Describe la actividad realizada'
  }
  const hoursMessage = validateHourLogInput(values.hours, values.startTime, values.endTime)
  if (hoursMessage) {
    errors.hours = hoursMessage
  }
  return errors
}
