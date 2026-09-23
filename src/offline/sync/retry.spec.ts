import { describe, expect, it } from 'vitest'
import { computeBackoffDelay, DEFAULT_RETRY_CONFIG } from './retry'

describe('computeBackoffDelay', () => {
  it('calcula esperas crecientes con los valores por defecto (1s, 2s, 4s, 8s)', () => {
    expect(computeBackoffDelay(0)).toBe(1000)
    expect(computeBackoffDelay(1)).toBe(2000)
    expect(computeBackoffDelay(2)).toBe(4000)
    expect(computeBackoffDelay(3)).toBe(8000)
  })

  it('respeta el tope máximo configurable (maxDelayMs)', () => {
    const config = { initialDelayMs: 1000, backoffFactor: 2, maxDelayMs: 5000 }
    expect(computeBackoffDelay(0, config)).toBe(1000)
    expect(computeBackoffDelay(1, config)).toBe(2000)
    expect(computeBackoffDelay(2, config)).toBe(4000)
    expect(computeBackoffDelay(3, config)).toBe(5000)
    expect(computeBackoffDelay(10, config)).toBe(5000)
  })

  it('permite personalizar el delay inicial y el factor de backoff', () => {
    const config = { initialDelayMs: 500, backoffFactor: 3 }
    expect(computeBackoffDelay(0, config)).toBe(500)
    expect(computeBackoffDelay(1, config)).toBe(1500)
    expect(computeBackoffDelay(2, config)).toBe(4500)
  })

  it('maneja intentos negativos o decimales de forma segura', () => {
    expect(computeBackoffDelay(-1)).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs)
    expect(computeBackoffDelay(1.8)).toBe(2000)
  })
})
