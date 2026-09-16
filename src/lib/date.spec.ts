import { describe, expect, it } from 'vitest'
import { parseLocalDate } from './date'

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
