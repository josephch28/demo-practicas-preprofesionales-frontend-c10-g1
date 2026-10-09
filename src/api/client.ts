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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  // Si recibimos 401 y no es ya una petición de login o refresh, intentamos renovar
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = requestTokenRefresh().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    const newAccessToken = await refreshPromise

    if (newAccessToken) {
      // Reintentar la petición original con el nuevo token de acceso
      const retryRes = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newAccessToken}`,
          ...init.headers,
        },
      })
      if (retryRes.ok) {
        return retryRes.json() as Promise<T>
      }
    }

    // Si la renovación no tuvo éxito o el reintento falló con 401, la sesión expiró definitivamente
    notifySessionExpired()
    const body = await res.json().catch(() => ({}))
    throw new ApiError(401, body.message ?? 'sesión expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}
