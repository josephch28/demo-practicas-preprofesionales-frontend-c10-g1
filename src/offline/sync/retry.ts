export interface RetryConfig {
  initialDelayMs: number
  backoffFactor: number
  maxDelayMs: number
  maxAttempts: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30000,
  maxAttempts: 4,
}

/**
 * Calcula la espera exponencial en milisegundos para un intento dado (0-indexed).
 * Ejemplo con defaults:
 * - Intento 0: 1000ms (1s)
 * - Intento 1: 2000ms (2s)
 * - Intento 2: 4000ms (4s)
 * - Intento 3: 8000ms (8s)
 */
export function computeBackoffDelay(
  attempt: number,
  config: Partial<RetryConfig> = {},
): number {
  const { initialDelayMs, backoffFactor, maxDelayMs } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }

  const safeAttempt = Math.max(0, Math.floor(attempt))
  const delay = initialDelayMs * Math.pow(backoffFactor, safeAttempt)
  return Math.min(delay, maxDelayMs)
}
