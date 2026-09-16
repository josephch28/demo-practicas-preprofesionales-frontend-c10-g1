import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { type Role, useAuth } from './AuthContext'

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, role } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
