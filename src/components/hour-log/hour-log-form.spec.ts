import { describe, expect, it } from 'vitest'
import {
  buildHourLogPushOperation,
  buildLocalHourLog,
  computeDurationLabel,
  formatDateForConfirmation,
  todayAsInputValue,
  validateHourLogForm,
  validateHourLogInput,
} from './hour-log-form-helpers'
import {
  getInitialFormState,
  type HourLogFormState,
  hourLogFormReducer,
  type HourLogFormValues,
} from './hour-log-form-state'

describe('hour-log-form-helpers — validación y helpers puros', () => {
  it('genera fecha de hoy en formato YYYY-MM-DD', () => {
    expect(todayAsInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formatea la fecha legible en español o vacía si es inválida', () => {
    expect(formatDateForConfirmation('')).toBe('')
    expect(formatDateForConfirmation('invalid')).toBe('')
    expect(formatDateForConfirmation('2026-10-21')).toContain('octubre')
  })

  it('calcula la etiqueta de duración o null si las horas son inconsistentes', () => {
    expect(computeDurationLabel('', '10:00')).toBeNull()
    expect(computeDurationLabel('12:00', '10:00')).toBeNull()
    expect(computeDurationLabel('08:00', '12:30')).toBe('Duración calculada: 4.5 h')
  })

  it('valida input de horas y orden de tiempo', () => {
    expect(validateHourLogInput('', '08:00', '10:00')).toBe('Ingresa un número de horas válido')
    expect(validateHourLogInput('15', '08:00', '10:00')).toContain('las horas deben estar entre')
    expect(validateHourLogInput('4', '12:00', '10:00')).toBe('La hora de fin debe ser posterior a la de inicio')
    expect(validateHourLogInput('4', '08:00', '12:00')).toBeNull()
  })

  it('valida formulario completo y reporta todos los campos obligatorios', () => {
    const invalid: HourLogFormValues = { date: '', startTime: '', endTime: '', hours: '', activity: '   ' }
    const errors = validateHourLogForm(invalid)
    expect(errors.date).toBe('La fecha es obligatoria')
    expect(errors.startTime).toBe('La hora de inicio es obligatoria')
    expect(errors.endTime).toBe('La hora de fin es obligatoria')
    expect(errors.activity).toBe('Describe la actividad realizada')
    expect(errors.hours).toBe('Ingresa un número de horas válido')
  })

  it('acepta formulario válido sin errores', () => {
    const valid: HourLogFormValues = {
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: '4',
      activity: 'Desarrollo de módulos',
    }
    expect(validateHourLogForm(valid)).toEqual({})
  })
})

describe('hour-log-form-helpers — construcción de registro y operación', () => {
  it('construye LocalHourLog con id temporal negativo y campos formateados', () => {
    const values: HourLogFormValues = {
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: '4',
      activity: '  Revisión de PRs  ',
    }
    const row = buildLocalHourLog(42, values, { id: -999, nowIso: '2026-10-21T12:00:00.000Z' })
    expect(row).toEqual({
      id: -999,
      placementId: 42,
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Revisión de PRs',
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: '2026-10-21T12:00:00.000Z',
      syncState: 'local',
    })
  })

  it('construye la operación a encolar en outbox', () => {
    const row = buildLocalHourLog(1, {
      date: '2026-10-21',
      startTime: '09:00',
      endTime: '11:00',
      hours: '2',
      activity: 'Testing',
    }, { id: -123, nowIso: '2026-10-21T00:00:00.000Z' })

    const op = buildHourLogPushOperation(row)
    expect(op).toEqual({
      entity: 'hourLog',
      op: 'create',
      baseVersion: null,
      payload: { ...row, syncState: undefined },
    })
    expect(op.payload.id).toBe(-123)
  })
})

describe('hour-log-form-state — transiciones de estado', () => {
  it('inicia en estado vacío no enviando', () => {
    const state = getInitialFormState()
    expect(state.submitting).toBe(false)
    expect(state.submitError).toBeNull()
    expect(state.startTime).toBe('')
  })

  it('transición SET_FIELD y SET_ERRORS', () => {
    let state = getInitialFormState()
    state = hourLogFormReducer(state, { type: 'SET_FIELD', field: 'activity', value: 'Programación' })
    expect(state.activity).toBe('Programación')

    state = hourLogFormReducer(state, { type: 'SET_ERRORS', errors: { activity: 'Error' } })
    expect(state.errors.activity).toBe('Error')
  })

  it('transición SUBMIT_START, SUBMIT_ERROR, SUBMIT_SUCCESS y RESET', () => {
    let state = getInitialFormState()
    state = hourLogFormReducer(state, { type: 'SUBMIT_START' })
    expect(state.submitting).toBe(true)

    state = hourLogFormReducer(state, { type: 'SUBMIT_ERROR', error: 'Fallo al guardar' })
    expect(state.submitting).toBe(false)
    expect(state.submitError).toBe('Fallo al guardar')

    const dirty: HourLogFormState = { ...state, hours: '5', activity: 'Demo' }
    expect(hourLogFormReducer(dirty, { type: 'SUBMIT_SUCCESS' }).hours).toBe('')
    expect(hourLogFormReducer(dirty, { type: 'RESET' }).activity).toBe('')
  })
})
