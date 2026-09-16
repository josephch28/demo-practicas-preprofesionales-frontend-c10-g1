import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/auth/AuthContext'
import { db, type LocalPlacement } from '@/offline/db'

/**
 * Lee el placement del estudiante autenticado desde Dexie. Nunca hace fetch:
 * los datos ya viven localmente gracias a pull/push, así que la pantalla
 * funciona igual con o sin conexión.
 */
export function usePlacement(): LocalPlacement | null | undefined {
  const { user, role } = useAuth()

  return useLiveQuery(async () => {
    if (!user || role !== 'STUDENT') return null
    const placement = await db.placements.where('studentId').equals(user.id).first()
    return placement ?? null
  }, [user?.id, role])
}
