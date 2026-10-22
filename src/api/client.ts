const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type SessionExpiredListener = (message?: string) => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

export function notifySessionExpired(message = 'Tu sesión ha caducado. Por favor, inicia sesión de nuevo.'): void {
  for (const listener of sessionExpiredListeners) {
    listener(message)
  }
}

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function requestTokenRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    if (data.accessToken) {
      localStorage.setItem('access_token', data.accessToken)
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken)
      }
      return data.accessToken
    }
    return null
  } catch {
    return null
  }
}

function buildHeaders(init: RequestInit, token: string | null): HeadersInit {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  }
}

function shouldRefreshToken(status: number, path: string): boolean {
  return status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')
}

async function handleUnauthorized<T>(path: string, init: RequestInit, res: Response): Promise<T> {
  if (!isRefreshing) {
    isRefreshing = true
    refreshPromise = requestTokenRefresh().finally(() => {
      isRefreshing = false
      refreshPromise = null
    })
  }

  const newAccessToken = await refreshPromise

  if (newAccessToken) {
    const retryRes = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: buildHeaders(init, newAccessToken),
    })
    if (retryRes.ok) {
      return retryRes.json() as Promise<T>
    }
  }

  notifySessionExpired()
  const body = await res.json().catch(() => ({}))
  throw new ApiError(401, body.message ?? 'sesión expirada')
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, token),
  })

  if (shouldRefreshToken(res.status, path)) {
    return handleUnauthorized<T>(path, init, res)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}
