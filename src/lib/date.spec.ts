import { describe, expect, it, vi } from 'vitest'
import { formatShortDate, parseLocalDate } from './date'

describe('parseLocalDate', () => {
  it('parses a date-only ISO string as local midnight, not UTC midnight', () => {
    const parsed = parseLocalDate('2026-01-01')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(1)
  })

  it('ignores a time component if present', () => {
    const parsed = parseLocalDate('2026-08-04T15:30:00.000Z')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(7)
    expect(parsed.getDate()).toBe(4)
  })
})

describe('formatShortDate', () => {

  const reference = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })

  it('formatea una fecha ISO con el mismo resultado que el formatter por fila anterior', () => {
    expect(formatShortDate('2026-04-01')).toBe(reference.format(new Date(2026, 3, 1)))
    expect(formatShortDate('2026-08-04T15:30:00.000Z')).toBe(reference.format(new Date(2026, 7, 4)))
  })

  it('devuelve el valor tal cual si no se puede parsear como fecha', () => {
    expect(formatShortDate('no-es-fecha')).toBe('no-es-fecha')
  })

  it('no construye un Intl.DateTimeFormat nuevo en cada llamada', () => {
    const ctor = vi.spyOn(Intl, 'DateTimeFormat')
    try {
      for (let i = 0; i < 100; i++) formatShortDate('2026-04-01')
      expect(ctor).not.toHaveBeenCalled()
    } finally {
      ctor.mockRestore()
    }
  })
})