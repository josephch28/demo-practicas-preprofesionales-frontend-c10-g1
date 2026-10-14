import { describe, expect, it } from 'vitest'
import {
  HOUR_LOG_MAX_HOURS_PER_DAY,
  HOUR_LOG_MIN_HOURS_PER_DAY,
  HOUR_LOG_RANGE_MESSAGE,
  validateHoursValue,
} from './hour-log-rules'

describe('hour-log-rules — validateHoursValue (E6-01)', () => {
  it('acepta exactamente el minimo', () => {
    expect(validateHoursValue(HOUR_LOG_MIN_HOURS_PER_DAY)).toBeNull()
  })

  it('acepta exactamente el maximo', () => {
    expect(validateHoursValue(HOUR_LOG_MAX_HOURS_PER_DAY)).toBeNull()
  })

  it('acepta un valor intermedio tipico', () => {
    expect(validateHoursValue(4.5)).toBeNull()
  })

  it('rechaza justo debajo del minimo con el mensaje unificado', () => {
    const belowMin = HOUR_LOG_MIN_HOURS_PER_DAY - 0.1
    expect(validateHoursValue(belowMin)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza justo encima del maximo con el mensaje unificado', () => {
    const aboveMax = HOUR_LOG_MAX_HOURS_PER_DAY + 0.1
    expect(validateHoursValue(aboveMax)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza cero', () => {
    expect(validateHoursValue(0)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza valores negativos', () => {
    expect(validateHoursValue(-1)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza un valor claramente por encima (ej. 12)', () => {
    expect(validateHoursValue(12)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza NaN', () => {
    expect(validateHoursValue(Number.NaN)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza Infinity', () => {
    expect(validateHoursValue(Number.POSITIVE_INFINITY)).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza strings no numericos', () => {
    expect(validateHoursValue('abc')).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('rechaza string vacio', () => {
    expect(validateHoursValue('')).toBe(HOUR_LOG_RANGE_MESSAGE)
  })

  it('acepta un string numerico dentro de rango', () => {
    expect(validateHoursValue('4.5')).toBeNull()
  })

  it('el mensaje unificado trae los limites vigentes', () => {
    expect(HOUR_LOG_RANGE_MESSAGE).toContain(String(HOUR_LOG_MIN_HOURS_PER_DAY))
    expect(HOUR_LOG_RANGE_MESSAGE).toContain(String(HOUR_LOG_MAX_HOURS_PER_DAY))
  })

  // El criterio "El usuario recibe el mismo mensaje de error valide quien
  // valide" exige que el texto sea el mismo que el del backend. Ambos usan
  // la plantilla `las horas deben estar entre {MIN} y {MAX}`. Verificamos
  // la forma literal para que un cambio accidental de redaccion rompa el
  // test antes de que lo note un revisor.
  it('coincide palabra por palabra con el mensaje del backend', () => {
    expect(HOUR_LOG_RANGE_MESSAGE).toBe(
      `las horas deben estar entre ${HOUR_LOG_MIN_HOURS_PER_DAY} y ${HOUR_LOG_MAX_HOURS_PER_DAY}`,
    )
  })
})
