import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, onSessionExpired } from '@/api/client'
import { db } from '@/offline/db'

export type Role = 'STUDENT' | 'TUTOR' | 'COMPANY' | 'COORDINATOR'

export interface AuthUser {
  id: number
  email: string
  fullName: string
  role: Role
  // Solo relevante para Role.COMPANY (ver User.companyId en el backend); el
  // resto de roles lo trae null. CompanyOffersPage lo usa para armar
  // CreateOfferDto sin tener que adivinar o listar todas las empresas.
  companyId: number | null
}

interface LoginResponse {
  accessToken: string
  refreshToken?: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  role: Role | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Canal para sincronizar eventos de autenticación entre pestañas del navegador
const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth-channel') : null

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const navigate = useNavigate()

  async function wipeLocalSession(): Promise<void> {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
    await db.delete()
    await db.open()
  }

  // Escuchar cierre de sesión en otras pestañas
  useEffect(() => {
    async function handleStorageEvent(event: StorageEvent) {
      if (event.key === 'access_token' && !event.newValue) {
        await wipeLocalSession()
        navigate('/login')
      }
    }

    async function handleChannelMessage(event: MessageEvent<{ type: string; reason?: string }>) {
      if (event.data?.type === 'LOGOUT') {
        await wipeLocalSession()
        navigate('/login', { state: event.data.reason ? { message: event.data.reason } : undefined })
      }
    }

    const unbindSessionExpired = onSessionExpired(async (msg) => {
      await wipeLocalSession()
      authChannel?.postMessage({ type: 'LOGOUT', reason: msg })
      navigate('/login', { state: { message: msg } })
    })

    window.addEventListener('storage', handleStorageEvent)
    authChannel?.addEventListener('message', handleChannelMessage)

    return () => {
      unbindSessionExpired()
      window.removeEventListener('storage', handleStorageEvent)
      authChannel?.removeEventListener('message', handleChannelMessage)
    }
  }, [navigate])

  async function login(email: string, password: string) {
    const { accessToken, refreshToken, user: loggedUser } = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('access_token', accessToken)
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken)
    }
    localStorage.setItem('user', JSON.stringify(loggedUser))
    setUser(loggedUser)
  }

  // Una máquina de laboratorio compartida es el caso normal de este dominio:
  // si no se borra Dexie, el checkpoint de sync y los datos del estudiante
  // anterior sobreviven a esta sesión y contaminan la del siguiente.
  async function logout() {
    await wipeLocalSession()
    // Notifica a las otras pestañas para que también cierren la sesión inmediatamente
    authChannel?.postMessage({ type: 'LOGOUT' })
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
